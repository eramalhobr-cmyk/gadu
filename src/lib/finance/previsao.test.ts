import assert from "node:assert/strict";
import { test } from "node:test";
import { config, item, mes } from "./fixtures.ts";
import { previsaoRecebimento } from "./previsao.ts";

const cfg = config({ receita_principal_id: "sal", adiantamento_pct: 40 });
const itens = [item("sal", { tipo: "receita", dia: 5 }), item("alu", { dia: 20 }), item("luz", { dia: 12 }), item("agua", { dia: 8 }), item("velha", { dia: 2 }), item("sem", { dia: null }), item("res", { dia: 13 })];
const meses = [mes("sal", 1000), mes("alu", 300), mes("luz", 100), mes("agua", 50), mes("velha", 70), mes("sem", 10), mes("res", 25, { via_reserva: true })];

test("antes do dia 15: próximo recebimento é o adiantamento (40% da receita principal); soma contas até o dia anterior", () => {
  const p = previsaoRecebimento({ hoje: { ano: 2026, mes: 11, dia: 10 }, itens, meses, config: cfg });
  assert.deepEqual(p.proximo, { data: "2026-11-15", dias: 5, valor: 400, rotulo: "Adiantamento de Conta sal", estimado: false });
  assert.equal(p.contasAteLa.total, 100, "só a luz (dia 12); água já passou; aluguel depois; reserva fora");
  assert.deepEqual(p.contasAteLa.itens.map((i) => i.nome), ["Conta luz"]);
  assert.deepEqual(p.vencidasEmAberto, { total: 120, qtd: 2 }, "água e velha vencidas e em aberto");
  assert.equal(p.semDia, 1);
});

test("depois do dia 15 sem receita no mês seguinte: estima o restante no dia 1 com os valores do mês atual", () => {
  const p = previsaoRecebimento({ hoje: { ano: 2026, mes: 11, dia: 16 }, itens, meses, config: cfg });
  assert.equal(p.proximo?.data, "2026-12-01");
  assert.equal(p.proximo?.estimado, true);
  assert.equal(p.proximo?.valor, 600);
  assert.equal(p.proximo?.rotulo, "Restante de Conta sal");
  assert.equal(p.contasAteLa.total, 300, "aluguel no dia 20, antes do dia 1");
});

test("mês seguinte com receita lançada: não é estimativa", () => {
  const m2 = [...meses, mes("sal", 1200, { ano: 2026, mes: 12 })];
  const p = previsaoRecebimento({ hoje: { ano: 2026, mes: 11, dia: 25 }, itens, meses: m2, config: cfg });
  assert.equal(p.proximo?.estimado, false); assert.equal(p.proximo?.valor, 720); assert.equal(p.proximo?.data, "2026-12-01");
});

test("recebimento já marcado como recebido não é 'próximo'; dia do recebimento hoje não conta como futuro", () => {
  const m = [mes("sal", 1000, { pago: true }), ...meses.slice(1)];
  const p = previsaoRecebimento({ hoje: { ano: 2026, mes: 11, dia: 3 }, itens, meses: m, config: cfg });
  assert.equal(p.proximo?.estimado, true, "sem receita aberta, cai na estimativa do mês seguinte");
  const q = previsaoRecebimento({ hoje: { ano: 2026, mes: 11, dia: 15 }, itens, meses, config: cfg });
  assert.equal(q.proximo?.data, "2026-12-01", "hoje é dia 15: o adiantamento não é 'depois de hoje'");
});

test("sem adiantamento configurado, a receita entra no dia dela", () => {
  const p = previsaoRecebimento({ hoje: { ano: 2026, mes: 11, dia: 1 }, itens, meses, config: config({ receita_principal_id: "sal" }) });
  assert.deepEqual(p.proximo, { data: "2026-11-05", dias: 4, valor: 1000, rotulo: "Conta sal", estimado: false });
});

test("sem nenhuma receita: proximo nulo, contas só até o fim do mês e nada quebra", () => {
  const p = previsaoRecebimento({ hoje: { ano: 2026, mes: 11, dia: 10 }, itens: [item("a", { dia: 28 }), item("b", { dia: 5 })], meses: [mes("a", 40), mes("b", 9, { mes: 12 })], config: null });
  assert.equal(p.proximo, null); assert.equal(p.contasAteLa.total, 40);
});

test("cartão: itens vinculados não entram; fatura entra no dia dela; pagas ficam fora", () => {
  const it = [item("c", { dia: 11 }), item("s", { dia: 11, cartao_id: "c" }), item("p", { dia: 11 })];
  const p = previsaoRecebimento({ hoje: { ano: 2026, mes: 11, dia: 10 }, itens: [...it, item("sal", { tipo: "receita", dia: 20 })], meses: [mes("c", 200), mes("s", 30), mes("p", 10, { pago: true }), mes("sal", 900)], config: null });
  assert.equal(p.contasAteLa.total, 200);
});

test("dia 31 em mês de 30 dias vence no dia 30", () => {
  const p = previsaoRecebimento({ hoje: { ano: 2026, mes: 4, dia: 29 }, itens: [item("a", { dia: 31 }), item("sal", { tipo: "receita", dia: 30 })], meses: [mes("a", 7, { mes: 4 }), mes("sal", 100, { mes: 4 })], config: null });
  assert.equal(p.proximo?.data, "2026-04-30");
});
