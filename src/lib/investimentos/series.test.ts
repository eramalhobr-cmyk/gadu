import assert from "node:assert/strict";
import { test } from "node:test";
import { carregarSinais, dadosGrafico } from "./analise.ts";
import { carregarSerie, lerYahoo, montarSerie } from "./series.ts";
import { ativosDoGrupo, UNIVERSO } from "./universo.ts";

const D0 = 1_700_000_000;
function chart(simbolo: string, n: number, tendencia = 0.001) {
  const timestamp: number[] = [], close: (number | null)[] = [];
  let p = 50;
  for (let i = 0; i < n; i++) { p *= 1 + tendencia + 0.01 * Math.sin(i); timestamp.push(D0 + i * 86_400); close.push(p); }
  return { chart: { result: [{ meta: { symbol: simbolo, currency: simbolo.endsWith(".SA") || simbolo === "^BVSP" ? "BRL" : "USD", regularMarketPrice: p, regularMarketTime: timestamp.at(-1) }, timestamp, indicators: { quote: [{ close }], adjclose: [{ adjclose: close }] } }], error: null } };
}

test("universo tem os grupos pedidos e nenhum ticker repetido", () => {
  assert.deepEqual(ativosDoGrupo("acompanhados").map((a) => a.ticker), ["LREN3", "CEAB3", "VIVA3"]);
  assert.deepEqual(ativosDoGrupo("ia").map((a) => a.ticker), ["NVDA", "MSFT", "GOOGL", "META", "AMD", "AVGO", "TSM", "AMZN"]);
  assert.equal(ativosDoGrupo("brasil").length, 10);
  assert.equal(new Set(UNIVERSO.map((a) => a.ticker)).size, UNIVERSO.length);
});

test("série: ordena, tira nulos e inválidos, um ponto por dia", () => {
  const s = montarSerie([D0 + 86_400, D0, D0 + 2 * 86_400, D0 + 2 * 86_400 + 60], [11, 10, null, -1]);
  assert.deepEqual(s.fechamentos, [10, 11]);
});

test("Yahoo: valida com zod e confere o símbolo", () => {
  assert.equal(lerYahoo(chart("NVDA", 10), "NVDA")?.fechamentos.length, 10);
  assert.equal(lerYahoo(chart("MSFT", 10), "NVDA"), null);
  assert.equal(lerYahoo({ chart: { result: null, error: { code: "Not Found" } } }, "NVDA"), null);
  assert.equal(lerYahoo({ chart: { result: [{ meta: { symbol: "NVDA" }, timestamp: ["x"], indicators: { quote: [{ close: [] }] } }] } }, "NVDA"), null);
});

test("fonte: host fixo do Yahoo, sem redirecionamento, sem dados da pessoa; B3 cai para a brapi com token", async () => {
  const urls: string[] = [];
  const mock: typeof fetch = async (input, opts) => {
    const url = new URL(String(input));
    urls.push(url.toString());
    assert.equal(opts?.redirect, "error");
    if (url.hostname === "query1.finance.yahoo.com") {
      assert.deepEqual([...url.searchParams.keys()].sort(), ["interval", "range"]);
      return new Response(null, { status: 429 });
    }
    assert.equal(url.origin, "https://brapi.dev");
    return Response.json({ results: [{ symbol: "PETR4", regularMarketPrice: 40, regularMarketTime: "2026-11-25T17:00:00Z", historicalDataPrice: [{ date: D0, close: 39 }, { date: D0 + 86_400, close: 40 }] }] });
  };
  const petr = await carregarSerie({ ticker: "PETR4", mercado: "B3" }, { brapiToken: "chave-ficticia", consultar: mock });
  assert.equal(petr?.fonte, "brapi");
  assert.deepEqual(petr?.fechamentos, [39, 40]);
  assert.equal(await carregarSerie({ ticker: "NVDA", mercado: "EUA" }, { brapiToken: "chave-ficticia", consultar: mock }), null);
  assert.ok(urls[0].startsWith("https://query1.finance.yahoo.com/v8/finance/chart/PETR4.SA?"));
});

test("carregarSinais: busca o índice uma vez, marca indisponíveis e monta gráfico e backtest", async () => {
  const pedidos: string[] = [];
  const mock: typeof fetch = async (input) => {
    const simbolo = decodeURIComponent(new URL(String(input)).pathname.split("/").at(-1)!);
    pedidos.push(simbolo);
    if (simbolo === "MSFT") return new Response(null, { status: 500 });
    return Response.json(chart(simbolo, 500, simbolo === "SPY" ? 0.0003 : 0.0015));
  };
  const ativos = ativosDoGrupo("ia").slice(0, 3);
  const r = await carregarSinais(ativos, { consultar: mock });
  assert.equal(pedidos.filter((s) => s === "SPY").length, 1);
  assert.deepEqual(r.indisponiveis, ["MSFT"]);
  assert.equal(r.itens.length, 2);
  const nvda = r.itens[0];
  assert.equal(nvda.moeda, "USD");
  assert.ok(["compra", "manter", "venda"].includes(nvda.sinal));
  assert.ok(nvda.grafico.precos.length <= 64 && nvda.grafico.precos.length === nvda.grafico.sma200.length);
  assert.ok(nvda.backtest && nvda.backtest.pregoes > 100);
  assert.match(r.aviso, /Não é recomendação/);
  assert.deepEqual(r.referencias, [{ simbolo: "SPY", nome: "S&P 500 (SPY)", disponivel: true }]);
});

test("gráfico: último ano reduzido, SMA200 nula sem histórico", () => {
  const g = dadosGrafico({ datas: Array.from({ length: 100 }, (_, i) => i), fechamentos: Array.from({ length: 100 }, (_, i) => i + 1) });
  assert.equal(g.precos.at(-1), 100);
  assert.ok(g.sma200.every((v) => v === null));
});
