import { loadProjetos } from "@/lib/goals/load";
import { IdParam, ProjetoLink } from "@/lib/goals/schemas";
import { dbFail, goalsGuard, invalid, notFound, ok, readJson, unavailable } from "../../_guard";

export const dynamic = "force-dynamic";

// Liga um projeto da PRÓPRIA pessoa à meta. Duas camadas: aqui (a RLS só mostra metas e projetos dela, senão 404) e no banco (chave composta com user_id).
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await goalsGuard();
  if ("res" in g) return g.res;
  const id = IdParam.safeParse((await ctx.params).id);
  if (!id.success) return invalid("Meta inválida.");
  const p = ProjetoLink.safeParse(await readJson(request));
  if (!p.success) return invalid("Projeto inválido.");
  const goal = await g.a.supabase.from("goals").select("id").eq("user_id", g.a.user.id).eq("id", id.data).maybeSingle();
  if (goal.error) return dbFail(goal.error);
  if (!goal.data) return notFound();
  const proj = await g.a.supabase.from("projects").select("id").eq("user_id", g.a.user.id).eq("id", p.data.project_id).maybeSingle();
  if (proj.error) return dbFail(proj.error);
  if (!proj.data) return notFound();
  const ins = await g.a.supabase.from("goal_projects").insert({ goal_id: id.data, project_id: p.data.project_id, user_id: g.a.user.id });
  if (ins.error) return dbFail(ins.error);
  try {
    return ok({ ok: true, projetos: await loadProjetos(g.a.supabase, g.a.user.id, id.data) }, 201);
  } catch {
    return unavailable();
  }
}
