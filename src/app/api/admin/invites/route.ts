import { NextResponse } from "next/server";
import { z } from "zod";
import { INVITE_DAYS, newInviteToken } from "@/lib/invites";
import { AGENT_PRESETS } from "@/lib/presets";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { adminOnly } from "../_admin";

export const dynamic = "force-dynamic";

const Create = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  name: z.string().trim().min(1).max(80),
  agents: z.array(z.enum(AGENT_PRESETS.map((p) => p.name) as [string, ...string[]])).max(10).default([]),
  business: z.string().trim().max(40).optional(),
}).strict();
const Revoke = z.object({ id: z.number().int().positive() }).strict();

// Cria um convite e devolve o link (vale 7 dias, uma vez). O admin envia pelo WhatsApp ou e-mail.
export async function POST(request: Request) {
  const a = await adminOnly();
  if (!a) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const p = Create.safeParse(await request.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "invalid", message: "Confira o nome e o e-mail." }, { status: 400 });
  const { token, hash } = newInviteToken();
  const { error } = await supabaseAdmin().from("invites").insert({
    created_by: a.user.id,
    email: p.data.email,
    name: p.data.name,
    token_hash: hash,
    presets: { agents: p.data.agents, business: p.data.business || null },
    expires_at: new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString(),
  });
  if (error) return NextResponse.json({ error: "save", message: "Não consegui criar o convite." }, { status: 500 });
  return NextResponse.json({ link: new URL(`/convite/${token}`, request.url).toString(), days: INVITE_DAYS });
}

// Cancela um convite ainda não usado.
export async function DELETE(request: Request) {
  const a = await adminOnly();
  if (!a) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const p = Revoke.safeParse(await request.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  await supabaseAdmin().from("invites").delete().eq("id", p.data.id).eq("created_by", a.user.id).is("used_at", null);
  return NextResponse.json({ ok: true });
}
