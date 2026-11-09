import { NextResponse } from "next/server";
import { z } from "zod";
import { signedIn } from "../google/_auth";

export const dynamic = "force-dynamic";

const Sub = z.object({
  endpoint: z.string().url().max(1000).startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }),
  device: z.string().max(120).optional(),
});
const Del = z.object({ endpoint: z.string().url().max(1000) });

// Liga as notificações neste aparelho.
export async function POST(request: Request) {
  const a = await signedIn();
  if (!a) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const p = Sub.safeParse(await request.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { error } = await a.supabase.from("push_subscriptions").upsert(
    { user_id: a.user.id, endpoint: p.data.endpoint, p256dh: p.data.keys.p256dh, auth: p.data.keys.auth, device: p.data.device ?? null },
    { onConflict: "user_id,endpoint" },
  );
  if (error) return NextResponse.json({ error: "save" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Desliga neste aparelho.
export async function DELETE(request: Request) {
  const a = await signedIn();
  if (!a) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const p = Del.safeParse(await request.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  await a.supabase.from("push_subscriptions").delete().eq("endpoint", p.data.endpoint);
  return NextResponse.json({ ok: true });
}
