import { z } from "zod";
import { readBudgets, serverConfig } from "@/lib/config";
import { accessOf } from "@/lib/access";
import { after } from "next/server";
import { AllProvidersFailed, BudgetReached, routeChat, NoProviderError } from "@/lib/llm/router";
import { complete } from "@/lib/llm/complete";
import type { ProviderId } from "@/lib/llm/types";
import type { ChatTurn } from "@/lib/llm/types";
import { splitMeta, visiblePart } from "@/lib/meta";
import { costUsd } from "@/lib/pricing";
import { blockedTerm, isSensitive } from "@/lib/privacy";
import { accessToken, events, formatEvents, formatMails, GoogleError, googleIntent, inbox } from "@/lib/google";
import { insights, type InTask } from "@/lib/insights";
import { embed, embeddingsAvailable, toVector } from "@/lib/embeddings";
import { agentAreas } from "@/lib/presets";
import { contextBlock, extrasBlock, systemPrompt } from "@/lib/prompt";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  message: z.string().trim().min(1).max(4000),
  conversationId: z.number().int().positive().nullable().optional(),
  // Só valem ao criar uma conversa nova: conversa sobre um projeto ou com um agente.
  projectId: z.number().int().positive().nullable().optional(),
  agentId: z.number().int().positive().nullable().optional(),
});

// Eventos enviados ao app, um JSON por linha (NDJSON).
type Out =
  | { t: "start"; conversationId: number }
  | { t: "provider"; name: string }
  | { t: "delta"; text: string }
  | { t: "done"; memories: number }
  | { t: "reminders"; items: { id: number; text: string; dueAt: string }[] }
  | { t: "tasks"; items: { id: number; title: string; due: string | null }[] }
  | { t: "events"; items: { title: string; start: string; end: string; location: string | null }[] }
  | { t: "notice"; text: string; kind: "privacy" | "quota" | "engine" | "error" };

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user || !(await accessOf(supabase, user)).ok) return Response.json({ error: "Faça login para continuar." }, { status: 401 });

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
        let projectId: number | null = null;
        let agentId: number | null = null;
        if (conversationId) {
          const { data } = await supabase.from("conversations").select("id, message_count, summary, project_id, agent_id").eq("id", conversationId).maybeSingle();
          if (!data) conversationId = null;
          else {
            msgCount = Number(data.message_count ?? 0);
            hasSummary = Boolean(data.summary);
            projectId = (data.project_id as number | null) ?? null;
            agentId = (data.agent_id as number | null) ?? null;
          }
        }
        if (!conversationId) {
          // RLS só mostra projetos e agentes da própria pessoa: id de outra pessoa vira null.
          const [pj, ag] = await Promise.all([
            parsed.data.projectId ? supabase.from("projects").select("id").eq("id", parsed.data.projectId).maybeSingle() : Promise.resolve({ data: null }),
            parsed.data.agentId ? supabase.from("agents").select("id").eq("id", parsed.data.agentId).maybeSingle() : Promise.resolve({ data: null }),
          ]);
          projectId = (pj.data?.id as number | undefined) ?? null;
          agentId = (ag.data?.id as number | undefined) ?? null;
          const { data, error } = await supabase.from("conversations").insert({ title: message.slice(0, 80), project_id: projectId, agent_id: agentId }).select("id").single();
          if (error || !data) throw new Error("não consegui criar a conversa");
          conversationId = data.id as number;
        }
        send({ t: "start", conversationId });

        // Busca por significado em paralelo (memórias, conversas, tarefas, projetos). Falha não atrapalha a conversa.
        const semantic = semanticContext(supabase, message);
        // 4. Contexto: perfil, memória aprovada, histórico recente, conversas antigas relacionadas e gasto por provedor.
        const [profile, memories, history, related, spendRows, openTasks, activeProjects, agentRow, projectRow] = await Promise.all([
          supabase.from("profiles").select("display_name, settings").eq("id", user.id).maybeSingle(),
          supabase.from("memories").select("content, area").eq("status", "approved").order("created_at", { ascending: true }).limit(80),
          supabase.from("messages").select("role, content").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(16),
          relatedQuery(message)
            ? supabase.from("conversations").select("title, summary, updated_at").textSearch("search", relatedQuery(message), { type: "websearch", config: "portuguese" }).not("summary", "is", null).neq("id", conversationId).order("updated_at", { ascending: false }).limit(3)
            : Promise.resolve({ data: [] as { title: string; summary: string; updated_at: string }[] }),
          supabase.rpc("month_spend_by_provider"),
          supabase.from("tasks").select("title, priority, due_date, projects(name)").eq("status", "open").order("due_date", { ascending: true, nullsFirst: false }).order("priority").limit(15),
          supabase.from("projects").select("id, name, goal").eq("status", "active").order("updated_at", { ascending: false }).limit(20),
          agentId ? supabase.from("agents").select("name, area, instructions").eq("id", agentId).maybeSingle() : Promise.resolve({ data: null }),
          projectId ? supabase.from("projects").select("name, goal, next_steps").eq("id", projectId).maybeSingle() : Promise.resolve({ data: null }),
        ]);
        // Agente: só as memórias da área dele e as preferências gerais.
        const agentArea = (agentRow.data as { area?: string } | null)?.area;
        const memFor = ((memories.data ?? []) as { content: string; area: string }[]).filter((m) => !agentArea || agentAreas(agentArea).includes(m.area));
        const extras = extrasBlock({
          tasks: ((openTasks.data ?? []) as unknown as { title: string; priority: number; due_date: string | null; projects: { name: string } | null }[])
            .map((t) => ({ title: t.title, priority: t.priority, due_date: t.due_date, project: t.projects?.name ?? null })),
          projects: (activeProjects.data ?? []) as { name: string; goal: string | null }[],
          agent: (agentRow.data as { name: string; area: string; instructions: string } | null) ?? null,
          project: (projectRow.data as { name: string; goal: string | null; next_steps: string | null } | null) ?? null,
        });
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
        const taskList = ((openTasks.data ?? []) as unknown as { title: string; priority: number; due_date: string | null }[]);
        const google = await googleContext(supabase, user.id, message, blocked, taskList);
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
          context: contextBlock(name, memFor, (related.data ?? []) as { title: string; summary: string; updated_at: string }[]) + extras + (await semantic) + google,
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
        const { body: answer, memories: proposals, reminders, tasks: taskProposals, events: eventProposals } = splitMeta(full);
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
        // Lembretes pedidos nesta mensagem (o agendador avisa no celular na hora certa).
        const okReminders = reminders.filter((r) => !isSensitive(r.text) && !blockedTerm(r.text, blocked));
        if (okReminders.length) {
          const { data: created } = await supabase
            .from("reminders")
            .insert(okReminders.map((r) => ({ text: r.text, due_at: r.dueAt, origin: "Conversa", conversation_id: conversationId })))
            .select("id, text, due_at");
          if (created?.length) send({ t: "reminders", items: created.map((r) => ({ id: r.id as number, text: r.text as string, dueAt: r.due_at as string })) });
        }
        // Tarefas pedidas nesta mensagem. Projeto pelo nome (só os da pessoa) ou o projeto desta conversa.
        const okTasks = taskProposals.filter((t) => !isSensitive(t.title) && !blockedTerm(t.title, blocked));
        if (okTasks.length) {
          const byName = new Map(((activeProjects.data ?? []) as { id: number; name: string }[]).map((p) => [p.name.toLowerCase(), p.id]));
          const { data: createdTasks } = await supabase
            .from("tasks")
            .insert(okTasks.map((t) => ({
              title: t.title, due_date: t.due, priority: t.priority, origin: "Conversa", conversation_id: conversationId,
              project_id: (t.project ? byName.get(t.project.toLowerCase()) : undefined) ?? projectId,
            })))
            .select("id, title, due_date");
          if (createdTasks?.length) send({ t: "tasks", items: createdTasks.map((t) => ({ id: t.id as number, title: t.title as string, due: (t.due_date as string | null) ?? null })) });
        }
        // Eventos: só propostas. O app mostra e a pessoa confirma antes de criar na agenda.
        const okEvents = eventProposals.filter((e) => !isSensitive(e.title) && !blockedTerm(e.title, blocked));
        if (okEvents.length) send({ t: "events", items: okEvents });
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
async function googleContext(supabase: Db, userId: string, message: string, blocked: string[], tasks: InTask[]): Promise<string> {
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
    // Insights calculados (conflitos, janela livre, atrasos, e-mails parados): use no briefing e ao priorizar.
    const tips = insights({ events: ev ? ev.filter((e) => !e.declined && e.start < new Date(start.getTime() + 86_400_000).toISOString()) : null, tasks, mails: mails?.filter((m) => !hide(`${m.from} ${m.subject} ${m.snippet}`)) ?? null });
    if (tips.length) parts.push("Insights de hoje:\n" + tips.map((t) => `- ${t.text}`).join("\n"));
    return `\n\nDados do Google (lidos agora, só leitura):\n${parts.join("\n\n")}`;
  } catch (e) {
    if (e instanceof GoogleError && e.kind === "not_connected") {
      return "\n\nDados do Google: a conta Google não está conectada. Se a pessoa pedir agenda ou e-mails, diga que ela pode conectar em Ajustes, Conexões.";
    }
    console.error("google no chat falhou", e instanceof Error ? e.message : "erro");
    return "\n\nDados do Google: não consegui ler agora (falha temporária ou acesso revogado). Diga isso com franqueza e sugira tentar de novo ou reconectar em Ajustes.";
  }
}

/** Itens parecidos com a mensagem, pela busca por significado. */
async function semanticContext(supabase: Db, message: string): Promise<string> {
  if (!embeddingsAvailable() || message.trim().length < 12) return "";
  try {
    const [v] = await embed([message]);
    const { data } = await supabase.rpc("search_similar", { query_embedding: toVector(v), match_count: 6 });
    const label: Record<string, string> = { memory: "memória", conversation: "conversa anterior", task: "tarefa", project: "projeto" };
    const hits = ((data ?? []) as { kind: string; content: string; similarity: number }[]).filter((r) => r.similarity > 0.4);
    if (!hits.length) return "";
    return "\n\nItens relacionados encontrados por significado (use só se ajudar):\n" + hits.map((h) => `- (${label[h.kind] ?? h.kind}) ${h.content.slice(0, 300)}`).join("\n");
  } catch {
    return "";
  }
}
