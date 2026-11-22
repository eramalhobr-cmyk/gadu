import assert from "node:assert/strict";
import { test } from "node:test";
import { detectIntent, planFor } from "./plan.ts";

test("intenção atencao_hoje: frases em pt-BR (com e sem acento, pontuação e caixa)", () => {
  for (const m of [
    "O que merece minha atenção hoje?", "o que merece minha atencao hoje", "O que merece atenção hoje?", "o que pede minha atenção?",
    "Como está meu dia?", "como ta meu dia", "Como vai meu dia hoje?", "como está o meu dia",
    "O que está atrasado?", "o que tá atrasado", "O que tenho atrasado?", "quais são minhas tarefas atrasadas", "tarefas atrasadas",
    "O que ainda falta fazer hoje?", "o que falta hoje", "O que é mais importante hoje?", "o que eu preciso fazer hoje",
    "Priorizar meu dia", "me ajuda a priorizar meu dia", "  O QUE MERECE MINHA ATENÇÃO HOJE???  ",
  ]) assert.equal(detectIntent(m), "atencao_hoje", m);
});

test("outras mensagens não ativam o Core", () => {
  for (const m of [
    "oi", "Me lembra amanhã às 9h de ligar para o dentista", "O que é atenção plena?", "Crie uma tarefa para hoje",
    "Quais e-mails pedem resposta?", "Planejar minha semana", "meu dia foi ótimo", "o voo está atrasado?", "",
  ]) assert.equal(detectIntent(m), null, m);
});

test("o plano tem limites de volume e aceita reduzir, nunca ampliar a intenção", () => {
  const p = planFor("atencao_hoje");
  assert.equal(p.intent, "atencao_hoje");
  assert.equal(p.maxChars, 6000);
  assert.ok(p.maxFacts > 0 && p.maxFacts <= 40);
  assert.equal(planFor("atencao_hoje", { maxFacts: 5 }).maxFacts, 5);
});
