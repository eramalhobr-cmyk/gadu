// Núcleo de renderização, SEM código do OpenSCAD: recebe a função createOpenSCAD de fora.
// Roda só dentro do Web Worker (ou no Node, nos testes). Não toca em DOM, rede, cookies nem armazenamento.
// Licença deste arquivo: a do GaDu. O openscad.js ao lado é GPL-2.0 ou posterior (veja LICENSE.txt e README.md).

const MAX_LOG = 4000;

/** O código usa text()? Só então vale carregar as fontes (1 MB). */
export function usaTexto(code) {
  return /\btext\s*\(/.test(code);
}

/** Converte { "Arquivo.ttf": base64 } em [{ name, bytes }] para o renderScad. */
export function decodeFonts(map) {
  return Object.entries(map || {}).map(([name, b64]) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { name, bytes };
  });
}

/**
 * Roda o OpenSCAD sobre o código e devolve { ok, stl (Uint8Array binário) | error, log }. Uma instância nova por render.
 * fonts: [{ name, bytes }] gravadas em /fonts. Sem elas, text() sai vazio e o relevo some sem aviso.
 */
export async function renderScad(createOpenSCAD, code, fonts = []) {
  const lines = [];
  const push = (l) => { if (lines.join("\n").length < MAX_LOG) lines.push(String(l)); };
  const inst = await createOpenSCAD({ noInitialRun: true, print: push, printErr: push });
  const m = inst.getInstance();
  if (fonts.length) {
    m.FS.mkdirTree("/fonts");
    for (const f of fonts) m.FS.writeFile(`/fonts/${f.name}`, f.bytes);
    m.FS.mkdirTree("/etc/fonts");
    m.FS.writeFile("/etc/fonts/fonts.conf", '<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>/fonts</dir></fontconfig>');
  }
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
  if (rc === 0 && /Can't get font/i.test(log)) return { ok: false, error: "O texto da peça usa uma fonte que não existe aqui. Use a fonte Liberation Sans.", log };
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
