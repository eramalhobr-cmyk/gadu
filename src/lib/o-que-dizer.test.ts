import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSayHelp, sayHere, sayHereSpoken, SAY_HERE } from "./o-que-dizer.ts";
import { VIEW_IDS } from "./modules.ts";

test("reconhece o pedido de ajuda por voz", () => {
  for (const s of ["O que posso dizer aqui?", "o que eu posso falar nesta tela", "Gadu, o que dá pra pedir?", "comandos de voz", "quais são os comandos daqui", "O que posso fazer aqui"]) assert.equal(parseSayHelp(s), true, s);
  for (const s of ["o que posso comer hoje", "cria a tarefa dizer oi", "posso dizer uma coisa?", "comandos do linux"]) assert.equal(parseSayHelp(s), false, s);
});

test("cada tela tem até 4 frases e há um padrão para as outras", () => {
  for (const [view, list] of Object.entries(SAY_HERE)) {
    assert.ok(list && list.length >= 2 && list.length <= 4, view);
    assert.ok(VIEW_IDS.includes(view as never), `tela existe: ${view}`);
  }
  assert.equal(sayHere("casa").length, 3);
  assert.match(sayHereSpoken("metas"), /^Aqui você pode dizer, por exemplo: “Quero correr 50 km este mês”/);
});
