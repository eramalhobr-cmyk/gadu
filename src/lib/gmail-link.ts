// Links para o Gmail. Antes: mail.google.com/mail/u/0/… abria a PRIMEIRA conta logada no navegador, que nem
// sempre é a conectada ao GaDu (aí o e-mail "não existia"); e #inbox/ falhava com e-mail arquivado.
// Agora: authuser = a conta Google conectada e #all/ (acha o e-mail em qualquer pasta).
// O Gmail no Android pode ignorar a conversa. O link HTTPS também fica disponível como alternativa.

const THREAD = /^[0-9a-f]{6,32}$/i;

export function gmailLink(thread: string | null | undefined, conta?: string | null): string {
  const base = conta && conta.includes("@") ? `https://mail.google.com/mail/?authuser=${encodeURIComponent(conta)}` : "https://mail.google.com/mail/u/0/";
  return `${base}${thread && THREAD.test(thread) ? `#all/${thread}` : "#inbox"}`;
}

/** Tenta abrir a mesma conversa no Gmail para Android e preserva o link web como fallback. */
export function gmailAndroidLink(href: string): string | null {
  let url: URL;
  try { url = new URL(href); } catch { return null; }
  if (url.origin !== "https://mail.google.com" || url.username || url.password ||
      !/^\/mail\/(?:u\/\d+\/)?$/.test(url.pathname) ||
      !/^#(?:inbox|all\/[0-9a-f]{6,32})$/i.test(url.hash)) return null;
  return `intent://${url.host}${url.pathname}${url.search}${url.hash}#Intent;scheme=https;package=com.google.android.gm;S.browser_fallback_url=${encodeURIComponent(url.href)};end`;
}

export const ehAndroid = (ua: string) => /\bAndroid\b/i.test(ua);
