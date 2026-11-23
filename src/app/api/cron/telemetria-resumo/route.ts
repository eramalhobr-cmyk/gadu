import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { agrupar, type LinhaErro } from "@/lib/telemetria/agrupar";
import { telemetriaEnabled } from "@/lib/telemetria/flag";

export const dynamic = "force-dynamic";

const RETENCAO_DIAS = 30;

function tokenOk(request: Request): boolean {
  const esperado = process.env.TELEMETRIA_TOKEN ?? "";
  if (esperado.length < 24) return false; // sem token (ou token fraco) a rota fica desligada
  const dado = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(dado);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Resumo das últimas 24 h para o alerta diário (GitHub Action agendada, .github/workflows/alerta-erros.yml).
// Protegido por TELEMETRIA_TOKEN (um token só de leitura do resumo; NÃO é o CRON_SECRET). POST porque também apaga o que passou de 30 dias.
export async function POST(request: Request) {
  if (!telemetriaEnabled() || !process.env.TELEMETRIA_TOKEN) return new NextResponse(null, { status: 404 });
  if (!tokenOk(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  const dia = new Date(Date.now() - 86_400_000).toISOString();
  const { data, error } = await db.from("error_events").select("created_at, origem, rota, nome, status, local_codigo, versao, impressao").gte("created_at", dia).order("created_at", { ascending: false }).limit(1000);
  if (error) return NextResponse.json({ error: "indisponivel" }, { status: 503 });
  const linhas = (data ?? []) as LinhaErro[];
  const apagou = await db.from("error_events").delete({ count: "exact" }).lt("created_at", new Date(Date.now() - RETENCAO_DIAS * 86_400_000).toISOString());
  return NextResponse.json({
    total24h: linhas.length,
    servidor: linhas.filter((l) => l.origem === "servidor").length,
    cliente: linhas.filter((l) => l.origem === "cliente").length,
    grupos: agrupar(linhas, 10).map((g) => ({ nome: g.nome, rota: g.rota, origem: g.origem, status: g.status, local: g.local, vezes: g.vezes })),
    apagados: apagou.count ?? 0,
  }, { headers: { "cache-control": "no-store" } });
}
