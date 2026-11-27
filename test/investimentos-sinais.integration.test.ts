// Sinais de investimentos: rota /api/investimentos/sinais com sessão e provedor simulados (sem rede, só dados sintéticos).
// Garante: interruptor (404), sessão (401), zod nos parâmetros (400), universo fixo e nenhum dado da pessoa no provedor.
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

const src = (p: string) => new URL(`../src/${p}`, import.meta.url).href;
let session: { user: { id: string } } | null = null;
mock.module(src("app/api/google/_auth.ts"), { namedExports: { signedIn: async () => session } });
const { GET } = await import("../src/app/api/investimentos/sinais/route.ts");

const realFetch = globalThis.fetch;
let pedidos: string[] = [];
const D0 = 1_700_000_000;
function chart(simbolo: string) {
  const timestamp: number[] = [], close: number[] = [];
  let p = 20;
  for (let i = 0; i < 480; i++) { p *= 1.001 + 0.01 * Math.sin(i); timestamp.push(D0 + i * 86_400); close.push(p); }
  return { chart: { result: [{ meta: { symbol: simbolo, currency: "USD", regularMarketPrice: p, regularMarketTime: timestamp.at(-1) }, timestamp, indicators: { quote: [{ close }], adjclose: [{ adjclose: close }] } }] } };
}

beforeEach(() => {
  session = { user: { id: "00000000-0000-4000-8000-0000000000a1" } };
  pedidos = [];
  delete process.env.INVESTIMENTOS_SINAIS_ENABLED;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    pedidos.push(url.toString());
    assert.equal(url.hostname, "query1.finance.yahoo.com");
    return Response.json(chart(decodeURIComponent(url.pathname.split("/").at(-1)!)));
  }) as typeof fetch;
});
afterEach(() => { globalThis.fetch = realFetch; });

const req = (q = "") => new Request(`http://localhost/api/investimentos/sinais${q}`);

test("INVESTIMENTOS_SINAIS_ENABLED=0 desliga a rota (404) sem chamar o provedor", async () => {
  process.env.INVESTIMENTOS_SINAIS_ENABLED = "0";
  assert.equal((await GET(req())).status, 404);
  assert.equal(pedidos.length, 0);
});

test("sem sessão: 401", async () => {
  session = null;
  assert.equal((await GET(req())).status, 401);
  assert.equal(pedidos.length, 0);
});

test("parâmetros inválidos ou fora do universo: 400", async () => {
  for (const q of ["?grupo=cripto", "?ticker=XXXX9", "?ticker=../x", "?outro=1"]) assert.equal((await GET(req(q))).status, 400, q);
  assert.equal(pedidos.length, 0);
});

test("grupo IA: só símbolos públicos do universo e o SPY; resposta com sinal, backtest e aviso", async () => {
  const r = await GET(req("?grupo=ia"));
  assert.equal(r.status, 200);
  assert.match(r.headers.get("cache-control") ?? "", /no-store/);
  const j = await r.json();
  assert.equal(j.itens.length, 8);
  assert.match(j.aviso, /Não é recomendação/);
  assert.ok(j.itens.every((a: { sinal: string; backtest: unknown }) => ["compra", "manter", "venda"].includes(a.sinal) && a.backtest));
  const simbolos = pedidos.map((u) => decodeURIComponent(new URL(u).pathname.split("/").at(-1)!)).sort();
  assert.deepEqual(simbolos, ["AMD", "AMZN", "AVGO", "GOOGL", "META", "MSFT", "NVDA", "SPY", "TSM"]);
  assert.ok(pedidos.every((u) => !/00000000|user|email/i.test(u)));
});

test("um papel: ticker do universo", async () => {
  const j = await (await GET(req("?ticker=nvda"))).json();
  assert.deepEqual(j.itens.map((a: { ticker: string }) => a.ticker), ["NVDA"]);
});
