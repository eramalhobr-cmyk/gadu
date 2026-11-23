// Ações propostas pela conversa (gasto, meta, evento, lembrete…): um formato só para o cartão de confirmação,
// a confirmação falada e (no futuro) novas ações. Puro: sem fetch nem React; quem executa é o ActionCard.
import { formatBRL } from "./finance/money.ts";
import { MEIO_LABEL, type Meio } from "./finance/types.ts";
import { fmtNum } from "./goals/numero.ts";
import type { MetaDraft } from "./goals/types.ts";
import type { Ajuste } from "./acoes.ts";
import type { Categoria, Medicao } from "./goals/types.ts";
import { confirmQuestion, spokenDay, spokenMoney, type ConfirmItem } from "./voice-confirm.ts";

export type GastoDraft = { valor: number; categoria: string; descricao: string; meio: Meio; data: string };
export type EventDraft = { title: string; start: string; end: string; location: string | null };

export type ChatAction =
  | { kind: "gasto"; g: GastoDraft }
  | { kind: "meta"; d: MetaDraft }
  | { kind: "evento"; ev: EventDraft }
  /** Já criado pelo servidor: o cartão oferece Desfazer (apaga). */
  | { kind: "lembrete"; id: number; text: string; dueAt: string }
  // "Tudo por voz" (src/lib/acoes.ts): ids resolvidos no servidor, só entre os itens da própria pessoa.
  | { kind: "meta_nova"; titulo: string; medicao: Medicao; unidade: string | null; alvo: number | null; inicial: number; prazo: string | null; categoria: Categoria; marcos: string[] }
  | { kind: "marco"; goalId: string; meta: string; titulo: string; data: string | null }
  | { kind: "marco_ok"; goalId: string; marcoId: string; meta: string; titulo: string }
  | { kind: "meta_tarefa"; goalId: string; meta: string; titulo: string; prazo: string | null }
  | { kind: "tarefa_ok"; id: number; titulo: string }
  /** Já criada pelo servidor ("anota aí"): o cartão oferece Desfazer (cancela a tarefa). */
  | { kind: "tarefa_criada"; id: number; titulo: string; prazo: string | null }
  | { kind: "tarefa_adiar"; id: number; titulo: string; prazo: string }
  | { kind: "tarefa_cancelar"; id: number; titulo: string }
  | { kind: "tarefa_reabrir"; id: number; titulo: string }
  | { kind: "tarefa_editar"; id: number; titulo: string; mudancas: TarefaMudancas }
  | { kind: "lembrete_off"; id: number; text: string; dueAt: string }
  | { kind: "lembrete_adiar"; id: number; text: string; dueAt: string; novoDueAt: string }
  | { kind: "conta_paga"; itemId: string; nome: string; valor: number; ano: number; mes: number }
  | { kind: "projeto"; nome: string; objetivo: string | null }
  | { kind: "ajuste"; ajuste: Ajuste };

/** Só os campos que mudam; `projetoId` vem do servidor (projeto da própria pessoa). */
export type TarefaMudancas = { titulo?: string; prioridade?: 1 | 2 | 3; prazo?: string; projetoId?: number; projeto?: string };
const PRIO = { 1: "alta", 2: "normal", 3: "baixa" } as const;
export function mudancasTexto(m: TarefaMudancas): string {
  const l: string[] = [];
  if (m.titulo) l.push(`título: ${m.titulo}`);
  if (m.prioridade) l.push(`prioridade ${PRIO[m.prioridade]}`);
  if (m.prazo) l.push(`prazo ${m.prazo.slice(8, 10)}/${m.prazo.slice(5, 7)}`);
  if (m.projeto) l.push(`projeto ${m.projeto}`);
  return l.join(" · ");
}

export type ActionView = {
  icon: string;
  /** Rótulos do cartão por estado. */
  proposed: string; done: string; undone: string;
  title: string; detail: string;
  /** Botão principal e o texto enquanto grava. Vazio quando a ação já foi aplicada (só Desfazer). */
  confirm: string; busy: string;
  applied: boolean;
  open?: { label: string; view: "financeiro" | "metas" | "agenda" | "hoje" | "tarefas" | "projetos" | "ajustes" };
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
    case "meta_nova": {
      const alvo = a.medicao === "numerica" && a.alvo !== null ? `${fmtNum(a.inicial)} → ${fmtNum(a.alvo)}${a.unidade ? ` ${a.unidade}` : ""}` : a.medicao === "percentual" ? "0 a 100%" : a.medicao === "marcos" ? `${a.marcos.length} ${a.marcos.length === 1 ? "marco" : "marcos"}` : "por tarefas";
      return {
        icon: "target", proposed: "Meta nova para confirmar", done: "Meta criada", undone: "Descartado",
        title: a.titulo, detail: `${alvo}${a.prazo ? ` · até ${dm(a.prazo)}` : ""}`,
        confirm: "Criar meta", busy: "Criando…", applied: false, open: { label: "Ver em Metas", view: "metas" },
      };
    }
    case "marco":
      return { icon: "target", proposed: "Marco para confirmar", done: "Marco adicionado", undone: "Descartado", title: a.titulo, detail: `Meta: ${a.meta}${a.data ? ` · até ${dm(a.data)}` : ""}`, confirm: "Adicionar", busy: "Salvando…", applied: false, open: { label: "Ver em Metas", view: "metas" } };
    case "marco_ok":
      return { icon: "target", proposed: "Marco para concluir", done: "Marco concluído", undone: "Descartado", title: a.titulo, detail: `Meta: ${a.meta}`, confirm: "Concluir marco", busy: "Salvando…", applied: false, open: { label: "Ver em Metas", view: "metas" } };
    case "meta_tarefa":
      return { icon: "check", proposed: "Tarefa da meta para confirmar", done: "Tarefa criada na meta", undone: "Descartado", title: a.titulo, detail: `Meta: ${a.meta}${a.prazo ? ` · até ${dm(a.prazo)}` : ""}`, confirm: "Criar tarefa", busy: "Criando…", applied: false, open: { label: "Ver em Metas", view: "metas" } };
    case "tarefa_ok":
      return { icon: "check", proposed: "Concluir tarefa?", done: "Tarefa concluída", undone: "Descartado", title: a.titulo, detail: "Marcar como feita", confirm: "Concluir", busy: "Salvando…", applied: false, open: { label: "Ver Tarefas", view: "tarefas" } };
    case "tarefa_criada":
      return { icon: "check", proposed: "Tarefa anotada", done: "Tarefa anotada", undone: "Tarefa desfeita", title: a.titulo, detail: a.prazo ? `Prazo: ${dm(a.prazo)}` : "Sem prazo", confirm: "", busy: "Desfazendo…", applied: true, open: { label: "Ver Tarefas", view: "tarefas" } };
    case "tarefa_adiar":
      return { icon: "calendar", proposed: "Adiar tarefa?", done: "Tarefa adiada", undone: "Descartado", title: a.titulo, detail: `Novo prazo: ${dm(a.prazo)}`, confirm: "Adiar", busy: "Salvando…", applied: false, open: { label: "Ver Tarefas", view: "tarefas" } };
    case "tarefa_cancelar":
      return { icon: "check", proposed: "Cancelar tarefa?", done: "Tarefa cancelada", undone: "Descartado", title: a.titulo, detail: "Sai da lista (dá para reabrir pela conversa)", confirm: "Cancelar tarefa", busy: "Salvando…", applied: false, open: { label: "Ver Tarefas", view: "tarefas" } };
    case "tarefa_reabrir":
      return { icon: "check", proposed: "Reabrir tarefa?", done: "Tarefa reaberta", undone: "Descartado", title: a.titulo, detail: "Volta para as abertas", confirm: "Reabrir", busy: "Salvando…", applied: false, open: { label: "Ver Tarefas", view: "tarefas" } };
    case "tarefa_editar":
      return { icon: "check", proposed: "Mudar tarefa?", done: "Tarefa mudada", undone: "Descartado", title: a.titulo, detail: mudancasTexto(a.mudancas), confirm: "Mudar", busy: "Salvando…", applied: false, open: { label: "Ver Tarefas", view: "tarefas" } };
    case "lembrete_adiar":
      return { icon: "bell", proposed: "Adiar lembrete?", done: "Lembrete adiado", undone: "Descartado", title: a.text, detail: `Novo horário: ${whenLabel(a.novoDueAt, now)}`, confirm: "Adiar", busy: "Salvando…", applied: false, open: { label: "Ver no Hoje", view: "hoje" } };
    case "lembrete_off":
      return { icon: "bell", proposed: "Cancelar lembrete?", done: "Lembrete cancelado", undone: "Descartado", title: a.text, detail: whenLabel(a.dueAt, now), confirm: "Cancelar lembrete", busy: "Salvando…", applied: false, open: { label: "Ver no Hoje", view: "hoje" } };
    case "conta_paga":
      return { icon: "coin", proposed: "Marcar conta como paga?", done: "Conta paga", undone: "Descartado", title: a.nome, detail: `${formatBRL(a.valor)} · ${String(a.mes).padStart(2, "0")}/${a.ano}`, confirm: "Marcar paga", busy: "Salvando…", applied: false, open: { label: "Ver no Financeiro", view: "financeiro" } };
    case "projeto":
      return { icon: "folder", proposed: "Projeto novo para confirmar", done: "Projeto criado", undone: "Descartado", title: a.nome, detail: a.objetivo || "Sem objetivo por enquanto", confirm: "Criar projeto", busy: "Criando…", applied: false, open: { label: "Ver Projetos", view: "projetos" } };
    case "ajuste":
      return { icon: "gear", proposed: "Mudar configuração?", done: "Configuração mudada", undone: "Descartado", title: ajusteLabel(a.ajuste), detail: "Vale neste aparelho", confirm: "Mudar", busy: "Salvando…", applied: false, open: { label: "Ver Configurações", view: "ajustes" } };
  }
}

const dm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
const liga = (v: boolean) => (v ? "Ligar" : "Desligar");
export function ajusteLabel(j: Ajuste): string {
  switch (j.opcao) {
    case "texto": return `Tamanho do texto: ${{ "100": "Normal", "115": "Grande", "130": "Maior" }[j.valor]}`;
    case "maos_livres": return `${liga(j.valor)} a conversa contínua`;
    case "respostas_curtas": return `${liga(j.valor)} as respostas faladas curtas`;
    case "voz": return `${liga(j.valor)} a resposta falada`;
    case "tema": return `Tema ${j.valor === "light" ? "claro" : "escuro"}`;
  }
}

/** Pergunta falada da confirmação (sem o "Diga sim ou não"). */
export function actionQuestion(a: ChatAction, now = new Date()): string {
  switch (a.kind) {
    case "gasto": case "meta": case "evento": case "lembrete": return confirmQuestion(toConfirmItem(a), now);
    case "meta_nova": {
      const alvo = a.medicao === "numerica" && a.alvo !== null ? `, de ${fmtNum(a.inicial)} até ${fmtNum(a.alvo)}${a.unidade ? ` ${a.unidade}` : ""}` : a.medicao === "marcos" ? `, com ${a.marcos.length} ${a.marcos.length === 1 ? "marco" : "marcos"}` : "";
      return `Crio a meta ${a.titulo}${alvo}${a.prazo ? `, até ${spokenDay(a.prazo, now)}` : ""}?`;
    }
    case "marco": return `Adiciono o marco ${a.titulo} na meta ${a.meta}?`;
    case "marco_ok": return `Marco o marco ${a.titulo}, da meta ${a.meta}, como concluído?`;
    case "meta_tarefa": return `Crio a tarefa ${a.titulo} na meta ${a.meta}?`;
    case "tarefa_ok": return `Marco a tarefa ${a.titulo} como feita?`;
    case "tarefa_criada": return `Anotei a tarefa ${a.titulo}${a.prazo ? `, para ${spokenDay(a.prazo, now)}` : ""}. Está certo?`;
    case "tarefa_adiar": return `Adio a tarefa ${a.titulo} para ${spokenDay(a.prazo, now)}?`;
    case "tarefa_cancelar": return `Cancelo a tarefa ${a.titulo}?`;
    case "tarefa_reabrir": return `Reabro a tarefa ${a.titulo}?`;
    case "tarefa_editar": return `Na tarefa ${a.titulo}, mudo ${mudancasFalada(a.mudancas, now)}?`;
    case "lembrete_adiar": return `Adio o lembrete ${a.text} para ${whenLabel(a.novoDueAt, now)}?`;
    case "lembrete_off": return `Cancelo o lembrete ${a.text}?`;
    case "conta_paga": return `Marco a conta ${a.nome}, de ${spokenMoney(a.valor)}, como paga?`;
    case "projeto": return `Crio o projeto ${a.nome}?`;
    case "ajuste": return `${ajusteLabel(a.ajuste)}?`;
  }
}

function mudancasFalada(m: TarefaMudancas, now: Date): string {
  const l: string[] = [];
  if (m.titulo) l.push(`o título para ${m.titulo}`);
  if (m.prioridade) l.push(`a prioridade para ${PRIO[m.prioridade]}`);
  if (m.prazo) l.push(`o prazo para ${spokenDay(m.prazo, now)}`);
  if (m.projeto) l.push(`o projeto para ${m.projeto}`);
  return l.join(", ");
}

/** O que a confirmação falada lê (tipos com frase própria em voice-confirm.ts). */
export function toConfirmItem(a: Extract<ChatAction, { kind: "gasto" | "meta" | "evento" | "lembrete" }>): ConfirmItem {
  switch (a.kind) {
    case "gasto": return { kind: "gasto", valor: a.g.valor, categoria: a.g.categoria, descricao: a.g.descricao, data: a.g.data };
    case "meta": return { kind: "meta", titulo: a.d.titulo, acao: a.d.acao, valor: a.d.valor, unidade: a.d.unidade };
    case "evento": return { kind: "evento", title: a.ev.title, start: a.ev.start };
    case "lembrete": return { kind: "lembrete", text: a.text, dueAt: a.dueAt };
  }
}
