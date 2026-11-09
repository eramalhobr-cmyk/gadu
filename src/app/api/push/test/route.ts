import { NextResponse } from "next/server";
import { z } from "zod";
import { sendPush, type Sub } from "@/lib/push";
import { signedIn } from "../../google/_auth";

export const dynamic = "force-dynamic";

const Body = z.object({ confirm: z.literal(true) }).strict();

export async function POST(request: Request) {
  const a = await signedIn();
  if (!a) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!Body.safeParse(await request.json().catch(() => null)).success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { data } = await a.supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth");
  const subs = (data ?? []) as Sub[];
  if (!subs.length) return NextResponse.json({ sent: 0 });
  const r = await sendPush(subs, { title: "GaDu", body: "Notificações funcionando. É assim que chegam os lembretes e o briefing da manhã.", url: "/app?tab=hoje", tag: "teste" });
  if (r.gone.length) await a.supabase.from("push_subscriptions").delete().in("id", r.gone);
  return NextResponse.json({ sent: r.sent });
}
