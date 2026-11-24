import assert from "node:assert/strict";
import { test } from "node:test";
import type { Report } from "./checks.ts";
import { checkMedidas, checkPartes, checkWall } from "./checks.ts";
import { box, boxTris, cup } from "./fixtures.ts";
import { parseParams } from "./params.ts";
import { deltaAlturaPedido, mensagemQualidade, pedeParedeFina, problemaAltura, problemasQualidade, tolAltura } from "./qualidade.ts";

test("deltaAlturaPedido: '2 mm mais alto' e variações; ignora pedido que não é de altura", () => {
  assert.equal(deltaAlturaPedido("Deixa 2 mm mais alto"), 2);
  assert.equal(deltaAlturaPedido("2mm mais alta"), 2);
  assert.equal(deltaAlturaPedido("deixa 2,5 mm mais baixo"), -2.5);
  assert.equal(deltaAlturaPedido("3 mm mais grosso"), 3);
  assert.equal(deltaAlturaPedido("aumenta a altura em 5 mm"), 5);
  assert.equal(deltaAlturaPedido("diminui a altura em 3 mm"), -3);
  assert.equal(deltaAlturaPedido("mais 2 mm de altura"), 2);
  assert.equal(deltaAlturaPedido("um suporte de celular inclinado"), null);
  assert.equal(deltaAlturaPedido("parede de 2 mm"), null);
  assert.equal(deltaAlturaPedido("2 mm mais fino"), null);
});

test("problemaAltura: o suporte que só aumentou a aba (+1,8 mm) falha; +2 mm passa", () => {
  const p = problemaAltura("Deixa 2 mm mais alto", 18.7, 20.5);
  assert.ok(p);
  assert.match(p!, /18,7/);
  assert.match(p!, /20,5/);
  assert.match(p!, /altura TOTAL|comprimento do apoio/i);
  assert.equal(problemaAltura("Deixa 2 mm mais alto", 18.7, 20.7), null);
  assert.equal(problemaAltura("um gancho de parede", 60, 60), null);
  assert.ok(tolAltura(2) <= 0.2);
});

test("pedeParedeFina: só quando a pessoa pede parede fina de propósito", () => {
  assert.equal(pedeParedeFina("Um chaveiro com o nome GADU"), false);
  assert.equal(pedeParedeFina("parede de 2 mm"), false);
  assert.equal(pedeParedeFina("deixa a parede bem fina"), true);
  assert.equal(pedeParedeFina("parede de 0,8 mm"), true);
});

test("problemasQualidade: junta partes, medidas, parede e altura; uma vez cada", () => {
  const params = parseParams("altura = 40; // [10:1:80] Altura externa\\nlargura = 80; // [10:1:200] Largura\\ncube(1);");
  const report: Report = {
    checks: [
      checkPartes({ positions: Float32Array.from([...boxTris(0, 0, 0, 10, 10, 10), ...boxTris(20, 0, 20, 30, 10, 30)]) }),
      checkMedidas(box(80, 60, 28), params, { altura: 40, largura: 80 }),
      checkWall(cup(40, 30, 20, 0.8)),
    ],
    ok: false, avisos: 2, erros: 1,
  };
  const probs = problemasQualidade({ report, pedido: "Deixa 2 mm mais alto", zAntes: 18.7, zDepois: 20.5 });
  assert.ok(probs.some((s) => /encosta|corpos/i.test(s)));
  assert.ok(probs.some((s) => /40/u.test(s) && /28/.test(s)));
  assert.ok(probs.some((s) => /1,2 mm/.test(s)));
  assert.ok(probs.some((s) => /altura TOTAL|18,7/.test(s)));
  assert.equal(problemasQualidade({ report: { checks: [checkWall(cup(40, 30, 20, 0.8))], ok: true, avisos: 1, erros: 0 }, pedido: "parede bem fina" }).length, 0);
  const msg = mensagemQualidade(probs);
  assert.match(msg, /^1\. /);
  assert.ok(msg.length <= 1500);
});
