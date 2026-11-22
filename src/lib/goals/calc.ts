// Cálculos de Metas: funções puras (sem banco, sem relógio global). Progresso só vem de registros com origem, marcos e tarefas reais.
import { lerData, ordinal } from "../finance/datas.ts";
import { fmtNum } from "./numero.ts";
import type { Goal, Marco, MetaView, Progresso, Registro, Ritmo, TarefaVinculada } from "./types.ts";
import { SITUACAO_LABEL } from "./types.ts";

const r2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Diferença em dias entre duas datas AAAA-MM-DD (b - a). null se alguma for inválida. */
export function diasEntre(a: string, b: string): number | null {
  const da = lerData(a), db = lerData(b);
  return da && db ? ordinal(db) - ordinal(da) : null;
}

/** Registros em ordem cronológica (data, depois ordem de criação). */
const cronologico = (rs: Registro[]) => [...rs].sort((x, y) => (x.data < y.data ? -1 : x.data > y.data ? 1 : (x.created_at ?? "") < (y.created_at ?? "") ? -1 : (x.created_at ?? "") > (y.created_at ?? "") ? 1 : 0));

/** Progresso de uma meta. `registros`, `marcos` e `tarefas` já são só os dessa meta. */
export function calcularProgresso(goal: Goal, registros: Registro[], marcos: Marco[], tarefas: TarefaVinculada[]): Progresso {
  if (goal.medicao === "marcos") {
    const total = marcos.length, feitos = marcos.filter((m) => m.concluido_em).length;
    return itens(feitos, total);
  }
  if (goal.medicao === "tarefas") {
    const vivas = tarefas.filter((t) => t.status !== "cancelled");
    return itens(vivas.filter((t) => t.status === "done").length, vivas.length);
  }
  const regs = cronologico(registros);
  const ultimoRegistro = regs.length ? regs[regs.length - 1].data : null;
  if (goal.medicao === "percentual") {
    const atual = regs.length ? clamp(regs[regs.length - 1].valor, 0, 100) : 0;
    return { semDados: !regs.length, atual, alvo: 100, pct: Math.round(atual), fracao: atual / 100, restante: r2(100 - atual), ultimoRegistro };
  }
  const ini = goal.valor_inicial, alvo = goal.valor_alvo ?? ini;
  const atual = !regs.length ? ini : goal.agregacao === "ultimo" ? regs[regs.length - 1].valor : r2(ini + regs.reduce((s, r) => s + r.valor, 0));
  const span = alvo - ini;
  const fracao = span === 0 ? 0 : clamp((atual - ini) / span, 0, 1);
  const falta = span > 0 ? alvo - atual : atual - alvo; // meta que diminui (82 kg → 75 kg): falta = atual - alvo
  return { semDados: !regs.length, atual: r2(atual), alvo, pct: Math.round(fracao * 100), fracao, restante: r2(Math.max(0, falta)), ultimoRegistro };
}

function itens(feitos: number, total: number): Progresso {
  const fracao = total ? feitos / total : 0;
  return { semDados: total === 0, atual: feitos, alvo: total, pct: Math.round(fracao * 100), fracao, restante: total - feitos, ultimoRegistro: null };
}

/** Margem (pontos percentuais) abaixo do esperado que ainda conta como "no ritmo". */
export const TOLERANCIA_PCT = 5;

/** Ritmo até o prazo. `hoje` = AAAA-MM-DD (Brasília). Sem prazo não há ritmo para cobrar. */
export function calcularRitmo(goal: Goal, p: Progresso, hoje: string): Ritmo {
  const sem = (situacao: Ritmo["situacao"], extra: Partial<Ritmo> = {}): Ritmo => ({ situacao, diasRestantes: null, esperadoPct: null, porDia: null, porSemana: null, ...extra });
  const dias = goal.prazo ? diasEntre(hoje, goal.prazo) : null;
  const base = { diasRestantes: dias };
  if (goal.status === "concluida") return sem("concluida", base);
  if (goal.status === "arquivada") return sem("arquivada", base);
  if (goal.status === "pausada") return sem("pausada", base);
  if (!p.semDados && p.fracao >= 1) return sem("batida", base);
  if (goal.prazo === null || dias === null) return sem(p.semDados ? "sem_dados" : "sem_prazo", base);
  if (dias < 0) return sem("vencida", base);
  const total = diasEntre(goal.inicio, goal.prazo) ?? 0;
  const passou = diasEntre(goal.inicio, hoje) ?? 0;
  const esperado = total > 0 ? clamp(passou / total, 0, 1) * 100 : 100;
  const porDia = r2(p.restante / Math.max(dias, 1));
  const ritmo = { ...base, esperadoPct: Math.round(esperado), porDia, porSemana: r2(porDia * 7) };
  if (p.semDados) return { situacao: "sem_dados", ...ritmo };
  return { situacao: p.fracao * 100 >= esperado - TOLERANCIA_PCT ? "no_ritmo" : "atrasada", ...ritmo };
}

export function montarMeta(goal: Goal, registros: Registro[], marcos: Marco[], tarefas: TarefaVinculada[], hoje: string): MetaView {
  const progresso = calcularProgresso(goal, registros, marcos, tarefas);
  return { goal, progresso, ritmo: calcularRitmo(goal, progresso, hoje) };
}

// ---- Texto (interface, Hoje e Core usam as mesmas frases) ----
const un = (g: Goal, n: number) => (g.unidade ? `${fmtNum(n)} ${g.unidade}` : fmtNum(n));
const br = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
export const dataBR = br;

/** "7 de 12 livros", "40%", "2 de 5 marcos", "Sem registros". */
export function progressoTexto(m: MetaView): string {
  const { goal: g, progresso: p } = m;
  if (g.medicao === "marcos") return p.semDados ? "Sem marcos" : `${p.atual} de ${p.alvo} marco${p.alvo === 1 ? "" : "s"}`;
  if (g.medicao === "tarefas") return p.semDados ? "Sem tarefas vinculadas" : `${p.atual} de ${p.alvo} tarefa${p.alvo === 1 ? "" : "s"}`;
  if (p.semDados) return "Sem registros";
  if (g.medicao === "percentual") return `${fmtNum(p.atual)}%`;
  return `${un(g, p.atual)} de ${un(g, p.alvo)}`;
}

/** Frase do ritmo: situação + o que precisa. Projeções ficam claras ("precisa de"), nunca como medição. */
export function ritmoTexto(m: MetaView): string {
  const { goal: g, ritmo: r, progresso: p } = m;
  const label = SITUACAO_LABEL[r.situacao];
  if (r.situacao === "vencida") return `${label} em ${br(g.prazo!)}`;
  if (r.situacao === "sem_dados") return r.diasRestantes !== null ? `${label}, prazo em ${r.diasRestantes} dia${r.diasRestantes === 1 ? "" : "s"}` : label;
  if ((r.situacao === "no_ritmo" || r.situacao === "atrasada") && r.porSemana !== null) {
    const falta = g.medicao === "numerica" ? un(g, p.restante) : g.medicao === "percentual" ? `${fmtNum(p.restante)} pontos` : `${p.restante} ${g.medicao === "marcos" ? "marco" : "tarefa"}${p.restante === 1 ? "" : "s"}`;
    const semana = r.diasRestantes! >= 7 ? `, cerca de ${g.medicao === "numerica" ? un(g, r.porSemana) : fmtNum(r.porSemana)} por semana` : "";
    return `${label}: faltam ${falta} em ${r.diasRestantes} dia${r.diasRestantes === 1 ? "" : "s"}${semana}`;
  }
  return label;
}

/** Metas que pedem atenção: ativas e vencidas, atrasadas ou com prazo em até `dias` dias (e ainda não atingidas). Mais urgentes primeiro. */
export function metasAtencao(views: MetaView[], dias = 7, max = 3): MetaView[] {
  const peso = (m: MetaView) => (m.ritmo.situacao === "vencida" ? 0 : m.ritmo.situacao === "atrasada" ? 1 : 2);
  return views
    .filter((m) => m.goal.status === "ativa" && (m.ritmo.situacao === "vencida" || m.ritmo.situacao === "atrasada"
      || (["no_ritmo", "sem_dados"].includes(m.ritmo.situacao) && m.ritmo.diasRestantes !== null && m.ritmo.diasRestantes <= dias)))
    .sort((a, b) => peso(a) - peso(b) || (a.ritmo.diasRestantes ?? 9999) - (b.ritmo.diasRestantes ?? 9999) || a.goal.titulo.localeCompare(b.goal.titulo, "pt-BR"))
    .slice(0, max);
}
