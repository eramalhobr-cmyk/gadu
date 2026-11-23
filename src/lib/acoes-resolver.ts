// Servidor: transforma as ações propostas pelo modelo (src/lib/acoes.ts) em cartões, resolvendo os nomes para ids
// SÓ entre os itens da própria pessoa (cliente da SESSÃO + filtro por user_id, além da RLS). Nada é gravado aqui.
import type { AcaoProposta } from "./acoes.ts";
import { matchByName, norm } from "./acoes.ts";
import type { ChatAction, GastoMudancas, TarefaMudancas } from "./chat-actions.ts";
import type { CalEvent } from "./google-format.ts";
import type { SessionDb } from "./core/types.ts";
import { hojeSP, isoDia } from "./finance/datas.ts";
import { GASTO_COLS, loadMes, toGasto } from "./finance/load.ts";
import type { Gasto } from "./finance/types.ts";
import type { Agregacao, Medicao } from "./goals/types.ts";

type GoalRow = { id: string; titulo: string; medicao: Medicao; unidade: string | null; agregacao: Agregacao; status: string; valor_alvo?: number | string | null; prazo?: string | null };
/** Agenda do Google (só no servidor, com o token da própria pessoa); ausente nos testes que não usam agenda. */
export type CalendarLookup = (from: Date, to: Date) => Promise<CalEvent[]>;
type Opts = { goals: boolean; finance: boolean; calendar?: CalendarLookup; now?: number; blocked?: (text: string) => boolean };

/** Ações resolvidas e avisos do que não deu para achar (o app mostra, sem inventar). */
export async function resolveAcoes(db: SessionDb, userId: string, acoes: AcaoProposta[], opts: Opts): Promise<{ actions: ChatAction[]; misses: string[] }> {
  const actions: ChatAction[] = [];
  const misses: string[] = [];
  const now = opts.now ?? Date.now();
  const blocked = opts.blocked ?? (() => false);
  const cache: { goals?: GoalRow[]; tasks?: { id: number; title: string }[]; reminders?: { id: number; text: string; due_at: string }[]; closed?: { id: number; title: string }[]; projects?: { id: number; name: string; goal?: string | null }[]; snoozable?: { id: number; text: string; due_at: string }[]; gastos?: Gasto[]; eventos?: CalEvent[] } = {};

  const goals = async () => {
    if (!cache.goals) {
      const r = await db.from("goals").select("id, titulo, medicao, unidade, agregacao, status, valor_alvo, prazo").eq("user_id", userId).in("status", ["ativa", "pausada"]).limit(200);
      cache.goals = r.error ? [] : (r.data as GoalRow[]);
    }
    return cache.goals;
  };
  const tasks = async () => {
    if (!cache.tasks) {
      const r = await db.from("tasks").select("id, title").eq("user_id", userId).eq("status", "open").limit(500);
      cache.tasks = r.error ? [] : (r.data as { id: number; title: string }[]);
    }
    return cache.tasks;
  };
  const reminders = async () => {
    if (!cache.reminders) {
      const r = await db.from("reminders").select("id, text, due_at").eq("user_id", userId).eq("status", "pending").limit(200);
      cache.reminders = r.error ? [] : (r.data as { id: number; text: string; due_at: string }[]);
    }
    return cache.reminders;
  };
  // Tarefas já feitas ou canceladas (para reabrir) e lembretes pendentes ou já avisados (para adiar).
  const closedTasks = async () => {
    if (!cache.closed) {
      const r = await db.from("tasks").select("id, title").eq("user_id", userId).in("status", ["done", "cancelled"]).order("updated_at", { ascending: false }).limit(200);
      cache.closed = r.error ? [] : (r.data as { id: number; title: string }[]);
    }
    return cache.closed;
  };
  const projects = async () => {
    if (!cache.projects) {
      const r = await db.from("projects").select("id, name, goal").eq("user_id", userId).in("status", ["active", "paused"]).limit(100);
      cache.projects = r.error ? [] : (r.data as { id: number; name: string; goal?: string | null }[]);
    }
    return cache.projects;
  };
  const snoozable = async () => {
    if (!cache.snoozable) {
      const r = await db.from("reminders").select("id, text, due_at").eq("user_id", userId).in("status", ["pending", "sent"]).order("due_at", { ascending: false }).limit(200);
      cache.snoozable = r.error ? [] : (r.data as { id: number; text: string; due_at: string }[]);
    }
    return cache.snoozable;
  };
  // Gastos já lançados (os 300 mais recentes) e eventos da agenda de ontem a 45 dias à frente.
  const gastos = async () => {
    if (!cache.gastos) {
      const r = await db.from("fin_gastos").select(GASTO_COLS).eq("user_id", userId).order("ano", { ascending: false }).order("mes", { ascending: false }).order("dia", { ascending: false }).limit(300);
      cache.gastos = r.error ? [] : (r.data as Record<string, unknown>[]).map(toGasto);
    }
    return cache.gastos;
  };
  const eventos = async () => {
    if (!cache.eventos) {
      if (!opts.calendar) throw new Error("sem agenda");
      cache.eventos = (await opts.calendar(new Date(now - 86_400_000), new Date(now + 45 * 86_400_000))).filter((e) => e.id && !e.declined);
    }
    return cache.eventos;
  };
  const noEventos = () => misses.push("Não consegui abrir sua agenda do Google agora. Confira a conexão em Configurações.");
  /** Acha UM gasto: o valor e a data (se ditos) filtram; o nome casa com a descrição ou a categoria. Ambíguo: pede mais detalhe. */
  const findGasto = async (nome: string, valor: number | null, data: string | null): Promise<Gasto | null> => {
    const iso = (g: Gasto) => isoDia({ ano: g.ano, mes: g.mes, dia: g.dia });
    const cand = (await gastos()).filter((g) => (valor === null || Math.abs(g.valor - valor) < 0.005) && (!data || iso(g) === data));
    const label = (x: Gasto) => `${x.descricao} ${x.categoria}`;
    // Apagar ou mudar gasto é sério: se o nome cabe em mais de um gasto, não escolhe (pede valor ou dia).
    const q = norm(nome);
    const varios = q ? cand.filter((x) => norm(label(x)).includes(q)).length > 1 : false;
    const g = varios ? null : nome ? matchByName(cand, label, nome) : cand.length === 1 ? cand[0] : null;
    if (!g) misses.push(cand.length > 1 || (nome && !cand.length) ? (cand.length > 1 ? "Achei mais de um gasto assim. Diga o valor e o dia." : `Não achei o gasto "${nome}".`) : "Não achei esse gasto. Diga o nome, o valor ou o dia.");
    return g;
  };
  const contasDoMes = async () => {
    const hoje = hojeSP(now);
    const d = await loadMes(db, userId, hoje.ano, hoje.mes);
    const doMes = new Map(d.meses.filter((m) => m.ano === hoje.ano && m.mes === hoje.mes).map((m) => [m.item_id, m]));
    return { hoje, doMes, contas: d.itens.filter((i) => i.tipo === "despesa" && doMes.has(i.id)) };
  };
  const findGoal = async (nome: string) => {
    const g = matchByName(await goals(), (x) => x.titulo, nome);
    if (!g) misses.push(`Não achei a meta "${nome}". Diga o nome como está em Metas.`);
    return g;
  };

  for (const a of acoes) {
    try {
      switch (a.tipo) {
        case "meta_criar":
          if (!opts.goals) break;
          if (blocked(a.titulo)) break;
          actions.push({ kind: "meta_nova", titulo: a.titulo, medicao: a.medicao, unidade: a.unidade, alvo: a.alvo, inicial: a.inicial, prazo: a.prazo, categoria: a.categoria, marcos: a.marcos });
          break;
        case "meta_registrar": case "meta_concluir": {
          if (!opts.goals) break;
          const g = await findGoal(a.meta);
          if (!g) break;
          if (a.tipo === "meta_registrar") {
            if (g.medicao !== "numerica" && g.medicao !== "percentual") { misses.push(`A meta "${g.titulo}" é medida por ${g.medicao === "marcos" ? "marcos" : "tarefas"}: conclua um marco ou uma tarefa dela.`); break; }
            if (g.medicao === "percentual" && a.valor > 100) break;
            actions.push({ kind: "meta", d: { goalId: g.id, titulo: g.titulo, unidade: g.medicao === "percentual" ? "%" : g.unidade, acao: "registrar", valor: a.valor, data: a.data ?? isoDia(hojeSP(now)), agregacao: g.agregacao } });
          } else {
            actions.push({ kind: "meta", d: { goalId: g.id, titulo: g.titulo, unidade: g.unidade, acao: "concluir", valor: null, data: null, agregacao: g.agregacao } });
          }
          break;
        }
        case "meta_pausar": case "meta_retomar": case "meta_arquivar": {
          if (!opts.goals) break;
          const g = await findGoal(a.meta);
          if (!g) break;
          const para = a.tipo === "meta_pausar" ? "pausada" : a.tipo === "meta_retomar" ? "ativa" : "arquivada";
          if (para === "pausada" && g.status === "pausada") { misses.push(`A meta "${g.titulo}" já está pausada.`); break; }
          if (para === "ativa" && g.status !== "pausada") { misses.push(`A meta "${g.titulo}" não está pausada.`); break; }
          actions.push({ kind: "meta_status", goalId: g.id, titulo: g.titulo, para });
          break;
        }
        case "meta_editar": {
          if (!opts.goals || (a.titulo && blocked(a.titulo))) break;
          const g = await findGoal(a.meta);
          if (!g) break;
          const mudancas: { titulo?: string; alvo?: number; prazo?: string } = {};
          if (a.titulo && a.titulo !== g.titulo) mudancas.titulo = a.titulo;
          if (a.alvo !== null) {
            if (g.medicao !== "numerica") { misses.push(`A meta "${g.titulo}" não tem alvo em número.`); break; }
            if (g.valor_alvo == null || Number(g.valor_alvo) !== a.alvo) mudancas.alvo = a.alvo;
          }
          if (a.prazo && a.prazo !== g.prazo) mudancas.prazo = a.prazo;
          if (!Object.keys(mudancas).length) { misses.push(`A meta "${g.titulo}" já está assim. Nada para mudar.`); break; }
          actions.push({ kind: "meta_editar", goalId: g.id, titulo: g.titulo, unidade: g.unidade, mudancas });
          break;
        }
        case "projeto_editar": case "projeto_arquivar": {
          if (a.tipo === "projeto_editar" && ((a.nome && blocked(a.nome)) || (a.objetivo && blocked(a.objetivo)))) break;
          const p = matchByName(await projects(), (x) => x.name, a.projeto);
          if (!p) { misses.push(`Não achei o projeto "${a.projeto}". Diga o nome como está em Projetos.`); break; }
          if (a.tipo === "projeto_arquivar") { actions.push({ kind: "projeto_arquivar", id: p.id, nome: p.name }); break; }
          const mudancas: { nome?: string; objetivo?: string } = {};
          if (a.nome && a.nome !== p.name) mudancas.nome = a.nome;
          if (a.objetivo !== null && a.objetivo !== (p.goal ?? "")) mudancas.objetivo = a.objetivo;
          if (!Object.keys(mudancas).length) { misses.push(`O projeto "${p.name}" já está assim. Nada para mudar.`); break; }
          actions.push({ kind: "projeto_editar", id: p.id, nome: p.name, mudancas });
          break;
        }
        case "meta_marco": {
          if (!opts.goals || blocked(a.titulo)) break;
          const g = await findGoal(a.meta);
          if (g) actions.push({ kind: "marco", goalId: g.id, meta: g.titulo, titulo: a.titulo, data: a.data });
          break;
        }
        case "meta_marco_concluir": {
          if (!opts.goals) break;
          const g = await findGoal(a.meta);
          if (!g) break;
          const r = await db.from("goal_milestones").select("id, titulo, concluido_em").eq("user_id", userId).eq("goal_id", g.id).limit(100);
          const abertos = r.error ? [] : (r.data as { id: string; titulo: string; concluido_em: string | null }[]).filter((m) => !m.concluido_em);
          const m = matchByName(abertos, (x) => x.titulo, a.marco);
          if (m) actions.push({ kind: "marco_ok", goalId: g.id, marcoId: m.id, meta: g.titulo, titulo: m.titulo });
          else misses.push(`Não achei o marco "${a.marco}" em aberto na meta "${g.titulo}".`);
          break;
        }
        case "meta_tarefa": {
          if (!opts.goals || blocked(a.tarefa)) break;
          const g = await findGoal(a.meta);
          if (g) actions.push({ kind: "meta_tarefa", goalId: g.id, meta: g.titulo, titulo: a.tarefa, prazo: a.prazo });
          break;
        }
        case "tarefa_concluir": case "tarefa_adiar": {
          const t = matchByName(await tasks(), (x) => x.title, a.tarefa);
          if (!t) { misses.push(`Não achei a tarefa "${a.tarefa}" entre as abertas.`); break; }
          actions.push(a.tipo === "tarefa_concluir" ? { kind: "tarefa_ok", id: t.id, titulo: t.title } : { kind: "tarefa_adiar", id: t.id, titulo: t.title, prazo: a.prazo });
          break;
        }
        case "tarefa_cancelar": {
          const t = matchByName(await tasks(), (x) => x.title, a.tarefa);
          if (t) actions.push({ kind: "tarefa_cancelar", id: t.id, titulo: t.title });
          else misses.push(`Não achei a tarefa "${a.tarefa}" entre as abertas.`);
          break;
        }
        case "tarefa_reabrir": {
          const t = matchByName(await closedTasks(), (x) => x.title, a.tarefa);
          if (t) actions.push({ kind: "tarefa_reabrir", id: t.id, titulo: t.title });
          else misses.push(`Não achei a tarefa "${a.tarefa}" entre as feitas ou canceladas.`);
          break;
        }
        case "tarefa_editar": {
          if (a.titulo && blocked(a.titulo)) break;
          const t = matchByName(await tasks(), (x) => x.title, a.tarefa);
          if (!t) { misses.push(`Não achei a tarefa "${a.tarefa}" entre as abertas.`); break; }
          const mudancas: TarefaMudancas = {};
          if (a.titulo) mudancas.titulo = a.titulo;
          if (a.prioridade) mudancas.prioridade = a.prioridade;
          if (a.prazo) mudancas.prazo = a.prazo;
          if (a.projeto) {
            const p = matchByName(await projects(), (x) => x.name, a.projeto);
            if (!p) { misses.push(`Não achei o projeto "${a.projeto}". Diga o nome como está em Projetos.`); break; }
            mudancas.projetoId = p.id;
            mudancas.projeto = p.name;
          }
          actions.push({ kind: "tarefa_editar", id: t.id, titulo: t.title, mudancas });
          break;
        }
        case "lembrete_adiar": {
          const r = matchByName(await snoozable(), (x) => x.text, a.lembrete);
          if (r) actions.push({ kind: "lembrete_adiar", id: r.id, text: r.text, dueAt: r.due_at, novoDueAt: a.quando });
          else misses.push(`Não achei o lembrete "${a.lembrete}".`);
          break;
        }
        case "lembrete_cancelar": {
          const r = matchByName(await reminders(), (x) => x.text, a.lembrete);
          if (r) actions.push({ kind: "lembrete_off", id: r.id, text: r.text, dueAt: r.due_at });
          else misses.push(`Não achei o lembrete "${a.lembrete}" entre os pendentes.`);
          break;
        }
        case "conta_paga": case "conta_desmarcar": case "conta_valor": {
          if (!opts.finance) break;
          const { hoje, doMes, contas } = await contasDoMes();
          const c = matchByName(contas, (x) => x.nome, a.conta);
          if (!c) { misses.push(`Não achei a conta "${a.conta}" neste mês. Confira o nome em Financeiro.`); break; }
          const m = doMes.get(c.id)!;
          if (a.tipo === "conta_paga") {
            if (m.pago) { misses.push(`A conta "${c.nome}" já está marcada como paga neste mês.`); break; }
            actions.push({ kind: "conta_paga", itemId: c.id, nome: c.nome, valor: m.valor, ano: hoje.ano, mes: hoje.mes });
          } else if (a.tipo === "conta_desmarcar") {
            if (!m.pago) { misses.push(`A conta "${c.nome}" já está em aberto neste mês.`); break; }
            actions.push({ kind: "conta_desmarcar", itemId: c.id, nome: c.nome, valor: m.valor, ano: hoje.ano, mes: hoje.mes });
          } else {
            if (Math.abs(m.valor - a.valor) < 0.005) { misses.push(`A conta "${c.nome}" já está com esse valor neste mês.`); break; }
            actions.push({ kind: "conta_valor", itemId: c.id, nome: c.nome, antes: m.valor, valor: a.valor, escopo: a.escopo, ano: hoje.ano, mes: hoje.mes });
          }
          break;
        }
        case "gasto_apagar": {
          if (!opts.finance) break;
          const g = await findGasto(a.gasto, a.valor, a.data);
          if (g) actions.push({ kind: "gasto_apagar", id: g.id, valor: g.valor, categoria: g.categoria, descricao: g.descricao, data: isoDia({ ano: g.ano, mes: g.mes, dia: g.dia }) });
          break;
        }
        case "gasto_editar": {
          if (!opts.finance) break;
          if (a.descricao && blocked(a.descricao)) break;
          const g = await findGasto(a.gasto, a.de_valor, a.de_data);
          if (!g) break;
          const mudancas: GastoMudancas = {};
          if (a.valor !== null && Math.abs(a.valor - g.valor) >= 0.005) mudancas.valor = a.valor;
          if (a.categoria && a.categoria !== g.categoria) mudancas.categoria = a.categoria;
          if (a.descricao !== null && a.descricao !== g.descricao) mudancas.descricao = a.descricao;
          if (a.meio && a.meio !== g.meio) mudancas.meio = a.meio;
          const atual = isoDia({ ano: g.ano, mes: g.mes, dia: g.dia });
          if (a.data && a.data !== atual) mudancas.data = a.data;
          if (!Object.keys(mudancas).length) { misses.push("O gasto já está assim. Nada para mudar."); break; }
          actions.push({ kind: "gasto_editar", id: g.id, atual: { valor: g.valor, categoria: g.categoria, descricao: g.descricao, data: atual }, mudancas });
          break;
        }
        case "evento_editar": case "evento_apagar": {
          if (a.tipo === "evento_editar" && a.titulo && blocked(a.titulo)) break;
          let lista: CalEvent[];
          try { lista = await eventos(); } catch { noEventos(); break; }
          const e = matchByName(lista, (x) => x.title, a.evento);
          if (!e || !e.id) { misses.push(`Não achei o evento "${a.evento}" nos próximos dias.`); break; }
          if (a.tipo === "evento_apagar") { actions.push({ kind: "evento_apagar", eventId: e.id, title: e.title, start: e.start, end: e.end }); break; }
          const mudancas: { title?: string; start?: string; end?: string; location?: string } = {};
          if (a.titulo && a.titulo !== e.title) mudancas.title = a.titulo;
          if (a.local && a.local !== e.where) mudancas.location = a.local;
          if (a.inicio || a.fim) {
            if (e.allDay) { misses.push(`O evento "${e.title}" dura o dia inteiro: mude o horário direto no Google Agenda.`); break; }
            const dur = Date.parse(e.end) - Date.parse(e.start);
            const start = a.inicio ?? e.start;
            const end = a.fim ?? new Date(Date.parse(start) + dur).toISOString();
            if (!(Date.parse(end) > Date.parse(start)) || Date.parse(end) - Date.parse(start) > 24 * 3_600_000) { misses.push("O fim do evento precisa ser depois do início, no máximo 24 horas."); break; }
            mudancas.start = new Date(start).toISOString();
            mudancas.end = new Date(end).toISOString();
          }
          if (!Object.keys(mudancas).length) { misses.push("O evento já está assim. Nada para mudar."); break; }
          actions.push({ kind: "evento_editar", eventId: e.id, title: e.title, start: e.start, end: e.end, mudancas });
          break;
        }
        case "projeto_criar":
          if (blocked(a.nome)) break;
          actions.push({ kind: "projeto", nome: a.nome, objetivo: a.objetivo });
          break;
        case "ajuste":
          actions.push({ kind: "ajuste", ajuste: a.ajuste });
          break;
      }
    } catch {
      misses.push("Não consegui preparar uma das ações agora. Tente de novo.");
    }
  }
  return { actions: actions.slice(0, 5), misses: [...new Set(misses)].slice(0, 3) };
}
