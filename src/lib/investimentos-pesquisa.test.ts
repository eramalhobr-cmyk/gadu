import assert from "node:assert/strict";
import { test } from "node:test";
import { blocoPesquisa, pedePesquisaInvestimentos, PEDIDO_PESQUISA } from "./investimentos/pesquisa.ts";
import { carregarCotacoes } from "./investimentos/fonte.ts";

test("pesquisa só carrega por intenção e exclui cotações vencidas ou futuras", () => {
  assert.equal(pedePesquisaInvestimentos(PEDIDO_PESQUISA), true);
  assert.equal(pedePesquisaInvestimentos("abra investimentos"), false);
  const agora = Date.parse("2026-11-25T18:00:00Z");
  const acao = { ticker: "LREN3", nome: "Lojas Renner", preco: 12, horario: "2026-11-25T17:00:00Z", dia: 1, periodos: [], baseAjustada: false, perdaMaxima63: null };
  assert.match(blocoPesquisa([acao], agora), /LREN3 .*12\.00/);
  assert.match(blocoPesquisa([acao], agora), /Sem dados atuais: CEAB3, VIVA3/);
  assert.match(blocoPesquisa([acao], agora + 8 * 86400 * 1000), /sem cotações atuais/);
  assert.match(blocoPesquisa([acao], agora - 2 * 3600000), /sem cotações atuais/);
});

test("fonte prescreve host e papéis, rejeita redirecionamentos e valida a identidade da cotação", async () => {
  const chamadas: string[] = [];
  const mockFetch: typeof fetch = async (input, opts) => {
    const url = new URL(String(input));
    chamadas.push(url.pathname);
    assert.equal(url.origin, "https://brapi.dev");
    assert.equal(opts?.redirect, "error");
    assert.deepEqual(opts?.headers, { Authorization: "Bearer chave-ficticia" });
    return Response.json({ results: [{ symbol: "LREN3", regularMarketPrice: 12, regularMarketTime: "2026-11-25T17:00:00Z", longName: "texto externo não consumido" }] });
  };
  const r = await carregarCotacoes("chave-ficticia", mockFetch);
  assert.deepEqual(chamadas, ["/api/quote/LREN3", "/api/quote/CEAB3", "/api/quote/VIVA3"]);
  assert.equal(r[0]?.nome, "Lojas Renner");
  assert.deepEqual(r.slice(1), [null, null]);
});

test("tenta janelas menores diante do limite do plano e preserva a cotação sem histórico", async () => {
  const tentativas = new Map<string, (string | null)[]>();
  const mockFetch: typeof fetch = async (input) => {
    const url = new URL(String(input));
    const ticker = url.pathname.split("/").at(-1)!;
    const janela = url.searchParams.get("range");
    tentativas.set(ticker, [...(tentativas.get(ticker) ?? []), janela]);
    if (ticker === "CEAB3") return new Response(null, { status: 401 });
    if (janela && !(ticker === "LREN3" && janela === "3mo")) return new Response(null, { status: 400 });
    return Response.json({ results: [{ symbol: ticker, regularMarketPrice: 12, regularMarketTime: "2026-11-25T17:00:00Z", regularMarketChangePercent: -2 }] });
  };
  const r = await carregarCotacoes("chave-ficticia", mockFetch);
  assert.deepEqual(tentativas.get("LREN3"), ["2y", "1y", "3mo"]);
  assert.deepEqual(tentativas.get("CEAB3"), ["2y"]);
  assert.deepEqual(tentativas.get("VIVA3"), ["2y", "1y", "3mo", null]);
  assert.equal(r[2]?.dia, -2);
  assert.ok(r[2]?.periodos.every((p) => p.variacao === null));
});
