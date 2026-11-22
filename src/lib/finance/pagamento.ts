// Marcar como pago respeitando os vínculos (especificação §5.2). Função pura: devolve QUAIS itens mudam.
//  - Cartão: marcar o cartão marca as assinaturas vinculadas; marcar uma assinatura sozinha marca o cartão (e todas).
//  - Segue: marcar a receita marca os itens que seguem ela (já vêm descontados quando o salário entra).
// O mesmo vale para desmarcar. Item sem vínculo muda sozinho.
import type { Item } from "./types.ts";

export function idsParaMarcar(itens: Item[], itemId: string): string[] | null {
  const alvo = itens.find((i) => i.id === itemId);
  if (!alvo) return null;
  const raiz = alvo.cartao_id && itens.some((i) => i.id === alvo.cartao_id) ? alvo.cartao_id : alvo.id;
  const ids = new Set<string>([raiz]);
  for (const i of itens) if (i.cartao_id === raiz || i.segue_id === raiz) ids.add(i.id);
  return [...ids];
}
