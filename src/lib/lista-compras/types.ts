export const NOME_ITEM_MAX = 120;
export const ITENS_POR_PAGINA = 50;
export const LISTA_COMPRAS_ATUALIZADA = "gadu:lista-compras-atualizada";
export const ITEM_COLS = "id, nome, comprado";

export type ItemCompra = { id: string; nome: string; comprado: boolean };

export function nomeItem(v: unknown): string | null {
  if (typeof v !== "string" || v.includes("\0")) return null;
  const nome = v.trim().replace(/\s+/g, " ");
  return nome && nome.length <= NOME_ITEM_MAX ? nome : null;
}

/** Mesma transformação da coluna gerada nome_chave, independente do locale. */
export const nomeChave = (nome: string) => nome.replace(/[A-ZÀ-ÖØ-ÞŸ]/g, (letra) => letra.toLowerCase());
