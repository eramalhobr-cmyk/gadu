// Fonte: lembretes pendentes até o fim do dia (Brasília). Cliente com a sessão da pessoa (RLS).
import { hidden } from "../privacy.ts";
import { OMITTED, type RawFact, type SourceCtx, type SourceResult } from "../types.ts";

export const REMINDERS_LIMIT = 10;

type Row = { id: number; text: string; due_at: string };

export function remindersQuery(ctx: SourceCtx) {
  // Pendentes até o fim de hoje; atrasados só das últimas 48 h (lembrete muito antigo não é "atenção de hoje").
  const since = new Date(ctx.now.getTime() - 48 * 3_600_000).toISOString();
  return ctx.db
    .from("reminders")
    .select("id, text, due_at")
    .eq("user_id", ctx.userId)
    .eq("status", "pending")
    .gte("due_at", since)
    .lt("due_at", ctx.dayEnd.toISOString())
    .order("due_at")
    .limit(REMINDERS_LIMIT);
}

const hm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

export async function collectReminders(ctx: SourceCtx): Promise<SourceResult> {
  const { data, error } = (await remindersQuery(ctx)) as { data: Row[] | null; error: unknown };
  if (error) return { facts: [], unavailable: { source: "lembretes", reason: "error", text: "Não consegui ler seus lembretes agora." } };
  const facts: RawFact[] = (data ?? []).map((r) => {
    const omitted = hidden(r.text, ctx.blocked);
    const past = new Date(r.due_at) < ctx.dayStart;
    return {
      module: "pessoal", scope: "pessoal", source: { table: "reminders", id: r.id },
      kind: "lembrete", label: "Lembrete", view: "hoje", omitted, rank: 25,
      text: `Lembrete ${past ? "que passou" : hm(r.due_at)}: ${omitted ? OMITTED : r.text.slice(0, 200)}`,
    };
  });
  return { facts };
}
