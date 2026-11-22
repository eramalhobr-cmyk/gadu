import assert from "node:assert/strict";
import { test } from "node:test";
import { config, gasto, item, mes } from "./fixtures.ts";
import { resumoMensal } from "./summary.ts";

const base = { ano: 2026, mes: 11 };

test("mês vazio: tudo zero, sem avisos", () => {
  const r = resumoMensal({ itens: [], meses: [], gastos: [], config: null, ...base });
  assert.equal(r.receitas, 0); assert.equal(r.despesas, 0); assert.equal(r.sobra, 0); assert.equal(r.pctPago, 0);
  assert.deepEqual(r.diaADia.porCategoria, []); assert.deepEqual(r.avisos, []); assert.equal(r.cartao, null);
});

test("§5.1: receitas, contas, pago, dia a dia e sobra", () => {
  const itens = [item("sal", { tipo: "receita" }), item("alu"), item("luz")];
  const meses = [mes("sal", 5000, { pago: true }), mes("alu", 1500, { pago: true }), mes("luz", 200.5)];
  const gastos = [gasto("g1", 50.25), gasto("g2", 30, { categoria: "Lazer", meio: "pix" }), gasto("g3", 20, { meio: "reserva" })];
  const r = resumoMensal({ itens, meses, gastos, config: null, ...base });
  assert.equal(r.receitas, 5000); assert.equal(r.recebido, 5000); assert.equal(r.aReceber, 0);
  assert.deepEqual(r.contas, { total: 1700.5, pago: 1500, aberto: 200.5, qtd: 2, qtdPagas: 1 });
  assert.equal(r.diaADia.total, 100.25); assert.equal(r.diaADia.qtd, 3);
  assert.deepEqual(r.diaADia.porCategoria, [{ categoria: "Mercado", total: 70.25, qtd: 2 }, { categoria: "Lazer", total: 30, qtd: 1 }]);
  assert.equal(r.despesas, 1800.75);
  assert.equal(r.pagoTotal, 1600.25); assert.equal(r.aPagar, 200.5);
  assert.equal(r.pctPago, 89);
  assert.equal(r.sobra, 3199.25);
  assert.equal(r.sobraRealizada, 3399.75);
});

test("ignora outros meses, outros anos e itens sem linha no mês; valor 0 não existe", () => {
  const itens = [item("a"), item("b")];
  const meses = [mes("a", 100), mes("a", 999, { mes: 10 }), mes("a", 999, { ano: 2025 }), mes("b", 0)];
  const gastos = [gasto("g", 10), gasto("h", 999, { mes: 12 })];
  const r = resumoMensal({ itens, meses, gastos, config: null, ...base });
  assert.equal(r.despesas, 110);
});

test("§5.2 cartão: itens vinculados não somam; crédito não soma quando a fatura existe", () => {
  const itens = [item("cartao", { nome: "Cartão" }), item("streaming", { cartao_id: "cartao" }), item("app", { cartao_id: "cartao" })];
  const meses = [mes("cartao", 500), mes("streaming", 40), mes("app", 20)];
  const gastos = [gasto("g1", 100, { meio: "credito" }), gasto("g2", 25, { meio: "pix" })];
  const r = resumoMensal({ itens, meses, gastos, config: config({ cartao_principal_id: "cartao" }), ...base });
  assert.equal(r.contas.total, 500, "só a fatura");
  assert.equal(r.diaADia.total, 25, "crédito fora do dia a dia");
  assert.equal(r.despesas, 525);
  assert.deepEqual(r.credito, { total: 100, qtd: 1, naFatura: true });
  assert.deepEqual(r.cartao, { itemId: "cartao", nome: "Cartão", fatura: 500, conteudo: 160 });
  assert.deepEqual(r.avisos, []);
  assert.deepEqual(r.diaADia.porCategoria, [{ categoria: "Mercado", total: 25, qtd: 1 }]);
});

test("cartão: conteúdo maior que a fatura gera aviso", () => {
  const itens = [item("cartao"), item("s", { cartao_id: "cartao" })];
  const r = resumoMensal({ itens, meses: [mes("cartao", 100), mes("s", 60)], gastos: [gasto("g", 70, { meio: "credito" })], config: config({ cartao_principal_id: "cartao" }), ...base });
  assert.equal(r.avisos.length, 1);
  assert.match(r.avisos[0], /passa da fatura/);
});

test("crédito sem fatura no mês (ou sem cartão principal): soma para não sumir, com aviso", () => {
  const g = [gasto("g", 80, { meio: "credito" })];
  const sem = resumoMensal({ itens: [], meses: [], gastos: g, config: null, ...base });
  assert.equal(sem.despesas, 80); assert.equal(sem.credito.naFatura, false); assert.match(sem.avisos[0], /nenhum cartão principal/);
  const semFatura = resumoMensal({ itens: [item("c")], meses: [], gastos: g, config: config({ cartao_principal_id: "c" }), ...base });
  assert.equal(semFatura.despesas, 80); assert.match(semFatura.avisos[0], /sem fatura|não tem fatura/);
  const comFatura = resumoMensal({ itens: [item("c")], meses: [mes("c", 80)], gastos: g, config: config({ cartao_principal_id: "c" }), ...base });
  assert.equal(comFatura.despesas, 80, "80 da fatura, crédito não soma de novo (sem dupla contagem)");
});

test("centavos exatos: 0,10 + 0,20 = 0,30", () => {
  const r = resumoMensal({ itens: [], meses: [], gastos: [gasto("a", 0.1), gasto("b", 0.2)], config: null, ...base });
  assert.equal(r.diaADia.total, 0.3);
});

test("via_reserva e nao_caixa contam como despesa/receita do mês (saem só do caixa, fase futura)", () => {
  const itens = [item("a"), item("vr", { tipo: "receita", nao_caixa: true })];
  const r = resumoMensal({ itens, meses: [mes("a", 100, { via_reserva: true }), mes("vr", 300)], gastos: [], config: null, ...base });
  assert.equal(r.despesas, 100); assert.equal(r.receitas, 300);
});

test("categorias empatadas ordenam por nome; categoria vazia vira Outros", () => {
  const r = resumoMensal({ itens: [], meses: [], gastos: [gasto("a", 10, { categoria: "Zeta" }), gasto("b", 10, { categoria: "Alfa" }), gasto("c", 5, { categoria: " " })], config: null, ...base });
  assert.deepEqual(r.diaADia.porCategoria.map((c) => c.categoria), ["Alfa", "Zeta", "Outros"]);
});
