import { loadMeta } from "@/lib/goals/load";
import { IdParam, TarefaLink } from "@/lib/goals/schemas";
import { dbFail, goalsGuard, hojeIso, invalid, notFound, ok, readJson, unavailable } from "../../_guard";

export const dynamic = "force-dynamic";

// Vincula uma tarefa da PRÓPRIA pessoa à meta. Duas camadas: aqui (a RLS só mostra tarefas e metas dela, senão 404) e no banco (chave composta).
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await goalsGuard();
  if ("res" in g) return g.res;
  const id = IdParam.safeParse((await ctx.params).id);
  if (!id.success) return invalid("Meta inválida.");
  const p = TarefaLink.safeParse(await readJson(request));
  if (!p.success) return invalid("Tarefa inválida.");
  const goal = await g.a.supabase.from("goals").select("id").eq("id", id.data).maybeSingle();
  if (goal.error) return dbFail(goal.error);
  if (!goal.data) return notFound();
  const task = await g.a.supabase.from("tasks").select("id").eq("id", p.data.task_id).maybeSingle();
  if (task.error) return dbFail(task.error);
  if (!task.data) return notFound();
  const ins = await g.a.supabase.from("goal_tasks").insert({ goal_id: id.data, task_id: p.data.task_id, user_id: g.a.user.id });
  if (ins.error) return dbFail(ins.error);
  try {
    const d = await loadMeta(g.a.supabase, g.a.user.id, id.data, hojeIso());
    return ok({ ok: true, meta: d?.meta ?? null }, 201);
  } catch {
    return unavailable();
  }
}
