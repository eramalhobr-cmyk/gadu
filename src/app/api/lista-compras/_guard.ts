import { NextResponse } from "next/server";
import { listaComprasEnabled } from "@/lib/lista-compras/flag";
import { signedIn } from "../google/_auth";

export function resposta(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function listaGuard() {
  const a = await signedIn();
  if (!a) return { res: resposta({ error: "unauthorized" }, 401) } as const;
  if (!listaComprasEnabled()) return { res: resposta({ error: "disabled" }, 404) } as const;
  return { a } as const;
}

export function falha(error?: { code?: string } | null) {
  if (error?.code === "23505") return resposta({ message: "Este item já está na lista." }, 409);
  if (error?.code === "42501") return resposta({ error: "forbidden" }, 403);
  return resposta({ message: "Não consegui acessar a lista de compras. Tente de novo." }, 503);
}
