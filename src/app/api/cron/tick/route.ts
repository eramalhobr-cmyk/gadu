import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { briefingText, parseTime, spNow } from "@/lib/briefing";
import { accessToken, events, inbox } from "@/lib/google";
import { pushConfigured, sendPush, type Sub } from "@/lib/push";
import { supabaseAdmin } from "@/lib/supabase/admin";

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
  const { data } = await db
    .from("reminders")
    .select("id, user_id, text")
    .eq("status", "pending")
    .lte("due_at", new Date(Date.now() + 30_000).toISOString())
    .order("due_at")
    .limit(100);
  let sent = 0;
  for (const r of data ?? []) {
    // Marca antes de enviar: se duas execuções se cruzarem, só uma envia.
    const { data: claimed } = await db.from("reminders").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", r.id).eq("status", "pending").select("id");
    if (!claimed?.length) continue;
    sent += await push(db, r.user_id as string, { title: "Lembrete", body: r.text as string, url: "/app?tab=hoje", tag: `lembrete-${r.id}` });
  }
  return sent;
}

async function briefings(db: Db) {
  const now = spNow();
  const { data: people } = await db.from("profiles").select("id, display_name, settings").eq("settings->briefing->>enabled", "true");
  let sent = 0;
  for (const p of people ?? []) {
    const at = parseTime((p.settings as { briefing?: { time?: unknown } })?.briefing?.time);
    if (now.minutes < at || now.minutes > at + 180) continue; // janela de 3h depois do horário
    const userId = p.id as string;
    const { error: dup } = await db.from("daily_briefings").insert({ user_id: userId, day: now.day });
    if (dup) continue; // já enviado hoje
    let evs: { title: string; start: string; allDay: boolean }[] | null = null;
    let mails: number | null = null;
    let important: number | null = null;
    try {
      const token = await accessToken(db as never, userId);
      const end = new Date(now.start.getTime() + 86_400_000);
      const [e, m] = await Promise.all([events(token, now.start, end), inbox(token)]);
      evs = e.filter((x) => !x.declined);
      mails = m.length;
      important = m.filter((x) => x.important).length;
    } catch { /* sem Google: o briefing sai só com lembretes */ }
    const endOfDay = new Date(now.start.getTime() + 86_400_000).toISOString();
    const { count } = await db.from("reminders").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "pending").lt("due_at", endOfDay);
    const name = String(p.display_name ?? "").split(" ")[0];
    const t = briefingText({ name, events: evs, mails, important, reminders: count ?? 0 });
    sent += await push(db, userId, { ...t, url: "/app?start=briefing", tag: `briefing-${now.day}` });
  }
  return sent;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!pushConfigured() || !process.env.SUPABASE_SECRET_KEY) return NextResponse.json({ ok: false, reason: "not_configured" });
  const db = supabaseAdmin();
  const [r, b] = await Promise.allSettled([reminders(db), briefings(db)]);
  const out = { ok: true, reminders: r.status === "fulfilled" ? r.value : -1, briefings: b.status === "fulfilled" ? b.value : -1 };
  if (r.status === "rejected" || b.status === "rejected") console.error("cron com falha", r.status, b.status);
  return NextResponse.json(out);
}
