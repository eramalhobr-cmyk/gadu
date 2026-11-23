// Servidor: transforma as ações propostas pelo modelo (src/lib/acoes.ts) em cartões, resolvendo os nomes para ids
// SÓ entre os itens da própria pessoa (cliente da SESSÃO + filtro por user_id, além da RLS). Nada é gravado aqui.
import { nomeCategoria } from "./finance/tetos.ts";
import type { AcaoProposta } from "./acoes.ts";
import { DESTINO_NOME, matchByName, norm } from "./acoes.ts";
import { AREAS } from "./meta.ts";
import type { ChatAction, GastoMudancas, TarefaMudancas } from "./chat-actions.ts";
import type { CalEvent } from "./google-format.ts";
import type { SessionDb } from "./core/types.ts";
import { hojeSP, isoDia } from "./finance/datas.ts";
import { calcularSalario } from "./finance/salario.ts";
import { GASTO_COLS, loadMes, toGasto } from "./finance/load.ts";
import type { Gasto } from "./finance/types.ts";
import type { Agregacao, Medicao } from "./goals/types.ts";

type GoalRow = { id: string; titulo: string; medicao: Medicao; unidade: string | null; agregacao: Agregacao; status: string; valor_alvo?: number | string | null; prazo?: string | null };
/** Agenda do Google (só no servidor, com o token da própria pessoa); ausente nos testes que não usam agenda. */
export type CalendarLookup = (from: Date, to: Date) => Promise<CalEvent[]>;
type Opts = { goals: boolean; finance: boolean; modeling3d?: boolean; calendar?: CalendarLookup; now?: number; blocked?: (text: string) => boolean };

/** Área do agente: só as da lista de Agentes (como na tela); outra coisa vira nulo. */
function areaDe(v: string | null): string | null {
  if (!v) return null;
  return AREAS.find((x) => norm(x) === norm(v)) ?? null;
}

/** Ações resolvidas e avisos do que não deu para achar (o app mostra, sem inventar). */
export async function resolveAcoes(db: SessionDb, userId: string, acoes: AcaoProposta[], opts: Opts): Promise<{ actions: ChatAction[]; misses: string[] }> {
  const actions: ChatAction[] = [];
  const misses: string[] = [];
  const now = opts.now ?? Date.now();
  const blocked = opts.blocked ?? (() => false);
  const cache: { goals?: GoalRow[]; tasks?: { id: number; title: string }[]; reminders?: { id: number; text: string; due_at: string }[]; closed?: { id: number; title: string }[]; agents?: { id: number; name: string; area: string; instructions: string; active: boolean }[]; projects?: { id: number; name: string; goal?: string | null }[]; snoozable?: { id: number; text: string; due_at: string }[]; memorias?: { id: number; content: string; status: string }[]; gastos?: Gasto[]; eventos?: CalEvent[] } = {};

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
  const agents = async () => {
    if (!cache.agents) {
      const r = await db.from("agents").select("id, name, area, instructions, active").eq("user_id", userId).limit(100);
      cache.agents = r.error ? [] : (r.data as { id: number; name: string; area: string; instructions: string; active: boolean }[]);
    }
    return cache.agents;
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
  // Memórias da pessoa (pendentes e aprovadas): aprovar só acha pendentes; recusar, só pendentes; esquecer, só aprovadas.
  const memorias = async (status: "pending" | "approved") => {
    if (!cache.memorias) {
      const r = await db.from("memories").select("id, content, status").eq("user_id", userId).order("created_at", { ascending: false }).limit(400);
      cache.memorias = r.error ? [] : (r.data as { id: number; content: string; status: string }[]);
    }
    return cache.memorias.filter((m) => m.status === status);
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
        case "meta_projeto": {
          if (!opts.goals || blocked(a.projeto)) break;
          const g = await findGoal(a.meta);
          if (!g) break;
          const p = matchByName(await projects(), (x) => x.name, a.projeto);
          if (!p) { misses.push(`Não achei o projeto "${a.projeto}". Diga o nome como está em Projetos.`); break; }
          // Vínculos da própria pessoa (leitura da sessão). Se a tabela não responder, não escolhe por ela: avisa.
          const r = await db.from("goal_projects").select("goal_id, project_id").eq("user_id", userId).eq("goal_id", g.id).eq("project_id", p.id).limit(1);
          if (r.error) { misses.push("Não consegui conferir os projetos da meta agora. Tente de novo."); break; }
          const ligado = (r.data ?? []).length > 0;
          if (a.desligar && !ligado) { misses.push(`A meta "${g.titulo}" não está ligada ao projeto "${p.name}".`); break; }
          if (!a.desligar && ligado) { misses.push(`A meta "${g.titulo}" já está ligada ao projeto "${p.name}".`); break; }
          actions.push({ kind: "meta_projeto", goalId: g.id, projectId: p.id, meta: g.titulo, projeto: p.name, desligar: a.desligar });
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
        case "memoria_aprovar": {
          const pend = await memorias("pending");
          if (a.todas) {
            if (!pend.length) { misses.push("Não há memórias pendentes para aprovar."); break; }
            actions.push({ kind: "memoria_aprovar", ids: pend.map((m) => m.id), texto: `${pend.length} ${pend.length === 1 ? "memória pendente" : "memórias pendentes"}` });
            break;
          }
          const m = matchByName(pend, (x) => x.content, a.memoria ?? "");
          if (m) actions.push({ kind: "memoria_aprovar", ids: [m.id], texto: m.content });
          else misses.push(`Não achei a memória pendente "${a.memoria}".`);
          break;
        }
        case "memoria_recusar": case "memoria_esquecer": {
          const lista = await memorias(a.tipo === "memoria_recusar" ? "pending" : "approved");
          const m = matchByName(lista, (x) => x.content, a.memoria);
          if (m) actions.push({ kind: a.tipo, id: m.id, texto: m.content });
          else misses.push(a.tipo === "memoria_recusar" ? `Não achei a memória pendente "${a.memoria}".` : `Não achei nada guardado sobre "${a.memoria}". Diga com outras palavras.`);
          break;
        }
        case "meta_registro_apagar": {
          if (!opts.goals) break;
          const g = await findGoal(a.meta);
          if (!g) break;
          const r = await db.from("goal_progress").select("id, valor, data").eq("user_id", userId).eq("goal_id", g.id).order("data", { ascending: false }).order("created_at", { ascending: false }).limit(60);
          const regs = (r.error || !Array.isArray(r.data) ? [] : r.data) as { id: string; valor: number; data: string }[];
          const reg = regs.find((x) => (a.valor === null || Number(x.valor) === a.valor) && (a.data === null || x.data === a.data));
          if (!reg) { misses.push(`Não achei esse registro na meta "${g.titulo}".`); break; }
          actions.push({ kind: "registro_apagar", goalId: g.id, registroId: reg.id, meta: g.titulo, valor: Number(reg.valor), unidade: g.unidade ?? null, data: reg.data });
          break;
        }
        case "conta_criar": {
          if (!opts.finance) break;
          if (blocked(`${a.nome} ${a.grupo ?? ""}`)) break;
          const hoje = hojeSP(now);
          actions.push({ kind: "conta_nova", contaTipo: a.contaTipo, nome: a.nome, grupo: a.grupo ?? (a.contaTipo === "receita" ? "Receitas" : "Geral"), valor: a.valor, dia: a.dia, escopo: a.todoMes ? "proximos" : "mes", ano: hoje.ano, mes: hoje.mes });
          break;
        }
        case "receita_principal": {
          if (!opts.finance) break;
          const r = await db.from("fin_itens").select("id, nome, tipo").eq("user_id", userId).eq("tipo", "receita").limit(100);
          const lista = (r.error || !Array.isArray(r.data) ? [] : r.data) as { id: string; nome: string }[];
          const it = matchByName(lista, (x) => x.nome, a.receita);
          if (!it) { misses.push(`Não achei a receita "${a.receita}" no Financeiro.`); break; }
          actions.push({ kind: "receita_principal", itemId: it.id, nome: it.nome });
          break;
        }
        case "peca3d_abrir": {
          if (!opts.modeling3d) break;
          const r = await db.from("pecas_3d").select("id, titulo, updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(50);
          const lista = (r.error || !Array.isArray(r.data) ? [] : r.data) as { id: string; titulo: string; updated_at: string }[];
          const p = a.busca ? matchByName(lista, (x) => x.titulo, a.busca) : lista[0];
          if (!p || blocked(p.titulo)) { misses.push(a.busca ? `Não achei a peça "${a.busca}" no 3D.` : "Você ainda não tem peças salvas no 3D."); break; }
          const quando = new Date(p.updated_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
          actions.push({ kind: "peca3d_abrir", id: p.id, titulo: p.titulo.slice(0, 120), quando });
          break;
        }
        case "teto_definir": {
          if (!opts.finance || blocked(a.categoria)) break;
          const categoria = nomeCategoria(a.categoria);
          const r = await db.from("fin_tetos").select("valor").eq("user_id", userId).eq("categoria", categoria).limit(1);
          const atual = !r.error && Array.isArray(r.data) && r.data[0] ? Number((r.data[0] as { valor: unknown }).valor) : null;
          if (a.valor === null && atual === null) { misses.push(`${categoria} não tem teto.`); break; }
          actions.push({ kind: "teto", categoria, valor: a.valor, anterior: atual });
          break;
        }
        case "nova_conversa":
          actions.push({ kind: "nova_conversa" });
          break;
        case "conversa_abrir": {
          // Só as conversas da própria pessoa: título e resumo pelo nome; se o nome não decide, a mais recente que casa na busca por texto.
          const r = await db.from("conversations").select("id, title, summary, updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(200);
          const lista = (r.error || !Array.isArray(r.data) ? [] : r.data) as { id: number; title: string | null; summary: string | null; updated_at: string }[];
          let c = matchByName(lista, (x) => x.title ?? "", a.busca) ?? matchByName(lista, (x) => `${x.title ?? ""} ${x.summary ?? ""}`, a.busca);
          if (!c) {
            const t = await db.from("conversations").select("id, title, summary, updated_at").eq("user_id", userId).textSearch("search", a.busca, { type: "websearch", config: "portuguese" }).order("updated_at", { ascending: false }).limit(1);
            c = (t.error || !Array.isArray(t.data) ? null : t.data[0]) ?? null;
          }
          if (!c || blocked(`${c.title ?? ""} ${c.summary ?? ""}`)) { misses.push(`Não achei uma conversa sobre "${a.busca}". Ela pode estar no Histórico.`); break; }
          const d = new Date(c.updated_at);
          const quando = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
          actions.push({ kind: "conversa_abrir", id: c.id, titulo: (c.title || "Sem título").slice(0, 120), quando });
          break;
        }
        case "guia":
          actions.push({ kind: "guia" });
          break;
        case "navegar":
          // Telas desligadas pelo interruptor não abrem (o menu também esconde).
          if ((a.destino === "financeiro" && !opts.finance) || (a.destino === "metas" && !opts.goals)) { misses.push(`${DESTINO_NOME[a.destino]} está desligado no momento.`); break; }
          actions.push({ kind: "navegar", view: a.destino });
          break;
        case "agente_criar": {
          if (blocked(a.nome) || (a.instrucoes && blocked(a.instrucoes))) break;
          const area = areaDe(a.area);
          if (a.area && !area) misses.push(`A área "${a.area}" não existe; usei Pessoal.`);
          if ((await agents()).some((x) => norm(x.name) === norm(a.nome))) { misses.push(`Você já tem um agente chamado "${a.nome}". Para mudar, peça para editar.`); break; }
          actions.push({ kind: "agente_novo", nome: a.nome, area: area ?? "Pessoal", instrucoes: a.instrucoes ?? "" });
          break;
        }
        case "agente_editar": {
          if ((a.nome && blocked(a.nome)) || (a.instrucoes && blocked(a.instrucoes))) break;
          const ag = matchByName(await agents(), (x) => x.name, a.agente);
          if (!ag) { misses.push(`Não achei o agente "${a.agente}". Diga o nome como está em Agentes.`); break; }
          const mudancas: { nome?: string; area?: string; instrucoes?: string; ativo?: boolean } = {};
          let avisou = false;
          if (a.nome && a.nome !== ag.name) mudancas.nome = a.nome;
          if (a.area) {
            const area = areaDe(a.area);
            if (!area) { misses.push(`A área "${a.area}" não existe. As áreas são: ${AREAS.join(", ")}.`); avisou = true; }
            else if (area !== ag.area) mudancas.area = area;
          }
          if (a.instrucoes !== null && a.instrucoes !== ag.instructions) mudancas.instrucoes = a.instrucoes;
          if (a.ativo !== null && a.ativo !== ag.active) mudancas.ativo = a.ativo;
          if (!Object.keys(mudancas).length) { if (!avisou) misses.push(`O agente "${ag.name}" já está assim. Nada para mudar.`); break; }
          actions.push({ kind: "agente_editar", id: ag.id, nome: ag.name, mudancas });
          break;
        }
        case "projeto_criar":
          if (blocked(a.nome)) break;
          actions.push({ kind: "projeto", nome: a.nome, objetivo: a.objetivo });
          break;
        case "salario_simular": {
          // O cálculo é do servidor (nunca do modelo). Só informa; para salvar, o líquido vai para a RECEITA PRINCIPAL da própria
          // pessoa (Financeiro › Contas › Configurar), que já guarda o valor do mês. Sem receita principal, só mostra o cálculo.
          if (!opts.finance) break;
          const calc = calcularSalario(a.bruto, a.dependentes);
          if (!calc) { misses.push("Não consegui calcular esse salário. Confira o valor e os dependentes."); break; }
          if (!a.salvar) { actions.push({ kind: "salario", calc, salvar: null }); break; }
          const hoje = hojeSP(now);
          const d = await loadMes(db, userId, hoje.ano, hoje.mes);
          const alvo = d.itens.find((i) => i.tipo === "receita" && i.id === d.config.receita_principal_id);
          if (!alvo) {
            actions.push({ kind: "salario", calc, salvar: null });
            misses.push("Para salvar o salário do mês, escolha a receita principal em Financeiro › Contas › Configurar. Por enquanto, só mostrei o cálculo.");
            break;
          }
          const antes = d.meses.find((m) => m.item_id === alvo.id && m.ano === hoje.ano && m.mes === hoje.mes)?.valor ?? null;
          actions.push({ kind: "salario", calc, salvar: { itemId: alvo.id, nome: alvo.nome, antes, ano: hoje.ano, mes: hoje.mes } });
          break;
        }
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
