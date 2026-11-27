// Interruptor de emergência dos sinais de Investimentos (servidor). LIGADO por padrão;
// INVESTIMENTOS_SINAIS_ENABLED=0 desliga /api/investimentos/sinais (404) e o bloco de sinais da conversa.
// Mesmo desenho de FINANCE_ENABLED e GOALS_ENABLED.
export function sinaisEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = (env.INVESTIMENTOS_SINAIS_ENABLED ?? "").trim().toLowerCase();
  return !["0", "false", "off", "no", "nao", "não"].includes(v);
}
