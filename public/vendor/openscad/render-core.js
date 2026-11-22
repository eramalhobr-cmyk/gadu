// Núcleo de renderização, SEM código do OpenSCAD: recebe a função createOpenSCAD de fora.
// Roda só dentro do Web Worker (ou no Node, nos testes). Não toca em DOM, rede, cookies nem armazenamento.
// Licença deste arquivo: a do GaDu. O openscad.js ao lado é GPL-2.0 ou posterior (veja LICENSE.txt e README.md).

const MAX_LOG = 4000;

/** Roda o OpenSCAD sobre o código e devolve { ok, stl (Uint8Array binário) | error, log }. Uma instância nova por render. */
export async function renderScad(createOpenSCAD, code) {
  const lines = [];
  const push = (l) => { if (lines.join("\n").length < MAX_LOG) lines.push(String(l)); };
  const inst = await createOpenSCAD({ noInitialRun: true, print: push, printErr: push });
  const m = inst.getInstance();
  m.FS.writeFile("/input.scad", code);
  let rc;
  try {
    rc = m.callMain(["/input.scad", "--backend=manifold", "--export-format", "binstl", "-o", "/out.stl"]);
  } catch (e) {
    // O Emscripten lança ao terminar com erro; trata como falha de compilação.
    rc = typeof e === "number" ? e : 1;
    push(String(e && e.message ? e.message : e));
  }
  const log = lines.join("\n").slice(0, MAX_LOG);
  if (rc !== 0) return { ok: false, error: friendlyError(log), log };
  let stl;
  try { stl = m.FS.readFile("/out.stl"); } catch { return { ok: false, error: "O OpenSCAD não gerou a peça. O código pode estar vazio.", log }; }
  if (!stl || stl.length < 84) return { ok: false, error: "O OpenSCAD não gerou a peça. O código pode estar vazio.", log };
  return { ok: true, stl, log };
}

/** Pega a linha de erro do OpenSCAD (ERROR:, WARNING: de parse) para mostrar sem o ruído técnico. */
export function friendlyError(log) {
  if (/top level object is empty/i.test(log)) return "A peça ficou vazia: o código não desenha nada.";
  const errs = log.split("\n").filter((l) => /ERROR|Parser error|syntax error|Can't parse/i.test(l));
  return (errs.length ? errs.slice(0, 4).join("\n") : log.split("\n").slice(-4).join("\n")) || "O OpenSCAD não conseguiu montar a peça.";
}
