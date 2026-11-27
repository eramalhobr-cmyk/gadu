import { NextResponse } from "next/server";
import { z } from "zod";
import { accessOf } from "@/lib/access";
import { serverConfig } from "@/lib/config";
import { falta, intervaloMes, lerPaginado, mesDe, porMes, porTipo, total, ultimosMeses, type LinhaUso } from "@/lib/consumo";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const Query = z.object({ meses: z.coerce.number().int().min(1).max(6).default(3) }).strict();

// Gasto detalhado da própria pessoa: por tipo no mês atual e total dos últimos meses. Só leitura.
// Cliente da sessão (RLS em usage_events): o id vem sempre da sessão, nunca da requisição (S-01).
export async function GET(request: Request) {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user || !(await accessOf(supabase, data.user)).ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!q.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const mes = mesDe(new Date());
  const meses = ultimosMeses(mes, q.data.meses);
  const { inicio } = intervaloMes(meses[meses.length - 1]);
  const { inicio: inicioMes } = intervaloMes(mes);
  const uid = data.user.id;
  const [lidas, status] = await Promise.all([
    lerPaginado<LinhaUso>((de, ate) =>
      supabase.from("usage_events").select("provider, model, kind, input_tokens, cost_usd, created_at")
        .eq("user_id", uid).gte("created_at", inicio).order("created_at", { ascending: false }).range(de, ate)),
    supabase.rpc("budget_status"),
  ]);
  if (!lidas) return NextResponse.json({ error: "load" }, { status: 500 });

  const st = (status.data ?? null) as { reserved?: unknown; limit?: unknown } | null;
  const n = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null);
  const teto = n(st?.limit) ?? serverConfig().monthlyBudgetUsd;
  const reservado = n(st?.reserved) ?? 0;
  const desde = Date.parse(inicioMes);
  const doMes = lidas.linhas.filter((l) => Date.parse(l.created_at) >= desde);
  const gasto = total(doMes);
  return NextResponse.json(
    {
      mes,
      gasto,
      teto,
      reservado,
      falta: falta(teto, gasto, reservado),
      tipos: porTipo(doMes),
      meses: porMes(lidas.linhas, meses),
      completo: lidas.completo,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
