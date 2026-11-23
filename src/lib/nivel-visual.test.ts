import test from "node:test";
import assert from "node:assert/strict";
import { espectro, nivelVisual, parseModoVoz, rotuloModo } from "./nivel-visual.ts";

test("nível visual: som real manda; sem sinal, respiração baixa; parado, zero", () => {
  assert.equal(nivelVisual(0.7, "listening", 1), 0.7);
  assert.equal(nivelVisual(1.4, "speaking", 1), 1);
  assert.ok(nivelVisual(-1, "listening", 1) < 0.11);
  assert.equal(nivelVisual(0.9, "idle", 1), 0);
  assert.ok(nivelVisual(-1, "thinking", 0) > 0.1);
});

test("espectro: n traços entre 0 e 1, todos zero em silêncio", () => {
  const e = espectro(60, 0.8, 0.5);
  assert.equal(e.length, 60);
  assert.ok(e.every((v) => v >= 0 && v <= 1));
  assert.ok(Math.max(...e) > 0.4);
  assert.ok(espectro(60, 0, 3).every((v) => v === 0));
});

test("rótulo e frase do modo voz", () => {
  assert.equal(rotuloModo("idle", true), "Ouvindo");
  assert.equal(rotuloModo("speaking", false), "Falando");
  for (const f of ["modo voz", "abre o modo de voz", "ativa o modo Jarvis", "modo imersivo"]) assert.ok(parseModoVoz(f), f);
  for (const f of ["qual o modo de preparo do bolo", "modo escuro"]) assert.ok(!parseModoVoz(f), f);
});
