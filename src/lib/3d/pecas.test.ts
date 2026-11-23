import assert from "node:assert/strict";
import { test } from "node:test";
import { PecaCreate, PecaPatch, tituloDe, VersaoCreate } from "./pecas.ts";

test("título da peça vem do pedido, curto e sem artigo", () => {
  assert.equal(tituloDe("Um suporte de celular com 70 mm de largura"), "Suporte de celular com 70 mm de largura");
  assert.equal(tituloDe("uma caixa com tampa. Bem resistente"), "Caixa com tampa");
  assert.equal(tituloDe("x".repeat(100)).length, 60);
});

test("corpos estritos: user_id no corpo é recusado; limites de tamanho", () => {
  assert.equal(PecaCreate.safeParse({ pedido: "cubo", scad: "cube(1);" }).success, true);
  assert.equal(PecaCreate.safeParse({ pedido: "cubo", scad: "cube(1);", user_id: "x" }).success, false);
  assert.equal(PecaCreate.safeParse({ pedido: "cubo", scad: "a".repeat(20_001) }).success, false);
  assert.equal(PecaPatch.safeParse({}).success, false);
  assert.equal(PecaPatch.safeParse({ valores: { largura: 70, tampa: true, estilo: "liso" } }).success, true);
  assert.equal(PecaPatch.safeParse({ valores: { largura: { x: 1 } } }).success, false);
  assert.equal(VersaoCreate.safeParse({ modo: "refinar", scad: "cube(2);" }).success, true);
  assert.equal(VersaoCreate.safeParse({ modo: "apagar", scad: "cube(2);" }).success, false);
});
