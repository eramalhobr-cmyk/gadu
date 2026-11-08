import Anthropic from "@anthropic-ai/sdk";
import { getVercelOidcToken } from "@vercel/oidc";
import { serverConfig } from "@/lib/config";
import type { ChatRequest, Provider } from "./types";

// Vercel AI Gateway: mesma API de mensagens da Anthropic, autenticada pelo token
// OIDC que a Vercel entrega a cada requisição. Não exige chave guardada no projeto.
const BASE_URL = "https://ai-gateway.vercel.sh";

async function credential(): Promise<string> {
  const key = process.env.AI_GATEWAY_API_KEY;
  if (key) return key;
  return getVercelOidcToken(); // renovado pela Vercel; buscar a cada requisição
}

function gatewayProvider(name: string, modelOf: () => string, withEffort: boolean): Provider {
  return {
    name,
    available: () => Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL),
    async *stream(req: ChatRequest) {
      const cfg = serverConfig();
      const client = new Anthropic({ apiKey: await credential(), baseURL: BASE_URL, maxRetries: 1, timeout: 45_000 });
      const stream = client.messages.stream(
        {
          model: modelOf(),
          max_tokens: 8000,
          system: [
            { type: "text", text: req.system, cache_control: { type: "ephemeral" } },
            { type: "text", text: req.context },
          ],
          messages: req.turns,
          ...(withEffort ? { output_config: { effort: cfg.effort } } : {}),
        },
        { signal: req.signal },
      );
      for await (const ev of stream) {
        if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") yield ev.delta.text;
      }
      const final = await stream.finalMessage();
      if (final.stop_reason === "refusal") yield "\n\nNão posso ajudar com esse pedido. Tente reformular.";
      else if (final.stop_reason === "max_tokens") yield "\n\n(Resposta cortada por tamanho. Peça para eu continuar.)";
    },
  };
}

export const gatewayClaude = gatewayProvider("Claude", () => serverConfig().gatewayModel, true);
export const gatewayFallback = gatewayProvider("Gemini", () => serverConfig().gatewayFallbackModel, false);
