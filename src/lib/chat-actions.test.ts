import assert from "node:assert/strict";
import { test } from "node:test";
import { describe, toConfirmItem, whenLabel, type ChatAction } from "./chat-actions.ts";

const NOW = new Date("2026-11-22T15:00:00-03:00");

test("cartão do gasto", () => {
  const v = describe({ kind: "gasto", g: { valor: 50, categoria: "Mercado", descricao: "feira", meio: "pix", data: "2026-11-22" } });
  assert.equal(v.title, "R$ 50,00 · Mercado");
  assert.equal(v.detail, "22/11 · Pix · feira");
  assert.equal(v.confirm, "Lançar");
  assert.equal(v.applied, false);
});
test("cartão da meta: registrar e concluir", () => {
  const base = { goalId: "g1", titulo: "Correr", unidade: "km", valor: 5, data: "2026-11-22", agregacao: "soma" } as const;
  assert.equal(describe({ kind: "meta", d: { ...base, acao: "registrar" } }).detail, "5 km · 22/11");
  assert.equal(describe({ kind: "meta", d: { ...base, acao: "concluir", valor: null, data: null } }).proposed, "Conclusão para confirmar");
});
test("lembrete já criado: cartão só com Desfazer", () => {
  const v = describe({ kind: "lembrete", id: 7, text: "Ligar para a mãe", dueAt: "2026-11-23T09:00:00-03:00" }, NOW);
  assert.equal(v.applied, true);
  assert.equal(v.confirm, "");
  assert.equal(v.detail, "amanhã 09:00");
});
test("whenLabel", () => {
  assert.equal(whenLabel("2026-11-22T20:00:00-03:00", NOW), "hoje 20:00");
  assert.equal(whenLabel("2026-11-27T09:30:00-03:00", NOW), "sex, 27/11 09:30");
});
test("toConfirmItem leva o essencial para a fala", () => {
  assert.deepEqual(toConfirmItem({ kind: "evento", ev: { title: "Dentista", start: "2026-11-23T10:00:00-03:00", end: "2026-11-23T11:00:00-03:00", location: null } }), { kind: "evento", title: "Dentista", start: "2026-11-23T10:00:00-03:00" });
});

test("tudo por voz: cartões e perguntas das ações novas", async () => {
  const { actionQuestion, describe: d } = await import("./chat-actions.ts");
  const meta: ChatAction = { kind: "meta_nova", titulo: "Correr 50 km", medicao: "numerica", unidade: "km", alvo: 50, inicial: 0, prazo: "2026-12-31", categoria: "saude", marcos: [] };
  assert.equal(d(meta).detail, "0 → 50 km · até 31/12");
  assert.equal(actionQuestion(meta, NOW), "Crio a meta Correr 50 km, de 0 até 50 km, até quinta, dia 31?");
  const conta: ChatAction = { kind: "conta_paga", itemId: "i1", nome: "Luz", valor: 180.5, ano: 2026, mes: 11 };
  assert.equal(d(conta).detail, "R$ 180,50 · 11/2026");
  assert.equal(actionQuestion(conta, NOW), "Marco a conta Luz, de 180 reais e 50 centavos, como paga?");
  assert.equal(actionQuestion({ kind: "tarefa_adiar", id: 1, titulo: "Pagar boleto", prazo: "2026-11-23" }, NOW), "Adio a tarefa Pagar boleto para amanhã?");
  assert.equal(actionQuestion({ kind: "ajuste", ajuste: { opcao: "texto", valor: "130" } }, NOW), "Tamanho do texto: Maior?");
  assert.equal(actionQuestion({ kind: "ajuste", ajuste: { opcao: "maos_livres", valor: true } }, NOW), "Ligar a conversa contínua?");
  assert.equal(d({ kind: "tarefa_criada", id: 3, titulo: "Comprar pão", prazo: null }).applied, true);
  assert.equal(d({ kind: "marco", goalId: "g", meta: "Mudar", titulo: "Achar casa", data: null }).confirm, "Adicionar");
});
