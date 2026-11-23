// Web Worker do OpenSCAD (módulo). O app conversa com ele SÓ por mensagens:
//   entrada: { id, type: "render", code }   saída: { id, type: "ready" | "result", ok, stl?, error?, log? }
// O OpenSCAD (GPL) é carregado do arquivo separado ./openscad.js; nada dele entra no código do GaDu.
// A CSP deste arquivo (next.config.ts) proíbe rede (connect-src 'none') e permite só WebAssembly deste endereço.
import { decodeFonts, renderScad, usaTexto } from "./render-core.js";

let loading = null;
function load() {
  if (!loading) loading = import("./openscad.js").then((m) => m.createOpenSCAD);
  return loading;
}
// Fontes (Liberation Sans, OFL) só quando o código tem text(): módulo do mesmo endereço, sem rede.
let fontes = null;
function loadFonts() {
  if (!fontes) fontes = import("./fonts.js").then((m) => decodeFonts(m.FONTES));
  return fontes;
}

self.onmessage = async (ev) => {
  const d = ev.data || {};
  if (d.type !== "render" || typeof d.code !== "string" || d.code.length > 200000) return;
  try {
    const create = await load();
    const r = await renderScad(create, d.code, usaTexto(d.code) ? await loadFonts() : []);
    if (r.ok) self.postMessage({ id: d.id, type: "result", ok: true, stl: r.stl.buffer, log: r.log }, [r.stl.buffer]);
    else self.postMessage({ id: d.id, type: "result", ok: false, error: r.error, log: r.log });
  } catch (e) {
    self.postMessage({ id: d.id, type: "result", ok: false, error: "O OpenSCAD travou ao montar a peça. Tente de novo.", log: String(e && e.message ? e.message : e).slice(0, 500) });
  }
};
self.postMessage({ type: "ready" });
