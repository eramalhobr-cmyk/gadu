import assert from "node:assert/strict";
import { inflateRawSync, deflateRawSync } from "node:zlib";
import { test } from "node:test";
import { box } from "./fixtures.ts";
import { parseStl, triangleCount } from "./mesh.ts";
import { encodeBinaryStl } from "./stl.ts";
import { A1_TEMPLATE_AVAILABLE, build3mf, escapeXml, indexMesh, injectIntoTemplate } from "./threemf.ts";
import { crc32, readZip, storedEntry, writeZip, type ZipEntry } from "./zip.ts";

test("STL binário: tamanho, contagem, normais e ida e volta", () => {
  const m = box(10, 20, 30);
  const stl = encodeBinaryStl(m);
  assert.equal(stl.length, 84 + 12 * 50);
  assert.equal(new DataView(stl.buffer).getUint32(80, true), 12);
  const back = parseStl(stl);
  assert.equal(triangleCount(back), 12);
  assert.deepEqual(Array.from(back.positions), Array.from(m.positions));
  const nz = new DataView(stl.buffer).getFloat32(84 + 8, true); // primeiro triângulo: face de baixo
  assert.ok(Math.abs(nz + 1) < 1e-6);
});

test("parseStl lê ASCII e recusa lixo", () => {
  const ascii = "solid x\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid x";
  assert.equal(triangleCount(parseStl(new TextEncoder().encode(ascii))), 1);
  assert.throws(() => parseStl(new TextEncoder().encode("isto não é stl")));
});

test("zip: CRC32 conhecido e ida e volta", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  const z = writeZip([storedEntry("a.txt", new TextEncoder().encode("olá")), storedEntry("pasta/b.txt", new Uint8Array([1, 2, 3]))]);
  const r = readZip(z);
  assert.deepEqual(r.map((e) => e.name), ["a.txt", "pasta/b.txt"]);
  assert.equal(new TextDecoder().decode(r[0].raw), "olá");
});

test("3MF: estrutura do pacote, unidade em mm, vértices soldados e triângulos", () => {
  const z = readZip(build3mf(box(10, 20, 30), "Caixa <teste>"));
  assert.deepEqual(z.map((e) => e.name), ["[Content_Types].xml", "_rels/.rels", "3D/3dmodel.model"]);
  const txt = (n: string) => new TextDecoder().decode(z.find((e) => e.name === n)!.raw);
  assert.match(txt("[Content_Types].xml"), /Extension="model" ContentType="application\/vnd\.ms-package\.3dmanufacturing-3dmodel\+xml"/);
  assert.match(txt("[Content_Types].xml"), /Extension="rels"/);
  assert.match(txt("_rels/.rels"), /Target="\/3D\/3dmodel\.model"/);
  assert.match(txt("_rels/.rels"), /3dmanufacturing\/2013\/01\/3dmodel/);
  const model = txt("3D/3dmodel.model");
  assert.match(model, /<model unit="millimeter"/);
  assert.match(model, /xmlns="http:\/\/schemas\.microsoft\.com\/3dmanufacturing\/core\/2015\/02"/);
  assert.equal((model.match(/<vertex /g) ?? []).length, 8, "8 vértices soldados");
  assert.equal((model.match(/<triangle /g) ?? []).length, 12);
  assert.match(model, /<build><item objectid="1"\/><\/build>/);
  assert.match(model, /name="Caixa &lt;teste&gt;"/);
  assert.match(model, /<vertex x="10" y="20" z="30"\/>/);
  // os CRCs do zip batem com o conteúdo
  for (const e of z) assert.equal(e.crc, crc32(e.raw));
  assert.deepEqual(indexMesh(box(1, 1, 1)).triangles.every((i) => i < 8), true);
  assert.equal(escapeXml(`<&"'>`), "&lt;&amp;&quot;&apos;&gt;");
  assert.throws(() => build3mf({ positions: new Float32Array(0) }));
});

test("modelo de projeto (FICTÍCIO): troca só a geometria e mantém o resto byte a byte", async () => {
  const model = `<?xml version="1.0"?><model unit="millimeter" xmlns="x"><metadata name="Title">Vazio</metadata><resources><object id="9"><mesh><vertices/><triangles/></mesh></object></resources><build><item objectid="9"/></build></model>`;
  const settings = new TextEncoder().encode('{"printer_model":"fictício"}');
  const deflated: ZipEntry = { name: "3D/3dmodel.model", method: 8, crc: crc32(new TextEncoder().encode(model)), size: model.length, raw: deflateRawSync(Buffer.from(model)) };
  const template = writeZip([storedEntry("[Content_Types].xml", new TextEncoder().encode("<Types/>")), deflated, storedEntry("Metadata/project_settings.config", settings)]);
  const out = readZip(await injectIntoTemplate(template, box(10, 10, 10), async (raw) => new Uint8Array(inflateRawSync(raw))));
  assert.deepEqual(out.map((e) => e.name), ["[Content_Types].xml", "3D/3dmodel.model", "Metadata/project_settings.config"]);
  assert.deepEqual(Array.from(out[2].raw), Array.from(settings));
  const m = new TextDecoder().decode(out[1].raw);
  assert.match(m, /<metadata name="Title">Vazio<\/metadata>/);
  assert.equal((m.match(/<vertex /g) ?? []).length, 8);
  assert.doesNotMatch(m, /id="9"/);
  assert.match(m, /<build><item objectid="1"\/><\/build>/);
  await assert.rejects(injectIntoTemplate(writeZip([storedEntry("x.txt", new Uint8Array(1))]), box(1, 1, 1), async (r) => r));
});

test("o botão do modelo A1 continua desativado até o Eduardo enviar o projeto", () => {
  assert.equal(A1_TEMPLATE_AVAILABLE, false);
});
