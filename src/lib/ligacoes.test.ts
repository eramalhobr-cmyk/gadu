import assert from "node:assert/strict";
import { test } from "node:test";
import { goalChip, goalsByItem, MAP_LINKS } from "./ligacoes.ts";

test("goalsByItem: só metas ativas ou pausadas, sem repetir, em ordem", () => {
  const goals = [
    { id: "a", titulo: "Correr 50 km", status: "ativa" },
    { id: "b", titulo: "Aprender violão", status: "pausada" },
    { id: "c", titulo: "Meta antiga", status: "arquivada" },
    { id: "d", titulo: "Feita", status: "concluida" },
  ];
  const m = goalsByItem([
    { goal_id: "a", item: 1 }, { goal_id: "b", item: 1 }, { goal_id: "a", item: 1 },
    { goal_id: "c", item: 2 }, { goal_id: "d", item: 3 }, { goal_id: "x", item: 4 }, { goal_id: "a", item: 5 },
  ], goals);
  assert.deepEqual(m.get(1), ["Aprender violão", "Correr 50 km"]);
  assert.equal(m.has(2), false);
  assert.equal(m.has(3), false);
  assert.equal(m.has(4), false, "meta de fora da lista (de outra pessoa ou apagada) não aparece");
  assert.deepEqual(m.get(5), ["Correr 50 km"]);
});

test("goalChip: nome curto, corte com reticências e +N", () => {
  assert.equal(goalChip([]), "");
  assert.equal(goalChip(["Correr 50 km"]), "Correr 50 km");
  assert.equal(goalChip(["Correr 50 km", "Ler 12 livros"]), "Correr 50 km +1");
  assert.equal(goalChip(["Uma meta com um nome muito comprido demais"], 10), "Uma meta…");
});

test("mapa do GaDu: toda ligação tem o que significa e uma frase para dizer", () => {
  assert.ok(MAP_LINKS.length >= 8);
  for (const l of MAP_LINKS) {
    assert.ok(l.from && l.to && l.from !== l.to);
    assert.ok(l.what.endsWith("."), l.what);
    assert.ok(l.say.length > 5 && !l.say.endsWith("."), l.say);
  }
});
