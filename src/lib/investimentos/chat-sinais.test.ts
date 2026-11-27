import assert from "node:assert/strict";
import { test } from "node:test";
import type { SinalAcao } from "./analise.ts";
import { blocoSinais, pedeSinais } from "./chat-sinais.ts";

const tickers = (m: string) => pedeSinais(m)?.map((a) => a.ticker) ?? null;

test("detector entende papel, empresa e grupo", () => {
  assert.deepEqual(tickers("como está a Nvidia?"), ["NVDA"]);
  assert.deepEqual(tickers("sinal da Petrobras"), ["PETR4"]);
  assert.deepEqual(tickers("e a PETR4 hoje?"), ["PETR4"]);
  assert.deepEqual(tickers("ação da Vale vale a pena?"), ["VALE3"]);
  assert.deepEqual(tickers("compara as ações da Meta e do Google"), ["GOOGL", "META"]);
  assert.equal(pedeSinais("o que comprar de IA?")?.length, 8);
  assert.equal(pedeSinais("quais ações brasileiras estão dando resultado?")?.length, 10);
});

test("detector não confunde metas, compras nem conversa comum", () => {
  for (const m of ["como está minha meta de viagem?", "vale a pena trocar o pneu?", "preciso comprar na amazon", "paguei a conta da sabesp",
    "a IA do GaDu é boa?", "abra investimentos", "transfere do itaú para o nubank", "minha meta de 2027"]) {
    assert.equal(pedeSinais(m), null, m);
  }
});

const agora = Date.parse("2026-11-25T18:00:00Z");
const acao = (horario: string, perdeu: boolean): SinalAcao => ({
  ticker: "NVDA", nome: "Nvidia", mercado: "EUA", moeda: "USD", fonte: "Yahoo Finance", preco: 123.456, horario, variacaoDia: 0.01,
  sinal: "compra", nota: 0.5, confianca: 62, motivos: ["Preço acima da média de 200 dias."],
  analistas: [{ id: "tendencia", nome: "Tendência", nota: 1, frases: [] }, { id: "forca", nome: "Força relativa", nota: null, frases: [] }],
  indicadores: { sma50: 1, sma200: 1, ema21: 1, rsi14: 55.5, macd: 1, macdSinal: 0, retorno3m: 0.1, retorno6m: 0.2, retorno12m: null, forca3m: null, forca6m: 0.05, volatilidade: 0.4, quedaMaxima: -0.2, distanciaMaxima: -0.05 },
  grafico: { precos: [], sma200: [] },
  backtest: { inicio: "2025-11-25", fim: "2026-11-25", pregoes: 250, retornoRegra: 0.1, retornoSegurar: 0.3, retornoIndice: 0.12, quedaRegra: -0.1, quedaSegurar: -0.25, acerto: 0.5, operacoes: 4, trocas: 7, tempoComprado: 0.6, perdeuDaReferencia: perdeu },
});

test("bloco leva só números calculados, avisa que a regra perdeu e descarta dado velho", () => {
  const b = blocoSinais({ itens: [acao("2026-11-25T17:00:00Z", true)], indisponiveis: ["MSFT"], referencias: [{ simbolo: "SPY", nome: "S&P 500 (SPY)", disponivel: true }] }, agora);
  assert.match(b, /NVDA \(Nvidia\).*USD 123\.46 · sinal Compra · confiança 62%/);
  assert.match(b, /Força relativa sem dados/);
  assert.match(b, /PERDEU de segurar/);
  assert.match(b, /Sem dados atuais: MSFT/);
  assert.match(b, /não é recomendação de investimento/);
  assert.match(b, /preço-alvo/);
  const velho = blocoSinais({ itens: [acao("2026-11-10T17:00:00Z", false)], indisponiveis: [], referencias: [] }, agora);
  assert.match(velho, /sem dados atuais verificados/);
  assert.match(blocoSinais(null, agora), /sem dados atuais verificados/);
});
