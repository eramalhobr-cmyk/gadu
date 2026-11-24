// Interruptor de emergência de Compras (servidor). LIGADO por padrão: só lê o Gmail da própria pessoa e não grava nada.
// COMPRAS_ENABLED=0 esconde a tela, desliga /api/compras e a fonte de compras na conversa.
export function comprasEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = (env.COMPRAS_ENABLED ?? "").trim().toLowerCase();
  return !["0", "false", "off", "no", "nao", "não"].includes(v);
}
