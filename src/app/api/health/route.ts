import { NextResponse } from "next/server";
import { APP_VERSION, SUPABASE_URL, serverConfig } from "@/lib/config";
import { googleConfigured } from "@/lib/google";
import { pushConfigured } from "@/lib/push";

export const dynamic = "force-dynamic";

// Saúde do serviço: usado por monitoramento e pelo app para decidir o modo de contingência.
export async function GET() {
  const cfg = serverConfig();
  return NextResponse.json({
    ok: true,
    version: APP_VERSION,
    google: googleConfigured(),
    push: pushConfigured(),
    scheduler: Boolean(process.env.CRON_SECRET && process.env.SUPABASE_SECRET_KEY),
    engine: { anthropic: Boolean(cfg.anthropicKey), gateway: Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL), gemini: Boolean(cfg.geminiKey) },
    database: Boolean(SUPABASE_URL),
    time: new Date().toISOString(),
  });
}
