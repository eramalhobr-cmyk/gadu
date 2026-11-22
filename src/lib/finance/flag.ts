// Interruptor de emergência de Finanças (servidor). LIGADO por padrão; FINANCE_ENABLED=0 esconde a tela e desliga
// as rotas /api/finance/*, a fonte `finance` do Core e o lançamento de gasto pela conversa.
// Mesmo desenho do CORE_MVP: quem opera pode não ter acesso às variáveis na hora, então o padrão é ligado e o desligamento é explícito.
export function financeEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = (env.FINANCE_ENABLED ?? "").trim().toLowerCase();
  return !["0", "false", "off", "no", "nao", "não"].includes(v);
}
