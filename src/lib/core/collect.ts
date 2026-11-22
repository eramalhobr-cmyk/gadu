// Coleta do "atenção hoje": consulta as fontes em paralelo, numera, prioriza e aplica os limites de volume.
// Escopo: SEMPRE só o user_id da sessão. Consultas com o cliente da sessão (RLS), nunca a chave secreta.
import { spNow } from "../briefing.ts";
import { fitFacts } from "./format.ts";
import { planFor, type Plan } from "./plan.ts";
import { personalUserId, resolveScopes } from "./scopes.ts";
import { collectAgenda } from "./sources/agenda.ts";
import { collectEmail } from "./sources/email.ts";
import { collectReminders } from "./sources/reminders.ts";
import { collectTasks } from "./sources/tasks.ts";
import type { AttentionFact, CoreResult, FactKind, GoogleReader, RawFact, SessionDb, SourceCtx, SourceResult, Unavailable } from "./types.ts";

export type CollectInput = {
  /** Identidade da SESSÃO (auth.getUser no servidor). O contexto do cliente não entra aqui. */
  userId: string;
  /** Cliente com a sessão da pessoa (RLS). */
  db: SessionDb;
  google: GoogleReader | null;
  blocked: string[];
  now?: Date;
  plan?: Plan;
};

const TAG: Record<FactKind, string> = { atrasada: "T", tarefa_hoje: "T", prioridade: "T", lembrete: "L", evento: "A", email: "E" };

export async function collectAttention(input: CollectInput): Promise<CoreResult> {
  const scopes = resolveScopes({ userId: input.userId });
  const userId = personalUserId(scopes);
  const plan = input.plan ?? planFor("atencao_hoje");
  const now = input.now ?? new Date();
  const sp = spNow(now.getTime());
  const ctx: SourceCtx = {
    db: input.db, userId, now, day: sp.day, dayStart: sp.start, dayEnd: new Date(sp.start.getTime() + 86_400_000), blocked: input.blocked,
  };

  // Status do Google (conectado? quais escopos?) uma vez só, para agenda e e-mail.
  let status: { connected: boolean; scopes: string[] } | null = null;
  let statusFailed = false;
  if (input.google) {
    try { status = await input.google.status(); } catch { statusFailed = true; }
  }
  const failed = (source: "agenda" | "email"): SourceResult => ({
    facts: [],
    unavailable: { source, reason: "error", text: source === "agenda" ? "Não consegui ler a agenda agora." : "Não consegui ler seus e-mails agora." },
  });

  const run = async (p: Promise<SourceResult>, fallback: SourceResult): Promise<SourceResult> => { try { return await p; } catch { return fallback; } };
  const [tasks, reminders, agenda, email] = await Promise.all([
    run(collectTasks(ctx), { facts: [], unavailable: { source: "tarefas", reason: "error", text: "Não consegui ler suas tarefas agora." } }),
    run(collectReminders(ctx), { facts: [], unavailable: { source: "lembretes", reason: "error", text: "Não consegui ler seus lembretes agora." } }),
    statusFailed ? failed("agenda") : run(collectAgenda(ctx, input.google, status), failed("agenda")),
    statusFailed ? failed("email") : run(collectEmail(ctx, input.google, status), failed("email")),
  ]);

  // Prioridade: menor rank primeiro; empate mantém a ordem das fontes. Só entram fatos do user_id da sessão (as fontes só leem o dele).
  const raw: RawFact[] = [...tasks.facts, ...reminders.facts, ...agenda.facts, ...email.facts]
    .map((f, i) => ({ f, i }))
    .sort((a, b) => a.f.rank - b.f.rank || a.i - b.i)
    .map((x) => x.f);
  const counters: Record<string, number> = {};
  const numbered: AttentionFact[] = raw.map((f) => {
    const k = TAG[f.kind];
    counters[k] = (counters[k] ?? 0) + 1;
    return { ...f, tag: `${k}${counters[k]}` };
  });

  const unavailable = [tasks, reminders, agenda, email].map((s) => s.unavailable).filter((u): u is Unavailable => Boolean(u));
  const keep = fitFacts({ facts: numbered, unavailable }, plan.maxFacts, plan.maxChars);
  return { facts: numbered.slice(0, keep), unavailable, more: numbered.length - keep };
}
