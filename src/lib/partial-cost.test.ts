import assert from "node:assert/strict";
import { test } from "node:test";
import { estimatePartialUsage } from "./partial-cost.ts";

test("nada saiu: não há custo (libera a reserva)", () => {
  assert.equal(estimatePartialUsage("claude-opus-5-5", 5000, 0, 0.5), null);
  assert.equal(estimatePartialUsage("claude-opus-5-5", 5000, NaN, 0.5), null);
  assert.equal(estimatePartialUsage("claude-opus-5-5", 5000, -3, 0.5), null);
});

test("saiu texto: entrada + caracteres recebidos ÷ 4, pelo preço do modelo", () => {
  // 4.000 caracteres de entrada = 1.000 tokens; 2.000 de saída = 500 tokens. Opus: US$ 4 e US$ 20 por milhão.
  const u = estimatePartialUsage("claude-opus-5-5", 4000, 2000, 1);
  assert.deepEqual(u, { input: 1000, output: 500, cost: 0.014, model: "claude-opus-5-5" });
});

test("a estimativa nunca passa do valor reservado", () => {
  const u = estimatePartialUsage("claude-opus-5-5", 400_000, 40_000, 0.05);
  assert.equal(u?.cost, 0.05);
});

test("modelo sem preço cadastrado usa o mais caro (nunca zero)", () => {
  const u = estimatePartialUsage("modelo-novo", 4000, 4000, 1);
  assert.ok(u && u.cost > 0);
});

test("entradas inválidas não derrubam nem zeram o custo de quem recebeu texto", () => {
  const u = estimatePartialUsage("claude-opus-5-5", NaN, 400, 0.5);
  assert.ok(u && u.input === 0 && u.output === 100 && u.cost > 0);
  const v = estimatePartialUsage("claude-opus-5-5", 400, 400, NaN);
  assert.ok(v && v.cost > 0);
});
