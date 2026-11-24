// Links para o Gmail. Antes: mail.google.com/mail/u/0/… abria a PRIMEIRA conta logada no navegador, que nem
// sempre é a conectada ao GaDu (aí o e-mail "não existia"); e #inbox/ falhava com e-mail arquivado.
// Agora: authuser = a conta Google conectada e #all/ (acha o e-mail em qualquer pasta).
// O app do Gmail no Android não aceita link para um e-mail específico (abre a caixa de entrada); por isso o link
// principal abre o e-mail certo no navegador e, no Android, há um segundo botão só para abrir o app.

const THREAD = /^[0-9a-f]{6,32}$/i;

export function gmailLink(thread: string | null | undefined, conta?: string | null): string {
  const base = conta && conta.includes("@") ? `https://mail.google.com/mail/?authuser=${encodeURIComponent(conta)}` : "https://mail.google.com/mail/u/0/";
  return `${base}${thread && THREAD.test(thread) ? `#all/${thread}` : "#inbox"}`;
}

/** Abre o app do Gmail no Android (caixa de entrada); sem o app, cai no Gmail do navegador. */
export const GMAIL_APP_ANDROID = `intent://mail.google.com/mail/#Intent;scheme=https;package=com.google.android.gm;S.browser_fallback_url=${encodeURIComponent("https://mail.google.com/mail/")};end`;

export const ehAndroid = (ua: string) => /\bAndroid\b/i.test(ua);
