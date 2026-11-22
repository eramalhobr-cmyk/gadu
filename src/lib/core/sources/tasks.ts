// Fonte: tarefas abertas (atrasadas, de hoje e de prioridade alta sem prazo). Cliente com a sessão da pessoa (RLS).
import { hidden } from "../privacy.ts";
import { OMITTED, type RawFact, type SourceCtx, type SourceResult } from "../types.ts";

export const TASKS_LIMIT = 15;

type Row = { id: number; title: string; priority: number; due_date: string | null; projects: { name: string } | { name: string }[] | null };

/** Consulta exata do Core (a mesma roda no teste de banco). */
export function tasksQuery(ctx: SourceCtx) {
  return ctx.db
    .from("tasks")
    .select("id, title, priority, due_date, projects(name)")
    .eq("user_id", ctx.userId)
    .eq("status", "open")
    .or(`due_date.lte.${ctx.day},and(priority.eq.1,due_date.is.null)`)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("priority")
    .limit(TASKS_LIMIT);
}

const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export async function collectTasks(ctx: SourceCtx): Promise<SourceResult> {
  const { data, error } = (await tasksQuery(ctx)) as { data: Row[] | null; error: unknown };
  if (error) return { facts: [], unavailable: { source: "tarefas", reason: "error", text: "Não consegui ler suas tarefas agora." } };
  const facts: RawFact[] = [];
  for (const r of data ?? []) {
    const project = (Array.isArray(r.projects) ? r.projects[0]?.name : r.projects?.name) ?? null;
    const omitted = hidden(`${r.title} ${project ?? ""}`, ctx.blocked);
    const late = r.due_date !== null && r.due_date < ctx.day;
    const today = r.due_date === ctx.day;
    const kind = late ? "atrasada" : today ? "tarefa_hoje" : "prioridade";
    const label = late ? "Tarefa atrasada" : today ? "Tarefa de hoje" : "Tarefa de prioridade alta";
    const when = late ? ` desde ${br(r.due_date!)}` : today ? " para hoje" : " sem prazo";
    const body = omitted ? OMITTED : `${r.title.slice(0, 160)}${project ? ` (projeto ${project.slice(0, 60)})` : ""}${r.priority === 1 && kind !== "prioridade" ? " [prioridade alta]" : ""}`;
    facts.push({
      module: "pessoal", scope: "pessoal", source: { table: "tasks", id: r.id },
      kind, label, view: "tarefas", omitted,
      rank: late ? 10 : today ? 20 : 50,
      text: `${label}${when}: ${body}`,
    });
  }
  return { facts };
}
