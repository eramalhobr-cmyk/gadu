// Ações propostas pela conversa (gasto, meta, evento, lembrete…): um formato só para o cartão de confirmação,
// a confirmação falada e (no futuro) novas ações. Puro: sem fetch nem React; quem executa é o ActionCard.
import { formatBRL } from "./finance/money.ts";
import { MEIO_LABEL, MESES, type Meio } from "./finance/types.ts";
import { fmtNum } from "./goals/numero.ts";
import type { MetaDraft } from "./goals/types.ts";
import { DESTINO_NOME, type Ajuste, type Destino } from "./acoes.ts";
import { FERRAMENTA_NOME, type Ferramenta } from "./agentes/ferramentas.ts";
import type { Categoria, Medicao } from "./goals/types.ts";
import { SALARIO_ANO, type Salario } from "./finance/salario.ts";
import { resumoSalario } from "./finance/salario-texto.ts";
import { confirmQuestion, spokenDay, spokenMoney, spokenTime, type ConfirmItem } from "./voice-confirm.ts";

export type GastoDraft = { valor: number; categoria: string; descricao: string; meio: Meio; data: string };
export type EventDraft = { title: string; start: string; end: string; location: string | null };

export type ChatAction =
  | { kind: "gasto"; g: GastoDraft }
  | { kind: "meta"; d: MetaDraft }
  | { kind: "registro_apagar"; goalId: string; registroId: string; meta: string; valor: number; unidade: string | null; data: string }
  | { kind: "evento"; ev: EventDraft }
  /** Já criado pelo servidor: o cartão oferece Desfazer (apaga). */
  | { kind: "lembrete"; id: number; text: string; dueAt: string }
  // "Tudo por voz" (src/lib/acoes.ts): ids resolvidos no servidor, só entre os itens da própria pessoa.
  | { kind: "meta_nova"; titulo: string; medicao: Medicao; unidade: string | null; alvo: number | null; inicial: number; prazo: string | null; categoria: Categoria; marcos: string[] }
  /** Simulador de salário: o cálculo vem do servidor. Sem `salvar` é só informação (sem botões); com `salvar`, grava o líquido na receita principal do mês depois da confirmação. */
  | { kind: "salario"; calc: Salario; salvar: { itemId: string; nome: string; antes: number | null; ano: number; mes: number } | null }
  | { kind: "meta_status"; goalId: string; titulo: string; para: "pausada" | "ativa" | "arquivada" }
  | { kind: "meta_editar"; goalId: string; titulo: string; unidade: string | null; mudancas: { titulo?: string; alvo?: number; prazo?: string } }
  | { kind: "projeto_editar"; id: number; nome: string; mudancas: { nome?: string; objetivo?: string } }
  | { kind: "projeto_arquivar"; id: number; nome: string }
  | { kind: "agente_novo"; nome: string; area: string; instrucoes: string }
  | { kind: "agente_editar"; id: number; nome: string; mudancas: AgenteMudancas }
  | { kind: "marco"; goalId: string; meta: string; titulo: string; data: string | null }
  | { kind: "marco_ok"; goalId: string; marcoId: string; meta: string; titulo: string }
  | { kind: "meta_tarefa"; goalId: string; meta: string; titulo: string; prazo: string | null }
  /** Liga (ou desliga) a meta a um projeto: ids resolvidos no servidor, só entre os itens da própria pessoa. */
  | { kind: "meta_projeto"; goalId: string; projectId: number; meta: string; projeto: string; desligar: boolean }
  /** Blocos de agenda escolhidos pelo SERVIDOR (pulando conflitos): o cartão mostra os dias e horários; só depois do "sim" cria os eventos no Google. */
  | { kind: "meta_agenda"; goalId: string; meta: string; blocos: { inicio: string; fim: string }[]; pulados: number; faltaram: number }
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
  | { kind: "conta_desmarcar"; itemId: string; nome: string; valor: number; ano: number; mes: number }
  | { kind: "conta_valor"; itemId: string; nome: string; antes: number; valor: number; escopo: "mes" | "proximos"; ano: number; mes: number }
  | { kind: "gasto_apagar"; id: string; valor: number; categoria: string; descricao: string; data: string }
  | { kind: "gasto_editar"; id: string; atual: { valor: number; categoria: string; descricao: string; data: string }; mudancas: GastoMudancas }
  | { kind: "evento_editar"; eventId: string; title: string; start: string; end: string; mudancas: { title?: string; start?: string; end?: string; location?: string } }
  | { kind: "evento_apagar"; eventId: string; title: string; start: string; end: string }
  | { kind: "memoria_aprovar"; ids: number[]; texto: string }
  | { kind: "memoria_recusar"; id: number; texto: string }
  | { kind: "memoria_esquecer"; id: number; texto: string }
  | { kind: "conta_nova"; contaTipo: "despesa" | "receita"; nome: string; grupo: string; valor: number | null; dia: number | null; escopo: "mes" | "proximos"; ano: number; mes: number }
  | { kind: "receita_principal"; itemId: string; nome: string }
  | { kind: "peca3d_abrir"; id: string; titulo: string; quando: string }
  | { kind: "teto"; categoria: string; valor: number | null; anterior: number | null }
  /** Resposta a uma percepção de hoje, achada no SERVIDOR (só as que ainda não foram respondidas). Aceitar faz a ação do tipo. */
  | { kind: "percepcao"; tipo: "conflito" | "livre" | "atrasadas" | "email" | "cheio"; decisao: "aceita" | "ignorada"; texto: string; rotulo: string | null; ref?: { inicio?: string; fim?: string; from?: string; subject?: string } }
  | { kind: "nova_conversa" }
  | { kind: "conversa_abrir"; id: number; titulo: string; quando: string }
  | { kind: "guia" }
  /** Abre uma tela na hora (o app trata, sem cartão nem confirmação): não grava nada. */
  | { kind: "navegar"; view: Destino }
  | { kind: "projeto"; nome: string; objetivo: string | null }
  | { kind: "ajuste"; ajuste: Ajuste };

/** Texto curto para o cartão e para a fala: uma linha, sem quebras. */
function resumo(t: string, max = 140): string {
  const s = t.replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}
function agenteMudancasLista(m: AgenteMudancas, max: number): string[] {
  const l: string[] = [];
  if (m.nome) l.push(`o nome para ${m.nome}`);
  if (m.area) l.push(`a área para ${m.area}`);
  if (m.instrucoes !== undefined) l.push(m.instrucoes ? `as instruções para: ${resumo(m.instrucoes, max)}` : "as instruções para vazio");
  if (m.ativo !== undefined) l.push(m.ativo ? "o agente para ativo" : "o agente para desativado");
  if (m.ferramentas) l.push(`as ferramentas para ${m.ferramentas.length ? m.ferramentas.map((f) => FERRAMENTA_NOME[f]).join(", ") : "nenhuma"}`);
  if (m.teto !== undefined) l.push(m.teto === null ? "o teto para sem teto próprio" : `o teto para US$ ${m.teto.toFixed(2).replace(".", ",")} por mês`);
  return l;
}
export function agenteMudancasTexto(m: AgenteMudancas): string {
  return agenteMudancasLista(m, 140).map((x) => x.replace(/^(o nome|a área|as instruções|o agente|as ferramentas|o teto) para /, (s) => ({ "o nome para ": "novo nome: ", "a área para ": "área: ", "as instruções para ": "instruções: ", "o agente para ": "", "as ferramentas para ": "ferramentas: ", "o teto para ": "teto: " } as Record<string, string>)[s] ?? s)).join(" · ");
}
/** Só os campos que mudam; `projetoId` vem do servidor (projeto da própria pessoa). */
/** Só os campos que mudam. `instrucoes` substitui o texto anterior (vazio = sem instruções). */
export type AgenteMudancas = { nome?: string; area?: string; instrucoes?: string; ativo?: boolean; ferramentas?: Ferramenta[]; teto?: number | null };
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

export type GastoMudancas = { valor?: number; categoria?: string; descricao?: string; meio?: Meio; data?: string };
const dmy = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
export function gastoMudancasTexto(m: GastoMudancas): string {
  const l: string[] = [];
  if (m.valor !== undefined) l.push(formatBRL(m.valor));
  if (m.categoria) l.push(m.categoria);
  if (m.descricao !== undefined) l.push(m.descricao ? `descrição: ${m.descricao}` : "sem descrição");
  if (m.meio) l.push(MEIO_LABEL[m.meio]);
  if (m.data) l.push(dmy(m.data));
  return l.join(" · ");
}
const gastoNome = (g: { valor: number; categoria: string; descricao: string }) => `${formatBRL(g.valor)} · ${g.descricao || g.categoria}`;

export type ActionView = {
  icon: string;
  /** Rótulos do cartão por estado. */
  proposed: string; done: string; undone: string;
  title: string; detail: string;
  /** Botão principal e o texto enquanto grava. Vazio quando a ação já foi aplicada (só Desfazer). */
  confirm: string; busy: string;
  applied: boolean;
  /** Cartão só de informação (resultado de um cálculo): sem Confirmar, sem Descartar e sem Desfazer; não entra na confirmação falada. */
  info?: boolean;
  open?: { label: string; view: "financeiro" | "metas" | "agenda" | "hoje" | "tarefas" | "projetos" | "ajustes" | "memoria" | "agentes" };
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

const PERCEPCAO_DETALHE: Record<"conflito" | "livre" | "atrasadas" | "email" | "cheio", string> = {
  atrasadas: "As tarefas abertas com prazo vencido passam para hoje (até 20)",
  email: "Cria uma tarefa para hoje com o assunto e o remetente",
  livre: "Reserva \"Foco\" na sua agenda do Google, até 2 horas",
  conflito: "Fica anotado; a Agenda abre para você resolver",
  cheio: "Só aviso",
};
const PERCEPCAO_PERGUNTA: Record<"conflito" | "livre" | "atrasadas" | "email" | "cheio", string> = {
  atrasadas: "Passo as tarefas atrasadas para hoje?",
  email: "Crio uma tarefa para responder esse e-mail hoje?",
  livre: "Reservo um bloco de foco na sua janela livre?",
  conflito: "Anoto o conflito e abro a Agenda?",
  cheio: "Ignoro o aviso de dia cheio?",
};

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
    case "salario": {
      const c = a.calc;
      const linhas = salarioDetalhe(c);
      if (!a.salvar) return { icon: "coin", proposed: "Salário líquido", done: "Salário líquido", undone: "Descartado", title: formatBRL(c.liquido), detail: linhas, confirm: "", busy: "", applied: true, info: true, open: { label: "Ver no Financeiro", view: "financeiro" } };
      const mm = `${String(a.salvar.mes).padStart(2, "0")}/${a.salvar.ano}`;
      return { icon: "coin", proposed: `Salvar como salário de ${mm}?`, done: "Salário salvo", undone: "Descartado", title: `${a.salvar.nome}: ${formatBRL(c.liquido)}`, detail: `${a.salvar.antes === null ? "Entra neste mês" : `Antes: ${formatBRL(a.salvar.antes)}`} · ${linhas}`, confirm: "Salvar", busy: "Salvando…", applied: false, open: { label: "Ver no Financeiro", view: "financeiro" } };
    }
    case "meta_status": {
      const t = { pausada: ["Pausar meta?", "Meta pausada", "Pausar", "Fica em Pausadas; o progresso é mantido"], ativa: ["Retomar meta?", "Meta retomada", "Retomar", "Volta para as ativas"], arquivada: ["Arquivar meta?", "Meta arquivada", "Arquivar", "Some das listas; nada é apagado (dá para restaurar em Metas)"] }[a.para];
      return { icon: "target", proposed: t[0], done: t[1], undone: "Descartado", title: a.titulo, detail: t[3], confirm: t[2], busy: "Salvando…", applied: false, open: { label: "Ver em Metas", view: "metas" } };
    }
    case "meta_editar":
      return { icon: "target", proposed: "Mudar meta?", done: "Meta mudada", undone: "Descartado", title: a.titulo, detail: metaMudancasTexto(a), confirm: "Mudar meta", busy: "Salvando…", applied: false, open: { label: "Ver em Metas", view: "metas" } };
    case "projeto_editar":
      return { icon: "folder", proposed: "Mudar projeto?", done: "Projeto mudado", undone: "Descartado", title: a.nome, detail: [a.mudancas.nome && `novo nome: ${a.mudancas.nome}`, a.mudancas.objetivo !== undefined && (a.mudancas.objetivo ? `objetivo: ${a.mudancas.objetivo}` : "sem objetivo")].filter(Boolean).join(" · "), confirm: "Mudar projeto", busy: "Salvando…", applied: false, open: { label: "Ver Projetos", view: "projetos" } };
    case "projeto_arquivar":
      return { icon: "folder", proposed: "Arquivar projeto?", done: "Projeto arquivado", undone: "Descartado", title: a.nome, detail: "Fica como concluído; some dos ativos (dá para reabrir em Projetos)", confirm: "Arquivar", busy: "Salvando…", applied: false, open: { label: "Ver Projetos", view: "projetos" } };
    case "agente_novo":
      return { icon: "agents", proposed: "Agente novo para confirmar", done: "Agente criado", undone: "Descartado", title: a.nome, detail: `Área: ${a.area} · ${a.instrucoes ? `instruções: ${resumo(a.instrucoes)}` : "sem instruções por enquanto"}`, confirm: "Criar agente", busy: "Criando…", applied: false, open: { label: "Ver Agentes", view: "agentes" } };
    case "agente_editar":
      return { icon: "agents", proposed: "Mudar agente?", done: "Agente mudado", undone: "Descartado", title: a.nome, detail: agenteMudancasTexto(a.mudancas), confirm: "Mudar agente", busy: "Salvando…", applied: false, open: { label: "Ver Agentes", view: "agentes" } };
    case "marco":
      return { icon: "target", proposed: "Marco para confirmar", done: "Marco adicionado", undone: "Descartado", title: a.titulo, detail: `Meta: ${a.meta}${a.data ? ` · até ${dm(a.data)}` : ""}`, confirm: "Adicionar", busy: "Salvando…", applied: false, open: { label: "Ver em Metas", view: "metas" } };
    case "marco_ok":
      return { icon: "target", proposed: "Marco para concluir", done: "Marco concluído", undone: "Descartado", title: a.titulo, detail: `Meta: ${a.meta}`, confirm: "Concluir marco", busy: "Salvando…", applied: false, open: { label: "Ver em Metas", view: "metas" } };
    case "meta_tarefa":
      return { icon: "check", proposed: "Tarefa da meta para confirmar", done: "Tarefa criada na meta", undone: "Descartado", title: a.titulo, detail: `Meta: ${a.meta}${a.prazo ? ` · até ${dm(a.prazo)}` : ""}`, confirm: "Criar tarefa", busy: "Criando…", applied: false, open: { label: "Ver em Metas", view: "metas" } };
    case "meta_projeto":
      return a.desligar
        ? { icon: "folder", proposed: "Desligar meta do projeto?", done: "Meta desligada do projeto", undone: "Descartado", title: a.meta, detail: `Projeto: ${a.projeto} (nada é apagado, só o vínculo)`, confirm: "Desligar", busy: "Salvando…", applied: false, open: { label: "Ver em Metas", view: "metas" } }
        : { icon: "folder", proposed: "Ligar meta ao projeto?", done: "Meta ligada ao projeto", undone: "Descartado", title: a.meta, detail: `Projeto: ${a.projeto}`, confirm: "Ligar", busy: "Salvando…", applied: false, open: { label: "Ver em Metas", view: "metas" } };
    case "meta_agenda": {
      const n = a.blocos.length;
      const extra = [a.pulados ? `${a.pulados} ${a.pulados === 1 ? "dia ocupado foi trocado" : "dias ocupados foram trocados"}` : "", a.faltaram ? `${a.faltaram} ${a.faltaram === 1 ? "bloco não coube" : "blocos não couberam"}` : ""].filter(Boolean).join(" · ");
      return { icon: "calendar", proposed: "Reservar horários na agenda?", done: `${n} ${n === 1 ? "bloco reservado" : "blocos reservados"} na agenda`, undone: "Descartado", title: `${a.meta} · ${n} ${n === 1 ? "bloco" : "blocos"}`, detail: `${a.blocos.map((b) => eventWhen(b.inicio, b.fim)).join("; ")}${extra ? ` — ${extra}` : ""}`, confirm: "Reservar", busy: "Reservando…", applied: false, open: { label: "Ver em Metas", view: "metas" } };
    }
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
    case "conta_desmarcar":
      return { icon: "coin", proposed: "Desmarcar conta paga?", done: "Conta em aberto", undone: "Descartado", title: a.nome, detail: `${formatBRL(a.valor)} · ${String(a.mes).padStart(2, "0")}/${a.ano} · volta para em aberto`, confirm: "Desmarcar", busy: "Salvando…", applied: false, open: { label: "Ver no Financeiro", view: "financeiro" } };
    case "conta_valor":
      return { icon: "coin", proposed: "Mudar o valor da conta?", done: "Valor mudado", undone: "Descartado", title: a.nome, detail: `${formatBRL(a.antes)} → ${formatBRL(a.valor)} · ${String(a.mes).padStart(2, "0")}/${a.ano}${a.escopo === "proximos" ? " até dezembro" : ""}`, confirm: "Mudar valor", busy: "Salvando…", applied: false, open: { label: "Ver no Financeiro", view: "financeiro" } };
    case "gasto_apagar":
      return { icon: "coin", proposed: "Apagar gasto?", done: "Gasto apagado", undone: "Descartado", title: gastoNome(a), detail: `${dmy(a.data)} · ${a.categoria} · não dá para desfazer`, confirm: "Apagar gasto", busy: "Apagando…", applied: false, open: { label: "Ver no Financeiro", view: "financeiro" } };
    case "gasto_editar":
      return { icon: "coin", proposed: "Mudar gasto?", done: "Gasto mudado", undone: "Descartado", title: gastoNome(a.atual), detail: `Agora: ${gastoMudancasTexto(a.mudancas)}`, confirm: "Mudar gasto", busy: "Salvando…", applied: false, open: { label: "Ver no Financeiro", view: "financeiro" } };
    case "evento_editar": {
      const m = a.mudancas;
      const quando = m.start || m.end ? ` · ${eventWhen(m.start ?? a.start, m.end ?? a.end)}` : "";
      return { icon: "calendar", proposed: "Mudar evento?", done: "Evento mudado", undone: "Descartado", title: a.title, detail: `${m.title ? `Novo título: ${m.title}` : "Mesmo título"}${quando}${m.location ? ` · ${m.location}` : ""}`, confirm: "Mudar evento", busy: "Salvando…", applied: false, open: { label: "Ver Agenda", view: "agenda" } };
    }
    case "evento_apagar":
      return { icon: "calendar", proposed: "Apagar evento?", done: "Evento apagado", undone: "Descartado", title: a.title, detail: `${eventWhen(a.start, a.end)} · não dá para desfazer`, confirm: "Apagar evento", busy: "Apagando…", applied: false, open: { label: "Ver Agenda", view: "agenda" } };
    case "memoria_aprovar":
      return { icon: "book", proposed: a.ids.length > 1 ? "Aprovar memórias?" : "Aprovar memória?", done: a.ids.length > 1 ? "Memórias aprovadas" : "Memória aprovada", undone: "Descartado", title: a.texto, detail: "Passa a valer nas próximas conversas", confirm: "Aprovar", busy: "Salvando…", applied: false, open: { label: "Ver Memória", view: "memoria" } };
    case "memoria_recusar":
      return { icon: "book", proposed: "Descartar memória?", done: "Memória descartada", undone: "Descartado", title: a.texto, detail: "Não dá para desfazer", confirm: "Descartar memória", busy: "Apagando…", applied: false, open: { label: "Ver Memória", view: "memoria" } };
    case "memoria_esquecer":
      return { icon: "book", proposed: "Esquecer isto?", done: "Esquecido", undone: "Descartado", title: a.texto, detail: "O GaDu deixa de saber disso. Não dá para desfazer", confirm: "Esquecer", busy: "Apagando…", applied: false, open: { label: "Ver Memória", view: "memoria" } };
    case "registro_apagar":
      return { icon: "target", proposed: "Apagar registro?", done: "Registro apagado", undone: "Descartado", title: a.meta, detail: `${fmtNum(a.valor)}${a.unidade ? (a.unidade === "%" ? "%" : ` ${a.unidade}`) : ""} em ${a.data.slice(8, 10)}/${a.data.slice(5, 7)} · o progresso é recalculado · não dá para desfazer`, confirm: "Apagar registro", busy: "Apagando…", applied: false, open: { label: "Ver Metas", view: "metas" } };
    case "conta_nova": {
      const r = a.contaTipo === "receita";
      const det = [a.grupo, a.valor !== null ? `${formatBRL(a.valor)} ${a.escopo === "proximos" ? "por mês até dezembro" : `em ${String(a.mes).padStart(2, "0")}/${a.ano}`}` : "sem valor por enquanto", a.dia ? `dia ${a.dia}` : null].filter(Boolean).join(" · ");
      return { icon: "coin", proposed: r ? "Receita nova para confirmar" : "Conta nova para confirmar", done: r ? "Receita criada" : "Conta criada", undone: "Descartado", title: a.nome, detail: det, confirm: r ? "Criar receita" : "Criar conta", busy: "Criando…", applied: false, open: { label: "Ver no Financeiro", view: "financeiro" } };
    }
    case "receita_principal":
      return { icon: "coin", proposed: "Receita principal?", done: "Receita principal definida", undone: "Descartado", title: a.nome, detail: "O simulador de salário salva o líquido nela", confirm: "Definir", busy: "Salvando…", applied: false, open: { label: "Ver no Financeiro", view: "financeiro" } };
    case "peca3d_abrir":
      return { icon: "chevron", proposed: "Abrir esta peça no 3D?", done: "Abrindo a peça", undone: "Descartado", title: a.titulo, detail: `Salva em ${a.quando} · abre no 3D Studio`, confirm: "Abrir peça", busy: "Abrindo…", applied: false };
    case "teto":
      return a.valor === null
        ? { icon: "coin", proposed: "Tirar o teto?", done: "Teto removido", undone: "Descartado", title: a.categoria, detail: a.anterior !== null ? `Hoje o teto é ${formatBRL(a.anterior)} por mês` : "Sem teto definido", confirm: "Tirar teto", busy: "Salvando…", applied: false, open: { label: "Ver no Financeiro", view: "financeiro" } }
        : { icon: "coin", proposed: a.anterior !== null ? "Mudar o teto?" : "Teto novo para confirmar", done: "Teto salvo", undone: "Descartado", title: a.categoria, detail: `${formatBRL(a.valor)} por mês${a.anterior !== null ? ` (antes ${formatBRL(a.anterior)})` : ""} · aviso em 80% e 100%`, confirm: "Salvar teto", busy: "Salvando…", applied: false, open: { label: "Ver no Financeiro", view: "financeiro" } };
    case "percepcao":
      return a.decisao === "ignorada"
        ? { icon: "bell", proposed: "Ignorar este aviso hoje?", done: "Aviso ignorado hoje", undone: "Descartado", title: a.texto, detail: "Ele não volta hoje; amanhã o GaDu olha de novo", confirm: "Ignorar", busy: "Salvando…", applied: false }
        : { icon: a.tipo === "conflito" || a.tipo === "livre" ? "calendar" : "check", proposed: `${a.rotulo ?? "Aceitar"}?`, done: a.tipo === "conflito" ? "Anotado" : "Feito", undone: "Descartado", title: a.texto, detail: PERCEPCAO_DETALHE[a.tipo], confirm: a.rotulo ?? "Aceitar", busy: "Salvando…", applied: false, ...(a.tipo === "conflito" ? { open: { label: "Agenda", view: "agenda" as const } } : {}) };
    case "nova_conversa":
      return { icon: "plus", proposed: "Começar uma conversa nova?", done: "Conversa nova", undone: "Descartado", title: "Nova conversa", detail: "A conversa atual fica guardada no histórico", confirm: "Começar", busy: "Abrindo…", applied: false };
    case "conversa_abrir":
      return { icon: "chevron", proposed: "Abrir esta conversa?", done: "Conversa aberta", undone: "Descartado", title: a.titulo, detail: `Última mensagem em ${a.quando} · a conversa atual fica guardada`, confirm: "Abrir conversa", busy: "Abrindo…", applied: false };
    case "guia":
      return { icon: "spark", proposed: "Abrir o guia?", done: "Abrindo o guia", undone: "Descartado", title: "Guia de primeiro uso", detail: "Três passos: nome, microfone e voz, Google", confirm: "Abrir", busy: "Abrindo…", applied: false };
    case "navegar":
      return { icon: "chevron", proposed: `Abrir ${DESTINO_NOME[a.view]}`, done: `Abrindo ${DESTINO_NOME[a.view]}`, undone: "Descartado", title: DESTINO_NOME[a.view], detail: "Abre a tela", confirm: "Abrir", busy: "Abrindo…", applied: false };
    case "projeto":
      return { icon: "folder", proposed: "Projeto novo para confirmar", done: "Projeto criado", undone: "Descartado", title: a.nome, detail: a.objetivo || "Sem objetivo por enquanto", confirm: "Criar projeto", busy: "Criando…", applied: false, open: { label: "Ver Projetos", view: "projetos" } };
    case "ajuste":
      return { icon: "gear", proposed: "Mudar configuração?", done: "Configuração mudada", undone: "Descartado", title: ajusteLabel(a.ajuste), detail: "Vale neste aparelho", confirm: "Mudar", busy: "Salvando…", applied: false, open: { label: "Ver Configurações", view: "ajustes" } };
  }
}

/** Passo a passo curto do cálculo, com os números de calcularSalario. */
export function salarioDetalhe(c: Salario): string {
  const ir = c.irrf > 0 ? formatBRL(c.irrf) : c.irrfDispensado ? "R$ 0,00 (até R$ 10 não retém)" : "R$ 0,00 (isento)";
  const dep = c.dependentes ? ` · ${c.dependentes} ${c.dependentes === 1 ? "dependente" : "dependentes"}` : "";
  const red = c.reducao > 0 ? ` · redução da lei ${formatBRL(c.reducao)}` : "";
  return `Bruto ${formatBRL(c.bruto)}${dep} · INSS ${formatBRL(c.inss)} · IR ${ir}${red} · IR sobre ${formatBRL(c.baseIr)} (${c.modelo === "simplificado" ? "desconto simplificado" : "INSS e dependentes"}) · tabelas de ${SALARIO_ANO}, estimativa de salário mensal CLT`;
}

function metaMudancasTexto(a: Extract<ChatAction, { kind: "meta_editar" }>): string {
  const m = a.mudancas, l: string[] = [];
  if (m.titulo) l.push(`novo título: ${m.titulo}`);
  if (m.alvo !== undefined) l.push(`alvo ${fmtNum(m.alvo)}${a.unidade ? ` ${a.unidade}` : ""}`);
  if (m.prazo) l.push(`prazo ${dm(m.prazo)}`);
  return l.join(" · ");
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
    case "velocidade": return j.valor === "mais_devagar" ? "Falar mais devagar" : j.valor === "mais_rapido" ? "Falar mais rápido" : `Velocidade da fala: ${j.valor.toFixed(2).replace(".", ",")}×`;
    case "voz_trocar": return "Trocar para a próxima voz do aparelho";
  }
}

/** Navegação por voz é instantânea (não grava nada): separa o pedido de abrir tela dos cartões. Vale o último pedido. */
export function splitNavegacao(items: ChatAction[]): { cards: ChatAction[]; destino: Destino | null; /** "me mostra o guia": abre o guia de primeiro uso na hora (não grava nada). */ guia: boolean } {
  let destino: Destino | null = null;
  let guia = false;
  const cards: ChatAction[] = [];
  for (const a of items) { if (a.kind === "navegar") destino = a.view; else if (a.kind === "guia") guia = true; else cards.push(a); }
  return { cards, destino, guia };
}

/** Pergunta falada da confirmação (sem o "Diga sim ou não"). */
export function actionQuestion(a: ChatAction, now = new Date()): string {
  switch (a.kind) {
    case "gasto": case "meta": case "evento": case "lembrete": return confirmQuestion(toConfirmItem(a), now);
    case "meta_nova": {
      const alvo = a.medicao === "numerica" && a.alvo !== null ? `, de ${fmtNum(a.inicial)} até ${fmtNum(a.alvo)}${a.unidade ? ` ${a.unidade}` : ""}` : a.medicao === "marcos" ? `, com ${a.marcos.length} ${a.marcos.length === 1 ? "marco" : "marcos"}` : "";
      return `Crio a meta ${a.titulo}${alvo}${a.prazo ? `, até ${spokenDay(a.prazo, now)}` : ""}?`;
    }
    case "meta_status": return a.para === "pausada" ? `Pauso a meta ${a.titulo}?` : a.para === "ativa" ? `Retomo a meta ${a.titulo}?` : `Arquivo a meta ${a.titulo}? Nada é apagado.`;
    case "meta_editar": {
      const m = a.mudancas, l: string[] = [];
      if (m.titulo) l.push(`o título para ${m.titulo}`);
      if (m.alvo !== undefined) l.push(`o alvo para ${fmtNum(m.alvo)}${a.unidade ? ` ${a.unidade}` : ""}`);
      if (m.prazo) l.push(`o prazo para ${spokenDay(m.prazo, now)}`);
      return `Na meta ${a.titulo}, mudo ${l.join(", ")}?`;
    }
    case "projeto_editar": return `No projeto ${a.nome}, mudo ${[a.mudancas.nome && `o nome para ${a.mudancas.nome}`, a.mudancas.objetivo !== undefined && (a.mudancas.objetivo ? `o objetivo para ${a.mudancas.objetivo}` : "o objetivo para vazio")].filter(Boolean).join(", ")}?`;
    case "projeto_arquivar": return `Arquivo o projeto ${a.nome}? Ele fica como concluído.`;
    case "agente_novo": return `Crio o agente ${a.nome}, da área ${a.area}${a.instrucoes ? `, com estas instruções: ${resumo(a.instrucoes, 160)}` : ""}?`;
    case "agente_editar": return `No agente ${a.nome}, mudo ${agenteMudancasLista(a.mudancas, 160).join(", ")}?`;
    case "marco": return `Adiciono o marco ${a.titulo} na meta ${a.meta}?`;
    case "marco_ok": return `Marco o marco ${a.titulo}, da meta ${a.meta}, como concluído?`;
    case "meta_tarefa": return `Crio a tarefa ${a.titulo} na meta ${a.meta}?`;
    case "meta_projeto": return a.desligar ? `Desligo a meta ${a.meta} do projeto ${a.projeto}?` : `Ligo a meta ${a.meta} ao projeto ${a.projeto}?`;
    case "meta_agenda": {
      const n = a.blocos.length;
      const dias = a.blocos.slice(0, 4).map((b) => `${spokenDay(new Date(Date.parse(b.inicio) - 3 * 3_600_000).toISOString().slice(0, 10), now)} ${spokenTime(b.inicio)}`).join("; ");
      return `Reservo ${n} ${n === 1 ? "bloco" : "blocos"} na agenda para a meta ${a.meta}: ${dias}${n > 4 ? ` e mais ${n - 4}` : ""}${a.faltaram ? `. ${a.faltaram} não ${a.faltaram === 1 ? "coube" : "couberam"}` : ""}. Posso reservar?`;
    }
    case "tarefa_ok": return `Marco a tarefa ${a.titulo} como feita?`;
    case "tarefa_criada": return `Anotei a tarefa ${a.titulo}${a.prazo ? `, para ${spokenDay(a.prazo, now)}` : ""}. Está certo?`;
    case "tarefa_adiar": return `Adio a tarefa ${a.titulo} para ${spokenDay(a.prazo, now)}?`;
    case "tarefa_cancelar": return `Cancelo a tarefa ${a.titulo}?`;
    case "tarefa_reabrir": return `Reabro a tarefa ${a.titulo}?`;
    case "tarefa_editar": return `Na tarefa ${a.titulo}, mudo ${mudancasFalada(a.mudancas, now)}?`;
    case "lembrete_adiar": return `Adio o lembrete ${a.text} para ${whenLabel(a.novoDueAt, now)}?`;
    case "lembrete_off": return `Cancelo o lembrete ${a.text}?`;
    case "conta_paga": return `Marco a conta ${a.nome}, de ${spokenMoney(a.valor)}, como paga?`;
    case "conta_desmarcar": return `Volto a conta ${a.nome} para em aberto?`;
    case "conta_valor": return `Mudo a conta ${a.nome} para ${spokenMoney(a.valor)}${a.escopo === "proximos" ? ", deste mês até dezembro" : " neste mês"}?`;
    case "gasto_apagar": return `Apago o gasto de ${spokenMoney(a.valor)}, ${a.descricao || a.categoria}? Não dá para desfazer.`;
    case "gasto_editar": return `No gasto de ${spokenMoney(a.atual.valor)}, ${a.atual.descricao || a.atual.categoria}, mudo ${gastoFalado(a.mudancas, now)}?`;
    case "evento_editar": return `No evento ${a.title}, mudo ${eventoFalado(a, now)}?`;
    case "evento_apagar": return `Apago o evento ${a.title}, de ${whenLabel(a.start, now)}? Não dá para desfazer.`;
    case "memoria_aprovar": return a.ids.length > 1 ? `Aprovo as ${a.ids.length} memórias pendentes?` : `Aprovo a memória: ${a.texto}?`;
    case "memoria_recusar": return `Descarto a memória: ${a.texto}? Não dá para desfazer.`;
    case "memoria_esquecer": return `Esqueço isto: ${a.texto}? Não dá para desfazer.`;
    case "nova_conversa": return "Começo uma conversa nova?";
    case "percepcao": return a.decisao === "ignorada" ? `Ignoro hoje o aviso: ${a.texto}` : `${PERCEPCAO_PERGUNTA[a.tipo]}`;
    case "teto": return a.valor === null ? `Tiro o teto de ${a.categoria}?` : `Ponho um teto de ${spokenMoney(a.valor)} por mês para ${a.categoria}?`;
    case "peca3d_abrir": return `Abro a peça ${a.titulo} no 3D?`;
    case "conta_nova": return `Crio a ${a.contaTipo === "receita" ? "receita" : "conta"} ${a.nome}${a.valor !== null ? `, de ${spokenMoney(a.valor)}${a.escopo === "proximos" ? " por mês" : ""}` : ""}${a.dia ? `, no dia ${a.dia}` : ""}?`;
    case "receita_principal": return `Defino ${a.nome} como sua receita principal?`;
    case "registro_apagar": return `Apago o registro de ${fmtNum(a.valor)}${a.unidade && a.unidade !== "%" ? ` ${a.unidade}` : a.unidade === "%" ? " por cento" : ""} de ${spokenDay(a.data, now)} na meta ${a.meta}?`;
    case "conversa_abrir": return `Abro a conversa ${a.titulo}, de ${a.quando}?`;
    case "guia": return "Abro o guia?";
    case "navegar": return `Abro ${DESTINO_NOME[a.view]}?`;
    case "salario": return a.salvar ? `${resumoSalario(a.calc)} Salvo o líquido de ${spokenMoney(a.calc.liquido)} como o salário de ${MESES[a.salvar.mes - 1]} de ${a.salvar.ano}?` : resumoSalario(a.calc);
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

function gastoFalado(m: GastoMudancas, now: Date): string {
  const l: string[] = [];
  if (m.valor !== undefined) l.push(`o valor para ${spokenMoney(m.valor)}`);
  if (m.categoria) l.push(`a categoria para ${m.categoria}`);
  if (m.descricao !== undefined) l.push(m.descricao ? `a descrição para ${m.descricao}` : "a descrição para vazia");
  if (m.meio) l.push(`a forma de pagamento para ${MEIO_LABEL[m.meio]}`);
  if (m.data) l.push(`o dia para ${spokenDay(m.data, now)}`);
  return l.join(", ");
}
function eventoFalado(a: Extract<ChatAction, { kind: "evento_editar" }>, now: Date): string {
  const m = a.mudancas, l: string[] = [];
  if (m.title) l.push(`o título para ${m.title}`);
  if (m.start || m.end) l.push(`o horário para ${whenLabel(m.start ?? a.start, now)}`);
  if (m.location) l.push(`o local para ${m.location}`);
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
