import { loadMeta, loadMetas, GOAL_COLS } from "@/lib/goals/load";
import { GoalCreate, ListaQuery } from "@/lib/goals/schemas";
import { dbFail, goalsGuard, hojeIso, invalid, ok, readJson, unavailable } from "./_guard";

export const dynamic = "force-dynamic";

// Lista as metas da pessoa com progresso e ritmo calculados. ?status= filtra; arquivadas só aparecem com ?status=arquivada.
export async function GET(request: Request) {
  const g = await goalsGuard();
  if ("res" in g) return g.res;
  const q = ListaQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!q.success) return invalid("Situação inválida.");
  try {
    const metas = await loadMetas(g.a.supabase, g.a.user.id, hojeIso(), { incluirArquivadas: q.data.status === "arquivada" });
    return ok({ metas: q.data.status ? metas.filter((m) => m.goal.status === q.data.status) : metas });
  } catch {
    return unavailable();
  }
}

// Cria uma meta (e os marcos, quando a medição é por marcos). user_id = sessão (o do corpo é descartado).
export async function POST(request: Request) {
  const g = await goalsGuard();
  if ("res" in g) return g.res;
  const p = GoalCreate.safeParse(await readJson(request));
  if (!p.success) return invalid(p.error.issues[0]?.message ? `Confira os dados: ${p.error.issues[0].message}.` : "Confira os dados.");
  const { marcos, ...campos } = p.data;
  const { data, error } = await g.a.supabase.from("goals").insert({ ...campos, inicio: campos.inicio ?? hojeIso(), user_id: g.a.user.id }).select(GOAL_COLS).single();
  if (error || !data) return dbFail(error);
  const id = String((data as Record<string, unknown>).id);
  if (marcos?.length) {
    const r = await g.a.supabase.from("goal_milestones").insert(marcos.map((titulo, i) => ({ goal_id: id, titulo, ordem: i, user_id: g.a.user.id })));
    if (r.error) {
      await g.a.supabase.from("goals").delete().eq("id", id); // não deixa meta pela metade
      return dbFail(r.error);
    }
  }
  try {
    const d = await loadMeta(g.a.supabase, g.a.user.id, id, hojeIso());
    return ok({ meta: d?.meta ?? null }, 201);
  } catch {
    return unavailable();
  }
}
