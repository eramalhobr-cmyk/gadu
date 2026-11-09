import { NextResponse } from "next/server";
import { z } from "zod";
import { disconnect } from "@/lib/google";
import { signedIn } from "../_auth";

export const dynamic = "force-dynamic";

const Body = z.object({ confirm: z.literal(true) }).strict();

// Desconecta: revoga o acesso no Google e apaga o token guardado.
export async function POST(request: Request) {
  const a = await signedIn();
  if (!a) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!Body.safeParse(await request.json().catch(() => null)).success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  await disconnect(a.supabase, a.user.id);
  return NextResponse.json({ ok: true });
}
