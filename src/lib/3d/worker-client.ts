import { RENDER_TIMEOUT_MS } from "./limits.ts";

// Cliente do Web Worker do OpenSCAD (só no navegador). Uma renderização por vez; o pedido mais novo cancela o anterior
// (o worker é encerrado e recriado). Passou do tempo-limite: o worker é encerrado e recriado, e a promessa falha com "timeout".
// O código GPL do OpenSCAD fica no arquivo separado /vendor/openscad/openscad.js; aqui só há mensagens.
export const WORKER_URL = "/vendor/openscad/render-worker.js";

export type RenderResult = { ok: true; stl: Uint8Array; log: string } | { ok: false; error: string; log: string; reason: "compile" | "timeout" | "cancelled" | "worker" };

export class ScadRenderer {
  private worker: Worker | null = null;
  private seq = 0;
  private pending: { id: number; resolve: (r: RenderResult) => void; timer: ReturnType<typeof setTimeout> } | null = null;
  /** Pedido mais novo à espera: se chegar outro, este é descartado (o worker não é derrubado a cada movimento do controle). */
  private next: { code: string; timeoutMs: number; resolve: (r: RenderResult) => void } | null = null;

  private spawn(): Worker {
    const w = new Worker(WORKER_URL, { type: "module" });
    w.onmessage = (ev: MessageEvent) => {
      const d = ev.data as { id?: number; type?: string; ok?: boolean; stl?: ArrayBuffer; error?: string; log?: string };
      if (d.type !== "result" || !this.pending || d.id !== this.pending.id) return;
      const { resolve } = this.finish();
      if (d.ok && d.stl) resolve({ ok: true, stl: new Uint8Array(d.stl), log: d.log ?? "" });
      else resolve({ ok: false, error: d.error ?? "O OpenSCAD não conseguiu montar a peça.", log: d.log ?? "", reason: "compile" });
      this.runNext();
    };
    w.onerror = () => { this.abort("O motor 3D não carregou. Recarregue a página.", "worker"); };
    return w;
  }

  private finish() {
    const p = this.pending!;
    clearTimeout(p.timer);
    this.pending = null;
    return p;
  }

  /** Encerra o worker (travado, com erro ou fora de tempo) e responde ao pedido em andamento. */
  private abort(error: string, reason: "timeout" | "cancelled" | "worker") {
    this.worker?.terminate();
    this.worker = null;
    if (this.pending) this.finish().resolve({ ok: false, error, log: "", reason });
    this.runNext();
  }

  private runNext() {
    const n = this.next;
    if (!n || this.pending) return;
    this.next = null;
    this.start(n.code, n.timeoutMs, n.resolve);
  }

  private start(code: string, timeoutMs: number, resolve: (r: RenderResult) => void) {
    try { this.worker ??= this.spawn(); } catch { resolve({ ok: false, error: "Este navegador não consegue rodar o motor 3D.", log: "", reason: "worker" }); return; }
    const id = ++this.seq;
    const timer = setTimeout(() => this.abort(`A peça demorou mais de ${Math.round(timeoutMs / 1000)} s para montar e foi interrompida. Simplifique a peça (menos detalhes redondos).`, "timeout"), timeoutMs);
    this.pending = { id, resolve, timer };
    this.worker!.postMessage({ id, type: "render", code });
  }

  render(code: string, timeoutMs = RENDER_TIMEOUT_MS): Promise<RenderResult> {
    return new Promise<RenderResult>((resolve) => {
      if (this.next) this.next.resolve({ ok: false, error: "Cancelado: veio um pedido mais novo.", log: "", reason: "cancelled" });
      this.next = { code, timeoutMs, resolve };
      this.runNext();
    });
  }

  dispose() {
    if (this.next) { this.next.resolve({ ok: false, error: "Cancelado.", log: "", reason: "cancelled" }); this.next = null; }
    this.abort("Cancelado.", "cancelled");
  }
}
