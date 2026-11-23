// Leitura dos dados de Metas com o cliente da SESSÃO da pessoa (RLS): nunca a chave secreta.
// Usado pelas rotas, pela fonte `goals` do Core e pelo resumo do Hoje. Qualquer erro de leitura lança (o chamador decide: 503 ou "indisponível").
import type { SessionDb } from "../core/types.ts";
import { montarMeta } from "./calc.ts";
import type { Goal, Marco, MetaView, Registro, TarefaVinculada } from "./types.ts";

export const GOAL_COLS = "id, titulo, descricao, categoria, categoria_nome, medicao, unidade, agregacao, valor_inicial, valor_alvo, inicio, prazo, status, concluida_em";
export const PROGRESS_COLS = "id, goal_id, valor, data, origem, nota, created_at";
export const MARCO_COLS = "id, goal_id, titulo, data_alvo, ordem, concluido_em";

const num = (v: unknown) => Number(v);
export const toGoal = (r: Record<string, unknown>): Goal => ({
  id: String(r.id), titulo: String(r.titulo), descricao: (r.descricao as string | null) ?? null, categoria: r.categoria as Goal["categoria"],
  categoria_nome: (r.categoria_nome as string | null) ?? null, medicao: r.medicao as Goal["medicao"], unidade: (r.unidade as string | null) ?? null,
  agregacao: r.agregacao as Goal["agregacao"], valor_inicial: num(r.valor_inicial), valor_alvo: r.valor_alvo == null ? null : num(r.valor_alvo),
  inicio: String(r.inicio), prazo: (r.prazo as string | null) ?? null, status: r.status as Goal["status"], concluida_em: (r.concluida_em as string | null) ?? null,
});
export const toRegistro = (r: Record<string, unknown>): Registro => ({
  id: String(r.id), goal_id: String(r.goal_id), valor: num(r.valor), data: String(r.data), origem: r.origem as Registro["origem"],
  nota: (r.nota as string | null) ?? null, ...(r.created_at ? { created_at: String(r.created_at) } : {}),
});
export const toMarco = (r: Record<string, unknown>): Marco => ({
  id: String(r.id), goal_id: String(r.goal_id), titulo: String(r.titulo), data_alvo: (r.data_alvo as string | null) ?? null,
  ordem: num(r.ordem), concluido_em: (r.concluido_em as string | null) ?? null,
});

type Rows = Record<string, unknown>[];
/** Tarefas ligadas às metas, com título e situação atuais (leitura das tabelas da própria pessoa). */
export async function loadTarefas(db: SessionDb, userId: string, goalIds?: string[]): Promise<TarefaVinculada[]> {
  const links = await db.from("goal_tasks").select("goal_id, task_id").eq("user_id", userId).limit(5000);
  if (links.error) throw new Error("goals_leitura");
  const rows = ((links.data ?? []) as Rows).filter((l) => !goalIds || goalIds.includes(String(l.goal_id)));
  if (!rows.length) return [];
  const ids = [...new Set(rows.map((l) => num(l.task_id)))];
  const tasks = await db.from("tasks").select("id, title, status, due_date").eq("user_id", userId).in("id", ids).limit(5000);
  if (tasks.error) throw new Error("goals_leitura");
  const byId = new Map(((tasks.data ?? []) as Rows).map((t) => [num(t.id), t]));
  return rows.flatMap((l) => {
    const t = byId.get(num(l.task_id));
    return t ? [{ goal_id: String(l.goal_id), task_id: num(t.id), title: String(t.title), status: t.status as TarefaVinculada["status"], due_date: (t.due_date as string | null) ?? null }] : [];
  });
}

/** Projeto ligado a uma meta, com o nome e a situação atuais. */
export type ProjetoVinculado = { goal_id: string; project_id: number; name: string; status: string };
/** Projetos ligados às metas (só da pessoa). Sem `goalIds`, de todas as metas. Erro de leitura lança. */
export async function loadProjetos(db: SessionDb, userId: string, goalId?: string | string[]): Promise<ProjetoVinculado[]> {
  const ids = goalId === undefined ? null : [goalId].flat();
  let q = db.from("goal_projects").select("goal_id, project_id").eq("user_id", userId);
  if (ids && ids.length === 1) q = q.eq("goal_id", ids[0]);
  const links = await q.limit(5000);
  if (links.error) throw new Error("goals_leitura");
  const rows = ((links.data ?? []) as Rows).filter((l) => !ids || ids.includes(String(l.goal_id)));
  if (!rows.length) return [];
  const projs = await db.from("projects").select("id, name, status").eq("user_id", userId).in("id", [...new Set(rows.map((l) => num(l.project_id)))]).limit(5000);
  if (projs.error) throw new Error("goals_leitura");
  const byId = new Map(((projs.data ?? []) as Rows).map((p) => [num(p.id), p]));
  return rows.flatMap((l) => {
    const p = byId.get(num(l.project_id));
    return p ? [{ goal_id: String(l.goal_id), project_id: num(p.id), name: String(p.name), status: String(p.status) }] : [];
  });
}

/** Todas as metas da pessoa (menos arquivadas, a não ser que `incluirArquivadas`) já com progresso e ritmo. Filtra também por user_id (a SESSÃO), como defesa em profundidade além da RLS. */
export async function loadMetas(db: SessionDb, userId: string, hoje: string, opts: { incluirArquivadas?: boolean } = {}): Promise<MetaView[]> {
  const [goals, prog, marcos] = await Promise.all([
    db.from("goals").select(GOAL_COLS).eq("user_id", userId).order("created_at", { ascending: false }).limit(300),
    db.from("goal_progress").select(PROGRESS_COLS).eq("user_id", userId).order("data", { ascending: false }).limit(10000),
    db.from("goal_milestones").select(MARCO_COLS).eq("user_id", userId).order("ordem").limit(5000),
  ]);
  for (const r of [goals, prog, marcos]) if (r.error) throw new Error("goals_leitura");
  const tarefas = await loadTarefas(db, userId);
  const regs = ((prog.data ?? []) as Rows).map(toRegistro);
  const ms = ((marcos.data ?? []) as Rows).map(toMarco);
  return ((goals.data ?? []) as Rows).map(toGoal)
    .filter((g) => opts.incluirArquivadas || g.status !== "arquivada")
    .map((g) => montarMeta(g, regs.filter((r) => r.goal_id === g.id), ms.filter((m) => m.goal_id === g.id), tarefas.filter((t) => t.goal_id === g.id), hoje));
}

/** Resumo: contagens por situação e as metas que pedem atenção. */
export type ResumoMetas = { total: number; ativas: number; pausadas: number; concluidas: number; atrasadas: number; atencao: { id: string; titulo: string; situacao: string; texto: string }[] };

export type DetalheMeta = { meta: MetaView; registros: Registro[]; marcos: Marco[]; tarefas: TarefaVinculada[] };

/** Uma meta com o detalhe (histórico, marcos, tarefas), ou null se não existir (ou não for da pessoa: a RLS esconde). */
export async function loadMeta(db: SessionDb, userId: string, id: string, hoje: string): Promise<DetalheMeta | null> {
  const goal = await db.from("goals").select(GOAL_COLS).eq("user_id", userId).eq("id", id).maybeSingle();
  if (goal.error) throw new Error("goals_leitura");
  if (!goal.data) return null;
  const [prog, marcos] = await Promise.all([
    db.from("goal_progress").select(PROGRESS_COLS).eq("user_id", userId).eq("goal_id", id).order("data", { ascending: false }).limit(2000),
    db.from("goal_milestones").select(MARCO_COLS).eq("user_id", userId).eq("goal_id", id).order("ordem").limit(200),
  ]);
  for (const r of [prog, marcos]) if (r.error) throw new Error("goals_leitura");
  const tarefas = await loadTarefas(db, userId, [id]);
  const registros = ((prog.data ?? []) as Rows).map(toRegistro);
  const ms = ((marcos.data ?? []) as Rows).map(toMarco);
  return { meta: montarMeta(toGoal(goal.data as Rows[number]), registros, ms, tarefas, hoje), registros, marcos: ms, tarefas };
}
