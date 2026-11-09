import { anthropicProvider } from "./anthropic";
import { gatewayClaude, gatewayFallback } from "./gateway";
import { geminiProvider } from "./gemini";
import type { ChatRequest, Provider } from "./types";

// Ordem: chave direta da Anthropic (se houver) → AI Gateway (Claude) → Gemini direto → Gemini via Gateway.
const CHAIN: Provider[] = [anthropicProvider, gatewayClaude, geminiProvider, gatewayFallback];

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
      // Registro por motor, sem dados da conversa nem chaves: só nome, status e mensagem curta.
      const err = e as { status?: number; message?: string };
      console.error(`motor ${p.name} falhou`, err?.status ?? "-", String(err?.message ?? e).slice(0, 300));
      if (started || req.signal.aborted) throw e;
    }
  }
  throw new AllProvidersFailed(lastError);
}

/** Todos os motores falharam antes de responder. Guarda o tipo da última falha para orientar a pessoa. */
export class AllProvidersFailed extends Error {
  kind: "auth" | "credits" | "busy" | "other";
  constructor(last: unknown) {
    super("Todos os motores falharam");
    const err = (last ?? {}) as { status?: number; message?: string };
    const msg = String(err.message ?? "");
    if (err.status === 401 || /api[_ ]?key|authentication/i.test(msg)) this.kind = "auth";
    else if (err.status === 402 || /credit|billing|free tier|balance/i.test(msg)) this.kind = "credits";
    else if (err.status === 429 || err.status === 529 || (err.status ?? 0) >= 500) this.kind = "busy";
    else this.kind = "other";
  }
}

export class NoProviderError extends Error {
  constructor() {
    super("Nenhum motor configurado");
  }
}
