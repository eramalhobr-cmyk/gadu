import assert from "node:assert/strict";
import { test } from "node:test";
import { item, mes } from "./fixtures.ts";
import { mesclarItens } from "./month.ts";
import { toConfig, toGasto } from "./load.ts";

test("mesclarItens: receitas primeiro, grupo/ordem/nome, mes nulo quando não existe no mês", () => {
  const itens = [item("b", { grupo: "Moradia", nome: "Zé" }), item("a", { grupo: "Moradia", nome: "Ana", ordem: 1 }), item("r", { tipo: "receita", grupo: "Receitas" }), item("c", { grupo: "Casa" })];
  const r = mesclarItens(itens, [mes("a", 10), mes("r", 99, { pago: true }), mes("b", 5, { mes: 10 })], 2026, 11);
  assert.deepEqual(r.map((i) => i.id), ["r", "c", "b", "a"]);
  assert.deepEqual(r.find((i) => i.id === "r")?.mes, { valor: 99, pago: true, via_reserva: false, nota: null });
  assert.equal(r.find((i) => i.id === "b")?.mes, null);
});

test("conversões do banco: numeric vem como texto ou número", () => {
  assert.equal(toGasto({ id: "x", ano: "2026", mes: 11, dia: 5, valor: "45.90", categoria: "Mercado", descricao: null, meio: "pix", origem: "manual" }).valor, 45.9);
  assert.deepEqual(toConfig(null), { dia_adiantamento: 15, dia_restante: 1, adiantamento_pct: 0, receita_principal_id: null, cartao_principal_id: null });
  assert.equal(toConfig({ dia_adiantamento: 20, dia_restante: 5, adiantamento_pct: "40.00" }).adiantamento_pct, 40);
});
