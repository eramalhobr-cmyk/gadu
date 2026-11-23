import { test } from "node:test";
import assert from "node:assert/strict";
import { navSpoken, parseNavIntent, pushTab } from "./nav-intent.ts";

test("abre telas por frases curtas", () => {
  const casos: [string, string][] = [
    ["abre finanças", "financeiro"], ["Abre as metas", "metas"], ["vai para a agenda", "agenda"], ["GaDu, me leva para minhas tarefas", "tarefas"],
    ["abre o 3D", "studio3d"], ["volta pra tela de hoje", "hoje"], ["entra nas configurações", "ajustes"], ["abre a conversa", "conversa"],
    ["abre memórias por favor", "memoria"], ["vai pra tela inicial", "hoje"], ["abre o mais", "modulos"],
  ];
  for (const [f, v] of casos) assert.deepEqual(parseNavIntent(f), { tipo: "abrir", view: v }, f);
});

test("volta para a tela anterior", () => {
  for (const f of ["volta", "Voltar", "volta para a tela anterior", "GaDu, volta por favor", "tela anterior"]) assert.deepEqual(parseNavIntent(f), { tipo: "voltar" }, f);
});

test("não sequestra frases que são pedidos ao GaDu", () => {
  for (const f of ["abre a conversa sobre a viagem", "abre minha última peça", "quanto gastei este mês", "volta atrás no gasto de ontem", "abre um projeto novo de reforma", "vai chover amanhã?", "me mostra as metas", "volta a meta de leitura"]) assert.equal(parseNavIntent(f), null, f);
});

test("pilha do voltar e frase falada", () => {
  let s = pushTab([], "hoje", "metas");
  s = pushTab(s, "metas", "agenda");
  assert.deepEqual(s, ["hoje", "metas"]);
  assert.deepEqual(pushTab(s, "agenda", "agenda"), s);
  assert.equal(navSpoken({ tipo: "abrir", view: "financeiro" }, "financeiro"), "Abrindo Financeiro.");
  assert.equal(navSpoken({ tipo: "voltar" }, "hoje"), "Voltando para Hoje.");
  assert.equal(navSpoken({ tipo: "voltar" }, null), "Não há tela anterior.");
});

test("resumo por voz: abre a tela e marca o painel", () => {
  const casos: [string, string][] = [
    ["mostra meu resumo de finanças", "financeiro"], ["resumo das tarefas", "tarefas"], ["me mostra o painel das metas", "metas"],
    ["quero ver o resumo dos agentes", "agentes"], ["resumo do dia", "hoje"], ["mostra o resumo de hoje", "hoje"],
  ];
  for (const [f, v] of casos) assert.deepEqual(parseNavIntent(f), { tipo: "abrir", view: v, painel: true }, f);
  assert.deepEqual(parseNavIntent("resumo da memória"), { tipo: "abrir", view: "memoria" });
  assert.equal(parseNavIntent("faz um resumo da reunião de ontem com o João"), null);
  assert.equal(navSpoken({ tipo: "abrir", view: "financeiro", painel: true }, "financeiro"), "Mostrando o resumo de Financeiro.");
});
