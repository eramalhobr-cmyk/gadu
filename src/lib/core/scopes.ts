// Escopos do Core. A identidade vem SÓ da sessão (auth.getUser no servidor).
// O contexto enviado pelo cliente ({ module, view }) é um rótulo: nunca autoriza nem amplia escopo.
import type { CoreScope } from "../core-context.ts";

/** No MVP o escopo é sempre e somente os dados pessoais de quem está logado. */
export function resolveScopes(session: { userId: string }, _clientHint?: unknown): CoreScope[] {
  if (!session.userId) throw new Error("sessão sem usuário");
  return [{ kind: "pessoal", userId: session.userId }];
}

/** O único user_id que o Core pode consultar, a partir dos escopos resolvidos. */
export function personalUserId(scopes: CoreScope[]): string {
  const s = scopes.find((x) => x.kind === "pessoal");
  if (!s || s.kind !== "pessoal") throw new Error("sem escopo pessoal");
  return s.userId;
}
