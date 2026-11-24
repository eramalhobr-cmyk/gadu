import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { briefingText, parseTime, spNow } from "@/lib/briefing";
import { accessToken, events, inbox } from "@/lib/google";
import { pushConfigured, sendPush, type Sub } from "@/lib/push";
import { embed, embeddingsAvailable, toVector } from "@/lib/embeddings";
import { aplicarRegras, carregarRegrasEmail } from "@/lib/email-regras";
import { insights } from "@/lib/insights";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { redeDeSeguranca, retencaoDeErros } from "@/lib/telemetria/avisar";
import { capturarErroServidor } from "@/lib/telemetria/capturar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Agendador (Vercel Cron, a cada minuto): envia lembretes vencidos e o briefing da manhã.
// Só a Vercel chama, com o CRON_SECRET. Usa a chave secreta do Supabase, então filtra por pessoa em toda consulta.

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  const got = request.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  return Boolean(secret) && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

type Db = ReturnType<typeof supabaseAdmin>;

// S-04: quem não está ativo (members.access <> 'active') não recebe push, não tem o Google lido e não é indexado.
// Quem entra só pela lista do servidor e não tem linha em members continua ativo (igual a src/lib/access.ts).
// Se não der para saber quem está bloqueado, a tarefa falha (não processa ninguém às cegas).
async function blockedIds(db: Db): Promise<Set<string>> {
  const { data, error } = await db.from("members").select("user_id").neq("access", "active");
  if (error) throw new Error("lista de bloqueados indisponível");
  return new Set((data ?? []).map((m) => m.user_id as string));
}

async function subsOf(db: Db, userId: string): Promise<Sub[]> {
  const { data } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
  return (data ?? []) as Sub[];
}

async function push(db: Db, userId: string, payload: Parameters<typeof sendPush>[1]) {
  const subs = await subsOf(db, userId);
  if (!subs.length) return 0;
  const r = await sendPush(subs, payload);
  if (r.gone.length) await db.from("push_subscriptions").delete().eq("user_id", userId).in("id", r.gone);
  return r.sent;
}

async function reminders(db: Db) {
  const blocked = await blockedIds(db);
  let query = db
    .from("reminders")
    .select("id, user_id, text")
    .eq("status", "pending")
    .lte("due_at", new Date(Date.now() + 30_000).toISOString());
  // Filtra no banco para os bloqueados não ocuparem as 100 vagas da rodada.
  if (blocked.size) query = query.not("user_id", "in", `(${[...blocked].join(",")})`);
  const { data } = await query.order("due_at").limit(100);
  let sent = 0;
  for (const r of data ?? []) {
    if (blocked.has(r.user_id as string)) continue;
    // Marca antes de enviar: se duas execuções se cruzarem, só uma envia.
    const { data: claimed } = await db.from("reminders").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", r.id).eq("status", "pending").select("id");
    if (!claimed?.length) continue;
    sent += await push(db, r.user_id as string, { title: "Lembrete", body: r.text as string, url: "/app?tab=hoje", tag: `lembrete-${r.id}` });
  }
  return sent;
}

async function briefings(db: Db) {
  const now = spNow();
  const blocked = await blockedIds(db);
  const { data: people } = await db.from("profiles").select("id, display_name, settings").eq("settings->briefing->>enabled", "true");
  let sent = 0;
  for (const p of people ?? []) {
    if (blocked.has(p.id as string)) continue;
    const at = parseTime((p.settings as { briefing?: { time?: unknown } })?.briefing?.time);
    if (now.minutes < at || now.minutes > at + 180) continue; // janela de 3h depois do horário
    const userId = p.id as string;
    const { error: dup } = await db.from("daily_briefings").insert({ user_id: userId, day: now.day });
    if (dup) continue; // já enviado hoje
    let evs: { title: string; start: string; allDay: boolean }[] | null = null;
    let mails: number | null = null;
    let important: number | null = null;
    let mailList: { from: string; subject: string; date: string; important: boolean }[] | null = null;
    try {
      const token = await accessToken(db as never, userId);
      const end = new Date(now.start.getTime() + 86_400_000);
      const [e, m] = await Promise.all([events(token, now.start, end), inbox(token)]);
      evs = e.filter((x) => !x.declined);
      // Regras das memórias aprovadas da pessoa (cliente do cron filtrado por user_id).
      const lista = aplicarRegras(m, await carregarRegrasEmail(db, userId));
      mails = lista.length;
      important = lista.filter((x) => x.important).length;
      mailList = lista;
    } catch { /* sem Google: o briefing sai só com lembretes */ }
    const endOfDay = new Date(now.start.getTime() + 86_400_000).toISOString();
    const { count } = await db.from("reminders").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "pending").lt("due_at", endOfDay);
    const { count: due } = await db.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "open").lte("due_date", now.day);
    const name = String(p.display_name ?? "").split(" ")[0];
    const t = briefingText({ name, events: evs, mails, important, reminders: count ?? 0, tasks: due ?? 0 });
    // Percepção que a pessoa já respondeu hoje não entra no briefing (se a leitura falhar, segue sem filtro).
    const { data: resp } = await db.from("insight_respostas").select("tipo").eq("user_id", userId).eq("dia", now.day);
    const ignoradas = new Set(((resp ?? []) as { tipo: string }[]).map((r) => r.tipo));
    const { data: openTasks } = await db.from("tasks").select("title, due_date, priority").eq("user_id", userId).eq("status", "open").limit(200);
    const tip = insights({ events: evs ? evs.map((e) => ({ ...e, end: (e as { end?: string }).end ?? e.start })) : null, tasks: (openTasks ?? []) as { title: string; due_date: string | null; priority: number }[], mails: mailList })
      .find((x) => (x.kind === "conflito" || x.kind === "atrasadas" || x.kind === "email") && !ignoradas.has(x.kind));
    if (tip) t.body = t.body.replace("Toque para começar o dia.", `${tip.text} Toque para começar o dia.`);
    sent += await push(db, userId, { ...t, url: "/app?start=briefing", tag: `briefing-${now.day}` });
  }
  return sent;
}

// Revisão da noite (opcional): resumo do dia e convite para reagendar o que ficou.
async function evenings(db: Db) {
  const now = spNow();
  const blocked = await blockedIds(db);
  const { data: people } = await db.from("profiles").select("id, settings").eq("settings->evening->>enabled", "true");
  let sent = 0;
  for (const p of people ?? []) {
    if (blocked.has(p.id as string)) continue;
    const at = parseTime((p.settings as { evening?: { time?: unknown } })?.evening?.time ?? "21:00");
    if (now.minutes < at || now.minutes > at + 120) continue;
    const userId = p.id as string;
    const { error: dup } = await db.from("daily_pushes").insert({ user_id: userId, day: now.day, kind: "evening" });
    if (dup) continue;
    const since = now.start.toISOString();
    const [{ count: done }, { count: pending }] = await Promise.all([
      db.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "done").gte("done_at", since),
      db.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "open").lte("due_date", now.day),
    ]);
    const body = `${done ?? 0} ${done === 1 ? "tarefa concluída" : "tarefas concluídas"} hoje.${pending ? ` ${pending} ${pending === 1 ? "ficou pendente" : "ficaram pendentes"}: toque para passar para amanhã.` : " Nada pendente para hoje. Bom descanso!"}`;
    sent += await push(db, userId, { title: "Revisão do dia", body, url: "/app?start=review", tag: `revisao-${now.day}` });
  }
  return sent;
}

// Indexação para a busca por significado: processa aos poucos o que mudou.
async function indexing(db: Db) {
  if (!embeddingsAvailable()) return 0;
  // index_backlog já ignora quem não está ativo (migração 20261122120001); o filtro aqui cobre a janela antes dela.
  const blocked = await blockedIds(db);
  const { data } = await db.rpc("index_backlog", { lim: 16 });
  const rows = ((data ?? []) as { user_id: string; kind: string; ref_id: number; content: string }[]).filter((r) => r.content?.trim() && !blocked.has(r.user_id)).slice(0, 48);
  if (rows.length) {
    const vecs = await embed(rows.map((r) => r.content));
    const { error } = await db.from("search_index").upsert(
      rows.map((r, i) => ({ user_id: r.user_id, kind: r.kind, ref_id: r.ref_id, content: r.content.slice(0, 4000), embedding: toVector(vecs[i]), updated_at: new Date().toISOString() })),
      { onConflict: "user_id,kind,ref_id" },
    );
    if (error) throw error;
  }
  if (new Date().getUTCMinutes() % 15 === 0) await db.rpc("index_prune");
  return rows.length;
}

// Reconciliação do orçamento: marca reservas vencidas (que já não contam no teto). Sem a migração, não faz nada.
async function expireReservations(db: Db) {
  const { data, error } = await db.rpc("expire_ai_reservations");
  if (error) return error.code === "PGRST202" || error.code === "42883" ? 0 : Promise.reject(new Error(error.message));
  return Number(data ?? 0);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!process.env.SUPABASE_SECRET_KEY) return NextResponse.json({ ok: false, reason: "not_configured" });
  const db = supabaseAdmin();
  if (!pushConfigured()) {
    await retencaoDeErros(db); // a retenção de 30 dias não depende do push
    return NextResponse.json({ ok: false, reason: "not_configured" });
  }
  // Monitoramento de erros: rede de segurança do alerta (avisa o que o aviso imediato perdeu) e retenção de 30 dias (1x por hora).
  const [r, b, ev, ix, rs, al, rt] = await Promise.allSettled([reminders(db), briefings(db), evenings(db), indexing(db), expireReservations(db), redeDeSeguranca(db), retencaoDeErros(db)]);
  const val = (x: PromiseSettledResult<number>) => (x.status === "fulfilled" ? x.value : -1);
  const out = { ok: true, reminders: val(r), briefings: val(b), evenings: val(ev), indexed: val(ix), expired: val(rs), errorAlerts: val(al), errorsPruned: val(rt) };
  for (const [k, x] of Object.entries({ r, b, ev, ix, rs })) {
    if (x.status !== "rejected") continue;
    console.error("cron com falha", k, x.reason instanceof Error ? x.reason.message.slice(0, 160) : "erro");
    await capturarErroServidor(x.reason, { rota: "/api/cron/tick" });
  }
  return NextResponse.json(out);
}
