import assert from "node:assert/strict";
import { test } from "node:test";
import { acumuladoAno, nivelDe, nomeCategoria, statusTetos, TetoBody } from "./tetos.ts";

const g = (categoria: string, valor: number, mes = 11, ano = 2026) => ({ categoria, valor, mes, ano });

test("nome da categoria: apelidos viram a categoria padrão; texto livre fica limpo", () => {
  assert.equal(nomeCategoria("restaurante"), "Restaurantes");
  assert.equal(nomeCategoria("  mercado "), "Mercado");
  assert.equal(nomeCategoria("academia"), "Academia");
});

test("níveis: abaixo de 80% ok, a partir de 80% alerta, a partir de 100% estourou", () => {
  assert.deepEqual([nivelDe(79), nivelDe(80), nivelDe(99), nivelDe(100), nivelDe(250)], ["ok", "alerta", "alerta", "estourou", "estourou"]);
});

test("status dos tetos: soma em centavos, ignora acento e maiúscula, maior % primeiro", () => {
  const st = statusTetos(
    [{ id: "t1", categoria: "Mercado", valor: 1000 }, { id: "t2", categoria: "Restaurantes", valor: 800 }, { id: "t3", categoria: "Lazer", valor: 200 }],
    [g("Mercado", 500.1), g("mercado", 300.2), g("Restaurantes", 900), g("Farmácia e saúde", 50)],
  );
  assert.deepEqual(st.map((s) => [s.categoria, s.gasto, s.pct, s.nivel, s.resta]), [
    ["Restaurantes", 900, 112, "estourou", 0],
    ["Mercado", 800.3, 80, "alerta", 199.7],
    ["Lazer", 0, 0, "ok", 200],
  ]);
});

test("acumulado do ano: até o mês atual, por categoria e por mês; filtro por categoria", () => {
  const gastos = [g("Mercado", 100, 1), g("Mercado", 50.55, 11), g("Lazer", 30, 3), g("Mercado", 999, 12), g("Mercado", 70, 5, 2025)];
  const a = acumuladoAno(gastos, 2026, 11);
  assert.equal(a.total, 180.55);
  assert.equal(a.qtd, 3);
  assert.deepEqual(a.porCategoria.map((c) => [c.categoria, c.total]), [["Mercado", 150.55], ["Lazer", 30]]);
  assert.equal(a.porMes.length, 11);
  assert.equal(a.porMes[0]!.total, 100);
  const m = acumuladoAno(gastos, 2026, 11, "mercado");
  assert.equal(m.total, 150.55);
});

test("corpo do teto: valor em reais com vírgula; zero ou texto é recusado", () => {
  assert.equal(TetoBody.parse({ categoria: "Mercado", valor: "1.500,00" }).valor, 1500);
  assert.equal(TetoBody.safeParse({ categoria: "Mercado", valor: 0 }).success, false);
  assert.equal(TetoBody.safeParse({ categoria: "Mercado", valor: "caro" }).success, false);
});
