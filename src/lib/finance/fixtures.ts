// Dados SINTÉTICOS dos testes de Finanças (nenhum valor ou nome real).
import type { Config, Gasto, Item, ItemMes } from "./types.ts";

export const item = (id: string, over: Partial<Item> = {}): Item => ({
  id, tipo: "despesa", grupo: "Geral", nome: `Conta ${id}`, nota: null, ordem: 0, dia: 10, dia_estimado: false, movivel: false, nao_caixa: false, cartao_id: null, segue_id: null, ...over,
});
export const mes = (item_id: string, valor: number, over: Partial<ItemMes> = {}): ItemMes => ({ item_id, ano: 2026, mes: 11, valor, pago: false, via_reserva: false, nota: null, ...over });
export const gasto = (id: string, valor: number, over: Partial<Gasto> = {}): Gasto => ({ id, ano: 2026, mes: 11, dia: 5, valor, categoria: "Mercado", descricao: "", meio: "debito", origem: "manual", ...over });
export const config = (over: Partial<Config> = {}): Config => ({ dia_adiantamento: 15, dia_restante: 1, adiantamento_pct: 0, receita_principal_id: null, cartao_principal_id: null, ...over });
