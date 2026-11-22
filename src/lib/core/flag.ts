// Interruptor de emergência do Core (servidor). LIGADO por padrão; CORE_MVP=0 volta o chat e a tela Hoje ao comportamento anterior.
// Motivo: quem opera o GaDu pode não ter acesso às variáveis da Vercel na hora; por isso o padrão é ligado e o desligamento é explícito.
export function coreEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = (env.CORE_MVP ?? "").trim().toLowerCase();
  return !["0", "false", "off", "no", "nao", "não"].includes(v);
}
