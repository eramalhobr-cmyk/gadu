// Fonte: Gmail, só leitura, enxuta: poucos e-mails não lidos recentes (48 h), só remetente e assunto. Sem corpo nem trecho.
import { hidden } from "../privacy.ts";
import { OMITTED, type GoogleReader, type RawFact, type SourceCtx, type SourceResult } from "../types.ts";
import { googleProblem } from "./agenda.ts";

export const EMAIL_LIMIT = 5;
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export async function collectEmail(ctx: SourceCtx, google: GoogleReader | null, status: { connected: boolean; scopes: string[] } | null): Promise<SourceResult> {
  if (!google || !status || !status.connected) return { facts: [], unavailable: googleProblem("email", { kind: "not_connected" }) };
  // Sem o escopo do Gmail já concedido, não tenta (nada de pedir acesso novo aqui).
  if (!status.scopes.includes(GMAIL_SCOPE)) return { facts: [], unavailable: { source: "email", reason: "scope", text: "O acesso ao Gmail não foi concedido. Reconecte o Google em Ajustes para incluir e-mails." } };
  try {
    const mails = await google.inbox(8);
    // Importantes primeiro; o resto só completa até o limite.
    const sorted = [...mails].sort((a, b) => Number(b.important) - Number(a.important)).slice(0, EMAIL_LIMIT);
    const facts: RawFact[] = sorted.map((m, i) => {
      // O trecho (snippet) só serve para checar privacidade; nunca entra no fato.
      const omitted = hidden(`${m.from} ${m.subject} ${m.snippet}`, ctx.blocked);
      return {
        module: "pessoal", scope: "pessoal", source: { table: "gmail", id: m.thread ?? `i${i}` },
        kind: "email", label: m.important ? "E-mail importante" : "E-mail não lido", view: "hoje", omitted,
        href: m.thread ? `https://mail.google.com/mail/u/0/#inbox/${m.thread}` : "https://mail.google.com/mail/u/0/#inbox",
        rank: m.important ? 60 : 80,
        text: `${m.important ? "E-mail importante" : "E-mail não lido"}, ${omitted ? OMITTED : `de ${m.from.slice(0, 60)}: "${m.subject.slice(0, 120)}"`}`,
      };
    });
    return { facts };
  } catch (e) {
    return { facts: [], unavailable: googleProblem("email", e) };
  }
}
