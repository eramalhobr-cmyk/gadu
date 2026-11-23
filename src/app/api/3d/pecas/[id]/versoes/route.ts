import { NextResponse } from "next/server";
import { PecaId, VERSOES_MAX, VersaoCreate } from "@/lib/3d/pecas";
import { fail, modeling3dGuard, NO_STORE } from "../../../_guard";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

// Nova versão (ajuste ou correção da IA) numa peça da própria pessoa. Guarda só as VERSOES_MAX mais recentes.
export async function POST(request: Request, { params }: Ctx) {
  const g = await modeling3dGuard();
  if ("res" in g) return g.res;
  const { supabase, user } = g.a;
  const id = PecaId.safeParse((await params).id);
  if (!id.success) return fail(404, "not_found", "Não achei essa peça.");
  const p = VersaoCreate.safeParse(await request.json().catch(() => null));
  if (!p.success) return fail(400, "invalid", p.error.issues[0]?.message ?? "Confira os dados.");
  const peca = await supabase.from("pecas_3d").select("id").eq("id", id.data).eq("user_id", user.id).maybeSingle();
  if (peca.error) return fail(503, "db", "Não consegui salvar agora.");
  if (!peca.data) return fail(404, "not_found", "Não achei essa peça.");
  const v = await supabase.from("pecas_3d_versoes").insert({ user_id: user.id, peca_id: id.data, modo: p.data.modo, pedido: p.data.pedido ?? null, scad: p.data.scad }).select("id, created_at").single();
  if (v.error || !v.data) return fail(503, "db", "Não consegui salvar a versão agora.");
  // Os valores dos controles voltam ao padrão do código novo; a peça sobe na lista.
  await supabase.from("pecas_3d").update({ valores: {}, updated_at: new Date().toISOString() }).eq("id", id.data).eq("user_id", user.id);
  const todas = await supabase.from("pecas_3d_versoes").select("id, created_at").eq("peca_id", id.data).eq("user_id", user.id).order("created_at", { ascending: false });
  const velhas = (todas.data ?? []).slice(VERSOES_MAX).map((x) => x.id as string);
  if (velhas.length) await supabase.from("pecas_3d_versoes").delete().in("id", velhas).eq("user_id", user.id);
  return NextResponse.json({ versao: v.data }, { status: 201, headers: NO_STORE });
}
