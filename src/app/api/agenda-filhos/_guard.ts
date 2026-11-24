import { NextResponse } from "next/server";
import { agendaFilhosEnabled } from "@/lib/filhos/flag";
import { signedIn } from "../google/_auth";

export function resposta(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function filhosGuard() {
  const a = await signedIn();
  if (!a) return { ok: false, res: resposta({ error: "unauthorized" }, 401) } as const;
  if (!agendaFilhosEnabled()) return { ok: false, res: resposta({ error: "disabled" }, 404) } as const;
  return { ok: true, a } as const;
}

export function falha(error?: { code?: string } | null) {
  if (error?.code === "42501") return resposta({ error: "forbidden" }, 403);
  return resposta({ message: "Não consegui acessar a Agenda de filhos. Tente de novo." }, 503);
}

/** Hoje em Brasília, AAAA-MM-DD. */
export const hojeIso = (now = Date.now()) => new Date(now - 3 * 3_600_000).toISOString().slice(0, 10);
