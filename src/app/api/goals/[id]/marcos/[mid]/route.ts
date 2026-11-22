import { loadMeta } from "@/lib/goals/load";
import { IdParam, MarcoPatch } from "@/lib/goals/schemas";
import { dbFail, goalsGuard, hojeIso, invalid, notFound, ok, readJson, unavailable } from "../../../_guard";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; mid: string }> };

async function ids(ctx: Ctx) {
  const { id, mid } = await ctx.params;
  const a = IdParam.safeParse(id), b = IdParam.safeParse(mid);
  return a.success && b.success ? { id: a.data, mid: b.data } : null;
}
async function resposta(g: Extract<Awaited<ReturnType<typeof goalsGuard>>, { a: unknown }>, id: string) {
  try {
    const d = await loadMeta(g.a.supabase, g.a.user.id, id, hojeIso());
    return ok({ ok: true, meta: d?.meta ?? null });
  } catch {
    return unavailable();
  }
}

// Edita o marco ou o conclui/reabre (concluido: true grava a data de agora; false limpa).
export async function PATCH(request: Request, ctx: Ctx) {
  const g = await goalsGuard();
  if ("res" in g) return g.res;
  const k = await ids(ctx);
  if (!k) return invalid("Marco inválido.");
  const p = MarcoPatch.safeParse(await readJson(request));
  if (!p.success) return invalid("Confira os dados.");
  const { concluido, ...resto } = p.data;
  const patch: Record<string, unknown> = { ...resto };
  if (concluido !== undefined) patch.concluido_em = concluido ? new Date().toISOString() : null;
  const { data, error } = await g.a.supabase.from("goal_milestones").update(patch).eq("id", k.mid).eq("goal_id", k.id).select("id");
  if (error) return dbFail(error);
  if (!data || data.length === 0) return notFound();
  return resposta(g, k.id);
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const g = await goalsGuard();
  if ("res" in g) return g.res;
  const k = await ids(ctx);
  if (!k) return invalid("Marco inválido.");
  const { data, error } = await g.a.supabase.from("goal_milestones").delete().eq("id", k.mid).eq("goal_id", k.id).select("id");
  if (error) return dbFail(error);
  if (!data || data.length === 0) return notFound();
  return resposta(g, k.id);
}
