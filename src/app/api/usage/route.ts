import { NextResponse } from "next/server";
import { getVercelOidcToken } from "@vercel/oidc";
import { z } from "zod";
import { readBudgets, serverConfig } from "@/lib/config";
import { accessOf } from "@/lib/access";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Saldo real do AI Gateway da Vercel. A Anthropic não tem API de saldo: lá mostramos só o gasto estimado. */
async function gatewayCredits(): Promise<{ balance: number; used: number } | null> {
  try {
    const key = process.env.AI_GATEWAY_API_KEY || (process.env.VERCEL ? await getVercelOidcToken() : "");
    if (!key) return null;
    const r = await fetch("https://ai-gateway.vercel.sh/v1/credits", { headers: { authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const j = (await r.json()) as { balance?: string; total_used?: string };
    const balance = Number(j.balance), used = Number(j.total_used);
    return Number.isFinite(balance) ? { balance, used: Number.isFinite(used) ? used : 0 } : null;
  } catch {
    return null;
  }
}

async function auth() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user || !(await accessOf(supabase, data.user)).ok) return null;
  return { supabase, user: data.user };
}

export async function GET() {
  const a = await auth();
  if (!a) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [profile, spend, credits, status] = await Promise.all([
    a.supabase.from("profiles").select("settings").eq("id", a.user.id).maybeSingle(),
    a.supabase.rpc("month_spend_by_provider"),
    gatewayCredits(),
    a.supabase.rpc("budget_status"),
  ]);
  // Teto e reservas do banco (fonte da verdade desde o orçamento com reserva). Sem a função, usa o teto do servidor.
  const st = (status.data ?? null) as { spent?: unknown; reserved?: unknown; limit?: unknown } | null;
  const num = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null);
  const limit = num(st?.limit);
  const reserved = num(st?.reserved) ?? 0;
  const by: Record<string, number> = { anthropic: 0, gateway: 0, gemini: 0 };
  for (const row of (spend.data ?? []) as { provider: string; cost_usd: number | string }[]) by[row.provider] = Number(row.cost_usd) || 0;
  return NextResponse.json(
    {
      budgets: readBudgets(profile.data?.settings),
      spent: by,
      total: by.anthropic + by.gateway + by.gemini,
      monthlyBudget: limit ?? serverConfig().monthlyBudgetUsd,
      reserved,
      gateway: credits,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

const Body = z.object({
  budgets: z.object({ anthropic: z.number().min(0).max(1000), gateway: z.number().min(0).max(1000) }).strict(),
}).strict();

export async function POST(request: Request) {
  const a = await auth();
  if (!a) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const round = (n: number) => Math.round(n * 100) / 100;
  const { data } = await a.supabase.from("profiles").select("settings").eq("id", a.user.id).maybeSingle();
  const settings = { ...((data?.settings as object) ?? {}), budgets: { anthropic: round(parsed.data.budgets.anthropic), gateway: round(parsed.data.budgets.gateway) } };
  const { error } = await a.supabase.from("profiles").update({ settings }).eq("id", a.user.id);
  if (error) return NextResponse.json({ error: "save" }, { status: 500 });
  return NextResponse.json({ ok: true, budgets: settings.budgets });
}
