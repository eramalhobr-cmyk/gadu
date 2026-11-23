// Ações propostas pela conversa (gasto, meta, evento, lembrete…): um formato só para o cartão de confirmação,
// a confirmação falada e (no futuro) novas ações. Puro: sem fetch nem React; quem executa é o ActionCard.
import { formatBRL } from "./finance/money.ts";
import { MEIO_LABEL, type Meio } from "./finance/types.ts";
import { fmtNum } from "./goals/numero.ts";
import type { MetaDraft } from "./goals/types.ts";
import type { ConfirmItem, ConfirmKind } from "./voice-confirm.ts";

export type GastoDraft = { valor: number; categoria: string; descricao: string; meio: Meio; data: string };
export type EventDraft = { title: string; start: string; end: string; location: string | null };

export type ChatAction =
  | { kind: "gasto"; g: GastoDraft }
  | { kind: "meta"; d: MetaDraft }
  | { kind: "evento"; ev: EventDraft }
  /** Já criado pelo servidor: o cartão oferece Desfazer (apaga). */
  | { kind: "lembrete"; id: number; text: string; dueAt: string };

export type ActionView = {
  icon: string;
  /** Rótulos do cartão por estado. */
  proposed: string; done: string; undone: string;
  title: string; detail: string;
  /** Botão principal e o texto enquanto grava. Vazio quando a ação já foi aplicada (só Desfazer). */
  confirm: string; busy: string;
  applied: boolean;
  open?: { label: string; view: "financeiro" | "metas" | "agenda" | "hoje" };
};

const TZ = "America/Sao_Paulo";
const hm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

/** "sábado, 28 de nov · 10:00–11:00". */
export function eventWhen(start: string, end: string): string {
  const day = new Date(start).toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "long", day: "numeric", month: "short" }).replace(".", "");
  return `${day} · ${hm(start)}–${hm(end)}`;
}
/** "hoje 14:00", "amanhã 09:00", "sex, 28/11 09:00". */
export function whenLabel(iso: string, now = new Date()): string {
  const k = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
  const d = new Date(iso);
  if (k(d) === k(now)) return `hoje ${hm(iso)}`;
  if (k(d) === k(new Date(now.getTime() + 86_400_000))) return `amanhã ${hm(iso)}`;
  return `${d.toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "")} ${hm(iso)}`;
}

export function describe(a: ChatAction, now = new Date()): ActionView {
  switch (a.kind) {
    case "gasto": {
      const [, m, d] = a.g.data.split("-");
      return {
        icon: "coin", proposed: "Gasto para confirmar", done: "Gasto lançado", undone: "Descartado",
        title: `${formatBRL(a.g.valor)} · ${a.g.categoria}`,
        detail: `${d}/${m} · ${MEIO_LABEL[a.g.meio]}${a.g.descricao ? ` · ${a.g.descricao}` : ""}`,
        confirm: "Lançar", busy: "Lançando…", applied: false, open: { label: "Ver no Financeiro", view: "financeiro" },
      };
    }
    case "meta": {
      const reg = a.d.acao === "registrar";
      const quando = a.d.data ? `${a.d.data.slice(8, 10)}/${a.d.data.slice(5, 7)}` : "";
      const valor = a.d.valor === null ? "" : `${fmtNum(a.d.valor)}${a.d.unidade ? (a.d.unidade === "%" ? "%" : ` ${a.d.unidade}`) : ""}`;
      return {
        icon: "target", proposed: reg ? "Registro para confirmar" : "Conclusão para confirmar", done: reg ? "Progresso registrado" : "Meta concluída", undone: "Descartado",
        title: a.d.titulo,
        detail: reg ? `${valor} · ${quando}${a.d.agregacao === "ultimo" ? " · medida atual" : ""}` : "Marcar a meta como concluída",
        confirm: "Confirmar", busy: "Salvando…", applied: false, open: { label: "Ver em Metas", view: "metas" },
      };
    }
    case "evento":
      return {
        icon: "calendar", proposed: "Evento para confirmar", done: "Criado na agenda", undone: "Descartado",
        title: a.ev.title, detail: `${eventWhen(a.ev.start, a.ev.end)}${a.ev.location ? ` · ${a.ev.location}` : ""}`,
        confirm: "Criar na agenda", busy: "Criando…", applied: false,
      };
    case "lembrete":
      return {
        icon: "bell", proposed: "Lembrete criado", done: "Lembrete criado", undone: "Lembrete apagado",
        title: a.text, detail: whenLabel(a.dueAt, now),
        confirm: "", busy: "Apagando…", applied: true, open: { label: "Ver no Hoje", view: "hoje" },
      };
  }
}

/** O que a confirmação falada lê. */
export function toConfirmItem(a: ChatAction): ConfirmItem {
  switch (a.kind) {
    case "gasto": return { kind: "gasto", valor: a.g.valor, categoria: a.g.categoria, descricao: a.g.descricao, data: a.g.data };
    case "meta": return { kind: "meta", titulo: a.d.titulo, acao: a.d.acao, valor: a.d.valor, unidade: a.d.unidade };
    case "evento": return { kind: "evento", title: a.ev.title, start: a.ev.start };
    case "lembrete": return { kind: "lembrete", text: a.text, dueAt: a.dueAt };
  }
}
export function confirmKind(a: ChatAction): ConfirmKind {
  return a.kind;
}
