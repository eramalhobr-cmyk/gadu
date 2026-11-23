// Confere as peças de referência do 3D-1 (critério de pronto): renderiza cada .scad com o OpenSCAD WASM real (o mesmo do
// navegador) e roda as verificações da A1 (tamanho, malha fechada, base, parede, balanço). Não chama IA nem rede.
// Uso: node --experimental-strip-types scripts/3d-referencia/conferir.ts pecas.json > relatorio.json
// pecas.json: [{ "titulo": "...", "scad": "..." }]  (por exemplo, exportado da tabela pecas_3d da própria pessoa)
import { readFileSync } from "node:fs";
import { analyze } from "../../src/lib/3d/checks.ts";
import { parseStl, placeOnBed, triangleCount, boundingBox } from "../../src/lib/3d/mesh.ts";
import { applyParams, defaultValues, parseParams } from "../../src/lib/3d/params.ts";
import { validateScad } from "../../src/lib/3d/scad.ts";

const dir = new URL("../../public/vendor/openscad/", import.meta.url).href;
const { createOpenSCAD } = await import(`${dir}openscad.js`);
const { renderScad } = await import(`${dir}render-core.js`);

const pecas = JSON.parse(readFileSync(process.argv[2], "utf8")) as { titulo: string; scad: string }[];
const out = [];
for (const p of pecas) {
  const v = validateScad(p.scad);
  if (!v.ok) { out.push({ titulo: p.titulo, render: "recusado", motivo: v.message }); continue; }
  const params = parseParams(p.scad);
  const values = defaultValues(params);
  const t0 = Date.now();
  const r = await renderScad(createOpenSCAD, applyParams(p.scad, values));
  const ms = Date.now() - t0;
  if (!r.ok) { out.push({ titulo: p.titulo, render: "erro", motivo: String(r.error).slice(0, 300), ms }); continue; }
  const mesh = placeOnBed(parseStl(r.stl));
  const rep = analyze(mesh, params, values);
  out.push({
    titulo: p.titulo, render: "ok", ms, triangulos: triangleCount(mesh), medidas: boundingBox(mesh)?.size.map((n) => Math.round(n * 10) / 10),
    parametros: params.length, a1_ok: rep.ok, erros: rep.erros, avisos: rep.avisos,
    checks: Object.fromEntries(rep.checks.map((c) => [c.id, `${c.status}: ${c.mensagem}`])),
  });
}
console.log(JSON.stringify(out, null, 2));
