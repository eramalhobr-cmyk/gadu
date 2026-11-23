import { accessToken, createEvent, deleteEvent } from "@/lib/google";
import { fail } from "../../../calendar/_fail";
import { loadAgenda } from "@/lib/goals/load";
import { AgendaCreate, IdParam } from "@/lib/goals/schemas";
import { dbFail, goalsGuard, invalid, notFound, ok, readJson } from "../../_guard";

export const dynamic = "force-dynamic";

// Reserva na agenda do Google (escopo calendar.events, o mesmo de criar evento) os blocos que o cartão mostrou e a pessoa confirmou,
// e guarda a ligação com a meta. O título vem da meta (nunca do cliente). Se um bloco falhar, os já criados nesta chamada são desfeitos.
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await goalsGuard();
  if ("res" in g) return g.res;
  const id = IdParam.safeParse((await ctx.params).id);
  if (!id.success) return invalid("Meta inválida.");
  const p = AgendaCreate.safeParse(await readJson(request));
  if (!p.success) return invalid("Confira os horários.");
  const agora = Date.now();
  for (const b of p.data.blocos) {
    const ini = Date.parse(b.inicio), fim = Date.parse(b.fim);
    if (!(fim > ini) || fim - ini > 24 * 3_600_000 || ini < agora - 60_000 || ini > agora + 366 * 86_400_000) return invalid("Cada bloco precisa terminar depois de começar (no máximo 24 horas) e ser daqui para a frente.");
  }
  const goal = await g.a.supabase.from("goals").select("id, titulo, status").eq("user_id", g.a.user.id).eq("id", id.data).maybeSingle();
  if (goal.error) return dbFail(goal.error);
  if (!goal.data) return notFound();
  const { titulo, status } = goal.data as { titulo: string; status: string };
  if (status !== "ativa" && status !== "pausada") return invalid("Só metas ativas ou pausadas recebem horários.");
  const evTitulo = `Meta: ${titulo}`.slice(0, 160);
  const feitos: string[] = [];
  let token: string;
  try {
    token = await accessToken(g.a.supabase, g.a.user.id);
  } catch (e) {
    return fail(e);
  }
  const desfazer = async () => {
    for (const eid of feitos) {
      await deleteEvent(token, eid).catch(() => {});
      await g.a.supabase.from("goal_events").delete().eq("user_id", g.a.user.id).eq("goal_id", id.data).eq("event_id", eid);
    }
  };
  for (const b of p.data.blocos) {
    try {
      const ev = await createEvent(token, { title: evTitulo, start: b.inicio, end: b.fim, description: "Bloco da meta, criado pelo GaDu." });
      const ins = await g.a.supabase.from("goal_events").insert({ goal_id: id.data, event_id: ev.id, titulo: evTitulo, inicio: b.inicio, fim: b.fim, user_id: g.a.user.id });
      if (ins.error) {
        await deleteEvent(token, ev.id).catch(() => {});
        await desfazer();
        return dbFail(ins.error);
      }
      feitos.push(ev.id);
    } catch (e) {
      await desfazer();
      return fail(e);
    }
  }
  try {
    return ok({ ok: true, ids: feitos, agenda: await loadAgenda(g.a.supabase, g.a.user.id, id.data) }, 201);
  } catch {
    return ok({ ok: true, ids: feitos, agenda: [] }, 201);
  }
}

