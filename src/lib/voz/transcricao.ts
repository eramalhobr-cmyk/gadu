// Transcrição na nuvem pelo Vercel AI Gateway (decisão de 24/11/2026, aprovada pelo Eduardo).
// O modelo é só configuração: TRANSCRIBE_MODELS lista o principal e as reservas, na ordem. Trocar de modelo não
// mexe em memória, histórico nem dados (eles ficam no banco do GaDu); vale só para as próximas falas.
// Escolha do padrão: piloto de 24/11 (docs/PILOTO_VOZ_GATEWAY.md). Microsoft: mais rápido e barato; OpenAI: reserva.

export const MODELOS_PADRAO = ["microsoft/mai-transcribe-2", "openai/gpt-transcribe"];
export const GATEWAY = "https://ai-gateway.vercel.sh";
/** Fala mais longa aceita (o app para sozinho em 20 s; margem para a duração medida). */
export const MAX_SEGUNDOS = 30;
/** 30 s de WAV 16 kHz mono 16 bits ≈ 960 KB; aceita até 48 kHz estéreo curto sem passar do limite da função (4,5 MB). */
export const MAX_BYTES = 1_200_000;

/** Preço por segundo de áudio (US$), do catálogo do Gateway em 24/11/2026 (/v1/models). Modelo sem preço conhecido
 * usa o teto PRECO_DESCONHECIDO, para nunca gravar custo menor que o real. */
export const PRECO_SEGUNDO: Record<string, number> = {
  "microsoft/mai-transcribe-2": 0.00002778,
  "spacexai/grok-stt": 0.000028,
  "elevenlabs/scribe-v2": 0.000061112,
  "openai/gpt-transcribe": 0.000075,
};
export const PRECO_DESCONHECIDO = 0.0002;

/** TRANSCRIBE_ENABLED=0 desliga a transcrição na nuvem (a rota responde 404 e o app usa só o microfone do aparelho). Ligada por padrão;
 * cada pessoa ainda precisa escolher usar em Ajustes. */
export const transcricaoEnabled = (env: Record<string, string | undefined> = process.env) => env.TRANSCRIBE_ENABLED !== "0";

/** Lista de modelos: TRANSCRIBE_MODELS="principal,reserva". Nomes inválidos são ignorados; no máximo 3. */
export function modelosTranscricao(env: Record<string, string | undefined> = process.env): string[] {
  const lista = (env.TRANSCRIBE_MODELS ?? "").split(",").map((s) => s.trim()).filter((s) => /^[a-z0-9-]+\/[a-z0-9.-]+$/.test(s));
  return [...new Set(lista.length ? lista : MODELOS_PADRAO)].slice(0, 3);
}

export const precoSegundo = (modelo: string) => PRECO_SEGUNDO[modelo] ?? PRECO_DESCONHECIDO;

/** Custo de um trecho. O Gateway cobra pela duração; arredonda para cima ao segundo, como margem. */
export function custoTranscricao(modelo: string, segundos: number): number {
  return Math.ceil(Math.max(0, segundos)) * precoSegundo(modelo);
}

/** Estimativa para reservar: o pior caso entre os modelos da lista (se o principal falhar, a reserva paga). */
export function estimativa(modelos: string[], segundos: number): number {
  return Math.max(...modelos.map((m) => custoTranscricao(m, segundos)));
}

export type Resultado = { texto: string; modelo: string; segundos: number; custo: number; tentativas: number };
export class TranscricaoFalhou extends Error {}

/** Chama os modelos na ordem até um responder com texto. Cada tentativa tem prazo próprio. Não guarda o áudio. */
export async function transcrever(
  audio: Uint8Array,
  opcoes: { modelos: string[]; credencial: string; segundos: number; prazoMs?: number; fetchImpl?: typeof fetch },
): Promise<Resultado> {
  const f = opcoes.fetchImpl ?? fetch;
  const corpo = JSON.stringify({ audio: Buffer.from(audio).toString("base64"), mediaType: "audio/wav" });
  let tentativas = 0;
  for (const modelo of opcoes.modelos) {
    tentativas++;
    try {
      const r = await f(`${GATEWAY}/v4/ai/transcription-model`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${opcoes.credencial}`,
          "ai-gateway-protocol-version": "0.0.1",
          "ai-transcription-model-specification-version": "4",
          "ai-model-id": modelo,
          "Content-Type": "application/json",
        },
        body: corpo,
        signal: AbortSignal.timeout(opcoes.prazoMs ?? 15_000),
      });
      if (!r.ok) { console.error(`transcrição: ${modelo} respondeu ${r.status}`); continue; }
      const j = (await r.json()) as { text?: unknown; durationInSeconds?: unknown };
      const texto = typeof j.text === "string" ? j.text.trim() : "";
      const seg = Number(j.durationInSeconds);
      const segundos = Number.isFinite(seg) && seg > 0 ? Math.max(seg, opcoes.segundos) : opcoes.segundos;
      return { texto, modelo, segundos, custo: custoTranscricao(modelo, segundos), tentativas };
    } catch {
      console.error(`transcrição: ${modelo} não respondeu`);
    }
  }
  throw new TranscricaoFalhou("nenhum modelo respondeu");
}
