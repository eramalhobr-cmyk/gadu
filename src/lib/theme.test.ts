import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTheme, THEME_COLOR } from "./theme.ts";
import { validAcao } from "./acoes.ts";

test("tema claro é o padrão; a escolha salva (escuro) vale", () => {
  assert.equal(parseTheme(undefined), "light");
  assert.equal(parseTheme("qualquer"), "light");
  assert.equal(parseTheme("light"), "light");
  assert.equal(parseTheme("dark"), "dark");
});

test("cor da barra do sistema acompanha o fundo de cada tema", () => {
  assert.equal(THEME_COLOR.light, "#eef4f9");
  assert.equal(THEME_COLOR.dark, "#050f1a");
});

test("voz: 'muda para o tema escuro' vira o ajuste de tema", () => {
  const now = new Date("2026-11-23T15:00:00-03:00").getTime();
  assert.deepEqual(validAcao({ tipo: "ajuste", opcao: "tema", valor: "escuro" }, now), { tipo: "ajuste", ajuste: { opcao: "tema", valor: "dark" } });
  assert.deepEqual(validAcao({ tipo: "ajuste", opcao: "tema", valor: "light" }, now), { tipo: "ajuste", ajuste: { opcao: "tema", valor: "light" } });
});
