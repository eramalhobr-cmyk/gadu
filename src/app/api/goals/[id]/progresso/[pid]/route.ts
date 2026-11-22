import { loadMeta } from "@/lib/goals/load";
import { IdParam } from "@/lib/goals/schemas";
import { dbFail, goalsGuard, hojeIso, invalid, notFound, ok, unavailable } from "../../../_guard";

export const dynamic = "force-dynamic";

// Apaga um registro de progresso (corrigir um engano). O progresso é recalculado dos registros que sobram.
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string; pid: string }> }) {
  const g = await goalsGuard();
  if ("res" in g) return g.res;
  const { id: rawId, pid: rawPid } = await ctx.params;
  const id = IdParam.safeParse(rawId), pid = IdParam.safeParse(rawPid);
  if (!id.success || !pid.success) return invalid("Registro inválido.");
  const { data, error } = await g.a.supabase.from("goal_progress").delete().eq("id", pid.data).eq("goal_id", id.data).select("id");
  if (error) return dbFail(error);
  if (!data || data.length === 0) return notFound();
  try {
    const d = await loadMeta(g.a.supabase, g.a.user.id, id.data, hojeIso());
    return ok({ ok: true, meta: d?.meta ?? null });
  } catch {
    return unavailable();
  }
}
