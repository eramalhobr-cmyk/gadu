/** Fail closed when a required quota or budget RPC cannot be verified. */
export type RpcResult<T> = { data: T | null; error: { message?: string } | null };

export type GuardResult =
  | { allowed: true }
  | { allowed: false; reason: "unavailable" | "monthly" };

export type DailyResult =
  | { allowed: true; used: number | null; limit: number }
  | { allowed: false; reason: "daily"; used: number; limit: number }
  | { allowed: false; reason: "unavailable" };

/** Valor monetário vindo do banco: número finito ≥ 0, ou texto numérico (inclui notação científica). */
function money(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? v : null;
  if (typeof v === "string" && /^\+?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(v.trim())) {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  return null;
}

/**
 * Executa uma RPC obrigatória sem deixar exceções escaparem: falha de rede, timeout ou erro inesperado
 * viram `error`, para a decisão fail-closed tratar tudo do mesmo jeito.
 */
export async function safeRpc<T>(call: () => PromiseLike<RpcResult<T>>): Promise<RpcResult<T>> {
  try {
    const r = await call();
    if (!r || typeof r !== "object") return { data: null, error: { message: "invalid rpc response" } };
    return r;
  } catch {
    return { data: null, error: { message: "rpc request failed" } };
  }
}

const count = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null);

/**
 * Resposta de consume_daily_quota(): {"allowed": bool, "used": int, "limit": int}.
 * Só um objeto com esse formato exato libera; qualquer outra coisa bloqueia (fail closed).
 */
export function checkDailyQuota(result: RpcResult<unknown>): DailyResult {
  if (result.error || !result.data || typeof result.data !== "object" || Array.isArray(result.data)) return { allowed: false, reason: "unavailable" };
  const d = result.data as { allowed?: unknown; used?: unknown; limit?: unknown };
  const used = count(d.used), limit = count(d.limit);
  if (typeof d.allowed !== "boolean" || used === null || limit === null) return { allowed: false, reason: "unavailable" };
  // Resposta positiva coerente: consumiu ao menos 1 e não passou do limite.
  if (d.allowed && (used < 1 || used > limit)) return { allowed: false, reason: "unavailable" };
  return d.allowed ? { allowed: true, used, limit } : { allowed: false, reason: "daily", used, limit };
}

export function checkMonthlyBudget(result: RpcResult<number | string>, budgetUsd: number): GuardResult {
  if (result.error || result.data === null || result.data === undefined) return { allowed: false, reason: "unavailable" };
  const spent = money(result.data);
  if (spent === null || !Number.isFinite(budgetUsd) || budgetUsd < 0) return { allowed: false, reason: "unavailable" };
  return spent >= budgetUsd ? { allowed: false, reason: "monthly" } : { allowed: true };
}

export type ProviderSpend = { ok: true; spentBy: Record<string, number> } | { ok: false };

/**
 * Gasto do mês por provedor (limites definidos pela pessoa em Ajustes). Sem esse dado não dá para
 * saber se um motor passou do limite: falha ou linha inválida bloqueia a chamada (fail closed).
 */
export function checkProviderSpend(result: RpcResult<unknown>): ProviderSpend {
  if (result.error || !Array.isArray(result.data)) return { ok: false };
  const spentBy: Record<string, number> = {};
  for (const row of result.data as unknown[]) {
    const r = (row ?? {}) as { provider?: unknown; cost_usd?: unknown };
    const cost = money(r.cost_usd);
    if (typeof r.provider !== "string" || !r.provider || cost === null) return { ok: false };
    spentBy[r.provider] = (spentBy[r.provider] ?? 0) + cost;
  }
  return { ok: true, spentBy };
}

/** O banco ainda não tem a função nova (migração não aplicada): PostgREST PGRST202 ou Postgres 42883. */
export function isMissingFunction(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "PGRST202" || code === "42883";
}

/**
 * Transição (só enquanto a migração 20261113120001 não estiver aplicada): resposta booleana da função
 * antiga consume_quota(limite do servidor). Mantém o comportamento de hoje em vez de bloquear todos.
 */
export function checkLegacyQuota(result: RpcResult<unknown>, limit: number): DailyResult {
  if (result.error || typeof result.data !== "boolean" || !Number.isInteger(limit) || limit < 0) return { allowed: false, reason: "unavailable" };
  return result.data ? { allowed: true, used: null, limit } : { allowed: false, reason: "daily", used: limit, limit };
}
