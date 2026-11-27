import { NextResponse } from "next/server";
import { z } from "zod";
import { serverConfig } from "@/lib/config";
import { intervaloMes, lerPaginado, MesSchema, mesDe, porPessoa, total, type LinhaUso, type Pessoa } from "@/lib/consumo";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { adminOnly } from "../_admin";

export const dynamic = "force-dynamic";

const Query = z.object({ mes: MesSchema.optional() }).strict();

// Consumo de IA do mês por pessoa (por tipo e motor), teto e % usado. Só administrador.
// Privacidade: a pessoa aparece só por nome e e-mail; nada de conversa, texto ou outro dado.
// O teto individual mora em private.user_budget, fora da API. Ele só é lido pela função
// server_budget_limits (proposta, ainda sem migração); sem ela, mostra o teto padrão do servidor.
export async function GET(request: Request) {
  const a = await adminOnly();
  if (!a) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const q = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!q.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const atual = mesDe(new Date());
  const mes = q.data.mes ?? atual;
  if (mes > atual) return NextResponse.json({ error: "invalid", message: "Mês no futuro." }, { status: 400 });

  const db = supabaseAdmin();
  const { inicio, fim } = intervaloMes(mes);
  const [lidas, { data: members, error: mErr }, { data: perfis }, { data: users }] = await Promise.all([
    lerPaginado<LinhaUso>((de, ate) =>
      db.from("usage_events").select("user_id, provider, model, kind, input_tokens, cost_usd, created_at")
        .gte("created_at", inicio).lt("created_at", fim).order("id").range(de, ate)),
    db.from("members").select("user_id").order("created_at"),
    db.from("profiles").select("id, display_name"),
    db.auth.admin.listUsers({ page: 1, perPage: 200 }),
  ]);
  if (!lidas || mErr) return NextResponse.json({ error: "load" }, { status: 500 });

  const nomes = new Map(((perfis ?? []) as { id: string; display_name: string | null }[]).map((p) => [p.id, p.display_name]));
  const emails = new Map((users?.users ?? []).map((u) => [u.id, u.email ?? null]));
  const pessoas: Pessoa[] = ((members ?? []) as { user_id: string }[]).map((m) => ({
    id: m.user_id,
    nome: nomes.get(m.user_id) ?? null,
    email: emails.get(m.user_id) ?? null,
  }));

  // Teto por pessoa vindo do banco, quando a função existir. Erro ou ausência: teto padrão do servidor (aproximado).
  const ids = [...new Set([...pessoas.map((p) => p.id), ...lidas.linhas.map((l) => l.user_id).filter((x): x is string => !!x)])];
  const tetos = new Map<string, { valor: number; proprio: boolean }>();
  let tetoFonte: "banco" | "servidor" = "servidor";
  if (ids.length) {
    const r = await db.rpc("server_budget_limits", { p_users: ids });
    if (!r.error && Array.isArray(r.data)) {
      tetoFonte = "banco";
      for (const row of r.data as { user_id: string; monthly_limit_usd: number | string; custom: boolean }[]) {
        const v = Number(row.monthly_limit_usd);
        if (Number.isFinite(v) && v >= 0) tetos.set(row.user_id, { valor: v, proprio: !!row.custom });
      }
    }
  }
  const lista = porPessoa(lidas.linhas, pessoas, tetos, tetoFonte === "banco" ? null : serverConfig().monthlyBudgetUsd);
  return NextResponse.json(
    { mes, total: total(lidas.linhas), pessoas: lista, tetoFonte, completo: lidas.completo },
    { headers: { "cache-control": "no-store" } },
  );
}
