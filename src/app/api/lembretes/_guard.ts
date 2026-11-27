import { NextResponse } from "next/server";
import { MSG } from "@/lib/errors";
import { signedIn } from "../google/_auth";

export function resposta(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** Sessão e acesso (pessoa bloqueada ou sem login: 401). A RLS da tabela reminders faz o resto. */
export async function lembretesGuard() {
  const a = await signedIn();
  if (!a) return { ok: false, res: resposta({ error: "unauthorized", message: MSG.session }, 401) } as const;
  return { ok: true, a } as const;
}

export function falha(error?: { code?: string } | null, leitura = false) {
  if (error?.code === "42501") return resposta({ error: "forbidden" }, 403);
  return resposta({ message: leitura ? "Não consegui carregar os lembretes. Tente de novo." : MSG.save }, 503);
}
