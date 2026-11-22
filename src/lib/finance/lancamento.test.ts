import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizarCategoria, normalizarMeio, validGasto } from "./lancamento.ts";
import { GastoCreate, GastoPatch, ItemCreate, ItemMesBody, ConfigBody } from "./schemas.ts";
import { splitMeta } from "../meta.ts";

const now = Date.parse("2026-11-22T15:00:00Z"); // 22/11/2026, 12h em Brasília

test("validGasto: 'gastei 45 no mercado no pix' como o modelo devolve", () => {
  assert.deepEqual(validGasto({ valor: 45, categoria: "Mercado", descricao: "mercado", meio: "pix" }, now), { valor: 45, categoria: "Mercado", descricao: "mercado", meio: "pix", data: "2026-11-22" });
});
test("validGasto: valor em texto pt-BR, categoria sem acento, meio livre", () => {
  const g = validGasto({ valor: "R$ 1.234,56", categoria: "farmacia e saude", meio: "Cartão no crédito", data: "2026-11-20" }, now);
  assert.deepEqual(g, { valor: 1234.56, categoria: "Farmácia e saúde", descricao: "", meio: "credito", data: "2026-11-20" });
});
test("validGasto: sem proposta quando valor ou data são inválidos (não adivinha)", () => {
  for (const o of [{}, { valor: 0 }, { valor: -3 }, { valor: "abc" }, { valor: 5, data: "2026-11-23" }, { valor: 5, data: "2025-01-01" }, { valor: 5, data: "2026-02-30" }, { valor: 5, data: "ontem" }, { valor: 5, data: 20261120 }]) {
    assert.equal(validGasto(o as never, now), null, JSON.stringify(o));
  }
});
test("validGasto: data vazia vira hoje; categoria desconhecida vira Outros; meio ausente vira débito; descrição curta", () => {
  const g = validGasto({ valor: 10, categoria: "Coisas de empresa", descricao: "x".repeat(500), data: "" }, now)!;
  assert.equal(g.data, "2026-11-22"); assert.equal(g.categoria, "Outros"); assert.equal(g.meio, "debito"); assert.equal(g.descricao.length, 120);
});
test("normalizar: categorias, apelidos e meios", () => {
  assert.equal(normalizarCategoria("SUPERMERCADO"), "Mercado"); assert.equal(normalizarCategoria(42), "Outros"); assert.equal(normalizarCategoria("Combustivel"), "Combustível");
  assert.equal(normalizarMeio("PIX"), "pix"); assert.equal(normalizarMeio("poupança"), "reserva"); assert.equal(normalizarMeio(null), "debito"); assert.equal(normalizarMeio("dinheiro"), "debito");
});

test("splitMeta: gastos propostos viram propostas validadas; lixo é descartado; no máximo 5", () => {
  const meta = JSON.stringify({ gastos: [
    { valor: 45, categoria: "Mercado", meio: "pix", descricao: "mercado" },
    { valor: 0, categoria: "Mercado" },
    { valor: "12,5", categoria: "Lazer", data: "2026-11-21" },
    ...Array.from({ length: 8 }, () => ({ valor: 1 })),
  ] });
  const r = splitMeta(`Anotei.\n<<<META>>>\n${meta}`, now);
  assert.equal(r.gastos.length, 5);
  assert.deepEqual(r.gastos[0], { valor: 45, categoria: "Mercado", descricao: "mercado", meio: "pix", data: "2026-11-22" });
  assert.equal(r.gastos[1].valor, 12.5);
  assert.deepEqual(splitMeta("Oi <<<META>>> {quebrado", now).gastos, []);
  assert.deepEqual(splitMeta("Oi", now).gastos, []);
});

test("schemas: o corpo não carrega user_id (descartado) e valida limites", () => {
  const g = GastoCreate.parse({ ano: 2026, mes: 11, dia: 5, valor: "45,90", user_id: "outra-pessoa", id: "x" });
  assert.equal(g.valor, 45.9); assert.equal(g.categoria, "Outros"); assert.equal(g.meio, "debito"); assert.ok(!("user_id" in g) && !("id" in g));
  for (const bad of [{ ano: 2026, mes: 2, dia: 31, valor: 5 }, { ano: 2026, mes: 13, dia: 1, valor: 5 }, { ano: 2026, mes: 11, dia: 1, valor: 0 }, { ano: 2026, mes: 11, dia: 1, valor: 5, meio: "dinheiro" }, { ano: 1999, mes: 1, dia: 1, valor: 5 }]) {
    assert.equal(GastoCreate.safeParse(bad).success, false, JSON.stringify(bad));
  }
  assert.equal(GastoPatch.safeParse({}).success, false);
  assert.equal(GastoPatch.safeParse({ user_id: "x" }).success, false, "só chave desconhecida = nada para alterar");
  assert.equal(ItemCreate.safeParse({ tipo: "despesa", nome: "  " }).success, false);
  assert.equal(ItemCreate.parse({ tipo: "despesa", nome: "Aluguel", user_id: "x" }).grupo, "Geral");
  assert.equal(ItemMesBody.safeParse({ ano: 2026, mes: 11, valor: 0 }).success, true, "valor 0 remove o mês");
  assert.equal(ItemMesBody.safeParse({ ano: 2026, mes: 11 }).success, false);
  assert.equal(ConfigBody.safeParse({ adiantamento_pct: 101 }).success, false);
  assert.equal(ConfigBody.safeParse({ dia_restante: 0 }).success, false);
});
