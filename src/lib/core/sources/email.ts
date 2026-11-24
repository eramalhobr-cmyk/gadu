// Fonte: Gmail, só leitura, enxuta: poucos e-mails não lidos recentes (48 h), só remetente e assunto. Sem corpo nem trecho.
// Só entram e-mails críticos ou importantes, já passados pelas regras das memórias aprovadas (src/lib/email-regras.ts).
import { aplicarRegras, SEM_REGRAS, type RegrasEmail } from "../../email-regras.ts";
import { hidden } from "../privacy.ts";
import { OMITTED, type GoogleReader, type RawFact, type SourceCtx, type SourceResult } from "../types.ts";
import { googleProblem } from "./agenda.ts";
import { gmailLink } from "../../gmail-link.ts";

export const EMAIL_LIMIT = 5;
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export async function collectEmail(ctx: SourceCtx, google: GoogleReader | null, status: { connected: boolean; scopes: string[]; email?: string | null } | null, regras: RegrasEmail = SEM_REGRAS): Promise<SourceResult> {
  if (!google || !status || !status.connected) return { facts: [], unavailable: googleProblem("email", { kind: "not_connected" }) };
  // Sem o escopo do Gmail já concedido, não tenta (nada de pedir acesso novo aqui).
  if (!status.scopes.includes(GMAIL_SCOPE)) return { facts: [], unavailable: { source: "email", reason: "scope", text: "O acesso ao Gmail não foi concedido. Reconecte o Google em Ajustes para incluir e-mails." } };
  try {
    const mails = aplicarRegras(await google.inbox(8), regras);
    // Só crítico e importante entram: e-mail comum ou de baixa prioridade não disputa atenção. Críticos primeiro.
    const sorted = mails
      .filter((m) => m.nivel === "critico" || m.nivel === "importante")
      .sort((a, b) => Number(b.nivel === "critico") - Number(a.nivel === "critico"))
      .slice(0, EMAIL_LIMIT);
    const facts: RawFact[] = sorted.map((m, i) => {
      // O trecho (snippet) só serve para checar privacidade; nunca entra no fato.
      const omitted = hidden(`${m.from} ${m.subject} ${m.snippet}`, ctx.blocked);
      const label = m.nivel === "critico" ? "E-mail crítico" : "E-mail importante";
      return {
        module: "pessoal", scope: "pessoal", source: { table: "gmail", id: m.thread ?? `i${i}` },
        kind: "email", label, view: "hoje", omitted,
        href: gmailLink(m.thread, status.email),
        rank: m.nivel === "critico" ? 28 : 60,
        ...(omitted ? {} : { de: (m.fromEmail ? `${m.from} <${m.fromEmail}>` : m.from).slice(0, 160) }),
        text: `${label}, ${omitted ? OMITTED : `de ${m.from.slice(0, 60)}: "${m.subject.slice(0, 120)}"`}`,
      };
    });
    return { facts };
  } catch (e) {
    return { facts: [], unavailable: googleProblem("email", e) };
  }
}
