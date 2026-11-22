// Fonte: agenda de hoje no Google Calendar (só leitura, escopo calendar.readonly).
import { hidden } from "../privacy.ts";
import { OMITTED, type GoogleReader, type RawFact, type SourceCtx, type SourceResult, type Unavailable } from "../types.ts";

export const AGENDA_LIMIT = 12;
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

const hm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

export function googleProblem(source: "agenda" | "email", e: unknown): Unavailable {
  const kind = (e as { kind?: string } | null)?.kind;
  const nome = source === "agenda" ? "agenda" : "Gmail";
  if (kind === "not_connected") return { source, reason: "not_connected", text: `Sua ${source === "agenda" ? "agenda" : "caixa de e-mail"} não está conectada.` };
  if (kind === "revoked") return { source, reason: "revoked", text: `O acesso do GaDu ao seu ${nome} foi revogado. Reconecte em Ajustes.` };
  return { source, reason: "error", text: source === "agenda" ? "Não consegui ler a agenda agora." : "Não consegui ler seus e-mails agora." };
}

export async function collectAgenda(ctx: SourceCtx, google: GoogleReader | null, status: { connected: boolean; scopes: string[] } | null): Promise<SourceResult> {
  if (!google || !status || !status.connected) return { facts: [], unavailable: googleProblem("agenda", { kind: "not_connected" }) };
  if (!status.scopes.includes(CALENDAR_SCOPE)) return { facts: [], unavailable: { source: "agenda", reason: "scope", text: "O GaDu não tem permissão para ler sua agenda. Reconecte o Google em Ajustes." } };
  try {
    const all = await google.events(ctx.dayStart, ctx.dayEnd);
    // Pela frente: dia inteiro, ou ainda não terminou. Recusados ficam de fora.
    const left = all.filter((e) => !e.declined && (e.allDay || new Date(e.end) > ctx.now)).slice(0, AGENDA_LIMIT);
    const facts: RawFact[] = left.map((e, i) => {
      const omitted = hidden(`${e.title} ${e.where ?? ""}`, ctx.blocked);
      const live = !e.allDay && new Date(e.start) <= ctx.now;
      const when = e.allDay ? "dia todo" : `${hm(e.start)}–${hm(e.end)}${live ? ", agora" : ""}`;
      return {
        module: "pessoal", scope: "pessoal", source: { table: "google_calendar", id: e.id ?? `i${i}` },
        kind: "evento", label: "Compromisso", view: "agenda", omitted,
        rank: i < 2 ? 30 + i : 70,
        text: `Agenda ${when}: ${omitted ? OMITTED : `${e.title.slice(0, 140)}${e.meet ? " (online)" : ""}${e.where ? ` · ${e.where.slice(0, 80)}` : ""}`}`,
      };
    });
    return { facts };
  } catch (e) {
    return { facts: [], unavailable: googleProblem("agenda", e) };
  }
}
