import assert from "node:assert/strict";
import { test } from "node:test";
import { checkDailyQuota, checkMonthlyBudget } from "./chat-budget-guard.ts";

const ok = <T>(data: T) => ({ data, error: null });
const failed = { data: null, error: { message: "database unavailable" } };

test("daily quota permits only explicit true", () => {
  assert.deepEqual(checkDailyQuota(ok(true)), { allowed: true });
  assert.deepEqual(checkDailyQuota(ok(false)), { allowed: false, reason: "daily" });
  for (const result of [failed, ok(null), ok(undefined), ok(1), ok("true")]) {
    assert.deepEqual(checkDailyQuota(result as never), { allowed: false, reason: "unavailable" });
  }
});

test("monthly budget blocks exhausted spending", () => {
  assert.deepEqual(checkMonthlyBudget(ok(5), 5), { allowed: false, reason: "monthly" });
  assert.deepEqual(checkMonthlyBudget(ok("4.50"), 5), { allowed: true });
  assert.deepEqual(checkMonthlyBudget(ok(4), 5), { allowed: true });
});

test("monthly budget fails closed for invalid RPC responses", () => {
  for (const result of [failed, ok(null), ok(undefined), ok(""), ok("abc"), ok(-1), ok(NaN), ok(Infinity)]) {
    assert.deepEqual(checkMonthlyBudget(result as never, 5), { allowed: false, reason: "unavailable" });
  }
  assert.deepEqual(checkMonthlyBudget(ok(0), NaN), { allowed: false, reason: "unavailable" });
  assert.deepEqual(checkMonthlyBudget(ok(0), -1), { allowed: false, reason: "unavailable" });
});
