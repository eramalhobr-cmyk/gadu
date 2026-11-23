// Mensagens de erro em português, curtas e com o que fazer. Uma fonte só para o app inteiro.

/** Rótulo do botão de repetir, o mesmo em toda tela. */
export const RETRY_LABEL = "Tentar de novo";

/** Mensagens que se repetem pelo app: uma frase curta que diz o que houve e o que fazer agora. */
export const MSG = {
  /** Chat sem internet: o que a pessoa disse não se perde. */
  offline: "Sem internet. Sua mensagem ficou guardada.",
  /** Ação que grava, sem internet. */
  offlineDo: "Sem internet. Confira a conexão e tente de novo.",
  /** Faixa no topo enquanto não há internet. */
  offlineBanner: "Sem internet. O app continua aberto e suas mensagens ficam guardadas.",
  save: "Não consegui salvar. Tente de novo.",
  undo: "Não consegui desfazer. Tente de novo.",
  moduleOff: "Esta função está desligada no momento.",
  notFound: "Não encontrei o item. Ele pode ter sido apagado.",
  /** Sessão vencida: a pessoa precisa entrar de novo. */
  session: "Sua sessão acabou. Entre de novo para continuar.",
} as const;

/** "Não consegui carregar as tarefas. Tente de novo." */
export const loadFailed = (what: string) => `Não consegui carregar ${what}. Tente de novo.`;
/** "Não consegui apagar. Tente de novo." */
export const actionFailed = (verb: string) => `Não consegui ${verb}. Tente de novo.`;

/** O que a pessoa vê (e ouve) quando algo falha, e se vale oferecer "Tentar de novo". */
export type Failure = { text: string; retry: boolean };

/** Erro ao conversar com o GaDu, pelo código HTTP (ou 0 para falha de rede). */
export function chatFailure(status: number): Failure {
  if (status === 0) return { text: MSG.offline, retry: true };
  if (status === 400 || status === 422) return { text: "Não entendi essa mensagem. Confira o texto e escreva de novo.", retry: false };
  if (status === 403) return { text: "Sua conta não tem acesso a esta função. Fale com quem te convidou.", retry: false };
  if (status === 413) return { text: "A mensagem ficou grande demais. Divida em partes menores.", retry: false };
  if (status === 429) return { text: "Muitas mensagens seguidas. Espere um pouco e tente de novo.", retry: true };
  if (status === 504) return { text: "O GaDu demorou demais. Sua mensagem ficou guardada.", retry: true };
  if (status >= 500) return { text: "O GaDu está instável agora. Sua mensagem ficou guardada.", retry: true };
  return { text: "Algo deu errado. Sua mensagem ficou guardada.", retry: true };
}
export function chatErrorMessage(status: number): string {
  return chatFailure(status).text;
}

/** O que o GaDu fala quando a pessoa está usando voz: a mesma frase, mais como repetir. */
export function spokenFailure(f: Failure): string {
  return f.retry ? `${f.text} Para repetir, diga: tenta de novo.` : f.text;
}

/** "tenta de novo", "tentar de novo", "manda de novo", "de novo": repetir a última mensagem que falhou. */
export function parseRetryCommand(text: string): boolean {
  const t = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  return /^(gadu )?(por favor )?(pode )?(tenta|tentar|tente|manda|mandar|envia|enviar|repete|repetir)( isso| ela| a mensagem)? (de novo|outra vez)( por favor)?$/.test(t) || /^(de novo|outra vez)$/.test(t);
}

/** Erro do reconhecimento de voz do navegador. Vazio quando não vale avisar (a pessoa cancelou). */
export function micErrorMessage(code: string): string {
  switch (code) {
    case "service-not-allowed":
      // Samsung Internet e navegadores embutidos: o serviço de voz do Google não está liberado.
      return "O reconhecimento de voz não está disponível neste navegador. Use o Chrome ou o microfone do teclado.";
    case "not-allowed":
      return "O microfone está bloqueado. Libere o microfone para este site nas configurações do navegador.";
    case "audio-capture":
      return "Não encontrei um microfone neste aparelho.";
    case "network":
      return "O reconhecimento de voz precisa de internet. Confira a conexão e tente de novo.";
    case "no-speech":
      return "Não ouvi nada. Toque no microfone e fale de novo.";
    case "language-not-supported":
      return "Este navegador não reconhece português. Use o Chrome ou o Safari.";
    case "aborted":
      return "";
    default:
      return "Não consegui usar o microfone agora. Tente de novo.";
  }
}

/** Texto de erro devolvido por uma rota da API: usa a mensagem em português quando houver. */
export function apiErrorMessage(body: unknown, fallback = "Não consegui concluir. Tente de novo."): string {
  if (body && typeof body === "object") {
    const b = body as { message?: unknown; error?: unknown };
    if (typeof b.message === "string" && b.message.trim()) return b.message;
    // Só aproveita "error" quando for uma frase (os códigos internos, como "invalid", não servem para a pessoa).
    if (typeof b.error === "string" && /\s/.test(b.error.trim())) return b.error;
  }
  return fallback;
}
