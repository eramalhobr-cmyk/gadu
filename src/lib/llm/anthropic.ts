import Anthropic from "@anthropic-ai/sdk";
import { serverConfig } from "@/lib/config";
import type { ChatRequest, Provider } from "./types";

let client: Anthropic | null = null;
function getClient(key: string) {
  if (!client) client = new Anthropic({ apiKey: key, maxRetries: 1, timeout: 45_000 });
  return client;
}

// Modelos que aceitam o plano B automático do servidor em caso de recusa.
const SERVER_FALLBACK = new Set(["claude-opus-5-5", "claude-fable-5-1", "claude-sonnet-5-5"]);

export const anthropicProvider: Provider = {
  id: "anthropic",
  name: "Claude",
  available: () => Boolean(serverConfig().anthropicKey),
  async *stream(req: ChatRequest) {
    const cfg = serverConfig();
    const c = getClient(cfg.anthropicKey);
    const useFallback = SERVER_FALLBACK.has(cfg.model);
    const stream = c.beta.messages.stream(
      {
        model: cfg.model,
        max_tokens: 8000,
        system: [
          { type: "text", text: req.system, cache_control: { type: "ephemeral" } },
          { type: "text", text: req.context },
        ],
        messages: req.turns,
        output_config: { effort: cfg.effort },
        ...(useFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      },
      { signal: req.signal },
    );
    for await (const ev of stream) {
      if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") yield ev.delta.text;
    }
    const final = await stream.finalMessage();
    req.onUsage?.({ provider: "anthropic", model: cfg.model, ...final.usage });
    if (final.stop_reason === "refusal") {
      yield "\n\nNão posso ajudar com esse pedido. Tente reformular.";
    } else if (final.stop_reason === "max_tokens") {
      yield "\n\n(Resposta cortada por tamanho. Peça para eu continuar.)";
    }
  },
};
