import assert from "node:assert/strict";
import { test } from "node:test";
import { applyParams, defaultValues, parseParams, sanitizeValue } from "./params.ts";

const SCAD = `// Suporte
largura = 70; // [30:1:200] Largura da base (mm)
altura = 12.5; // [5:0.5:40] Altura (mm)
espessura = 3; // [1:10] Espessura da parede
arredondar = true; // [true] Bordas arredondadas
acabamento = "liso"; // ["liso", "texturizado"] Acabamento
constante = 5;
$fn = 48;
modulo = 3; // [1:5] depois do código? não: o primeiro cubo encerra os parâmetros

cube([largura, 10, altura]);
depois = 9; // [1:20] Não deve virar controle
`;

test("lê números, booleanos e opções do topo do arquivo", () => {
  const p = parseParams(SCAD);
  assert.deepEqual(p.map((x) => [x.name, x.kind]), [["largura", "number"], ["altura", "number"], ["espessura", "number"], ["arredondar", "bool"], ["acabamento", "choice"], ["modulo", "number"]]);
  const l = p[0];
  assert.ok(l.kind === "number" && l.min === 30 && l.max === 200 && l.step === 1 && l.value === 70 && l.label === "Largura da base (mm)");
  const a = p[1];
  assert.ok(a.kind === "number" && a.step === 0.5 && a.value === 12.5);
  const e = p[2];
  assert.ok(e.kind === "number" && e.min === 1 && e.max === 10 && e.step === 1, "faixa [min:max] usa passo inteiro");
  const c = p[4];
  assert.ok(c.kind === "choice" && c.value === "liso" && c.options.length === 2);
});

test("para na primeira linha de código: nada depois vira controle", () => {
  assert.ok(!parseParams(SCAD).some((x) => x.name === "depois"));
});

test("ignora faixas inválidas e valor fora das opções", () => {
  assert.deepEqual(parseParams("a = 5; // [10:1]\nb = 5; // [0:0:10]\nc = \"x\"; // [\"a\", \"b\"]\ncube(1);"), []);
  assert.deepEqual(parseParams("// nada\ncube(1);"), []);
});

test("valores padrão", () => {
  assert.deepEqual(defaultValues(parseParams(SCAD)), { largura: 70, altura: 12.5, espessura: 3, arredondar: true, acabamento: "liso", modulo: 3 });
});

test("applyParams troca só os valores declarados e preserva comentário e resto do código", () => {
  const out = applyParams(SCAD, { largura: 100, arredondar: false, acabamento: "texturizado", constante: 99 });
  assert.match(out, /^largura = 100; \/\/ \[30:1:200\] Largura da base \(mm\)$/m);
  assert.match(out, /^arredondar = false; \/\/ \[true\]/m);
  assert.match(out, /^acabamento = "texturizado";/m);
  assert.match(out, /^constante = 5;$/m, "o que não é controle não muda");
  assert.match(out, /cube\(\[largura, 10, altura\]\);/);
});

test("applyParams limita ao intervalo, ajusta ao passo e ignora valor inválido (sem injeção de código)", () => {
  const out = applyParams(SCAD, { largura: 9999, altura: 12.74, espessura: "1; cube(500)" as unknown as number, acabamento: 'x"; cube(9); "' });
  assert.match(out, /^largura = 200;/m);
  assert.match(out, /^altura = 12.5;/m);
  assert.match(out, /^espessura = 3;/m);
  assert.match(out, /^acabamento = "liso";/m);
  assert.doesNotMatch(out, /cube\(500\)|cube\(9\)/);
});

test("sanitizeValue", () => {
  const [l] = parseParams(SCAD);
  assert.equal(sanitizeValue(l, NaN), null);
  assert.equal(sanitizeValue(l, 0), 30);
  assert.equal(sanitizeValue(l, 70.4), 70);
});
