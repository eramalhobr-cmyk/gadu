import { test } from "node:test";
import assert from "node:assert/strict";
import { blockedTerm, isSensitive } from "./privacy.ts";
import { splitMeta, visiblePart } from "./meta.ts";

test("detecta dados sensíveis", () => {
  assert.equal(isSensitive("meu cpf é 123.456.789-09"), true);
  assert.equal(isSensitive("a senha do banco é xyz"), true);
  assert.equal(isSensitive("cartão 4111 1111 1111 1111"), true);
  assert.equal(isSensitive("sk-abcdefghijklmnop123"), true);
});

test("não bloqueia conversa comum", () => {
  assert.equal(isSensitive("planeje minha semana com foco na Stratprice"), false);
  assert.equal(isSensitive("reunião às 15h com 3 pessoas"), false);
});

test("termos bloqueados", () => {
  assert.equal(blockedTerm("projeto da Empresa X", ["empresa x"]), "empresa x");
  assert.equal(blockedTerm("nada aqui", ["empresa x"]), null);
});

test("separa o bloco de controle", () => {
  const r = splitMeta('Olá!\n<<<META>>>\n{"memorias":[{"texto":"Prefere respostas curtas","area":"Preferências"}]}');
  assert.equal(r.body, "Olá!");
  assert.deepEqual(r.memories, [{ content: "Prefere respostas curtas", area: "Preferências" }]);
});

test("bloco inválido não quebra", () => {
  assert.deepEqual(splitMeta("Oi <<<META>>> {quebrado").memories, []);
  assert.equal(visiblePart("Resposta <<<MET"), "Resposta");
});

import { costUsd, priceKey } from "./pricing.ts";

test("calcula o custo por modelo", () => {
  assert.equal(priceKey("anthropic/claude-opus-5.5"), "claude-opus-5-5");
  const c = costUsd({ model: "claude-opus-5-5", input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 10000 });
  assert.ok(Math.abs(c - (0.004 + 0.01 + 0.002)) < 1e-9);
  assert.equal(costUsd({ model: "desconhecido", input_tokens: 1000 }), 0);
});
