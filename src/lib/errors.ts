// Mensagens de erro em português, curtas e com o que fazer. Uma fonte só para o app inteiro.

/** Erro ao conversar com o GaDu, pelo código HTTP (ou 0 para falha de rede). */
export function chatErrorMessage(status: number): string {
  if (status === 0) return "Não consegui falar com o servidor. Confira a internet. Sua mensagem ficou no rascunho.";
  if (status === 400 || status === 422) return "Não entendi essa mensagem. Confira o texto e tente de novo.";
  if (status === 403) return "Sua conta não tem acesso a esta função. Fale com quem te convidou.";
  if (status === 413) return "A mensagem ficou grande demais. Divida em partes menores.";
  if (status === 429) return "Muitas mensagens seguidas. Espere um pouco e tente de novo.";
  if (status === 504) return "O GaDu demorou demais para responder. Tente de novo; sua mensagem ficou no rascunho.";
  if (status >= 500) return "O GaDu está instável agora. Sua mensagem ficou no rascunho; tente de novo em instantes.";
  return "Algo deu errado. Sua mensagem ficou no rascunho; tente de novo.";
}

/** Erro do reconhecimento de voz do navegador. Vazio quando não vale avisar (a pessoa cancelou). */
export function micErrorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
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
