import { NextResponse } from "next/server";
import { z } from "zod";
import { hashToken, TOKEN_RE } from "@/lib/invites";
import { AGENT_PRESETS, businessAgent } from "@/lib/presets";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const Body = z.object({
  token: z.string().regex(TOKEN_RE),
  name: z.string().trim().min(1).max(80),
  password: z.string().min(10).max(200),
}).strict();

// Aceita o convite: cria a conta com senha, libera o acesso, instala os modelos iniciais e já entra.
export async function POST(request: Request) {
  const p = Body.safeParse(await request.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Confira o nome e use uma senha com pelo menos 10 caracteres." }, { status: 400 });
  const db = supabaseAdmin();
  const { data: inv } = await db.from("invites").select("id, email, created_by, presets, expires_at, used_at").eq("token_hash", hashToken(p.data.token)).maybeSingle();
  if (!inv || inv.used_at || new Date(inv.expires_at as string).getTime() < Date.now()) {
    return NextResponse.json({ error: "Este convite expirou ou já foi usado. Peça um novo." }, { status: 410 });
  }
  // Marca como usado antes de criar a conta: dois cliques ao mesmo tempo não criam duas.
  const { data: claimed } = await db.from("invites").update({ used_at: new Date().toISOString() }).eq("id", inv.id).is("used_at", null).select("id");
  if (!claimed?.length) return NextResponse.json({ error: "Este convite já foi usado." }, { status: 410 });

  const email = inv.email as string;
  const { data: created, error } = await db.auth.admin.createUser({ email, password: p.data.password, email_confirm: true, user_metadata: { full_name: p.data.name } });
  if (error || !created.user) {
    await db.from("invites").update({ used_at: null }).eq("id", inv.id);
    const weak = /password|weak|pwned/i.test(error?.message ?? "");
    const exists = /already|registered|exists/i.test(error?.message ?? "");
    return NextResponse.json({ error: weak ? "Senha fraca. Escolha outra com letras e números." : exists ? "Este e-mail já tem conta. Entre pela tela de login." : "Não consegui criar a conta. Tente de novo." }, { status: 400 });
  }
  const userId = created.user.id;
  await Promise.all([
    db.from("members").insert({ user_id: userId, role: "member", access: "active", invited_by: inv.created_by }),
    db.from("profiles").update({ display_name: p.data.name }).eq("id", userId),
    db.from("invites").update({ user_id: userId }).eq("id", inv.id),
  ]);
  // Modelos iniciais escolhidos pelo admin no convite.
  const presets = (inv.presets ?? {}) as { agents?: string[]; business?: string | null };
  const agents = AGENT_PRESETS.filter((a) => presets.agents?.includes(a.name));
  if (presets.business) agents.push(businessAgent(presets.business));
  if (agents.length) await db.from("agents").insert(agents.map((a) => ({ ...a, user_id: userId })));
  if (presets.business) await db.from("projects").insert({ user_id: userId, name: presets.business.slice(0, 80), goal: "Organizar clientes, propostas e projetos do negócio.", color: "blue" });

  const supabase = await supabaseServer();
  await supabase.auth.signInWithPassword({ email, password: p.data.password });
  return NextResponse.json({ ok: true });
}
