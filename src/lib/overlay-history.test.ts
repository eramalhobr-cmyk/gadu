import assert from "node:assert/strict";
import { test } from "node:test";
import { OverlayHistory, type HistoryLike } from "./overlay-history.ts";

/** Histórico falso: pilha de entradas, go() assíncrono como no navegador (o popstate chega depois). */
function fake() {
  const stack: unknown[] = [null];
  let pos = 0;
  const log: string[] = [];
  const h: HistoryLike & { stack: unknown[]; pos: number } = {
    get state() { return stack[pos]; },
    get stack() { return stack; },
    get pos() { return pos; },
    pushState(s) { stack.splice(pos + 1); stack.push(s); pos++; log.push("push"); },
    go(d) { log.push(`go${d}`); pending = d; },
  };
  let pending = 0;
  const flush = () => { pos = Math.max(0, pos + pending); pending = 0; };
  return { h, log, flush, userBack: () => { pos = Math.max(0, pos - 1); } };
}

function setup() {
  const f = fake();
  const closed: string[] = [];
  let settled = 0;
  const oh = new OverlayHistory({ history: f.h, onBack: () => closed.push("back"), onSettled: () => settled++ });
  return { f, oh, closed, settled: () => settled };
}

test("abrir uma camada empurra uma entrada; fechar pela interface volta uma", () => {
  const { f, oh, settled } = setup();
  oh.sync(1);
  assert.equal(f.h.pos, 1);
  assert.deepEqual(f.h.state, { gaduOverlay: 1 });
  oh.sync(0);
  assert.deepEqual(f.log, ["push", "go-1"]);
  f.flush(); oh.handlePopState();
  assert.equal(f.h.pos, 0);
  assert.equal(oh.depth, 0);
  assert.equal(settled(), 1);
});

test("fechar pela interface não é tratado como Voltar da pessoa", () => {
  const { f, oh, closed } = setup();
  oh.sync(1); oh.sync(0);
  f.flush(); oh.handlePopState();
  assert.deepEqual(closed, []);
});

test("duas camadas: cada Voltar fecha uma, e o app não sai da tela", () => {
  const { f, oh, closed } = setup();
  oh.sync(1); oh.sync(2);
  assert.equal(f.h.pos, 2);
  f.userBack(); oh.handlePopState(); // 1º Voltar
  assert.equal(closed.length, 1);
  oh.sync(1); // o app fechou a camada de cima
  assert.equal(f.h.pos, 1); // ainda há uma entrada para a camada que sobrou
  f.userBack(); oh.handlePopState(); // 2º Voltar
  assert.equal(closed.length, 2);
  oh.sync(0);
  assert.equal(f.h.pos, 0);
  assert.equal(oh.depth, 0);
  assert.deepEqual(f.log, ["push", "push"]); // nenhuma volta extra do app
});

test("fechar duas camadas de uma vez usa uma volta só", () => {
  const { f, oh, closed } = setup();
  oh.sync(2);
  oh.sync(0);
  assert.deepEqual(f.log, ["push", "push", "go-2"]);
  f.flush(); oh.handlePopState();
  assert.equal(f.h.pos, 0);
  assert.deepEqual(closed, []);
});

test("abrir enquanto uma volta do app está em andamento espera o popstate (sem corrida)", () => {
  const { f, oh } = setup();
  oh.sync(1);
  oh.sync(0); // go(-1) pedido
  oh.sync(1); // reabriu antes do popstate
  assert.deepEqual(f.log, ["push", "go-1"]); // ainda não empurrou
  f.flush(); oh.handlePopState();
  assert.deepEqual(f.log, ["push", "go-1", "push"]);
  assert.equal(f.h.pos, 1);
  assert.equal(oh.depth, 1);
});

test("Voltar sem camada nossa avisa o app (volta de tela normal)", () => {
  const { oh, closed } = setup();
  oh.handlePopState();
  assert.deepEqual(closed, ["back"]);
});

test("sync repetido com o mesmo valor não mexe no histórico", () => {
  const { f, oh } = setup();
  oh.sync(1); oh.sync(1); oh.sync(1);
  assert.deepEqual(f.log, ["push"]);
});
