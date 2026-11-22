import { loadMeta, GOAL_COLS, toGoal } from "@/lib/goals/load";
import { GoalPatch, IdParam } from "@/lib/goals/schemas";
import { dbFail, goalsGuard, hojeIso, invalid, notFound, ok, readJson, unavailable } from "../_guard";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

// Detalhe: meta, histórico de progresso (com origem), marcos, tarefas vinculadas e tarefas abertas que ainda podem ser vinculadas.
export async function GET(_request: Request, ctx: Ctx) {
  const g = await goalsGuard();
  if ("res" in g) return g.res;
  const id = IdParam.safeParse((await ctx.params).id);
  if (!id.success) return invalid("Meta inválida.");
  try {
    const d = await loadMeta(g.a.supabase, g.a.user.id, id.data, hojeIso());
    if (!d) return notFound();
    const vinculadas = new Set(d.tarefas.map((t) => t.task_id));
    const abertas = await g.a.supabase.from("tasks").select("id, title, due_date").eq("user_id", g.a.user.id).eq("status", "open").order("created_at", { ascending: false }).limit(60);
    if (abertas.error) return unavailable();
    const tarefasAbertas = ((abertas.data ?? []) as { id: number; title: string; due_date: string | null }[]).filter((t) => !vinculadas.has(Number(t.id))).slice(0, 30)
      .map((t) => ({ id: Number(t.id), title: t.title, due_date: t.due_date }));
    return ok({ ...d, tarefasAbertas });
  } catch {
    return unavailable();
  }
}

// Edita campos, pausa, conclui, reativa ou arquiva (status). O tipo de medição, o valor inicial e a agregação não mudam.
export async function PATCH(request: Request, ctx: Ctx) {
  const g = await goalsGuard();
  if ("res" in g) return g.res;
  const id = IdParam.safeParse((await ctx.params).id);
  if (!id.success) return invalid("Meta inválida.");
  const p = GoalPatch.safeParse(await readJson(request));
  if (!p.success) return invalid("Confira os dados.");
  const atual = await g.a.supabase.from("goals").select(GOAL_COLS).eq("id", id.data).maybeSingle();
  if (atual.error) return dbFail(atual.error);
  if (!atual.data) return notFound();
  const goal = toGoal(atual.data as Record<string, unknown>);

  const patch: Record<string, unknown> = { ...p.data, updated_at: new Date().toISOString() };
  if (p.data.valor_alvo !== undefined && goal.medicao !== "numerica") return invalid("Só metas numéricas têm alvo.");
  if (p.data.unidade !== undefined && goal.medicao !== "numerica") return invalid("Só metas numéricas têm unidade.");
  const categoria = p.data.categoria ?? goal.categoria;
  if (p.data.categoria !== undefined || p.data.categoria_nome !== undefined) {
    const nome = p.data.categoria_nome !== undefined ? p.data.categoria_nome : goal.categoria_nome;
    if (categoria === "personalizada" && !nome) return invalid("Dê um nome à categoria.");
    patch.categoria_nome = categoria === "personalizada" ? nome : null;
  }
  if (p.data.status !== undefined) patch.concluida_em = p.data.status === "concluida" ? (goal.concluida_em ?? new Date().toISOString()) : null;
  const { error, data } = await g.a.supabase.from("goals").update(patch).eq("id", id.data).select("id");
  if (error) return dbFail(error);
  if (!data || data.length === 0) return notFound();
  try {
    const d = await loadMeta(g.a.supabase, g.a.user.id, id.data, hojeIso());
    return ok({ meta: d?.meta ?? null });
  } catch {
    return unavailable();
  }
}
