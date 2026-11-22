// Número digitado em pt-BR ("1.250,5", "5,5", "2") ou vindo como number. Arredonda para 2 casas. null se não for número válido.
export const MAX_NUM = 1_000_000_000;

export function parseNumero(input: unknown): number | null {
  let n: number;
  if (typeof input === "number") n = input;
  else if (typeof input === "string") {
    let t = input.trim().replace(/\s+/g, "");
    if (!t || !/^-?\d[\d.,]*$/.test(t)) return null;
    if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
    if ((t.match(/\./g) ?? []).length > 1) return null;
    n = Number(t);
  } else return null;
  if (!Number.isFinite(n) || Math.abs(n) >= MAX_NUM) return null;
  return Math.round(n * 100) / 100;
}

/** "1.250,5", sem zeros inúteis. */
export const fmtNum = (n: number): string => (Math.round(n * 100) / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
