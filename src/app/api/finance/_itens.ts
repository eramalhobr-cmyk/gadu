// Apoio das rotas de itens: vínculos e gravação de valores por mês. Sempre com o cliente da sessão (RLS).
import type { SessionDb } from "@/lib/core/types";
import { MES_COLS } from "@/lib/finance/load";
import type { Tipo } from "@/lib/finance/types";

type DbError = { code?: string } | null;

/** Cartão precisa ser uma despesa e "segue" uma receita; ambos da própria pessoa (a RLS só mostra os dela). */
export async function checarVinculos(db: SessionDb, tipo: Tipo | undefined, cartaoId: string | null | undefined, segueId: string | null | undefined): Promise<"ok" | "invalid" | "db"> {
  if (cartaoId && segueId) return "invalid";
  if ((cartaoId || segueId) && tipo === "receita") return "invalid";
  for (const [id, esperado] of [[cartaoId, "despesa"], [segueId, "receita"]] as const) {
    if (!id) continue;
    const { data, error } = await db.from("fin_itens").select("id, tipo").eq("id", id).maybeSingle();
    if (error) return "db";
    if (!data || data.tipo !== esperado) return "invalid";
  }
  return "ok";
}

/**
 * Grava o valor de um item em um mês (ou deste mês até dezembro do mesmo ano). Mantém pago/via_reserva/nota de linhas que já existem.
 * No primeiro mês aplica também os campos `extra` (via_reserva, nota, pago). Devolve o erro do banco, se houver.
 */
export async function gravarMeses(
  db: SessionDb, userId: string, itemId: string, ano: number, mes: number, valor: number, escopo: "mes" | "proximos",
  extra: { pago?: boolean; via_reserva?: boolean; nota?: string | null },
): Promise<{ error: DbError }> {
  const meses = Array.from({ length: escopo === "proximos" ? 13 - mes : 1 }, (_, i) => mes + i);
  const { data: existentes, error } = await db.from("fin_item_meses").select(MES_COLS).eq("item_id", itemId).eq("ano", ano).in("mes", meses);
  if (error) return { error };
  const porMes = new Map(((existentes ?? []) as Record<string, unknown>[]).map((r) => [Number(r.mes), r]));
  const agora = new Date().toISOString();
  const linhas = meses.map((m) => {
    const antes = porMes.get(m);
    const primeiro = m === mes;
    return {
      user_id: userId, item_id: itemId, ano, mes: m, valor,
      pago: primeiro && extra.pago !== undefined ? extra.pago : Boolean(antes?.pago),
      via_reserva: primeiro && extra.via_reserva !== undefined ? extra.via_reserva : Boolean(antes?.via_reserva),
      nota: primeiro && extra.nota !== undefined ? extra.nota : ((antes?.nota as string | null) ?? null),
      updated_at: agora,
    };
  });
  const r = await db.from("fin_item_meses").upsert(linhas, { onConflict: "item_id,ano,mes" });
  return { error: r.error ?? null };
}
