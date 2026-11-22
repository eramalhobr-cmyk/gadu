import { ordinal, lerData } from "@/lib/finance/datas";
import { GOAL_COLS, loadMeta, PROGRESS_COLS, toGoal, toRegistro } from "@/lib/goals/load";
import { IdParam, ProgressoCreate } from "@/lib/goals/schemas";
import { dbFail, goalsGuard, hojeIso, invalid, notFound, ok, readJson, unavailable } from "../../_guard";

export const dynamic = "force-dynamic";

// Registra progresso (com data e ORIGEM). Metas por marcos ou tarefas não recebem valor. user_id = sessão.
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await goalsGuard();
  if ("res" in g) return g.res;
  const id = IdParam.safeParse((await ctx.params).id);
  if (!id.success) return invalid("Meta inválida.");
  const p = ProgressoCreate.safeParse(await readJson(request));
  if (!p.success) return invalid("Confira o valor e a data.");
  const found = await g.a.supabase.from("goals").select(GOAL_COLS).eq("id", id.data).maybeSingle();
  if (found.error) return dbFail(found.error);
  if (!found.data) return notFound();
  const goal = toGoal(found.data as Record<string, unknown>);

  if (goal.status === "arquivada" || goal.status === "concluida") return invalid("Reative a meta para registrar progresso.");
  if (goal.medicao === "marcos" || goal.medicao === "tarefas") return invalid("Esta meta é medida por marcos ou tarefas: conclua um marco ou uma tarefa.");
  const v = p.data.valor;
  if (goal.medicao === "percentual" && (v < 0 || v > 100)) return invalid("O percentual vai de 0 a 100.");
  if (goal.medicao === "numerica" && (goal.agregacao === "soma" ? v <= 0 : v < 0)) return invalid(goal.agregacao === "soma" ? "Informe um valor maior que zero." : "Informe uma medida válida.");
  const hoje = hojeIso();
  const data = p.data.data ?? hoje;
  const d = lerData(data)!, h = lerData(hoje)!;
  if (ordinal(d) > ordinal(h)) return invalid("A data não pode ser no futuro.");
  if (ordinal(d) < ordinal(h) - 366) return invalid("A data é antiga demais.");

  const ins = await g.a.supabase.from("goal_progress").insert({ goal_id: id.data, valor: v, data, origem: p.data.origem, nota: p.data.nota ?? null, user_id: g.a.user.id }).select(PROGRESS_COLS).single();
  if (ins.error || !ins.data) return dbFail(ins.error);
  await g.a.supabase.from("goals").update({ updated_at: new Date().toISOString() }).eq("id", id.data);
  try {
    const det = await loadMeta(g.a.supabase, g.a.user.id, id.data, hoje);
    return ok({ registro: toRegistro(ins.data as Record<string, unknown>), meta: det?.meta ?? null }, 201);
  } catch {
    return unavailable();
  }
}
