import { getVercelOidcToken } from "@vercel/oidc";
import { z } from "zod";
import { accessOf } from "@/lib/access";
import { releaseBudget, reserveBudget, settleBudget } from "@/lib/ai-budget";
import { supabaseServer } from "@/lib/supabase/server";
import { infoWav } from "@/lib/voz/wav";
import { estimativa, MAX_BYTES, MAX_SEGUNDOS, modelosTranscricao, transcrever, TranscricaoFalhou, transcricaoEnabled } from "@/lib/voz/transcricao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Transcrição na nuvem (opcional, escolhida em Ajustes). O app manda um WAV curto; o servidor confere, reserva o custo no
// orçamento de IA, chama o modelo configurado (com reserva) e devolve só o texto. O áudio não é gravado em lugar nenhum.
const Pedido = z.object({
  tipo: z.string().regex(/^audio\/(wav|x-wav|wave)$/),
  tamanho: z.number().int().min(44).max(MAX_BYTES),
});

const erro = (status: number, message: string) => Response.json({ message }, { status });

export async function POST(request: Request) {
  if (!transcricaoEnabled()) return erro(404, "Transcrição na nuvem desligada.");
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user || !(await accessOf(supabase, user)).ok) return erro(401, "Faça login para continuar.");

  const declarado = Number(request.headers.get("content-length") ?? "0");
  if (declarado > MAX_BYTES) return erro(413, "Fala longa demais. Fale em trechos de até 20 segundos.");
  const pedido = Pedido.safeParse({ tipo: (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase(), tamanho: declarado || MAX_BYTES });
  if (!pedido.success) return erro(400, "Áudio inválido.");

  const audio = new Uint8Array(await request.arrayBuffer().catch(() => new ArrayBuffer(0)));
  if (audio.length > MAX_BYTES) return erro(413, "Fala longa demais. Fale em trechos de até 20 segundos.");
  const info = infoWav(audio);
  if (!info) return erro(400, "Áudio inválido.");
  if (info.segundos < 0.3) return erro(422, "Não ouvi nada. Tente de novo.");
  if (info.segundos > MAX_SEGUNDOS) return erro(413, "Fala longa demais. Fale em trechos de até 20 segundos.");

  const modelos = modelosTranscricao();
  const credencial = process.env.AI_GATEWAY_API_KEY || (process.env.VERCEL ? await getVercelOidcToken().catch(() => "") : "");
  if (!credencial) return erro(503, "Transcrição na nuvem indisponível agora.");

  // S-01: reserva com o id da sessão. Sem conseguir verificar o orçamento, não transcreve (fail closed).
  const reserva = await reserveBudget(user.id, "transcribe", estimativa(modelos, info.segundos));
  if (!reserva.ok) {
    if (reserva.reason === "unavailable") return erro(503, "Não consegui verificar seu orçamento de IA agora.");
    return erro(402, "O teto de gasto com IA do mês foi atingido.");
  }

  let liquidou = false;
  try {
    const r = await transcrever(audio, { modelos, credencial, segundos: info.segundos });
    liquidou = await settleBudget(user.id, reserva.id, "transcribe", { provider: "gateway", model: r.modelo, input: Math.ceil(r.segundos), output: r.texto.length, cost: r.custo });
    return Response.json({ texto: r.texto, modelo: r.modelo });
  } catch (e) {
    if (e instanceof TranscricaoFalhou) return erro(502, "Não consegui transcrever agora.");
    console.error("transcrição: erro inesperado");
    return erro(500, "Não consegui transcrever agora.");
  } finally {
    if (!liquidou) await releaseBudget(user.id, reserva.id);
  }
}
