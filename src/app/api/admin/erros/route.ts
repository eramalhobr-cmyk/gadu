import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { agrupar, type LinhaErro } from "@/lib/telemetria/agrupar";
import { telemetriaEnabled } from "@/lib/telemetria/flag";
import { adminOnly } from "../_admin";

export const dynamic = "force-dynamic";

// Últimos erros agrupados, só para administrador. Sem mensagem, e-mail ou nome de pessoa: a tabela nem guarda isso.
export async function GET() {
  const a = await adminOnly();
  if (!a) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!telemetriaEnabled()) return NextResponse.json({ ligado: false, disponivel: false, grupos: [], total24h: 0, total7d: 0 });
  const db = supabaseAdmin();
  const dia = new Date(Date.now() - 86_400_000).toISOString();
  const semana = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [rows, d1, d7] = await Promise.all([
    db.from("error_events").select("created_at, origem, rota, nome, status, local_codigo, versao, impressao").gte("created_at", semana).order("created_at", { ascending: false }).limit(1000),
    db.from("error_events").select("id", { count: "exact", head: true }).gte("created_at", dia),
    db.from("error_events").select("id", { count: "exact", head: true }).gte("created_at", semana),
  ]);
  if (rows.error) return NextResponse.json({ ligado: true, disponivel: false, grupos: [], total24h: 0, total7d: 0 });
  return NextResponse.json({ ligado: true, disponivel: true, grupos: agrupar((rows.data ?? []) as LinhaErro[]), total24h: d1.count ?? 0, total7d: d7.count ?? 0 });
}
