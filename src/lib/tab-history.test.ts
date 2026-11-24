import assert from "node:assert/strict";
import { test } from "node:test";
import { navegarTela, prepararHistorico, type TabHistoryLike } from "./tab-history.ts";

/** Histórico simulado: pilha de entradas e posição atual, como o do navegador. */
function hist() {
  const pilha: { state: unknown; url: string }[] = [{ state: null, url: "/app?tab=hoje" }];
  let i = 0;
  const h: TabHistoryLike & { pilha: typeof pilha; back: () => string; get i(): number } = {
    pilha,
    get state() { return pilha[i].state; },
    get i() { return i; },
    pushState: (state, _t, url) => { pilha.splice(i + 1); pilha.push({ state, url }); i++; },
    replaceState: (state, _t, url) => { pilha[i] = { state, url }; },
    back: () => { i = Math.max(0, i - 1); return pilha[i].url; },
  };
  return h;
}

test("cada troca de tela cria uma entrada: o Voltar volta de tela em vez de fechar o app", () => {
  const h = hist();
  prepararHistorico(h, "hoje");
  navegarTela(h, "hoje", "modulos", 0);
  navegarTela(h, "modulos", "compras", 0);
  assert.equal(h.pilha.length, 3);
  assert.equal(h.back(), "/app?tab=modulos");
  assert.equal(h.back(), "/app?tab=hoje");
});

test("mesma tela ou camada aberta: só troca o endereço, sem nova entrada", () => {
  const h = hist();
  prepararHistorico(h, "hoje");
  navegarTela(h, "hoje", "hoje", 0);
  assert.equal(h.pilha.length, 1);
  h.pushState({ gaduOverlay: 1 }, "", "/app?tab=hoje");
  navegarTela(h, "hoje", "metas", 1);
  assert.equal(h.pilha.length, 2);
  assert.deepEqual(h.state, { gaduOverlay: 1 }, "a entrada da camada continua marcada");
  assert.equal(h.pilha[1].url, "/app?tab=metas");
});

test("abrir direto numa tela põe Hoje embaixo; recarregar não duplica", () => {
  const h = hist();
  h.replaceState(null, "", "/app?tab=financeiro");
  prepararHistorico(h, "financeiro");
  assert.deepEqual(h.pilha.map((e) => e.url), ["/app?tab=hoje", "/app?tab=financeiro"]);
  prepararHistorico(h, "financeiro");
  assert.equal(h.pilha.length, 2);
  assert.equal(h.back(), "/app?tab=hoje");
});
