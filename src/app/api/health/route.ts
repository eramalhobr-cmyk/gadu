import { NextResponse } from "next/server";
import { APP_VERSION, SUPABASE_URL, serverConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

// Saúde do serviço: usado por monitoramento e pelo app para decidir o modo de contingência.
export async function GET() {
  const cfg = serverConfig();
  return NextResponse.json({
    ok: true,
    version: APP_VERSION,
    engine: { primary: Boolean(cfg.anthropicKey), fallback: Boolean(cfg.geminiKey) },
    database: Boolean(SUPABASE_URL),
    time: new Date().toISOString(),
  });
}
