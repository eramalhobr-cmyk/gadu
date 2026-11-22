// Decisões do lado do aparelho para notificações (sem tocar no navegador: testável).

export type PushSupport = "ok" | "install" | "ios-old" | "no";

/** O que este aparelho consegue fazer com notificações.
 * - iPhone/iPad: só dentro do app instalado na tela de início (Safari 16.4 ou mais novo); no Safari comum, "install".
 * - Sem Service Worker, PushManager ou Notification (Firefox antigo, navegadores embutidos): "no". */
export function pushSupport(env: { ua: string; standalone: boolean; hasServiceWorker: boolean; hasPushManager: boolean; hasNotification: boolean }): PushSupport {
  if (env.hasServiceWorker && env.hasPushManager && env.hasNotification) return "ok";
  const ios = /iphone|ipad|ipod/i.test(env.ua);
  if (ios && !env.standalone) return "install";
  if (ios) return "ios-old";
  return "no";
}

/** Mensagem depois de pedir permissão (o pedido só acontece dentro de um toque). */
export function permissionMessage(p: NotificationPermission): string | null {
  if (p === "granted") return null;
  if (p === "denied") return "As notificações estão bloqueadas. Libere nas configurações do navegador, em Permissões do site, e tente de novo.";
  // "default": a pessoa fechou o pedido sem escolher.
  return "Você fechou o pedido sem escolher. Toque em Ligar notificações e escolha Permitir.";
}

/** Mensagem fixa quando o sistema já bloqueou: tocar no botão não faria o pedido aparecer de novo. */
export const DENIED_HELP = "O navegador bloqueou as notificações do GaDu. Para ligar: toque no cadeado ao lado do endereço (ou em Configurações do Android › Apps › GaDu › Notificações) e permita.";

export function deviceLabel(ua: string): string {
  return /iphone|ipad/i.test(ua) ? "iPhone" : /android/i.test(ua) ? "Android" : "Computador";
}
