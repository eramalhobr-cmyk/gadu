import Anthropic from "@anthropic-ai/sdk";
import { getVercelOidcToken } from "@vercel/oidc";
import { serverConfig } from "@/lib/config";
import { costUsd } from "@/lib/pricing";
import type { ProviderId } from "./types";

// Tarefas curtas de bastidor (resumo de conversa, extração de memórias) com o modelo mais barato.
// Tenta a Anthropic direta e, se não der, o AI Gateway. Respeita os provedores pulados por limite.
/** cortada: a resposta parou no limite de tokens (stop_reason "max_tokens"), então o texto está incompleto. */
export type Completion = { text: string; provider: ProviderId; model: string; input: number; output: number; cost: number; cortada?: boolean };

export type CompleteOpts = {
  maxTokens?: number;
  skip?: Set<ProviderId>;
  /** Imagem já conferida pelo servidor (3D-1b), enviada antes do texto. */
  image?: { mediaType: "image/png" | "image/jpeg"; data: string };
  /** Tempo máximo de cada motor (padrão 30 s) e novas tentativas do SDK (padrão 1). */
  timeoutMs?: number;
  maxRetries?: number;
  /** Instante (Date.now()) a partir do qual não vale mais chamar: cada motor só usa o tempo que sobra até lá. */
  deadline?: number;
  /** Sem raciocínio interno: o modelo responde direto. No 3D o raciocínio gastava o limite de saída e o tempo. */
  semRaciocinio?: boolean;
};

/** Erro de tempo esgotado do SDK (ou do prazo da rota). */
export class TempoEsgotado extends Error {}
export function isTimeout(e: unknown): boolean {
  if (e instanceof TempoEsgotado) return true;
  const err = e as { name?: string; message?: string; constructor?: { name?: string } } | null;
  return Boolean(err && (/timeout/i.test(err.name ?? "") || /timeout/i.test(err.constructor?.name ?? "") || /timed? ?out/i.test(err.message ?? "")));
}

export async function complete(prompt: string, opts: CompleteOpts = {}): Promise<Completion> {
  const cfg = serverConfig();
  const skip = opts.skip ?? new Set();
  const maxRetries = opts.maxRetries ?? 1;
  const timeoutFor = () => {
    const base = opts.timeoutMs ?? 30_000;
    return opts.deadline ? Math.min(base, opts.deadline - Date.now()) : base;
  };
  const attempts: { provider: ProviderId; model: string; client: (timeout: number) => Promise<Anthropic> }[] = [];
  if (cfg.anthropicKey && !skip.has("anthropic")) {
    attempts.push({ provider: "anthropic", model: cfg.cheapModel, client: async (timeout) => new Anthropic({ apiKey: cfg.anthropicKey, maxRetries, timeout }) });
  }
  if ((process.env.AI_GATEWAY_API_KEY || process.env.VERCEL) && !skip.has("gateway")) {
    attempts.push({
      provider: "gateway",
      model: cfg.gatewayCheapModel,
      client: async (timeout) => new Anthropic({ apiKey: process.env.AI_GATEWAY_API_KEY || (await getVercelOidcToken()), baseURL: "https://ai-gateway.vercel.sh", maxRetries, timeout }),
    });
  }
  let last: unknown = new Error("nenhum motor disponível");
  for (const a of attempts) {
    const timeout = timeoutFor();
    // Menos de 5 s até o prazo: não começa outra chamada que seria cortada no meio (e cobrada).
    if (timeout < 5_000) { last = new TempoEsgotado("prazo da tarefa esgotado"); break; }
    let semRaciocinio = Boolean(opts.semRaciocinio);
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      try {
        const c = await a.client(timeout);
        const msg = await c.messages.create({
          model: a.model,
          max_tokens: opts.maxTokens ?? 1200,
          messages: [{
            role: "user",
            content: opts.image
              ? [{ type: "image", source: { type: "base64", media_type: opts.image.mediaType, data: opts.image.data } }, { type: "text", text: prompt }]
              : prompt,
          }],
          output_config: { effort: "low" },
          ...(semRaciocinio ? { thinking: { type: "disabled" as const } } : {}),
        });
        const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
        const u = msg.usage;
        return {
          text,
          provider: a.provider,
          model: a.model,
          input: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
          output: u.output_tokens ?? 0,
          cost: costUsd({ model: a.model, ...u }),
          cortada: msg.stop_reason === "max_tokens",
        };
      } catch (e) {
        last = e;
        const err = e as { status?: number; message?: string };
        console.error(`tarefa curta: ${a.provider} falhou`, err?.status ?? "-", String(err?.message ?? e).slice(0, 200));
        // Motor que não aceita desligar o raciocínio: repete uma vez do jeito padrão (recusa 400 não é cobrada).
        if (semRaciocinio && err?.status === 400 && /thinking/i.test(String(err?.message ?? ""))) { semRaciocinio = false; continue; }
        break;
      }
    }
  }
  throw last;
}
