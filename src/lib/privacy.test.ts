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

import { costUsd, estimateMaxCost, priceKey } from "./pricing.ts";

test("calcula o custo por modelo", () => {
  assert.equal(priceKey("anthropic/claude-opus-5.5"), "claude-opus-5-5");
  const c = costUsd({ model: "claude-opus-5-5", input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 10000 });
  assert.ok(Math.abs(c - (0.004 + 0.01 + 0.002)) < 1e-9);
  // Modelo desconhecido nunca custa zero: usa o preço mais caro da tabela.
  assert.equal(costUsd({ model: "desconhecido", input_tokens: 1000 }), costUsd({ model: "claude-opus-5-5", input_tokens: 1000 }));
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

test("eventos propostos: fim padrão de 1 hora e horário de Brasília", () => {
  const now = Date.parse("2026-11-10T12:00:00Z");
  const r = splitMeta('Posso marcar?\n<<<META>>>\n{"eventos":[{"titulo":"Dentista","inicio":"2026-11-12T09:00:00","local":"Centro"},{"titulo":"Treino","inicio":"2026-11-12T18:00:00-03:00","fim":"2026-11-12T19:30:00-03:00"},{"titulo":"Antigo","inicio":"2026-01-01T10:00:00-03:00"}]}', now);
  assert.equal(r.events.length, 2);
  assert.deepEqual(r.events[0], { title: "Dentista", start: "2026-11-12T12:00:00.000Z", end: "2026-11-12T13:00:00.000Z", location: "Centro" });
  assert.equal(r.events[1].end, "2026-11-12T22:30:00.000Z");
});

test("estimativa de custo máximo para reservar orçamento", () => {
  // Opus: 30.000 caracteres (~10.000 tokens) × US$ 4/M + 8.000 tokens × US$ 20/M = 0,04 + 0,16
  assert.equal(Number(estimateMaxCost("claude-opus-5-5", 30000, 8000).toFixed(4)), 0.2);
  assert.equal(estimateMaxCost("anthropic/claude-haiku-5.5", 0, 0), 0);
  assert.ok(estimateMaxCost("modelo-novo", 3000, 1000) >= estimateMaxCost("claude-opus-5-5", 3000, 1000));
  assert.equal(estimateMaxCost("claude-opus-5-5", NaN, -5), 0);
});
