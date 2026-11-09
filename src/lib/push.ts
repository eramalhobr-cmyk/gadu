import webpush from "web-push";

// Notificações no celular (Web Push). A chave privada fica só no servidor.
export type PushPayload = { title: string; body: string; url?: string; tag?: string };
export type Sub = { id: number; endpoint: string; p256dh: string; auth: string };

export function pushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let ready = false;
function setup() {
  if (ready) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://gadu-agent.vercel.app", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "", process.env.VAPID_PRIVATE_KEY ?? "");
  ready = true;
}

/** Envia para todos os aparelhos. Devolve os ids das inscrições que expiraram (para apagar). */
export async function sendPush(subs: Sub[], payload: PushPayload): Promise<{ sent: number; gone: number[] }> {
  setup();
  const body = JSON.stringify({ ...payload, title: payload.title.slice(0, 80), body: payload.body.slice(0, 300) });
  let sent = 0;
  const gone: number[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 3600, urgency: "high", timeout: 8000 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) gone.push(s.id);
        else console.error("push falhou", code ?? "-");
      }
    }),
  );
  return { sent, gone };
}
