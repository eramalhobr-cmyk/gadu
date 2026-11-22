// Dinheiro: cálculos em centavos inteiros (sem erro de ponto flutuante); texto em pt-BR.
export const toCents = (n: number): number => Math.round(n * 100);
export const fromCents = (c: number): number => c / 100;

/** "R$ 1.234,56". */
export function formatBRL(n: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n).replace(/ /g, " ");
}

/** Arredondado, sem centavos, para cartões grandes: "R$ 1.235". */
export function formatBRLRound(n: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n).replace(/ /g, " ");
}

export const MAX_VALOR = 999_999_999.99;

/**
 * Valor em reais a partir de número ou texto pt-BR: "45", "45,9", "1.234,56", "R$ 45", "45.50".
 * Devolve null se não for um valor positivo e válido. Arredonda para centavos.
 */
export function parseValor(input: unknown): number | null {
  let n: number;
  if (typeof input === "number") n = input;
  else if (typeof input === "string") {
    let t = input.trim().replace(/^r\$\s*/i, "").replace(/\s+/g, "");
    if (!t || !/^\d[\d.,]*$/.test(t)) return null;
    if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
    if ((t.match(/\./g) ?? []).length > 1) return null;
    n = Number(t);
  } else return null;
  if (!Number.isFinite(n)) return null;
  const c = toCents(n);
  if (c <= 0 || c > toCents(MAX_VALOR)) return null;
  return fromCents(c);
}
