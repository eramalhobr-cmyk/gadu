// Junta o cadastro de itens com o valor/estado de um mês (para a tela e para o Core).
import type { Item, ItemMes } from "./types.ts";

export type ItemComMes = Item & { mes: { valor: number; pago: boolean; via_reserva: boolean; nota: string | null } | null };

/** Receitas primeiro, depois despesas; dentro de cada tipo por grupo, ordem e nome. `mes` é null se o item não existe naquele mês. */
export function mesclarItens(itens: Item[], meses: ItemMes[], ano: number, mes: number): ItemComMes[] {
  const doMes = new Map(meses.filter((m) => m.ano === ano && m.mes === mes).map((m) => [m.item_id, m]));
  const cmp = (a: string, b: string) => a.localeCompare(b, "pt-BR");
  return itens
    .map((i): ItemComMes => {
      const m = doMes.get(i.id);
      return { ...i, mes: m ? { valor: m.valor, pago: m.pago, via_reserva: m.via_reserva, nota: m.nota } : null };
    })
    .sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === "receita" ? -1 : 1) || cmp(a.grupo, b.grupo) || a.ordem - b.ordem || cmp(a.nome, b.nome));
}
