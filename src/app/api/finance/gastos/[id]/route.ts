import { GASTO_COLS, toGasto } from "@/lib/finance/load";
import { GastoPatch, IdParam } from "@/lib/finance/schemas";
import { dbFail, financeGuard, invalid, notFound, ok, readJson } from "../../_guard";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await financeGuard();
  if ("res" in g) return g.res;
  const id = IdParam.safeParse((await ctx.params).id);
  if (!id.success) return invalid("Gasto inválido.");
  const p = GastoPatch.safeParse(await readJson(request));
  if (!p.success) return invalid("Confira os dados.");
  const { data, error } = await g.a.supabase.from("fin_gastos").update({ ...p.data, updated_at: new Date().toISOString() }).eq("id", id.data).select(GASTO_COLS).maybeSingle();
  if (error) return dbFail(error);
  if (!data) return notFound();
  return ok({ gasto: toGasto(data as Record<string, unknown>) });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await financeGuard();
  if ("res" in g) return g.res;
  const id = IdParam.safeParse((await ctx.params).id);
  if (!id.success) return invalid("Gasto inválido.");
  const { data, error } = await g.a.supabase.from("fin_gastos").delete().eq("id", id.data).select("id");
  if (error) return dbFail(error);
  if (!data || data.length === 0) return notFound();
  return ok({ ok: true });
}
