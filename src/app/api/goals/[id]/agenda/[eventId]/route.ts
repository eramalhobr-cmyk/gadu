import { accessToken, deleteEvent, GoogleError } from "@/lib/google";
import { fail } from "../../../../calendar/_fail";
import { loadAgenda } from "@/lib/goals/load";
import { EventIdParam, IdParam } from "@/lib/goals/schemas";
import { dbFail, goalsGuard, invalid, notFound, ok } from "../../../_guard";

export const dynamic = "force-dynamic";

// Libera um bloco: apaga o evento no Google e a ligação com a meta. Só mexe em evento que o GaDu reservou para uma meta da própria pessoa
// (a linha de goal_events precisa existir para a sessão): esta rota nunca apaga outro evento da agenda.
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string; eventId: string }> }) {
  const g = await goalsGuard();
  if ("res" in g) return g.res;
  const { id: rawId, eventId: rawEvent } = await ctx.params;
  const id = IdParam.safeParse(rawId), eventId = EventIdParam.safeParse(rawEvent);
  if (!id.success || !eventId.success) return invalid("Bloco inválido.");
  const row = await g.a.supabase.from("goal_events").select("event_id").eq("user_id", g.a.user.id).eq("goal_id", id.data).eq("event_id", eventId.data).maybeSingle();
  if (row.error) return dbFail(row.error);
  if (!row.data) return notFound();
  try {
    const token = await accessToken(g.a.supabase, g.a.user.id);
    await deleteEvent(token, eventId.data);
  } catch (e) {
    // Evento já apagado no Google: só limpa a ligação. Qualquer outro erro mantém tudo como está.
    if (!(e instanceof GoogleError && e.kind === "gone")) return fail(e);
  }
  const del = await g.a.supabase.from("goal_events").delete().eq("user_id", g.a.user.id).eq("goal_id", id.data).eq("event_id", eventId.data);
  if (del.error) return dbFail(del.error);
  const agenda = await loadAgenda(g.a.supabase, g.a.user.id, id.data).catch(() => []);
  return ok({ ok: true, agenda });
}
