import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze, checkBase, checkManifold, checkOverhang, checkSize, checkWall, contactArea, declaredWallIssues, edgeStats, estimateMinWall } from "./checks.ts";
import { box, boxTris, cup } from "./fixtures.ts";
import { boundingBox, placeOnBed } from "./mesh.ts";
import { parseParams } from "./params.ts";

test("tamanho: cabe na A1 até 256 mm e falha acima, com sugestão", () => {
  assert.equal(checkSize(box(256, 256, 256)).status, "ok");
  const big = checkSize(box(300, 20, 20));
  assert.equal(big.status, "erro");
  assert.match(big.mensagem, /300/);
  assert.match(big.mensagem, /largura/);
  assert.ok(big.sugestao);
  assert.equal(checkSize({ positions: new Float32Array(0) }).status, "erro");
});

test("malha fechada: cubo ok; aberta, invertida e não-manifold detectadas", () => {
  assert.equal(checkManifold(box(10, 10, 10)).status, "ok");
  assert.deepEqual(edgeStats(box(10, 10, 10)), { open: 0, nonManifold: 0, flipped: 0, degenerate: 0, edges: 18 });
  const open = { positions: box(10, 10, 10).positions.slice(0, 11 * 9) };
  const o = checkManifold(open);
  assert.equal(o.status, "erro");
  assert.match(o.mensagem, /aberta/);
  assert.ok(o.sugestao);
  const flipped = { positions: Float32Array.from([...boxTris(0, 0, 0, 10, 10, 10).slice(0, 9 * 11), ...boxTris(0, 0, 0, 10, 10, 10, true).slice(9 * 11)]) };
  assert.ok(edgeStats(flipped).flipped > 0 || edgeStats(flipped).open > 0);
  // duas caixas que dividem uma aresta (não-manifold): 4 faces numa aresta
  const twin = { positions: Float32Array.from([...boxTris(0, 0, 0, 10, 10, 10), ...boxTris(10, 10, 0, 20, 20, 10)]) };
  assert.ok(edgeStats(twin).nonManifold > 0);
  assert.equal(checkManifold(twin).status, "erro");
  assert.equal(checkManifold({ positions: new Float32Array(0) }).status, "erro");
});

test("base plana: área de contato no z mínimo", () => {
  assert.ok(Math.abs(contactArea(box(20, 10, 5)) - 200) < 1e-6);
  assert.equal(checkBase(box(20, 10, 5)).status, "ok");
  const up = placeOnBed(box(20, 10, 5));
  assert.ok(Math.abs(contactArea(up) - 200) < 1e-4, "continua depois de mover para a mesa");
  // peça sobre um ponto: pirâmide invertida sem face plana embaixo
  const tip = { positions: Float32Array.from([0, 0, 0, 1, 0, 5, 0, 1, 5, 0, 0, 0, 0, 1, 5, 1, 0, 5]) };
  const c = checkBase(tip);
  assert.equal(c.status, "aviso");
  assert.ok(c.sugestao);
  // base minúscula numa peça grande (<1 cm² e <10% da pegada)
  const pino = { positions: Float32Array.from([...boxTris(0, 0, 0, 2, 2, 10), ...boxTris(-40, -40, 10, 40, 40, 20)]) };
  assert.equal(checkBase(pino).status, "aviso");
  // base com a face para cima não conta
  assert.equal(contactArea({ positions: Float32Array.from(boxTris(0, 0, 0, 10, 10, 1, true).slice(0, 18)) }), 0);
});

test("parede mínima (estimativa): copo de 2 mm passa; parede de 0,8 mm avisa", () => {
  const w2 = estimateMinWall(cup(40, 30, 20, 2));
  assert.ok(w2 !== null && w2 >= 1.9 && w2 <= 2.1, String(w2));
  assert.equal(checkWall(cup(40, 30, 20, 2)).status, "ok");
  const thin = checkWall(cup(40, 30, 20, 0.8));
  assert.equal(thin.status, "aviso");
  assert.equal(thin.estimativa, true);
  assert.match(thin.mensagem, /Estimativa/);
  assert.match(thin.sugestao ?? "", /1,2 mm/);
  const solid = estimateMinWall(box(20, 20, 20));
  assert.ok(solid !== null && Math.abs(solid - 20) < 0.1);
  assert.equal(estimateMinWall({ positions: new Float32Array(0) }), null);
});

test("parede mínima pelos parâmetros declarados", () => {
  const params = parseParams("parede = 1; // [0.4:0.1:5] Espessura da parede\nlargura = 10; // [1:1:50] Largura\ncube(1);");
  assert.deepEqual(declaredWallIssues(params, { parede: 1 }), ["Espessura da parede está em 1 mm"]);
  assert.deepEqual(declaredWallIssues(params, { parede: 2 }), []);
  assert.equal(checkWall(box(20, 20, 20), params, { parede: 0.8 }).status, "aviso");
});

test("balanço: peça com topo mais largo avisa; cubo não", () => {
  assert.equal(checkOverhang(box(10, 10, 10)).status, "ok");
  const tee = { positions: Float32Array.from([...boxTris(-2, -2, 0, 2, 2, 10), ...boxTris(-20, -20, 10, 20, 20, 12)]) };
  assert.equal(checkOverhang(tee).status, "aviso");
});

test("analyze reúne tudo", () => {
  const r = analyze(box(30, 20, 10));
  assert.equal(r.checks.length, 5);
  assert.equal(r.erros, 0);
  assert.equal(r.ok, true);
  assert.equal(analyze(box(300, 20, 10)).ok, false);
  const bb = boundingBox(placeOnBed(box(30, 20, 10)))!;
  assert.deepEqual([bb.min[2], (bb.min[0] + bb.max[0]) / 2, (bb.min[1] + bb.max[1]) / 2], [0, 128, 128]);
});
