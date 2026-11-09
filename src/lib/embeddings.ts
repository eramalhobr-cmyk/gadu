import { getVercelOidcToken } from "@vercel/oidc";

// Embeddings pelo AI Gateway da Vercel (mesmo crédito dos motores). Custo: ~US$ 0,02 por milhão de tokens.
export const EMBED_MODEL = process.env.EMBED_MODEL || "openai/text-embedding-3-small";
export const EMBED_DIMS = 1536;

export function embeddingsAvailable(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL);
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const key = process.env.AI_GATEWAY_API_KEY || (await getVercelOidcToken());
  const r = await fetch("https://ai-gateway.vercel.sh/v1/embeddings", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts.map((t) => t.slice(0, 4000)) }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`embeddings ${r.status}`);
  const j = (await r.json()) as { data?: { embedding: number[]; index: number }[] };
  const out = new Array<number[]>(texts.length);
  for (const d of j.data ?? []) out[d.index] = d.embedding;
  if (out.some((v) => !v || v.length !== EMBED_DIMS)) throw new Error("embeddings incompletos");
  return out;
}

/** Formato aceito pelo pgvector via PostgREST. */
export const toVector = (v: number[]) => `[${v.join(",")}]`;
