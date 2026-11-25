import { getVercelOidcToken } from "@vercel/oidc";
import { z } from "zod";
import { signedIn } from "../../google/_auth";
import { reserveBudget, settleBudget } from "@/lib/ai-budget";
import { isSensitive, blockedTerm } from "@/lib/privacy";
import { falaNaturalEnabled, MAX_TEXTO_FALA } from "@/lib/voz/fala-config";
import { GATEWAY } from "@/lib/voz/transcricao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MODELO = "elevenlabs/eleven-flash-v2.5";
const PRECO_CARACTERE = 0.00004;
const Input = z.object({ texto: z.string().trim().min(1).max(MAX_TEXTO_FALA) }).strict();

export async function POST(request: Request) {
  if (!falaNaturalEnabled()) return new Response(null, { status: 404 });
  const auth = await signedIn();
  if (!auth) return new Response(null, { status: 401 });
  if (Number(request.headers.get("content-length")) > 32_768) return new Response(null, { status: 413 });
  const input = Input.safeParse(await request.json().catch(() => null));
  if (!input.success) return new Response(null, { status: 400 });

  const perfil = await auth.supabase.from("profiles").select("settings").eq("id", auth.user.id).maybeSingle();
  if (perfil.error) return new Response(null, { status: 503 });
  const termos = Array.isArray(perfil.data?.settings?.blocked) ? perfil.data.settings.blocked.map(String) : [];
  const { texto } = input.data;
  if (isSensitive(texto) || blockedTerm(texto, termos)) return new Response(null, { status: 422 });

  const credencial = process.env.AI_GATEWAY_API_KEY || (process.env.VERCEL ? await getVercelOidcToken().catch(() => "") : "");
  if (!credencial) return new Response(null, { status: 503 });
  const custo = Math.ceil(texto.length * PRECO_CARACTERE * 1e6) / 1e6;
  const reserva = await reserveBudget(auth.user.id, "speech", custo);
  if (!reserva.ok) return new Response(null, { status: reserva.reason === "unavailable" ? 503 : 402 });

  try {
    const r = await fetch(`${GATEWAY}/v4/ai/speech-model`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credencial}`,
        "Content-Type": "application/json",
        "ai-gateway-protocol-version": "0.0.1",
        "ai-speech-model-specification-version": "4",
        "ai-model-id": MODELO,
      },
      body: JSON.stringify({ text: texto, voice: "21m00Tcm4TlvDq8ikWAM", language: "pt", outputFormat: "mp3" }),
      signal: AbortSignal.timeout(16_000),
    });
    if (!r.ok) return new Response(null, { status: 502 });
    const { audio } = await r.json();
    if (typeof audio !== "string" || audio.length < 12 || audio.length > 4_000_000) return new Response(null, { status: 502 });
    return new Response(Uint8Array.from(Buffer.from(audio, "base64")), {
      headers: { "content-type": "audio/mpeg", "cache-control": "private, no-store" },
    });
  } catch {
    return new Response(null, { status: 502 });
  } finally {
    // Uma chamada iniciada pode ser cobrada mesmo se a resposta falhar. Registra a estimativa conservadora.
    await settleBudget(auth.user.id, reserva.id, "speech", { provider: "gateway", model: MODELO, input: texto.length, output: 0, cost: custo });
  }
}
