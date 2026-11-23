// UX-4 · "Feito · Desfazer": um aviso só, por alguns segundos, para toda ação que grava.
// Lógica pura (sem React) para poder testar. O componente é src/components/UndoToast.tsx.
import { MSG } from "./errors.ts";

/** Quanto tempo o Desfazer fica à mão (ms). Um pouco mais que o normal, para quem fala ou toca devagar. */
export const UNDO_MS = 8000;
/** Aviso sem botão (erro ou confirmação do próprio desfazer) some mais cedo. */
export const NOTICE_MS = 4000;

/** Frases do aviso, num lugar só. */
export const UNDO_TEXT = {
  done: "Feito.",
  later: "Passou para amanhã.",
  undone: "Desfeito.",
  failSave: MSG.save,
  failUndo: MSG.undo,
  gone: "Já passou o tempo de desfazer.",
  nothing: "Não há nada para desfazer agora.",
} as const;

export type UndoItem = { text: string; revert: () => Promise<unknown> };
export type UndoView = { text: string; undoable: boolean } | null;

/** Uma resposta que falhou: erro do Supabase, `ok: false` ou resposta HTTP fora de 2xx. */
export function failed(r: unknown): boolean {
  if (!r || typeof r !== "object") return false;
  const o = r as { error?: unknown; ok?: unknown };
  return Boolean(o.error) || o.ok === false;
}

type Timers = { set: (fn: () => void, ms: number) => unknown; clear: (id: unknown) => void };
const realTimers: Timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>) };

/** Guarda o último desfazer. Um novo aviso substitui o anterior; passado o tempo, o desfazer some. */
export class UndoController {
  private item: UndoItem | null = null;
  private timer: unknown = null;
  private view: UndoView = null;
  private listeners = new Set<() => void>();
  private timers: Timers;
  private ms: number;
  private noticeMs: number;
  constructor(timers: Timers = realTimers, ms = UNDO_MS, noticeMs = NOTICE_MS) { this.timers = timers; this.ms = ms; this.noticeMs = noticeMs; }

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getView = (): UndoView => this.view;
  /** Há um desfazer à espera? (para o "desfaz" falado) */
  get active(): boolean { return this.item !== null; }

  private set(view: UndoView, item: UndoItem | null, ms: number) {
    if (this.timer !== null) this.timers.clear(this.timer);
    this.item = item;
    this.view = view;
    this.timer = view ? this.timers.set(() => this.dismiss(), ms) : null;
    this.listeners.forEach((l) => l());
  }

  show(item: UndoItem) { this.set({ text: item.text, undoable: true }, item, this.ms); }
  notify(text: string) { this.set({ text, undoable: false }, null, this.noticeMs); }
  dismiss() { this.set(null, null, 0); }

  /** Desfaz a última ação. Devolve true se desfez. Sem nada à espera, avisa e devolve false. */
  async undo(): Promise<boolean> {
    const it = this.item;
    if (!it) { this.notify(UNDO_TEXT.nothing); return false; }
    this.dismiss();
    try {
      const r = await it.revert();
      if (failed(r)) { this.notify(UNDO_TEXT.failUndo); return false; }
    } catch {
      this.notify(UNDO_TEXT.failUndo);
      return false;
    }
    this.notify(UNDO_TEXT.undone);
    return true;
  }
}

/** O aviso único do app. */
export const undoBus = new UndoController();
/** Mostra "texto · Desfazer" por alguns segundos. `revert` desfaz o que foi gravado. */
export function showUndo(text: string, revert: () => Promise<unknown>) { undoBus.show({ text, revert }); }
/** Aviso curto sem botão (ex.: erro). */
export function showNotice(text: string) { undoBus.notify(text); }

/** "desfaz", "desfazer isso", "volta atrás", "foi sem querer": o comando falado ou escrito para desfazer a última ação. */
export function parseUndoCommand(text: string): boolean {
  const t = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  return /^(gadu )?(por favor )?(pode )?(desfaz|desfazer|desfaca)( (isso|essa|esta|a ultima|a ultima acao|ai|agora|tudo))?( por favor)?$/.test(t)
    || /^(volta|voltar|volte) atras$/.test(t)
    || /^(foi|isso foi) sem querer$/.test(t);
}
