/** Fail closed when a required quota or budget RPC cannot be verified. */
export type RpcResult<T> = { data: T | null; error: { message?: string } | null };

export type GuardResult =
  | { allowed: true }
  | { allowed: false; reason: "unavailable" | "daily" | "monthly" };

export function checkDailyQuota(result: RpcResult<boolean>): GuardResult {
  if (result.error || typeof result.data !== "boolean") return { allowed: false, reason: "unavailable" };
  return result.data ? { allowed: true } : { allowed: false, reason: "daily" };
}

export function checkMonthlyBudget(result: RpcResult<number | string>, budgetUsd: number): GuardResult {
  if (result.error || result.data === null || result.data === undefined) return { allowed: false, reason: "unavailable" };
  if (typeof result.data !== "number" && (typeof result.data !== "string" || !/^\d+(\.\d+)?$/.test(result.data))) {
    return { allowed: false, reason: "unavailable" };
  }
  const spent = Number(result.data);
  if (!Number.isFinite(spent) || spent < 0 || !Number.isFinite(budgetUsd) || budgetUsd < 0) {
    return { allowed: false, reason: "unavailable" };
  }
  return spent >= budgetUsd ? { allowed: false, reason: "monthly" } : { allowed: true };
}
