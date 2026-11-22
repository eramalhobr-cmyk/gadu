import { NextResponse } from "next/server";
import { z } from "zod";
import { collectAttention } from "@/lib/core/collect";
import { coreEnabled } from "@/lib/core/flag";
import { toItem } from "@/lib/core/format";
import { googleReader } from "@/lib/core/google-adapter";
import { planFor } from "@/lib/core/plan";
import { signedIn } from "../google/_auth";

export const dynamic = "force-dynamic";

const Query = z.object({ limit: z.coerce.number().int().min(1).max(12).default(8) }).strict();

// Cartão "Merece sua atenção" da tela Hoje: o mesmo Core do chat, SEM IA (custo zero de modelo).
// Sessão obrigatória. Escopo = só o usuário da sessão. Consultas com a sessão dele (RLS), nunca a chave secreta.
export async function GET(request: Request) {
  const a = await signedIn();
  if (!a) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });
  const q = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!q.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  // Interruptor de emergência: CORE_MVP=0 esconde o cartão (a tela Hoje volta a ser a de antes).
  if (!coreEnabled()) return NextResponse.json({ enabled: false }, { headers: { "cache-control": "no-store" } });
  try {
    // Sem as regras de privacidade não dá para filtrar: falha fechada.
    const { data: profile, error } = await a.supabase.from("profiles").select("settings").eq("id", a.user.id).maybeSingle();
    if (error) throw new Error("perfil");
    const blocked = Array.isArray(profile?.settings?.blocked) ? (profile.settings.blocked as unknown[]).map(String) : [];
    const r = await collectAttention({
      userId: a.user.id, db: a.supabase, google: googleReader(a.supabase, a.user.id), blocked,
      plan: planFor("atencao_hoje", { maxFacts: q.data.limit }),
    });
    return NextResponse.json(
      { enabled: true, items: r.facts.map(toItem), more: r.more, unavailable: r.unavailable.map((u) => ({ source: u.source, reason: u.reason, text: u.text })) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    console.error("attention indisponível");
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
