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

test("lembretes do bloco de controle: futuros e válidos", () => {
  const now = Date.parse("2026-11-10T12:00:00Z");
  const r = splitMeta('Combinado!\n<<<META>>>\n{"memorias":[],"lembretes":[{"texto":"Ligar para o dentista","quando":"2026-11-11T09:00:00-03:00"},{"texto":"passado","quando":"2026-11-09T09:00:00-03:00"},{"texto":"sem fuso","quando":"2026-11-11T10:30:00"}]}', now);
  assert.equal(r.reminders.length, 2);
  assert.equal(r.reminders[0].dueAt, "2026-11-11T12:00:00.000Z");
  assert.equal(r.reminders[1].dueAt, "2026-11-11T13:30:00.000Z");
});

test("tarefas do bloco de controle", () => {
  const now = Date.parse("2026-11-10T12:00:00Z");
  const r = splitMeta('Anotado.\n<<<META>>>\n{"memorias":[],"lembretes":[],"tarefas":[{"texto":"Renovar o seguro do carro","prazo":"2026-11-14","prioridade":1,"projeto":"Casa"},{"texto":"Ler o capítulo 3","prazo":"amanhã"},{"texto":""}]}', now);
  assert.equal(r.tasks.length, 2);
  assert.deepEqual(r.tasks[0], { title: "Renovar o seguro do carro", due: "2026-11-14", priority: 1, project: "Casa" });
  assert.deepEqual(r.tasks[1], { title: "Ler o capítulo 3", due: null, priority: 2, project: null });
});
