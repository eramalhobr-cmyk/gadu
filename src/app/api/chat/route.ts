import { z } from "zod";
import { isAllowed, readBudgets, serverConfig } from "@/lib/config";
import { after } from "next/server";
import { AllProvidersFailed, BudgetReached, routeChat, NoProviderError } from "@/lib/llm/router";
import { complete } from "@/lib/llm/complete";
import type { ProviderId } from "@/lib/llm/types";
import type { ChatTurn } from "@/lib/llm/types";
import { splitMeta, visiblePart } from "@/lib/meta";
import { costUsd } from "@/lib/pricing";
import { blockedTerm, isSensitive } from "@/lib/privacy";
import { accessToken, events, formatEvents, formatMails, GoogleError, googleIntent, inbox } from "@/lib/google";
import { contextBlock, systemPrompt } from "@/lib/prompt";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  message: z.string().trim().min(1).max(4000),
  conversationId: z.number().int().positive().nullable().optional(),
});

// Eventos enviados ao app, um JSON por linha (NDJSON).
type Out =
  | { t: "start"; conversationId: number }
  | { t: "provider"; name: string }
  | { t: "delta"; text: string }
  | { t: "done"; memories: number }
  | { t: "notice"; text: string; kind: "privacy" | "quota" | "engine" | "error" };

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user || !isAllowed(user.email)) return Response.json({ error: "Faça login para continuar." }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Mensagem inválida." }, { status: 400 });
  const message = parsed.data.message;
  const cfg = serverConfig();

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (o: Out) => controller.enqueue(encoder.encode(JSON.stringify(o) + "\n"));
      try {
        // 1. Privacidade: dado sensível não sai daqui e nem é gravado.
        if (isSensitive(message)) {
          send({ t: "notice", kind: "privacy", text: "Percebi um dado sensível nessa mensagem (documento, senha, dado bancário ou de saúde). Pela regra de privacidade, ele não vai para nenhuma IA externa, então não enviei. Pode reescrever sem esse dado?" });
          return;
        }
        // 2. Cota diária (proteção de custo).
        const { data: okQuota } = await supabase.rpc("consume_quota", { p_limit: cfg.dailyLimit });
        if (okQuota === false) {
          send({ t: "notice", kind: "quota", text: `Você chegou ao limite de ${cfg.dailyLimit} mensagens de hoje. O limite volta amanhã e pode ser ajustado nas configurações do servidor.` });
          return;
        }
        // 2b. Teto de gasto mensal.
        const { data: spent } = await supabase.rpc("month_spend");
        if (Number(spent ?? 0) >= cfg.monthlyBudgetUsd) {
          send({ t: "notice", kind: "quota", text: `O teto de gasto do mês (US$ ${cfg.monthlyBudgetUsd.toFixed(2)}) foi atingido. O GaDu volta a responder no próximo mês, ou quando o teto for aumentado.` });
          return;
        }
        // 3. Conversa: usa a existente (se for da pessoa) ou cria uma nova.
        let conversationId = parsed.data.conversationId ?? null;
        let msgCount = 0;
        let hasSummary = false;
        if (conversationId) {
          const { data } = await supabase.from("conversations").select("id, message_count, summary").eq("id", conversationId).maybeSingle();
          if (!data) conversationId = null;
          else { msgCount = Number(data.message_count ?? 0); hasSummary = Boolean(data.summary); }
        }
        if (!conversationId) {
          const { data, error } = await supabase.from("conversations").insert({ title: message.slice(0, 80) }).select("id").single();
          if (error || !data) throw new Error("não consegui criar a conversa");
          conversationId = data.id as number;
        }
        send({ t: "start", conversationId });

        // 4. Contexto: perfil, memória aprovada, histórico recente, conversas antigas relacionadas e gasto por provedor.
        const [profile, memories, history, related, spendRows] = await Promise.all([
          supabase.from("profiles").select("display_name, settings").eq("id", user.id).maybeSingle(),
          supabase.from("memories").select("content, area").eq("status", "approved").order("created_at", { ascending: true }).limit(80),
          supabase.from("messages").select("role, content").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(16),
          relatedQuery(message)
            ? supabase.from("conversations").select("title, summary, updated_at").textSearch("search", relatedQuery(message), { type: "websearch", config: "portuguese" }).not("summary", "is", null).neq("id", conversationId).order("updated_at", { ascending: false }).limit(3)
            : Promise.resolve({ data: [] as { title: string; summary: string; updated_at: string }[] }),
          supabase.rpc("month_spend_by_provider"),
        ]);
        // Limite por provedor: quem passou do limite do mês fica de fora desta resposta.
        const budgets = readBudgets(profile.data?.settings);
        const spentBy: Record<string, number> = {};
        for (const r of (spendRows.data ?? []) as { provider: string; cost_usd: number }[]) spentBy[r.provider] = Number(r.cost_usd);
        const skip = new Set<ProviderId>();
        if ((spentBy.anthropic ?? 0) >= budgets.anthropic) skip.add("anthropic");
        if ((spentBy.gateway ?? 0) >= budgets.gateway) skip.add("gateway");
        const name = String(profile.data?.display_name ?? "").split(" ")[0];
        const blocked: string[] = Array.isArray(profile.data?.settings?.blocked) ? profile.data.settings.blocked : [];
        const turns: ChatTurn[] = [];
        for (const m of (history.data ?? []).reverse()) {
          const role = m.role === "assistant" ? "assistant" : "user";
          if (!turns.length && role !== "user") continue;
          const last = turns[turns.length - 1];
          if (last && last.role === role) last.content += "\n\n" + m.content;
          else turns.push({ role, content: m.content });
        }
        // Fase 2: agenda e e-mails do Google entram no contexto só quando o assunto pede.
        const google = await googleContext(supabase, user.id, message, blocked);
        const lastTurn = turns[turns.length - 1];
        if (lastTurn && lastTurn.role === "user") lastTurn.content += "\n\n" + message;
        else turns.push({ role: "user", content: message });

        // 5. Resposta em streaming, com troca de provedor se o principal cair.
        let full = "";
        let provider = "";
        let usage: { input: number; output: number; cost: number; provider: ProviderId; model: string } | null = null;
        let sent = 0;
        for await (const ev of routeChat({
          system: systemPrompt(),
          context: contextBlock(name, memories.data ?? [], (related.data ?? []) as { title: string; summary: string; updated_at: string }[]) + google,
          turns,
          signal: request.signal,
          onUsage: (u) => {
            usage = {
              input: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
              output: u.output_tokens ?? 0,
              cost: costUsd(u),
              provider: u.provider,
              model: u.model,
            };
          },
        }, skip)) {
          if (ev.type === "provider") {
            provider = `${ev.name} · ${ev.id === "gateway" ? "Vercel" : ev.id === "anthropic" ? "Anthropic" : "Google"}`;
            send({ t: "provider", name: provider });
          } else {
            full += ev.text;
            const vis = visiblePart(full);
            if (vis.length > sent) {
              send({ t: "delta", text: vis.slice(sent) });
              sent = vis.length;
            }
          }
        }

        // 6. Grava a conversa e as memórias propostas (sempre pendentes).
        const { body: answer, memories: proposals } = splitMeta(full);
        await supabase.from("messages").insert([
          { conversation_id: conversationId, role: "user", content: message },
          {
            conversation_id: conversationId, role: "assistant", content: answer || "(sem resposta)", provider,
            input_tokens: (usage as { input: number } | null)?.input ?? null,
            output_tokens: (usage as { output: number } | null)?.output ?? null,
            cost_usd: (usage as { cost: number } | null)?.cost ?? null,
          },
        ]);
        const u = usage as { input: number; output: number; cost: number; provider: ProviderId; model: string } | null;
        if (u) {
          await supabase.from("usage_events").insert({ provider: u.provider, model: u.model.slice(0, 80), kind: "chat", input_tokens: u.input, output_tokens: u.output, cost_usd: u.cost });
        }
        const newCount = msgCount + 2;
        await supabase.from("conversations").update({ updated_at: new Date().toISOString(), message_count: newCount }).eq("id", conversationId);
        // Memória v2: resume a conversa em segundo plano (depois de responder), a cada 6 mensagens.
        if (newCount >= 4 && (!hasSummary || newCount % 6 === 0)) {
          const convId = conversationId;
          after(() => summarize(supabase, convId, skip));
        }
        let added = 0;
        if (proposals.length) {
          const { data: existing } = await supabase.from("memories").select("content");
          const seen = new Set((existing ?? []).map((m) => String(m.content).toLowerCase()));
          const rows = proposals
            .filter((p) => !seen.has(p.content.toLowerCase()) && !blockedTerm(p.content, blocked) && !isSensitive(p.content))
            .map((p) => ({ content: p.content, area: p.area, origin: "Conversa", status: "pending" }));
          if (rows.length) {
            const { error } = await supabase.from("memories").insert(rows);
            if (!error) added = rows.length;
          }
        }
        send({ t: "done", memories: added });
      } catch (e) {
        if (e instanceof BudgetReached) {
          send({ t: "notice", kind: "quota", text: "Os motores de IA chegaram ao limite de gasto que você definiu para este mês. Ajuste os limites em Ajustes para continuar." });
        } else if (e instanceof NoProviderError) {
          send({ t: "notice", kind: "engine", text: "O motor ainda não está configurado neste servidor. Publique na Vercel (usa o AI Gateway) ou cadastre ANTHROPIC_API_KEY." });
        } else if (e instanceof AllProvidersFailed && !request.signal.aborted) {
          const text = {
            auth: "Os motores de IA recusaram a chave de acesso. Confira a chave da Anthropic no servidor.",
            credits: "Os motores de IA estão sem crédito. Adicione crédito na Anthropic ou no AI Gateway da Vercel.",
            busy: "Os motores de IA estão ocupados agora. Tente de novo em alguns segundos.",
            other: "Não consegui responder agora. Tente de novo em instantes.",
          }[e.kind];
          console.error("chat error", e.kind);
          send({ t: "notice", kind: "engine", text });
        } else if (!request.signal.aborted) {
          console.error("chat error", e instanceof Error ? e.message : "unknown");
          send({ t: "notice", kind: "error", text: "Não consegui responder agora. Tente de novo em instantes." });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}

const STOP = new Set("para como mais muito pela pelo isso esta este essa esse estou você voce sobre qual quais quando onde porque também tambem agora ainda depois antes então entao gadu fala falar pode poderia quero queria tenho temos fazer coisa coisas hoje".split(" "));

/** Monta a busca por conversas antigas: palavras relevantes da mensagem, unidas por "or". */
function relatedQuery(message: string): string {
  const words = message
    .toLowerCase()
    .normalize("NFC")
    .match(/[\p{L}\p{N}]{4,}/gu) ?? [];
  const uniq = [...new Set(words.filter((w) => !STOP.has(w)))].slice(0, 8);
  return uniq.join(" or ");
}

type Db = Awaited<ReturnType<typeof supabaseServer>>;

/** Gera ou atualiza o resumo da conversa com o modelo mais barato. Falhas não afetam a conversa. */
async function summarize(supabase: Db, conversationId: number, skip: Set<ProviderId>) {
  try {
    const [{ data: conv }, { data: msgs }] = await Promise.all([
      supabase.from("conversations").select("summary").eq("id", conversationId).maybeSingle(),
      supabase.from("messages").select("role, content").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(30),
    ]);
    const transcript = (msgs ?? []).reverse().map((m) => `${m.role === "user" ? "Pessoa" : "GaDu"}: ${String(m.content).slice(0, 1500)}`).join("\n");
    if (!transcript) return;
    const r = await complete(
      `Resuma a conversa abaixo em português do Brasil, em até 120 palavras, para servir de memória futura do assistente. Inclua decisões, pedidos pendentes, nomes de projetos e datas citadas. Não inclua dados sensíveis (documentos, senhas, dados bancários ou de saúde). Responda só com o resumo, sem título.${conv?.summary ? `\n\nResumo anterior:\n${conv.summary}` : ""}\n\nConversa:\n${transcript}`,
      { maxTokens: 600, skip },
    );
    await supabase.from("conversations").update({ summary: r.text.slice(0, 2000), summary_at: new Date().toISOString() }).eq("id", conversationId);
    await supabase.from("usage_events").insert({ provider: r.provider, model: r.model.slice(0, 80), kind: "summary", input_tokens: r.input, output_tokens: r.output, cost_usd: r.cost });
  } catch (e) {
    console.error("resumo falhou", e instanceof Error ? e.message.slice(0, 200) : "erro");
  }
}

/** Lê agenda e/ou e-mails quando a mensagem pede. Falhas viram um aviso no contexto, nunca derrubam a conversa. */
async function googleContext(supabase: Db, userId: string, message: string, blocked: string[]): Promise<string> {
  const want = googleIntent(message);
  if (!want.agenda && !want.email) return "";
  try {
    const token = await accessToken(supabase, userId);
    // Começo de hoje no horário de Brasília (UTC-3, sem horário de verão).
    const sp = new Date(Date.now() - 3 * 3_600_000);
    const start = new Date(Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate(), 3));
    const end = new Date(start.getTime() + (want.week ? 7 : 2) * 86_400_000);
    const hide = (t: string) => isSensitive(t) || Boolean(blockedTerm(t, blocked));
    const [ev, mails] = await Promise.all([
      want.agenda ? events(token, start, end) : Promise.resolve(null),
      want.email ? inbox(token) : Promise.resolve(null),
    ]);
    const parts = [ev ? formatEvents(ev) : "", mails ? formatMails(mails, hide) : ""].filter(Boolean);
    return `\n\nDados do Google (lidos agora, só leitura):\n${parts.join("\n\n")}`;
  } catch (e) {
    if (e instanceof GoogleError && e.kind === "not_connected") {
      return "\n\nDados do Google: a conta Google não está conectada. Se a pessoa pedir agenda ou e-mails, diga que ela pode conectar em Ajustes, Conexões.";
    }
    console.error("google no chat falhou", e instanceof Error ? e.message : "erro");
    return "\n\nDados do Google: não consegui ler agora (falha temporária ou acesso revogado). Diga isso com franqueza e sugira tentar de novo ou reconectar em Ajustes.";
  }
}
