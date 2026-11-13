// Preço por milhão de tokens (US$), para estimar o gasto de cada resposta.
// Fonte: tabelas oficiais da Anthropic e do Vercel AI Gateway (mesmo preço). Revisar quando trocar de modelo.
type Price = { input: number; output: number; cacheRead: number; cacheWrite: number };

const PRICES: Record<string, Price> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  "gemini-3.5-flash": { input: 1.5, output: 9, cacheRead: 0.15, cacheWrite: 1.5 },
};

export type Usage = {
  model: string;
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

/** Normaliza "anthropic/claude-opus-5.5" e "claude-opus-5-5" para a mesma chave. */
export function priceKey(model: string): string {
  return model.replace(/^[a-z]+\//, "").replace(/\./g, "-");
}

/** Modelo sem preço cadastrado: usa o mais caro da tabela (nunca zero, para não furar o teto de gasto). */
const FALLBACK: Price = Object.values(PRICES).reduce((a, b) => (b.output > a.output ? b : a));
const priceOf = (model: string): Price => PRICES[priceKey(model)] ?? FALLBACK;
export const isKnownModel = (model: string) => Boolean(PRICES[priceKey(model)]);

export function costUsd(u: Usage): number {
  const p = priceOf(u.model);
  const m = 1_000_000;
  return (
    ((u.input_tokens ?? 0) * p.input +
      (u.output_tokens ?? 0) * p.output +
      (u.cache_read_input_tokens ?? 0) * p.cacheRead +
      (u.cache_creation_input_tokens ?? 0) * p.cacheWrite) / m
  );
}

/**
 * Estimativa de custo máximo de uma chamada, para reservar orçamento antes de chamar a IA.
 * Entrada estimada em ~3 caracteres por token; saída pelo máximo configurado. Sempre ≥ 0.
 */
export function estimateMaxCost(model: string, inputChars: number, maxOutputTokens: number): number {
  const p = priceOf(model);
  const input = Math.max(0, Math.ceil((Number.isFinite(inputChars) ? inputChars : 0) / 3));
  const output = Math.max(0, Number.isFinite(maxOutputTokens) ? maxOutputTokens : 0);
  return (input * p.input + output * p.output) / 1_000_000;
}
