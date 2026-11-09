import { NextResponse } from "next/server";
import { APP_VERSION, SUPABASE_URL, serverConfig } from "@/lib/config";
import { googleConfigured } from "@/lib/google";

export const dynamic = "force-dynamic";

// Saúde do serviço: usado por monitoramento e pelo app para decidir o modo de contingência.
export async function GET() {
  const cfg = serverConfig();
  return NextResponse.json({
    ok: true,
    version: APP_VERSION,
    google: googleConfigured(),
    engine: { anthropic: Boolean(cfg.anthropicKey), gateway: Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL), gemini: Boolean(cfg.geminiKey) },
    database: Boolean(SUPABASE_URL),
    time: new Date().toISOString(),
  });
}
