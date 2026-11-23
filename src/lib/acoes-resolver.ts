// Servidor: transforma as ações propostas pelo modelo (src/lib/acoes.ts) em cartões, resolvendo os nomes para ids
// SÓ entre os itens da própria pessoa (cliente da SESSÃO + filtro por user_id, além da RLS). Nada é gravado aqui.
import type { AcaoProposta } from "./acoes.ts";
import { matchByName } from "./acoes.ts";
import type { ChatAction, TarefaMudancas } from "./chat-actions.ts";
import type { SessionDb } from "./core/types.ts";
import { hojeSP, isoDia } from "./finance/datas.ts";
import { loadMes } from "./finance/load.ts";
import type { Agregacao, Medicao } from "./goals/types.ts";

type GoalRow = { id: string; titulo: string; medicao: Medicao; unidade: string | null; agregacao: Agregacao; status: string };
type Opts = { goals: boolean; finance: boolean; now?: number; blocked?: (text: string) => boolean };

/** Ações resolvidas e avisos do que não deu para achar (o app mostra, sem inventar). */
export async function resolveAcoes(db: SessionDb, userId: string, acoes: AcaoProposta[], opts: Opts): Promise<{ actions: ChatAction[]; misses: string[] }> {
  const actions: ChatAction[] = [];
  const misses: string[] = [];
  const now = opts.now ?? Date.now();
  const blocked = opts.blocked ?? (() => false);
  const cache: { goals?: GoalRow[]; tasks?: { id: number; title: string }[]; reminders?: { id: number; text: string; due_at: string }[]; closed?: { id: number; title: string }[]; projects?: { id: number; name: string }[]; snoozable?: { id: number; text: string; due_at: string }[] } = {};

  const goals = async () => {
    if (!cache.goals) {
      const r = await db.from("goals").select("id, titulo, medicao, unidade, agregacao, status").eq("user_id", userId).in("status", ["ativa", "pausada"]).limit(200);
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
      const r = await db.from("projects").select("id, name").eq("user_id", userId).in("status", ["active", "paused"]).limit(100);
      cache.projects = r.error ? [] : (r.data as { id: number; name: string }[]);
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
        case "conta_paga": {
          if (!opts.finance) break;
          const hoje = hojeSP(now);
          const d = await loadMes(db, userId, hoje.ano, hoje.mes);
          const doMes = new Map(d.meses.filter((m) => m.ano === hoje.ano && m.mes === hoje.mes).map((m) => [m.item_id, m]));
          const contas = d.itens.filter((i) => i.tipo === "despesa" && doMes.has(i.id));
          const c = matchByName(contas, (x) => x.nome, a.conta);
          if (!c) { misses.push(`Não achei a conta "${a.conta}" neste mês. Confira o nome em Financeiro.`); break; }
          const m = doMes.get(c.id)!;
          if (m.pago) { misses.push(`A conta "${c.nome}" já está marcada como paga neste mês.`); break; }
          actions.push({ kind: "conta_paga", itemId: c.id, nome: c.nome, valor: m.valor, ano: hoje.ano, mes: hoje.mes });
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
