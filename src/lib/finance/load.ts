// Leitura dos dados de Finanças com o cliente da SESSÃO da pessoa (RLS): nunca a chave secreta.
// Usado pela rota de resumo e pela fonte `finance` do Core. Qualquer erro de leitura lança (o chamador decide: 503 ou "indisponível").
import type { SessionDb } from "../core/types.ts";
import { CONFIG_PADRAO, type Config, type Gasto, type Item, type ItemMes } from "./types.ts";

export const ITEM_COLS = "id, tipo, grupo, nome, nota, ordem, dia, dia_estimado, movivel, nao_caixa, cartao_id, segue_id";
export const MES_COLS = "item_id, ano, mes, valor, pago, via_reserva, nota";
export const GASTO_COLS = "id, ano, mes, dia, valor, categoria, descricao, meio, origem";
export const CONFIG_COLS = "dia_adiantamento, dia_restante, adiantamento_pct, receita_principal_id, cartao_principal_id";

const num = (v: unknown) => Number(v);

export const toItem = (r: Record<string, unknown>): Item => ({
  id: String(r.id), tipo: r.tipo as Item["tipo"], grupo: String(r.grupo), nome: String(r.nome), nota: (r.nota as string | null) ?? null, ordem: num(r.ordem),
  dia: r.dia == null ? null : num(r.dia), dia_estimado: Boolean(r.dia_estimado), movivel: Boolean(r.movivel), nao_caixa: Boolean(r.nao_caixa),
  cartao_id: (r.cartao_id as string | null) ?? null, segue_id: (r.segue_id as string | null) ?? null,
});
export const toItemMes = (r: Record<string, unknown>): ItemMes => ({
  item_id: String(r.item_id), ano: num(r.ano), mes: num(r.mes), valor: num(r.valor), pago: Boolean(r.pago), via_reserva: Boolean(r.via_reserva), nota: (r.nota as string | null) ?? null,
});
export const toGasto = (r: Record<string, unknown>): Gasto => ({
  id: String(r.id), ano: num(r.ano), mes: num(r.mes), dia: num(r.dia), valor: num(r.valor), categoria: String(r.categoria), descricao: String(r.descricao ?? ""),
  meio: r.meio as Gasto["meio"], origem: r.origem as Gasto["origem"],
});
export const toConfig = (r: Record<string, unknown> | null): Config => (r ? {
  dia_adiantamento: num(r.dia_adiantamento), dia_restante: num(r.dia_restante), adiantamento_pct: num(r.adiantamento_pct),
  receita_principal_id: (r.receita_principal_id as string | null) ?? null, cartao_principal_id: (r.cartao_principal_id as string | null) ?? null,
} : { ...CONFIG_PADRAO });

export type DadosMes = { itens: Item[]; meses: ItemMes[]; gastos: Gasto[]; config: Config; configSalva: boolean };

/** Filtra também por user_id (a SESSÃO), como defesa em profundidade além da RLS. Itens, valores do ano (e do seguinte, para a previsão de dezembro), gastos do mês e config. */
export async function loadMes(db: SessionDb, userId: string, ano: number, mes: number): Promise<DadosMes> {
  const [itens, meses, gastos, config] = await Promise.all([
    db.from("fin_itens").select(ITEM_COLS).eq("user_id", userId).order("ordem").limit(1000),
    db.from("fin_item_meses").select(MES_COLS).eq("user_id", userId).in("ano", [ano, ano + 1]).limit(10000),
    db.from("fin_gastos").select(GASTO_COLS).eq("user_id", userId).eq("ano", ano).eq("mes", mes).order("dia", { ascending: false }).limit(1000),
    db.from("fin_config").select(CONFIG_COLS).eq("user_id", userId).maybeSingle(),
  ]);
  for (const r of [itens, meses, gastos, config]) if (r.error) throw new Error("fin_leitura");
  return {
    itens: ((itens.data ?? []) as Record<string, unknown>[]).map(toItem),
    meses: ((meses.data ?? []) as Record<string, unknown>[]).map(toItemMes),
    gastos: ((gastos.data ?? []) as Record<string, unknown>[]).map(toGasto),
    config: toConfig((config.data as Record<string, unknown> | null) ?? null),
    configSalva: Boolean(config.data),
  };
}
