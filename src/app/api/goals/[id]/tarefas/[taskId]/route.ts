import { loadMeta } from "@/lib/goals/load";
import { IdParam, TaskIdParam } from "@/lib/goals/schemas";
import { dbFail, goalsGuard, hojeIso, invalid, notFound, ok, unavailable } from "../../../_guard";

export const dynamic = "force-dynamic";

// Desvincula a tarefa da meta (a tarefa continua existindo).
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string; taskId: string }> }) {
  const g = await goalsGuard();
  if ("res" in g) return g.res;
  const { id: rawId, taskId: rawTask } = await ctx.params;
  const id = IdParam.safeParse(rawId), taskId = TaskIdParam.safeParse(rawTask);
  if (!id.success || !taskId.success) return invalid("Vínculo inválido.");
  const { data, error } = await g.a.supabase.from("goal_tasks").delete().eq("goal_id", id.data).eq("task_id", taskId.data).select("task_id");
  if (error) return dbFail(error);
  if (!data || data.length === 0) return notFound();
  try {
    const d = await loadMeta(g.a.supabase, g.a.user.id, id.data, hojeIso());
    return ok({ ok: true, meta: d?.meta ?? null });
  } catch {
    return unavailable();
  }
}
