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

test("tudo por voz: cartões e perguntas de tarefa (cancelar, reabrir, editar) e lembrete (adiar)", async () => {
  const { actionQuestion, describe: d } = await import("./chat-actions.ts");
  assert.equal(actionQuestion({ kind: "tarefa_cancelar", id: 1, titulo: "Pagar boleto" }, NOW), "Cancelo a tarefa Pagar boleto?");
  assert.equal(actionQuestion({ kind: "tarefa_reabrir", id: 1, titulo: "Pagar boleto" }, NOW), "Reabro a tarefa Pagar boleto?");
  const ed: ChatAction = { kind: "tarefa_editar", id: 1, titulo: "Boleto", mudancas: { titulo: "Boleto da luz", prioridade: 1, prazo: "2026-11-23", projeto: "Casa", projetoId: 4 } };
  assert.equal(d(ed).detail, "título: Boleto da luz · prioridade alta · prazo 23/11 · projeto Casa");
  assert.equal(actionQuestion(ed, NOW), "Na tarefa Boleto, mudo o título para Boleto da luz, a prioridade para alta, o prazo para amanhã, o projeto para Casa?");
  const ad: ChatAction = { kind: "lembrete_adiar", id: 2, text: "Tomar o remédio", dueAt: "2026-11-22T20:00:00-03:00", novoDueAt: "2026-11-23T09:00:00-03:00" };
  assert.equal(d(ad, NOW).detail, "Novo horário: amanhã 09:00");
  assert.equal(d(ad).applied, false);
  assert.equal(actionQuestion(ad, NOW), "Adio o lembrete Tomar o remédio para amanhã 09:00?");
});

test("tudo por voz: cartões e perguntas de conta, gasto e evento (apagar avisa que não dá para desfazer)", async () => {
  const { actionQuestion, describe: d } = await import("./chat-actions.ts");
  assert.equal(actionQuestion({ kind: "conta_desmarcar", itemId: "i", nome: "Luz", valor: 180, ano: 2026, mes: 11 }, NOW), "Volto a conta Luz para em aberto?");
  const cv: ChatAction = { kind: "conta_valor", itemId: "i", nome: "Luz", antes: 180, valor: 210.5, escopo: "proximos", ano: 2026, mes: 11 };
  assert.equal(d(cv).detail, "R$ 180,00 → R$ 210,50 · 11/2026 até dezembro");
  assert.equal(actionQuestion(cv, NOW), "Mudo a conta Luz para 210 reais e 50 centavos, deste mês até dezembro?");
  const ga: ChatAction = { kind: "gasto_apagar", id: "g", valor: 45.5, categoria: "Mercado", descricao: "feira", data: "2026-11-20" };
  assert.equal(d(ga).title, "R$ 45,50 · feira");
  assert.match(d(ga).detail, /não dá para desfazer/);
  assert.match(actionQuestion(ga, NOW), /Não dá para desfazer\.$/);
  const ge: ChatAction = { kind: "gasto_editar", id: "g", atual: { valor: 100, categoria: "Mercado", descricao: "", data: "2026-11-20" }, mudancas: { valor: 120, meio: "pix", data: "2026-11-21" } };
  assert.equal(d(ge).detail, "Agora: R$ 120,00 · Pix · 21/11");
  assert.equal(actionQuestion(ge, NOW), "No gasto de 100 reais, Mercado, mudo o valor para 120 reais, a forma de pagamento para Pix, o dia para ontem?");
  const ea: ChatAction = { kind: "evento_apagar", eventId: "e", title: "Dentista", start: "2026-11-23T10:00:00-03:00", end: "2026-11-23T11:00:00-03:00" };
  assert.equal(actionQuestion(ea, NOW), "Apago o evento Dentista, de amanhã 10:00? Não dá para desfazer.");
  assert.match(d(ea).detail, /não dá para desfazer/);
  const ee: ChatAction = { kind: "evento_editar", eventId: "e", title: "Dentista", start: "2026-11-23T10:00:00-03:00", end: "2026-11-23T11:00:00-03:00", mudancas: { title: "Dentista da Ana", start: "2026-11-23T15:00:00-03:00", end: "2026-11-23T16:00:00-03:00" } };
  assert.equal(actionQuestion(ee, NOW), "No evento Dentista, mudo o título para Dentista da Ana, o horário para amanhã 15:00?");
  for (const a of [ga, ea, ge, ee, cv]) assert.equal(d(a).applied, false, "nunca pré-aplicado: só grava depois do toque ou do sim");
});

test("tudo por voz: cartões e perguntas de meta (pausar, retomar, arquivar, editar) e projeto (editar, arquivar)", async () => {
  const { actionQuestion, describe: d } = await import("./chat-actions.ts");
  const ms = (para: "pausada" | "ativa" | "arquivada"): ChatAction => ({ kind: "meta_status", goalId: "g", titulo: "Correr 50 km", para });
  assert.equal(actionQuestion(ms("pausada"), NOW), "Pauso a meta Correr 50 km?");
  assert.equal(actionQuestion(ms("ativa"), NOW), "Retomo a meta Correr 50 km?");
  assert.equal(actionQuestion(ms("arquivada"), NOW), "Arquivo a meta Correr 50 km? Nada é apagado.");
  assert.equal(d(ms("pausada")).confirm, "Pausar");
  assert.match(d(ms("arquivada")).detail, /nada é apagado/i);
  const me: ChatAction = { kind: "meta_editar", goalId: "g", titulo: "Correr 50 km", unidade: "km", mudancas: { titulo: "Correr 60 km", alvo: 60, prazo: "2026-12-31" } };
  assert.equal(d(me).detail, "novo título: Correr 60 km · alvo 60 km · prazo 31/12");
  assert.equal(actionQuestion(me, NOW), "Na meta Correr 50 km, mudo o título para Correr 60 km, o alvo para 60 km, o prazo para quinta, dia 31?");
  const pe: ChatAction = { kind: "projeto_editar", id: 3, nome: "Casa", mudancas: { nome: "Casa nova", objetivo: "" } };
  assert.equal(d(pe).detail, "novo nome: Casa nova · sem objetivo");
  assert.equal(actionQuestion(pe, NOW), "No projeto Casa, mudo o nome para Casa nova, o objetivo para vazio?");
  const pa: ChatAction = { kind: "projeto_arquivar", id: 3, nome: "Casa" };
  assert.equal(actionQuestion(pa, NOW), "Arquivo o projeto Casa? Ele fica como concluído.");
  for (const a of [ms("pausada"), me, pe, pa]) assert.equal(d(a).applied, false);
});

test("tudo por voz: cartões e perguntas de memória, nova conversa e navegação; splitNavegacao separa o que abre na hora", async () => {
  const { actionQuestion, describe: d, splitNavegacao } = await import("./chat-actions.ts");
  assert.equal(actionQuestion({ kind: "memoria_aprovar", ids: [1], texto: "Mora em Curitiba" }, NOW), "Aprovo a memória: Mora em Curitiba?");
  assert.equal(actionQuestion({ kind: "memoria_aprovar", ids: [1, 2, 3], texto: "3 memórias pendentes" }, NOW), "Aprovo as 3 memórias pendentes?");
  assert.equal(actionQuestion({ kind: "memoria_recusar", id: 1, texto: "Gosta de café" }, NOW), "Descarto a memória: Gosta de café? Não dá para desfazer.");
  assert.equal(actionQuestion({ kind: "memoria_esquecer", id: 1, texto: "Mora em Curitiba" }, NOW), "Esqueço isto: Mora em Curitiba? Não dá para desfazer.");
  assert.match(d({ kind: "memoria_esquecer", id: 1, texto: "x" }).detail, /Não dá para desfazer/);
  assert.equal(actionQuestion({ kind: "nova_conversa" }, NOW), "Começo uma conversa nova?");
  assert.equal(d({ kind: "nova_conversa" }).confirm, "Começar");
  assert.equal(actionQuestion({ kind: "navegar", view: "financeiro" }, NOW), "Abro Financeiro?");
  const r = splitNavegacao([{ kind: "navegar", view: "metas" }, { kind: "nova_conversa" }, { kind: "navegar", view: "tarefas" }]);
  assert.equal(r.destino, "tarefas", "vale o último pedido");
  assert.deepEqual(r.cards, [{ kind: "nova_conversa" }], "gravações e conversa nova continuam como cartão");
  assert.equal(splitNavegacao([{ kind: "nova_conversa" }]).destino, null);
});

test("guia: pergunta falada, cartão e abertura instantânea (não vira cartão)", async () => {
  const { actionQuestion, describe: d, splitNavegacao } = await import("./chat-actions.ts");
  assert.equal(actionQuestion({ kind: "guia" }, NOW), "Abro o guia?");
  assert.equal(d({ kind: "guia" }).confirm, "Abrir");
  const r = splitNavegacao([{ kind: "guia" }, { kind: "nova_conversa" }]);
  assert.equal(r.guia, true);
  assert.deepEqual(r.cards, [{ kind: "nova_conversa" }]);
  assert.equal(splitNavegacao([{ kind: "navegar", view: "metas" }]).guia, false);
});

test("salário: cartão só de informação (sem botões) e cartão de salvar (confirma, nunca pré-aplicado); pergunta falada traz os números do cálculo", async () => {
  const { actionQuestion, describe: d } = await import("./chat-actions.ts");
  const { calcularSalario } = await import("./finance/salario.ts");
  const calc = calcularSalario(8000)!;
  const info = d({ kind: "salario", calc, salvar: null });
  assert.equal(info.info, true);
  assert.equal(info.title, "R$ 6.040,64");
  assert.match(info.detail, /INSS R\$ 921,51/);
  assert.match(info.detail, /IR R\$ 1\.037,85/);
  assert.match(info.detail, /estimativa/);
  const salvar = { kind: "salario" as const, calc, salvar: { itemId: "i1", nome: "Salário", antes: 5000, ano: 2026, mes: 11 } };
  const sv = d(salvar);
  assert.equal(sv.applied, false, "só grava depois do toque ou do sim");
  assert.equal(sv.info, undefined);
  assert.equal(sv.confirm, "Salvar");
  assert.match(sv.proposed, /11\/2026/);
  assert.match(sv.detail, /Antes: R\$ 5\.000,00/);
  assert.match(actionQuestion(salvar, NOW), /líquido de .*6\.040.* como o salário de novembro de 2026\?$/);
  assert.match(actionQuestion({ kind: "salario", calc, salvar: null }, NOW), /líquido R\$ 6\.040,64/);
  assert.match(d({ kind: "salario", calc: calcularSalario(3000, 1)!, salvar: null }).detail, /IR R\$ 0,00 \(isento\)/);
});

test("pergunta falada dos ajustes de velocidade e voz", async () => {
  const { actionQuestion } = await import("./chat-actions.ts");
  assert.equal(actionQuestion({ kind: "ajuste", ajuste: { opcao: "velocidade", valor: "mais_devagar" } }, NOW), "Falar mais devagar?");
  assert.equal(actionQuestion({ kind: "ajuste", ajuste: { opcao: "velocidade", valor: 1.2 } }, NOW), "Velocidade da fala: 1,20×?");
  assert.equal(actionQuestion({ kind: "ajuste", ajuste: { opcao: "voz_trocar", valor: "proxima" } }, NOW), "Trocar para a próxima voz do aparelho?");
});
