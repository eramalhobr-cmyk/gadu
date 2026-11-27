import assert from "node:assert/strict";
import { test } from "node:test";
import { backtest, inicioPadrao, simularPosicoes } from "./backtest.ts";
import { avaliar, type Serie } from "./sinais.ts";

const D0 = 1_700_000_000;
function serie(n: number, f: (i: number) => number): Serie {
  const datas: number[] = [], fechamentos: number[] = [];
  let p = 100;
  for (let i = 0; i < n; i++) { p *= 1 + f(i); datas.push(D0 + i * 86_400); fechamentos.push(p); }
  return { datas, fechamentos };
}
const ciclo = (i: number) => 0.004 * Math.sin(i / 25) + 0.012 * Math.sin(i * 1.3);

test("não usa dado futuro: mudar os preços depois do dia k não muda nenhuma decisão até k", () => {
  const s = serie(500, ciclo);
  const ind = serie(500, (i) => 0.0005 * Math.sin(i / 40));
  const k = 380;
  const futuro: Serie = { datas: s.datas, fechamentos: s.fechamentos.map((v, i) => (i > k ? v * (i % 2 ? 5 : 0.2) : v)) };
  const indFuturo: Serie = { datas: ind.datas, fechamentos: ind.fechamentos.map((v, i) => (i > k ? v * 9 : v)) };
  const inicio = inicioPadrao(500);
  const a = simularPosicoes(s, ind, inicio), b = simularPosicoes(futuro, indFuturo, inicio);
  assert.deepEqual(a.slice(0, k - inicio + 1), b.slice(0, k - inicio + 1));
  assert.notDeepEqual(a, b, "o teste precisa mexer em decisões depois de k");
});

test("a decisão de cada dia é a mesma do sinal ao vivo calculado só até aquele dia", () => {
  const s = serie(420, ciclo);
  const inicio = inicioPadrao(420);
  const pos = simularPosicoes(s, null, inicio);
  for (const i of [inicio + 10, inicio + 77, 400]) {
    const { sinal } = avaliar({ datas: s.datas.slice(0, i + 1), fechamentos: s.fechamentos.slice(0, i + 1) }, null);
    if (sinal === "compra") assert.equal(pos[i - inicio], 1);
    if (sinal === "venda") assert.equal(pos[i - inicio], 0);
  }
});

test("alta contínua: a regra fica comprada, paga custo e não ganha de comprar e segurar", () => {
  const r = backtest(serie(500, () => 0.001), null)!;
  assert.ok(r.trocas >= 1);
  assert.ok(r.retornoRegra <= r.retornoSegurar + 1e-12);
  assert.equal(r.quedaSegurar, 0);
  assert.ok(r.tempoComprado > 0.9);
});

test("custo de 0,1% por troca e queda máxima entram na conta; mostra quando perde", () => {
  const s = serie(520, ciclo);
  const semCusto = backtest(s, null, 0)!, comCusto = backtest(s, null)!;
  assert.equal(semCusto.trocas, comCusto.trocas);
  if (comCusto.trocas > 0) assert.ok(comCusto.retornoRegra < semCusto.retornoRegra);
  assert.ok(comCusto.quedaRegra <= 0 && comCusto.quedaSegurar <= 0);
  assert.equal(comCusto.perdeuDaReferencia, comCusto.retornoRegra < comCusto.retornoSegurar);
  assert.ok(comCusto.acerto === null || (comCusto.acerto >= 0 && comCusto.acerto <= 1));
  assert.equal(backtest(serie(250, ciclo), null), null);
});

test("queda contínua: a regra sai e perde menos que segurar", () => {
  const r = backtest(serie(500, (i) => (i < 300 ? 0.001 : -0.003)), null)!;
  assert.ok(r.retornoRegra > r.retornoSegurar);
  assert.equal(r.perdeuDaReferencia, false);
});
