import { z } from "zod";
import { isAllowed, serverConfig } from "@/lib/config";
import { routeChat, NoProviderError } from "@/lib/llm/router";
import type { ChatTurn } from "@/lib/llm/types";
import { splitMeta, visiblePart } from "@/lib/meta";
import { blockedTerm, isSensitive } from "@/lib/privacy";
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
        // 3. Conversa: usa a existente (se for da pessoa) ou cria uma nova.
        let conversationId = parsed.data.conversationId ?? null;
        if (conversationId) {
          const { data } = await supabase.from("conversations").select("id").eq("id", conversationId).maybeSingle();
          if (!data) conversationId = null;
        }
        if (!conversationId) {
          const { data, error } = await supabase.from("conversations").insert({ title: message.slice(0, 80) }).select("id").single();
          if (error || !data) throw new Error("não consegui criar a conversa");
          conversationId = data.id as number;
        }
        send({ t: "start", conversationId });

        // 4. Contexto: perfil, memória aprovada e histórico recente.
        const [profile, memories, history] = await Promise.all([
          supabase.from("profiles").select("display_name, settings").eq("id", user.id).maybeSingle(),
          supabase.from("memories").select("content, area").eq("status", "approved").order("created_at", { ascending: true }).limit(80),
          supabase.from("messages").select("role, content").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(16),
        ]);
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
        const lastTurn = turns[turns.length - 1];
        if (lastTurn && lastTurn.role === "user") lastTurn.content += "\n\n" + message;
        else turns.push({ role: "user", content: message });

        // 5. Resposta em streaming, com troca de provedor se o principal cair.
        let full = "";
        let provider = "";
        let sent = 0;
        for await (const ev of routeChat({
          system: systemPrompt(),
          context: contextBlock(name, memories.data ?? []),
          turns,
          signal: request.signal,
        })) {
          if (ev.type === "provider") {
            provider = ev.name;
            send({ t: "provider", name: ev.name });
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
          { conversation_id: conversationId, role: "assistant", content: answer || "(sem resposta)", provider },
        ]);
        await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
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
        if (e instanceof NoProviderError) {
          send({ t: "notice", kind: "engine", text: "O motor ainda não está configurado neste servidor. Publique na Vercel (usa o AI Gateway) ou cadastre ANTHROPIC_API_KEY." });
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
