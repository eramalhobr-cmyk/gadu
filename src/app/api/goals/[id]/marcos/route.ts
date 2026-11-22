import { loadMeta, MARCO_COLS, toGoal, toMarco, GOAL_COLS } from "@/lib/goals/load";
import { IdParam, MarcoCreate } from "@/lib/goals/schemas";
import { dbFail, goalsGuard, hojeIso, invalid, notFound, ok, readJson, unavailable } from "../../_guard";

export const dynamic = "force-dynamic";

// Acrescenta um marco (só em metas medidas por marcos).
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await goalsGuard();
  if ("res" in g) return g.res;
  const id = IdParam.safeParse((await ctx.params).id);
  if (!id.success) return invalid("Meta inválida.");
  const p = MarcoCreate.safeParse(await readJson(request));
  if (!p.success) return invalid("Confira o título do marco.");
  const found = await g.a.supabase.from("goals").select(GOAL_COLS).eq("id", id.data).maybeSingle();
  if (found.error) return dbFail(found.error);
  if (!found.data) return notFound();
  if (toGoal(found.data as Record<string, unknown>).medicao !== "marcos") return invalid("Só metas por marcos têm marcos.");
  const last = await g.a.supabase.from("goal_milestones").select("ordem").eq("goal_id", id.data).order("ordem", { ascending: false }).limit(1);
  if (last.error) return dbFail(last.error);
  const ordem = ((last.data as { ordem: number }[] | null)?.[0]?.ordem ?? -1) + 1;
  const ins = await g.a.supabase.from("goal_milestones").insert({ goal_id: id.data, titulo: p.data.titulo, data_alvo: p.data.data_alvo ?? null, ordem, user_id: g.a.user.id }).select(MARCO_COLS).single();
  if (ins.error || !ins.data) return dbFail(ins.error);
  try {
    const d = await loadMeta(g.a.supabase, g.a.user.id, id.data, hojeIso());
    return ok({ marco: toMarco(ins.data as Record<string, unknown>), meta: d?.meta ?? null }, 201);
  } catch {
    return unavailable();
  }
}
