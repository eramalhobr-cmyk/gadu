import { NextResponse } from "next/server";
import { PECAS_LISTA_MAX, PecaCreate, tituloDe } from "@/lib/3d/pecas";
import { fail, modeling3dGuard, NO_STORE } from "../_guard";

export const dynamic = "force-dynamic";

// Peças salvas do 3D Studio. Sempre com o cliente da SESSÃO e .eq("user_id"); a RLS também só deixa a própria pessoa.
export async function GET() {
  const g = await modeling3dGuard();
  if ("res" in g) return g.res;
  const { supabase, user } = g.a;
  const r = await supabase.from("pecas_3d").select("id, titulo, pedido, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(PECAS_LISTA_MAX);
  if (r.error) return fail(503, "db", "Não consegui ler suas peças agora.");
  return NextResponse.json({ pecas: r.data ?? [] }, { headers: NO_STORE });
}

// Cria a peça com a primeira versão (o código que a IA acabou de devolver).
export async function POST(request: Request) {
  const g = await modeling3dGuard();
  if ("res" in g) return g.res;
  const { supabase, user } = g.a;
  const p = PecaCreate.safeParse(await request.json().catch(() => null));
  if (!p.success) return fail(400, "invalid", p.error.issues[0]?.message ?? "Confira os dados.");
  const { pedido, scad, valores } = p.data;
  const peca = await supabase.from("pecas_3d").insert({ user_id: user.id, titulo: tituloDe(pedido), pedido, valores: valores ?? {} }).select("id, titulo, pedido, updated_at").single();
  if (peca.error || !peca.data) return fail(503, "db", "Não consegui salvar a peça agora.");
  const v = await supabase.from("pecas_3d_versoes").insert({ user_id: user.id, peca_id: peca.data.id, modo: "novo", pedido, scad }).select("id, created_at").single();
  if (v.error || !v.data) {
    await supabase.from("pecas_3d").delete().eq("id", peca.data.id).eq("user_id", user.id);
    return fail(503, "db", "Não consegui salvar a peça agora.");
  }
  return NextResponse.json({ peca: peca.data, versao: v.data }, { status: 201, headers: NO_STORE });
}
