import { test } from "node:test";
import assert from "node:assert/strict";
import { descreve, escala, linha, pctDe, resumoTarefas } from "./painel.ts";

test("porcentagem sem base é null, nunca 0% inventado", () => {
  assert.equal(pctDe(1, 0), null);
  assert.equal(pctDe(3, 6), 50);
  assert.equal(pctDe(9, 6), 100);
});

test("escala e linha", () => {
  assert.equal(escala([{ label: "a", value: 0 }]), null);
  assert.deepEqual(escala([{ label: "a", value: 50 }, { label: "b", value: 100 }]), [50, 100]);
  assert.equal(linha([1]), "");
  assert.equal(linha([0, 10], 120, 32), "2,30 118,2");
});

test("descrição falável", () => {
  assert.equal(descreve([{ label: "jan", value: 1 }, { label: "fev", value: 3 }], String), "jan: 1; fev: 3. Maior: fev.");
  assert.equal(descreve([], String), "Sem dados.");
});

test("resumo de tarefas no fuso de São Paulo", () => {
  const r = resumoTarefas(
    [{ due_date: "2026-11-20" }, { due_date: "2026-11-23" }, { due_date: null }],
    [{ done_at: "2026-11-23T13:00:00Z" }, { done_at: "2026-11-23T02:30:00Z" }, { done_at: "2026-11-21T15:00:00Z" }],
    "2026-11-23",
  );
  assert.equal(r.abertas, 3);
  assert.equal(r.atrasadas, 1);
  assert.equal(r.paraHoje, 1);
  assert.equal(r.feitasHoje, 1, "23h30 de 22/11 em São Paulo não conta como hoje");
  assert.equal(r.feitas7, 3);
  assert.equal(r.serie.length, 7);
  assert.equal(r.serie[6].label, "hoje");
});
