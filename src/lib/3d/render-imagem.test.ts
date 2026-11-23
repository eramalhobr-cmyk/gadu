import assert from "node:assert/strict";
import { test } from "node:test";
import { IMAGEM_LADO, IMAGEM_MAX_BYTES, IMAGEM_TOKENS_EST, lerImagem, tamanhoCaptura, tokensDaImagem } from "./render-imagem.ts";
import { buildPrompt, IMAGEM_NOTA } from "./scad.ts";
import { GenerateBody } from "./schemas.ts";
import { costUsd } from "../pricing.ts";

const b64 = (bytes: number[], fill = 2000) => Buffer.concat([Buffer.from(bytes), Buffer.alloc(fill, 1)]).toString("base64");

test("lerImagem: só PNG e JPEG de verdade (pelo cabeçalho) e dentro do tamanho", () => {
  assert.equal(lerImagem(`data:image/jpeg;base64,${b64([0xff, 0xd8, 0xff, 0xe0])}`)?.mediaType, "image/jpeg");
  assert.equal(lerImagem(`data:image/png;base64,${b64([0x89, 0x50, 0x4e, 0x47])}`)?.mediaType, "image/png");
  assert.equal(lerImagem(`data:image/png;base64,${b64([0xff, 0xd8, 0xff, 0xe0])}`), null, "tipo declarado diferente do real");
  assert.equal(lerImagem(`data:image/svg+xml;base64,${b64([0x3c, 0x73])}`), null);
  assert.equal(lerImagem(`data:image/jpeg;base64,${b64([0xff, 0xd8, 0xff], IMAGEM_MAX_BYTES + 10)}`), null, "grande demais");
  assert.equal(lerImagem("data:image/jpeg;base64,/9j/"), null, "pequena demais");
  assert.equal(lerImagem("data:image/jpeg;base64,não é base64"), null);
});

test("tamanho da captura e custo da imagem", () => {
  assert.deepEqual(tamanhoCaptura(1600, 1000), { w: IMAGEM_LADO, h: 320 });
  assert.deepEqual(tamanhoCaptura(300, 200), { w: 300, h: 200 }, "não aumenta");
  assert.deepEqual(tamanhoCaptura(0, 10), { w: 0, h: 0 });
  assert.ok(tokensDaImagem(IMAGEM_LADO, IMAGEM_LADO) <= IMAGEM_TOKENS_EST, "a reserva cobre a maior imagem");
  // Custo extra por ajuste no modelo barato (Haiku 5.5, US$ 0,10 por milhão de tokens de entrada): bem abaixo de 1 centésimo de centavo.
  const extra = costUsd({ model: "claude-haiku-5-5", input_tokens: tokensDaImagem(IMAGEM_LADO, IMAGEM_LADO) });
  assert.ok(extra > 0 && extra < 0.0001, String(extra));
});

test("prompt do ajuste explica a imagem só quando ela vai; o esquema só aceita imagem no ajuste", () => {
  const base = { modo: "refinar" as const, pedido: "mais alto", scad: "cube(1);" };
  assert.ok(buildPrompt({ ...base, comImagem: true }).includes(IMAGEM_NOTA));
  assert.ok(!buildPrompt(base).includes(IMAGEM_NOTA));
  assert.equal(GenerateBody.safeParse({ ...base, imagem: "data:image/jpeg;base64,AAAA" }).success, true);
  assert.equal(GenerateBody.safeParse({ modo: "novo", pedido: "um vaso", imagem: "data:image/jpeg;base64,AAAA" }).success, false);
  assert.equal(GenerateBody.safeParse({ modo: "corrigir", pedido: "x", scad: "cube(1);", erro: "e", imagem: "data:image/jpeg;base64,AAAA" }).success, false);
});
