import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { LinhaErro } from "@/lib/telemetria/agrupar";
import { telemetriaEnabled } from "@/lib/telemetria/flag";
import { resumirSaude, saudeVazia } from "@/lib/telemetria/saude";
import { adminOnly } from "../_admin";

export const dynamic = "force-dynamic";

// "Saúde do sistema": totais de 24 h e 7 dias, servidor × cliente, grupos recentes e erros por dia. Só administrador.
// Só números e marcas técnicas (tipo, rota sem query, "arquivo:linha"): a tabela não guarda mensagem, e-mail nem dado de pessoa.
export async function GET() {
  const a = await adminOnly();
  if (!a) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const h = { headers: { "cache-control": "no-store" } };
  if (!telemetriaEnabled()) return NextResponse.json(saudeVazia(false, false), h);
  try {
    const db = supabaseAdmin();
    const agora = new Date();
    const dia = new Date(agora.getTime() - 86_400_000).toISOString();
    const semana = new Date(agora.getTime() - 7 * 86_400_000).toISOString();
    const [rows, d1, d7] = await Promise.all([
      db.from("error_events").select("created_at, origem, rota, nome, status, local_codigo, versao, impressao").gte("created_at", semana).order("created_at", { ascending: false }).limit(2000),
      db.from("error_events").select("id", { count: "exact", head: true }).gte("created_at", dia),
      db.from("error_events").select("id", { count: "exact", head: true }).gte("created_at", semana),
    ]);
    if (rows.error) return NextResponse.json(saudeVazia(true, false), h);
    return NextResponse.json(resumirSaude((rows.data ?? []) as LinhaErro[], agora, { d24h: d1.error ? null : d1.count, d7d: d7.error ? null : d7.count }), h);
  } catch {
    return NextResponse.json(saudeVazia(true, false), h);
  }
}
