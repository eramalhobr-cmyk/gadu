export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ChatRequest = {
  system: string; // estável: persona e regras (vai para o cache)
  context: string; // muda pouco: memória aprovada, data
  turns: ChatTurn[]; // histórico + mensagem atual (termina em user)
  signal: AbortSignal;
};

/** Um provedor de modelo. Adicionar um provedor novo = escrever um adaptador. */
export type Provider = {
  name: string;
  available: () => boolean;
  stream: (req: ChatRequest) => AsyncGenerator<string>;
};
