import { NextResponse } from "next/server";
import { accessToken, createEvent } from "@/lib/google";
import { spNow } from "@/lib/briefing";
import { ATRASADAS_MAX, blocoFoco, RespostaBody, tarefaDoEmail, type Desfazer } from "@/lib/percepcoes";
import { signedIn } from "../google/_auth";
import { fail } from "../calendar/_fail";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

// Resposta a uma percepção do dia (Aceitar/Ignorar). Grava só dia, tipo e decisão (nada de conteúdo).
// Aceitar faz a ação do tipo, sempre com a sessão (RLS) e o user_id da sessão, e devolve o que precisa para o Desfazer:
//   atrasadas → tarefas abertas com prazo antes de hoje passam para hoje (até 20)
//   email     → cria a tarefa "Responder e-mail: assunto (remetente)" para hoje
//   livre     → reserva "Foco" na agenda do Google dentro da janela livre (até 2 h)
//   conflito  → só registra (o app abre a Agenda)
// "cheio" é só aviso: aceitar não vale.
export async function POST(request: Request) {
  const a = await signedIn();
  if (!a) return json({ error: "unauthorized" }, 401);
  const p = RespostaBody.safeParse(await request.json().catch(() => null));
  if (!p.success) return json({ error: "invalid", message: "Resposta inválida." }, 400);
  const { tipo, decisao, ref } = p.data;
  if (decisao === "aceita" && tipo === "cheio") return json({ error: "invalid", message: "Esse aviso só dá para ignorar." }, 400);
  const hoje = spNow().day;
  const uid = a.user.id;
  const desfazer: Desfazer = {};

  if (decisao === "aceita" && tipo === "atrasadas") {
    const r = await a.supabase.from("tasks").select("id, due_date").eq("user_id", uid).eq("status", "open").lt("due_date", hoje).order("due_date").limit(ATRASADAS_MAX);
    if (r.error) return json({ error: "db", message: "Não consegui ler as tarefas. Tente de novo." }, 502);
    const tarefas = ((r.data ?? []) as { id: number; due_date: string | null }[]).map((t) => ({ id: Number(t.id), due_date: t.due_date ?? null }));
    if (!tarefas.length) return json({ error: "invalid", message: "Não há tarefas atrasadas agora." }, 409);
    const u = await a.supabase.from("tasks").update({ due_date: hoje, updated_at: new Date().toISOString() }).eq("user_id", uid).in("id", tarefas.map((t) => t.id)).select("id");
    if (u.error) return json({ error: "db", message: "Não consegui mudar as tarefas. Tente de novo." }, 502);
    desfazer.tarefas = tarefas;
  } else if (decisao === "aceita" && tipo === "email") {
    const t = await a.supabase.from("tasks").insert({ user_id: uid, title: tarefaDoEmail(ref), due_date: hoje, priority: 1, origin: "Percepção" }).select("id").single();
    if (t.error || !t.data) return json({ error: "db", message: "Não consegui criar a tarefa. Tente de novo." }, 502);
    desfazer.tarefa_id = Number((t.data as { id: number }).id);
  } else if (decisao === "aceita" && tipo === "livre") {
    const b = blocoFoco(ref, Date.now());
    if (!b) return json({ error: "invalid", message: "A janela livre já passou ou ficou curta." }, 409);
    try {
      const token = await accessToken(a.supabase, uid);
      const ev = await createEvent(token, { title: "Foco", start: b.start, end: b.end, description: "Bloco de foco reservado pelo GaDu na sua janela livre." });
      desfazer.evento_id = ev.id;
    } catch (e) {
      return fail(e);
    }
  }

  const up = await a.supabase.from("insight_respostas").upsert({ user_id: uid, dia: hoje, tipo, decisao }, { onConflict: "user_id,dia,tipo" });
  // A ação já foi feita: se só a resposta falhar, a percepção pode voltar a aparecer, mas nada se perde.
  return json({ ok: true, tipo, decisao, desfazer, gravou: !up.error });
}
