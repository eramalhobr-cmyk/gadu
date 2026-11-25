import assert from "node:assert/strict";
import { test } from "node:test";
import { ACOMPANHADOS, cotacao, resumirCotacao } from "./investimentos/cotacoes.ts";

test("calcula variação por pregões e deixa prazo sem histórico em branco", () => {
  const dados = cotacao.parse({
    symbol: "LREN3", regularMarketPrice: 130, regularMarketTime: "2026-11-25T17:30:00Z", regularMarketChangePercent: -0.3,
    historicalDataPrice: Array.from({ length: 22 }, (_, i) => ({ date: 86400 * (20000 + i), close: i === 21 ? 125 : 100 })).reverse(),
  });
  dados.historicalDataPrice?.push({ date: 1, close: null });
  const resumo = resumirCotacao(ACOMPANHADOS[0], dados);
  assert.deepEqual(resumo.periodos, [{ sessoes: 21, variacao: 25 }, { sessoes: 63, variacao: null }, { sessoes: 252, variacao: null }]);
  assert.equal(resumo.preco, 130);
  assert.equal(resumo.dia, -0.3);
});
