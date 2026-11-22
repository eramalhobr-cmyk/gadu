import { costUsd } from "./pricing.ts";

// S-02: resposta cancelada ou interrompida no meio já gerou custo no provedor, mesmo sem o relatório final de uso.
// Estimativa: ~4 caracteres por token, na entrada e na saída, limitada ao valor reservado (o máximo que
// a política aceitou para esta resposta). Se nada saiu, não há o que cobrar: o chamador libera a reserva.
export const CHARS_PER_TOKEN = 4;

export type PartialUsage = { input: number; output: number; cost: number; model: string };

/** `null` quando nenhum texto saiu (libera a reserva). Senão, o consumo estimado, nunca acima de `reservedUsd`. */
export function estimatePartialUsage(model: string, inputChars: number, outputChars: number, reservedUsd: number): PartialUsage | null {
  if (!Number.isFinite(outputChars) || outputChars <= 0) return null;
  const chars = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
  const input = Math.ceil(chars(inputChars) / CHARS_PER_TOKEN);
  const output = Math.ceil(chars(outputChars) / CHARS_PER_TOKEN);
  const raw = costUsd({ model, input_tokens: input, output_tokens: output });
  const cap = Number.isFinite(reservedUsd) && reservedUsd > 0 ? reservedUsd : raw;
  const cost = Math.round(Math.min(raw, cap) * 1e6) / 1e6;
  return { input, output, cost, model };
}
