import { NextResponse } from "next/server";
import { modeling3dEnabled } from "@/lib/3d/flag";
import { signedIn } from "../google/_auth";

export const NO_STORE = { "cache-control": "no-store" };

/**
 * Porta de entrada de toda rota do 3D Studio: sessão obrigatória (401), depois o interruptor MODELING_3D_ENABLED (404 se não for "1").
 * O user_id vem SEMPRE da sessão.
 */
export async function modeling3dGuard() {
  const a = await signedIn();
  if (!a) return { res: NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE }) } as const;
  if (!modeling3dEnabled()) return { res: NextResponse.json({ error: "disabled" }, { status: 404, headers: NO_STORE }) } as const;
  return { a } as const;
}

export const fail = (status: number, error: string, message: string) => NextResponse.json({ error, message }, { status, headers: NO_STORE });
