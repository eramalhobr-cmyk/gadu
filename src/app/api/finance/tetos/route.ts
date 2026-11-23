import { z } from "zod";
import { hojeSP } from "@/lib/finance/datas";
import { GASTO_COLS, toGasto } from "@/lib/finance/load";
import { nomeCategoria, statusTetos, TetoBody, type Teto } from "@/lib/finance/tetos";
import { dbFail, financeGuard, invalid, notFound, ok, readJson } from "../_guard";

export const dynamic = "force-dynamic";

const Query = z.object({ ano: z.coerce.number().int().min(2000).max(2100).optional(), mes: z.coerce.number().int().min(1).max(12).optional() });
const toTeto = (r: Record<string, unknown>): Teto => ({ id: String(r.id), categoria: String(r.categoria), valor: Number(r.valor) });

// Tetos por categoria e a situação no mês (padrão: o mês atual em Brasília). Sempre a sessão e .eq("user_id").
export async function GET(request: Request) {
  const g = await financeGuard();
  if ("res" in g) return g.res;
  const { supabase, user } = g.a;
  const q = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!q.success) return invalid("Mês inválido.");
  const hoje = hojeSP();
  const ano = q.data.ano ?? hoje.ano, mes = q.data.mes ?? hoje.mes;
  const [t, gs] = await Promise.all([
    supabase.from("fin_tetos").select("id, categoria, valor").eq("user_id", user.id).order("categoria").limit(100),
    supabase.from("fin_gastos").select(GASTO_COLS).eq("user_id", user.id).eq("ano", ano).eq("mes", mes).limit(5000),
  ]);
  if (t.error || gs.error) return dbFail(t.error ?? gs.error);
  const tetos = ((t.data ?? []) as Record<string, unknown>[]).map(toTeto);
  return ok({ ano, mes, tetos: statusTetos(tetos, ((gs.data ?? []) as Record<string, unknown>[]).map(toGasto)) });
}

// Define (ou muda) o teto de uma categoria. Devolve o valor anterior para o Desfazer.
export async function PUT(request: Request) {
  const g = await financeGuard();
  if ("res" in g) return g.res;
  const { supabase, user } = g.a;
  const p = TetoBody.safeParse(await readJson(request));
  if (!p.success) return invalid("Confira a categoria e o valor.");
  const categoria = nomeCategoria(p.data.categoria);
  const antes = await supabase.from("fin_tetos").select("id, valor").eq("user_id", user.id).eq("categoria", categoria).maybeSingle();
  if (antes.error) return dbFail(antes.error);
  const r = antes.data
    ? await supabase.from("fin_tetos").update({ valor: p.data.valor, updated_at: new Date().toISOString() }).eq("id", (antes.data as { id: string }).id).eq("user_id", user.id).select("id, categoria, valor").single()
    : await supabase.from("fin_tetos").insert({ user_id: user.id, categoria, valor: p.data.valor }).select("id, categoria, valor").single();
  if (r.error || !r.data) return dbFail(r.error);
  return ok({ teto: toTeto(r.data as Record<string, unknown>), anterior: antes.data ? Number((antes.data as { valor: unknown }).valor) : null });
}

// Tira o teto de uma categoria (?categoria=…). Devolve o valor que tinha, para o Desfazer.
export async function DELETE(request: Request) {
  const g = await financeGuard();
  if ("res" in g) return g.res;
  const { supabase, user } = g.a;
  const raw = new URL(request.url).searchParams.get("categoria") ?? "";
  if (!raw.trim() || raw.length > 40) return invalid("Faltou a categoria.");
  const categoria = nomeCategoria(raw);
  const r = await supabase.from("fin_tetos").delete().eq("user_id", user.id).eq("categoria", categoria).select("valor");
  if (r.error) return dbFail(r.error);
  if (!r.data?.length) return notFound();
  return ok({ ok: true, categoria, anterior: Number((r.data[0] as { valor: unknown }).valor) });
}
