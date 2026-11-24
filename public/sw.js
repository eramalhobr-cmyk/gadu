// Service worker do GaDu: deixa o app abrir rápido e mostra uma tela amigável sem internet.
// Nunca guarda respostas de API, login ou dados da pessoa.
const VERSION = "gadu-v7";
const SHELL = ["/offline", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/badge-96.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  // Arquivos estáticos versionados: cache primeiro.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      })),
    );
    return;
  }
  // Páginas: sempre da rede; sem internet, mostra a tela offline.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/offline")));
  }
});

// Notificações: lembretes e briefing da manhã. O conteúdo vem do servidor do GaDu.
self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data ? event.data.text() : "" }; }
  const url = typeof d.url === "string" && d.url.startsWith("/") && !d.url.startsWith("//") ? d.url : "/app";
  event.waitUntil(
    self.registration.showNotification(d.title || "GaDu", {
      body: d.body || "",
      icon: "/icons/icon-192.png?v=4",
      badge: "/icons/badge-96.png",
      tag: d.tag || undefined,
      renotify: Boolean(d.tag),
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.url) || "/app";
  // Só rotas do próprio GaDu (nunca outro site, mesmo que o servidor mande).
  const target = new URL(raw, self.location.origin);
  const url = target.origin === self.location.origin ? target.href : new URL("/app", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        // Foca primeiro (precisa do toque do usuário ainda valendo) e depois leva para a rota certa.
        if (new URL(c.url).origin === self.location.origin && "focus" in c) {
          return c.focus().then((w) => (w && "navigate" in w && w.url !== url ? w.navigate(url) : w)).catch(() => self.clients.openWindow(url));
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

// A assinatura de push expirou ou foi trocada pelo navegador: assina de novo e avisa o servidor,
// senão os lembretes simplesmente deixam de chegar sem ninguém perceber.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil((async () => {
    const old = event.oldSubscription;
    const key = (old && old.options && old.options.applicationServerKey) || (event.newSubscription && event.newSubscription.options && event.newSubscription.options.applicationServerKey);
    let sub = event.newSubscription;
    if (!sub) {
      if (!key) return;
      sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key instanceof ArrayBuffer ? new Uint8Array(key) : key });
    }
    const j = sub.toJSON();
    const body = JSON.stringify({ endpoint: j.endpoint, keys: j.keys, device: /iphone|ipad/i.test(self.navigator.userAgent) ? "iPhone" : /android/i.test(self.navigator.userAgent) ? "Android" : "Computador" });
    const r = await fetch("/api/push", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body });
    // Só apaga a inscrição velha depois de salvar a nova.
    if (r.ok && old && old.endpoint && old.endpoint !== j.endpoint) {
      await fetch("/api/push", { method: "DELETE", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: old.endpoint }) }).catch(() => {});
    }
  })().catch(() => {}));
});
