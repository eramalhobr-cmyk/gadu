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
