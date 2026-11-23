// Interruptor de emergência da telemetria de erros (servidor). LIGADO por padrão; TELEMETRIA_ENABLED=0 desliga
// a rota /api/telemetria/*, o registro de erros do servidor e a lista no Admin. Mesmo desenho de GOALS_ENABLED.
export function telemetriaEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = (env.TELEMETRIA_ENABLED ?? "").trim().toLowerCase();
  return !["0", "false", "off", "no", "nao", "não"].includes(v);
}
