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

export function costUsd(u: Usage): number {
  const p = PRICES[priceKey(u.model)];
  if (!p) return 0;
  const m = 1_000_000;
  return (
    ((u.input_tokens ?? 0) * p.input +
      (u.output_tokens ?? 0) * p.output +
      (u.cache_read_input_tokens ?? 0) * p.cacheRead +
      (u.cache_creation_input_tokens ?? 0) * p.cacheWrite) / m
  );
}
