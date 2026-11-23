import { loadProjetos } from "@/lib/goals/load";
import { IdParam, TaskIdParam } from "@/lib/goals/schemas";
import { dbFail, goalsGuard, invalid, notFound, ok, unavailable } from "../../../_guard";

export const dynamic = "force-dynamic";

// Desliga o projeto da meta (o projeto e a meta continuam existindo).
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string; projectId: string }> }) {
  const g = await goalsGuard();
  if ("res" in g) return g.res;
  const { id: rawId, projectId: rawProj } = await ctx.params;
  const id = IdParam.safeParse(rawId), projectId = TaskIdParam.safeParse(rawProj);
  if (!id.success || !projectId.success) return invalid("Vínculo inválido.");
  const { data, error } = await g.a.supabase.from("goal_projects").delete().eq("user_id", g.a.user.id).eq("goal_id", id.data).eq("project_id", projectId.data).select("project_id");
  if (error) return dbFail(error);
  if (!data || data.length === 0) return notFound();
  try {
    return ok({ ok: true, projetos: await loadProjetos(g.a.supabase, g.a.user.id, id.data) });
  } catch {
    return unavailable();
  }
}
