// Interruptor de emergência de Metas (servidor). LIGADO por padrão; GOALS_ENABLED=0 esconde a tela e o resumo do Hoje e desliga
// as rotas /api/goals/*, a fonte `goals` do Core e as propostas de atualização pela conversa.
// Mesmo desenho de FINANCE_ENABLED e CORE_MVP: o padrão é ligado e o desligamento é explícito.
export function goalsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = (env.GOALS_ENABLED ?? "").trim().toLowerCase();
  return !["0", "false", "off", "no", "nao", "não"].includes(v);
}
