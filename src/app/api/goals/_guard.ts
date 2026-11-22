import { NextResponse } from "next/server";
import { goalsEnabled } from "@/lib/goals/flag";
import { hojeSP, isoDia } from "@/lib/finance/datas";
import { signedIn } from "../google/_auth";

export const NO_STORE = { "cache-control": "no-store" };

/**
 * Porta de entrada de toda rota de Metas: sessão obrigatória (401), depois o interruptor GOALS_ENABLED (404).
 * O user_id vem SEMPRE da sessão; as consultas usam o cliente da sessão (RLS), nunca a chave secreta.
 */
export async function goalsGuard() {
  const a = await signedIn();
  if (!a) return { res: NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE }) } as const;
  if (!goalsEnabled()) return { res: NextResponse.json({ error: "disabled" }, { status: 404, headers: NO_STORE }) } as const;
  return { a } as const;
}

export const invalid = (message = "Confira os dados.") => NextResponse.json({ error: "invalid", message }, { status: 400, headers: NO_STORE });
export const notFound = () => NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
export const ok = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });
export const unavailable = () => NextResponse.json({ error: "unavailable" }, { status: 503, headers: NO_STORE });

/** Erro do banco → resposta. Violação de CHECK, chave ou formato é problema do pedido (400); o resto é 503 sem detalhes. */
export function dbFail(error: { code?: string } | null | undefined) {
  const code = error?.code ?? "";
  if (["23514", "23503", "22P02", "22008", "22003"].includes(code)) return invalid("Confira os dados.");
  if (code === "23505") return NextResponse.json({ error: "conflict" }, { status: 409, headers: NO_STORE });
  console.error("goals: erro de banco", code || "desconhecido");
  return unavailable();
}

export async function readJson(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}

/** Hoje em Brasília, AAAA-MM-DD. */
export const hojeIso = () => isoDia(hojeSP());
