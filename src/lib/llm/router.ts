import { anthropicProvider } from "./anthropic";
import { geminiProvider } from "./gemini";
import type { ChatRequest, Provider } from "./types";

const CHAIN: Provider[] = [anthropicProvider, geminiProvider];

export type RouterEvent = { type: "provider"; name: string } | { type: "text"; text: string };

/**
 * Tenta os provedores em ordem. Se um falhar ANTES de mandar texto, passa para o próximo.
 * Se falhar no meio da resposta, para ali (não mistura respostas de dois modelos).
 */
export async function* routeChat(req: ChatRequest): AsyncGenerator<RouterEvent> {
  const providers = CHAIN.filter((p) => p.available());
  if (!providers.length) throw new NoProviderError();
  let lastError: unknown = null;
  for (const p of providers) {
    let started = false;
    try {
      for await (const text of p.stream(req)) {
        if (!started) {
          started = true;
          yield { type: "provider", name: p.name };
        }
        yield { type: "text", text };
      }
      if (started) return;
    } catch (e) {
      lastError = e;
      if (started || req.signal.aborted) throw e;
    }
  }
  throw lastError ?? new Error("sem resposta");
}

export class NoProviderError extends Error {
  constructor() {
    super("Nenhum motor configurado");
  }
}
