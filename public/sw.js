// Service worker do GaDu: deixa o app abrir rápido e mostra uma tela amigável sem internet.
// Nunca guarda respostas de API, login ou dados da pessoa.
const VERSION = "gadu-v4";
const SHELL = ["/offline", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

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
  const url = typeof d.url === "string" && d.url.startsWith("/") ? d.url : "/app";
  event.waitUntil(
    self.registration.showNotification(d.title || "GaDu", {
      body: d.body || "",
      icon: "/icons/icon-192.png?v=3",
      badge: "/icons/icon-192.png?v=3",
      tag: d.tag || undefined,
      renotify: Boolean(d.tag),
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/app", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && "focus" in c) { c.navigate(url); return c.focus(); }
      }
      return self.clients.openWindow(url);
    }),
  );
});
