import { ITEM_COLS, toItem } from "@/lib/finance/load";
import { IdParam, ItemPatch } from "@/lib/finance/schemas";
import { dbFail, financeGuard, invalid, notFound, ok, readJson } from "../../_guard";
import { checarVinculos } from "../../_itens";

export const dynamic = "force-dynamic";

// Edita o cadastro de uma conta ou receita (nome, grupo, dia, vínculos...). Valor e pago de um mês: PUT .../mes.
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await financeGuard();
  if ("res" in g) return g.res;
  const id = IdParam.safeParse((await ctx.params).id);
  if (!id.success) return invalid("Item inválido.");
  const p = ItemPatch.safeParse(await readJson(request));
  if (!p.success) return invalid("Confira os dados.");
  const db = g.a.supabase;
  const atual = await db.from("fin_itens").select("id, tipo").eq("id", id.data).maybeSingle();
  if (atual.error) return dbFail(atual.error);
  if (!atual.data) return notFound();
  const v = await checarVinculos(db, atual.data.tipo as "despesa" | "receita", p.data.cartao_id, p.data.segue_id);
  if (v === "db") return dbFail(null);
  if (v === "invalid" || p.data.cartao_id === id.data || p.data.segue_id === id.data) return invalid("Vínculo inválido.");
  // Trocar de vínculo desfaz o outro: um item está dentro de um cartão OU segue uma receita.
  const campos: Record<string, unknown> = { ...p.data, updated_at: new Date().toISOString() };
  if (p.data.cartao_id) campos.segue_id = null;
  if (p.data.segue_id) campos.cartao_id = null;
  const { data, error } = await db.from("fin_itens").update(campos).eq("id", id.data).select(ITEM_COLS).maybeSingle();
  if (error) return dbFail(error);
  if (!data) return notFound();
  return ok({ item: toItem(data as Record<string, unknown>) });
}

// Apaga a conta e todos os valores dela (cascata no banco). Vinculados e a config são soltos, não apagados.
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await financeGuard();
  if ("res" in g) return g.res;
  const id = IdParam.safeParse((await ctx.params).id);
  if (!id.success) return invalid("Item inválido.");
  const { data, error } = await g.a.supabase.from("fin_itens").delete().eq("id", id.data).select("id");
  if (error) return dbFail(error);
  if (!data || data.length === 0) return notFound();
  return ok({ ok: true });
}
