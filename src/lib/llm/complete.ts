import Anthropic from "@anthropic-ai/sdk";
import { getVercelOidcToken } from "@vercel/oidc";
import { serverConfig } from "@/lib/config";
import { costUsd } from "@/lib/pricing";
import type { ProviderId } from "./types";

// Tarefas curtas de bastidor (resumo de conversa, extração de memórias) com o modelo mais barato.
// Tenta a Anthropic direta e, se não der, o AI Gateway. Respeita os provedores pulados por limite.
export type Completion = { text: string; provider: ProviderId; model: string; input: number; output: number; cost: number };

export async function complete(prompt: string, opts: { maxTokens?: number; skip?: Set<ProviderId> } = {}): Promise<Completion> {
  const cfg = serverConfig();
  const skip = opts.skip ?? new Set();
  const attempts: { provider: ProviderId; model: string; client: () => Promise<Anthropic> }[] = [];
  if (cfg.anthropicKey && !skip.has("anthropic")) {
    attempts.push({ provider: "anthropic", model: cfg.cheapModel, client: async () => new Anthropic({ apiKey: cfg.anthropicKey, maxRetries: 1, timeout: 30_000 }) });
  }
  if ((process.env.AI_GATEWAY_API_KEY || process.env.VERCEL) && !skip.has("gateway")) {
    attempts.push({
      provider: "gateway",
      model: cfg.gatewayCheapModel,
      client: async () => new Anthropic({ apiKey: process.env.AI_GATEWAY_API_KEY || (await getVercelOidcToken()), baseURL: "https://ai-gateway.vercel.sh", maxRetries: 1, timeout: 30_000 }),
    });
  }
  let last: unknown = new Error("nenhum motor disponível");
  for (const a of attempts) {
    try {
      const c = await a.client();
      const msg = await c.messages.create({
        model: a.model,
        max_tokens: opts.maxTokens ?? 1200,
        messages: [{ role: "user", content: prompt }],
        output_config: { effort: "low" },
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
      };
    } catch (e) {
      last = e;
      const err = e as { status?: number; message?: string };
      console.error(`tarefa curta: ${a.provider} falhou`, err?.status ?? "-", String(err?.message ?? e).slice(0, 200));
    }
  }
  throw last;
}
