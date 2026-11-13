import assert from "node:assert/strict";
import { test } from "node:test";
import { checkDailyQuota, checkLegacyQuota, checkMonthlyBudget, checkProviderSpend, isMissingFunction, safeRpc } from "./chat-budget-guard.ts";

const ok = <T>(data: T) => ({ data, error: null });
const failed = { data: null, error: { message: "database unavailable" } };

test("daily quota permits only a well-formed allowed response", () => {
  assert.deepEqual(checkDailyQuota(ok({ allowed: true, used: 3, limit: 150 })), { allowed: true, used: 3, limit: 150 });
  assert.deepEqual(checkDailyQuota(ok({ allowed: false, used: 150, limit: 150 })), { allowed: false, reason: "daily", used: 150, limit: 150 });
  assert.deepEqual(checkDailyQuota(ok({ allowed: false, used: 0, limit: 0 })), { allowed: false, reason: "daily", used: 0, limit: 0 });
  for (const result of [
    failed, ok(null), ok(undefined), ok(true), ok(1), ok("true"), ok([]),
    ok({ allowed: "true", used: 1, limit: 2 }), ok({ allowed: true, used: -1, limit: 2 }), ok({ allowed: true, used: 1.5, limit: 2 }),
    ok({ allowed: true, used: 1 }), ok({ allowed: true, used: 3, limit: 2 }),
  ]) {
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

test("monthly budget accepts numeric text in scientific notation", () => {
  assert.deepEqual(checkMonthlyBudget(ok("1e-7"), 5), { allowed: true });
  assert.deepEqual(checkMonthlyBudget(ok("0.009556"), 5), { allowed: true });
  assert.deepEqual(checkMonthlyBudget(ok("5.0"), 5), { allowed: false, reason: "monthly" });
});

test("safeRpc turns thrown errors and empty results into errors", async () => {
  assert.deepEqual(await safeRpc(async () => { throw new Error("fetch failed"); }), { data: null, error: { message: "rpc request failed" } });
  assert.deepEqual(await safeRpc(async () => undefined as never), { data: null, error: { message: "invalid rpc response" } });
  assert.deepEqual(await safeRpc(async () => ok(true)), ok(true));
  // Resultado de safeRpc com exceção nunca libera a cota.
  assert.deepEqual(checkDailyQuota(await safeRpc<unknown>(async () => { throw new Error("timeout"); })), { allowed: false, reason: "unavailable" });
});

test("provider spend fails closed on errors and invalid rows", () => {
  assert.deepEqual(checkProviderSpend(ok([])), { ok: true, spentBy: {} });
  assert.deepEqual(checkProviderSpend(ok([{ provider: "anthropic", cost_usd: 1.5 }, { provider: "gateway", cost_usd: "0.25" }])), { ok: true, spentBy: { anthropic: 1.5, gateway: 0.25 } });
  for (const result of [failed, ok(null), ok({}), ok([{ provider: "anthropic", cost_usd: null }]), ok([{ provider: "", cost_usd: 1 }]), ok([{ provider: "gateway", cost_usd: -2 }]), ok([{ cost_usd: 1 }])]) {
    assert.deepEqual(checkProviderSpend(result as never), { ok: false });
  }
});

test("daily quota rejects a positive answer that did not consume", () => {
  assert.deepEqual(checkDailyQuota(ok({ allowed: true, used: 0, limit: 150 })), { allowed: false, reason: "unavailable" });
});

test("legacy quota fallback only for a missing function", () => {
  assert.equal(isMissingFunction({ code: "PGRST202", message: "Could not find the function" }), true);
  assert.equal(isMissingFunction({ code: "42883" }), true);
  for (const e of [null, {}, { code: "PGRST301" }, { code: "57014" }, { message: "PGRST202" }]) assert.equal(isMissingFunction(e), false);
  assert.deepEqual(checkLegacyQuota(ok(true), 150), { allowed: true, used: null, limit: 150 });
  assert.deepEqual(checkLegacyQuota(ok(false), 150), { allowed: false, reason: "daily", used: 150, limit: 150 });
  for (const r of [failed, ok(null), ok("true"), ok(1)]) assert.deepEqual(checkLegacyQuota(r as never, 150), { allowed: false, reason: "unavailable" });
});
