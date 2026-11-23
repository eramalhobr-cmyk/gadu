// Teste do núcleo do worker com o OpenSCAD WASM REAL (o mesmo arquivo que o navegador carrega), em Node.
// O Web Worker em si (mensagens, timeout, CSP) é coberto pela captura em navegador real; aqui vale a compilação.
import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "./checks.ts";
import { boundingBox, parseStl, triangleCount } from "./mesh.ts";

const dir = new URL("../../../public/vendor/openscad/", import.meta.url).href;
const { createOpenSCAD } = await import(`${dir}openscad.js`);
const { renderScad, decodeFonts, usaTexto } = await import(`${dir}render-core.js`);
const { FONTES } = await import(`${dir}fonts.js`);

test("compila um cubo de verdade: STL binário, 12 triângulos e as medidas certas", async () => {
  const r = await renderScad(createOpenSCAD, "cube([20, 10, 5]);");
  assert.equal(r.ok, true);
  const mesh = parseStl(r.stl);
  assert.equal(triangleCount(mesh), 12);
  assert.deepEqual(boundingBox(mesh)!.size.map((n) => Math.round(n * 1000) / 1000), [20, 10, 5]);
  assert.equal(analyze(mesh).checks.find((c) => c.id === "malha")!.status, "ok");
});

test("peça paramétrica com difference() e $fn: malha fechada e dentro da mesa", async () => {
  const r = await renderScad(createOpenSCAD, "largura = 40; // [10:1:100]\ndifference() { cube([largura, 30, 10]); translate([20, 15, -1]) cylinder(h = 12, r = 6, $fn = 32); }");
  assert.equal(r.ok, true);
  const rep = analyze(parseStl(r.stl));
  assert.equal(rep.checks.find((c) => c.id === "malha")!.status, "ok");
  assert.equal(rep.checks.find((c) => c.id === "tamanho")!.status, "ok");
});

test("erro de sintaxe vira mensagem amigável e ok:false (sem lançar)", async () => {
  const r = await renderScad(createOpenSCAD, "cube([20, 10, 5]");
  assert.equal(r.ok, false);
  assert.match(r.error, /syntax error|Parser error/i);
});

test("código que não desenha nada: erro claro", async () => {
  const r = await renderScad(createOpenSCAD, "x = 1;");
  assert.equal(r.ok, false);
  assert.match(r.error, /vazia/);
});

test("não lê arquivos do sistema: include de arquivo inexistente não traz nada", async () => {
  const r = await renderScad(createOpenSCAD, "include </etc/passwd>\ncube(1);");
  const mesh = r.ok ? parseStl(r.stl) : null;
  // O sistema de arquivos do WASM é virtual: nada do aparelho aparece. Rende só o cubo (ou falha), nunca vaza conteúdo.
  assert.ok(!r.ok || triangleCount(mesh!) === 12);
  assert.ok(!/root:/.test(r.log));
});

// Referência 3D (23/11): sem fonte no WASM, text() saía vazio e o relevo sumia sem aviso.
test("texto em relevo: com as fontes Liberation Sans, text() desenha e sobe em Z (acento incluso)", async () => {
  const code = 'union() { cube([120, 40, 4]); translate([60, 20, 3.99]) linear_extrude(1.21) text("ESCRITÓRIO", size = 10, font = "Liberation Sans:style=Bold", halign = "center", valign = "center"); }';
  assert.equal(usaTexto(code), true);
  const r = await renderScad(createOpenSCAD, code, decodeFonts(FONTES));
  assert.equal(r.ok, true, r.error);
  const box = boundingBox(parseStl(r.stl));
  assert.ok(box && box.max[2] - box.min[2] > 5, `altura ${box ? box.max[2] - box.min[2] : "?"}`);
});

test("texto sem fonte disponível: erro claro em vez de peça sem o relevo", async () => {
  const r = await renderScad(createOpenSCAD, 'linear_extrude(1) text("GADU", size = 8);\ncube([10, 10, 1]);');
  assert.equal(r.ok, false);
  assert.match(r.error, /fonte/);
});

test("usaTexto só liga com text(", () => {
  assert.equal(usaTexto("cube(10); // texto"), false);
  assert.equal(usaTexto("text (\"A\");"), true);
});
