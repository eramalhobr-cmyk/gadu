import test from "node:test";
import assert from "node:assert/strict";
import { cleanName, needsOnboarding, nextStep, ONBOARDING_STEPS, ONBOARDING_VERSION, parseOnboarding, prevStep, STEPS, withOnboarding } from "./onboarding.ts";

const AT = new Date("2026-11-23T10:00:00.000Z");

test("três passos, na ordem: nome, voz, Google", () => {
  assert.deepEqual([...ONBOARDING_STEPS], ["nome", "voz", "google"]);
  assert.equal(nextStep("nome"), "voz");
  assert.equal(nextStep("google"), null);
  assert.equal(prevStep("nome"), null);
  assert.equal(prevStep("google"), "voz");
  for (const s of ONBOARDING_STEPS) {
    assert.ok(STEPS[s].title.length > 0 && STEPS[s].say.length > 20, s);
    assert.doesNotMatch(STEPS[s].text, /Beta|Planejado|Core|token/i, s);
  }
});

test("a preferência fica em settings.onboarding e preserva as outras chaves", () => {
  const novo = withOnboarding({ tips: ["hoje"], blocked: ["x"], briefing: { enabled: true } }, "skipped", AT);
  assert.deepEqual(novo, { tips: ["hoje"], blocked: ["x"], briefing: { enabled: true }, onboarding: { v: ONBOARDING_VERSION, status: "skipped", at: "2026-11-23T10:00:00.000Z" } });
  assert.deepEqual(parseOnboarding(novo), { v: ONBOARDING_VERSION, status: "skipped", at: "2026-11-23T10:00:00.000Z" });
  assert.deepEqual(withOnboarding(null, "done", AT), { onboarding: { v: 1, status: "done", at: AT.toISOString() } });
  assert.deepEqual(withOnboarding([1, 2], "done", AT), { onboarding: { v: 1, status: "done", at: AT.toISOString() } }, "settings fora do formato não vaza");
});

test("parseOnboarding: o que não tem o formato conta como nunca feito", () => {
  for (const ruim of [null, undefined, {}, { onboarding: null }, { onboarding: "done" }, { onboarding: { status: "talvez", v: 1 } }, { onboarding: { status: "done" } }, 5]) assert.equal(parseOnboarding(ruim), null, JSON.stringify(ruim));
});

test("o guia abre sozinho só para pessoa nova", () => {
  assert.equal(needsOnboarding({}), true);
  assert.equal(needsOnboarding(null), true);
  assert.equal(needsOnboarding({ tips: [] }), true);
  assert.equal(needsOnboarding({ tips: ["hoje"] }), false, "quem já usa o app não é interrompido");
  assert.equal(needsOnboarding({ onboarding: { v: 1, status: "skipped", at: "" } }), false, "pulou: não volta sozinho");
  assert.equal(needsOnboarding({ onboarding: { v: 1, status: "done", at: "" } }), false);
});

test("cleanName: tira espaços e símbolos, limita o tamanho", () => {
  assert.equal(cleanName("  Maria   Clara \n"), "Maria Clara");
  assert.equal(cleanName("<b>Ana</b>"), "b Ana /b");
  assert.equal(cleanName("a".repeat(100)).length, 40);
  assert.equal(cleanName("   "), "");
});
