import assert from "node:assert/strict";
import { test } from "node:test";
import { formatBRL, formatBRLRound, parseValor, toCents } from "./money.ts";
import { diaNoMes, diasNoMes, hojeSP, lerData, proximoMes } from "./datas.ts";
import { financeEnabled } from "./flag.ts";

test("parseValor: formatos pt-BR e inválidos", () => {
  const ok: [unknown, number][] = [[45, 45], ["45", 45], ["45,9", 45.9], ["45,90", 45.9], ["1.234,56", 1234.56], ["R$ 45", 45], ["r$45,5", 45.5], ["45.50", 45.5], ["1.234", 1234], ["0,01", 0.01], [10.005, 10.01]];
  for (const [i, o] of ok) assert.equal(parseValor(i), o, String(i));
  for (const bad of [0, -1, "0", "-5", "abc", "", "  ", null, undefined, NaN, Infinity, "1,2,3", "1.2.3,4x", "9999999999", {}, [], "45 reais"]) assert.equal(parseValor(bad), null, String(bad));
});

test("centavos: sem erro de ponto flutuante", () => {
  assert.equal(toCents(0.1 + 0.2), 30);
  assert.equal(formatBRL(1234.5), "R$ 1.234,50");
  assert.equal(formatBRLRound(1234.5), "R$ 1.235");
});

test("datas: Brasília, dias do mês, validação", () => {
  assert.deepEqual(hojeSP(Date.parse("2026-11-23T02:00:00Z")), { ano: 2026, mes: 11, dia: 22 }, "02h UTC ainda é dia 22 em Brasília");
  assert.deepEqual(hojeSP(Date.parse("2026-11-23T03:00:00Z")), { ano: 2026, mes: 11, dia: 23 });
  assert.equal(diasNoMes({ ano: 2028, mes: 2 }), 29);
  assert.equal(diasNoMes({ ano: 2027, mes: 2 }), 28);
  assert.equal(diaNoMes({ ano: 2026, mes: 4 }, 31), 30);
  assert.deepEqual(proximoMes({ ano: 2026, mes: 12 }), { ano: 2027, mes: 1 });
  assert.deepEqual(lerData("2026-11-05"), { ano: 2026, mes: 11, dia: 5 });
  for (const bad of ["2026-02-31", "2026-13-01", "26-11-05", "2026-11-5", null, 5, "1999-01-01"]) assert.equal(lerData(bad), null, String(bad));
});

test("FINANCE_ENABLED: ligado por padrão, desliga com 0/false/off", () => {
  assert.equal(financeEnabled({}), true);
  assert.equal(financeEnabled({ FINANCE_ENABLED: "1" }), true);
  assert.equal(financeEnabled({ FINANCE_ENABLED: "" }), true);
  for (const v of ["0", "false", "OFF", " no ", "não"]) assert.equal(financeEnabled({ FINANCE_ENABLED: v }), false, v);
});
