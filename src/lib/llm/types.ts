export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ChatRequest = {
  system: string; // estável: persona e regras (vai para o cache)
  context: string; // muda pouco: memória aprovada, data
  turns: ChatTurn[]; // histórico + mensagem atual (termina em user)
  signal: AbortSignal;
  /** Recebe o consumo da resposta (tokens) para calcular o gasto. */
  onUsage?: (u: import("@/lib/pricing").Usage & { provider: ProviderId }) => void;
};

/** Um provedor de modelo. Adicionar um provedor novo = escrever um adaptador. */
export type ProviderId = "anthropic" | "gateway" | "gemini";

export type Provider = {
  /** Conta onde o gasto cai (para limites por provedor). */
  id: ProviderId;
  /** Nome mostrado na conversa. */
  name: string;
  available: () => boolean;
  stream: (req: ChatRequest) => AsyncGenerator<string>;
};
