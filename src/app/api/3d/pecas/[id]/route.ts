import { NextResponse } from "next/server";
import { PecaId, PecaPatch, VERSOES_MAX } from "@/lib/3d/pecas";
import { fail, modeling3dGuard, NO_STORE } from "../../_guard";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

// Uma peça com as versões mais recentes (mais nova primeiro). Peça de outra pessoa = 404.
export async function GET(_req: Request, { params }: Ctx) {
  const g = await modeling3dGuard();
  if ("res" in g) return g.res;
  const { supabase, user } = g.a;
  const id = PecaId.safeParse((await params).id);
  if (!id.success) return fail(404, "not_found", "Não achei essa peça.");
  const peca = await supabase.from("pecas_3d").select("id, titulo, pedido, valores, updated_at").eq("id", id.data).eq("user_id", user.id).maybeSingle();
  if (peca.error) return fail(503, "db", "Não consegui abrir a peça agora.");
  if (!peca.data) return fail(404, "not_found", "Não achei essa peça.");
  const v = await supabase.from("pecas_3d_versoes").select("id, modo, pedido, scad, created_at").eq("peca_id", id.data).eq("user_id", user.id).order("created_at", { ascending: false }).limit(VERSOES_MAX);
  if (v.error) return fail(503, "db", "Não consegui abrir a peça agora.");
  return NextResponse.json({ peca: peca.data, versoes: v.data ?? [] }, { headers: NO_STORE });
}

// Guarda os valores dos controles (as medidas) ou renomeia. Não usa IA.
export async function PATCH(request: Request, { params }: Ctx) {
  const g = await modeling3dGuard();
  if ("res" in g) return g.res;
  const { supabase, user } = g.a;
  const id = PecaId.safeParse((await params).id);
  if (!id.success) return fail(404, "not_found", "Não achei essa peça.");
  const p = PecaPatch.safeParse(await request.json().catch(() => null));
  if (!p.success) return fail(400, "invalid", p.error.issues[0]?.message ?? "Confira os dados.");
  const r = await supabase.from("pecas_3d").update({ ...p.data, updated_at: new Date().toISOString() }).eq("id", id.data).eq("user_id", user.id).select("id");
  if (r.error) return fail(503, "db", "Não consegui salvar agora.");
  if (!r.data?.length) return fail(404, "not_found", "Não achei essa peça.");
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}

// Apaga a peça e todas as versões (cascata no banco).
export async function DELETE(_req: Request, { params }: Ctx) {
  const g = await modeling3dGuard();
  if ("res" in g) return g.res;
  const { supabase, user } = g.a;
  const id = PecaId.safeParse((await params).id);
  if (!id.success) return fail(404, "not_found", "Não achei essa peça.");
  const r = await supabase.from("pecas_3d").delete().eq("id", id.data).eq("user_id", user.id).select("id");
  if (r.error) return fail(503, "db", "Não consegui apagar agora.");
  if (!r.data?.length) return fail(404, "not_found", "Não achei essa peça.");
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
