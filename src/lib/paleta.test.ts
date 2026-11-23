import { test } from "node:test";
import assert from "node:assert/strict";
import { isPaletaKey, paletaItens, parseMenuCommand } from "./paleta.ts";

const ctx = { views: ["hoje", "conversa", "tarefas", "agenda", "financeiro", "metas"] as const, frases: ["Quero correr 50 km este mês", "Corri 5 km hoje"], navMini: false, theme: "light" as const };
const c = { ...ctx, views: [...ctx.views] };

test("vazio: comandos principais, frases da tela e telas", () => {
  const it = paletaItens("", c);
  assert.equal(it[0].label, "Falar com o GaDu");
  assert.ok(it.some((i) => i.kind === "frase" && i.label === "Corri 5 km hoje"));
  assert.ok(it.some((i) => i.kind === "tela" && i.label === "Agenda"));
});

test("filtra por nome e entende intenção de navegação", () => {
  assert.equal(paletaItens("agen", c)[0].label, "Agenda");
  const fin = paletaItens("abre finanças", c);
  assert.deepEqual([fin[0].kind, fin[0].label], ["tela", "Financeiro"]);
  assert.equal(paletaItens("recolher", c)[0].label, "Recolher o menu");
  assert.equal(paletaItens("abre fin", c)[0].label, "Financeiro");
});

test("sempre termina com perguntar ao GaDu", () => {
  const it = paletaItens("quanto gastei este mês?", c);
  const last = it[it.length - 1];
  assert.equal(last.kind, "perguntar");
  assert.equal(last.kind === "perguntar" && last.text, "quanto gastei este mês?");
});

test("tela desligada não aparece", () => {
  const it = paletaItens("abre finanças", { ...c, views: ["hoje", "conversa"] });
  assert.equal(it[0].kind, "perguntar");
});

test("menu compacto por voz e atalho", () => {
  assert.equal(parseMenuCommand("Recolhe o menu"), "mini");
  assert.equal(parseMenuCommand("GaDu, expande o menu lateral"), "full");
  assert.equal(parseMenuCommand("recolhe a roupa"), null);
  assert.equal(isPaletaKey({ key: "k", ctrlKey: true, metaKey: false, altKey: false, shiftKey: false }), true);
  assert.equal(isPaletaKey({ key: "K", ctrlKey: false, metaKey: true, altKey: false, shiftKey: false }), true);
  assert.equal(isPaletaKey({ key: "k", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }), false);
});
