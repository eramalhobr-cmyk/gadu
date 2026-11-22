// Service worker (public/sw.js) rodando em um "self" simulado: push, clique na notificação e reinscrição.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

type Handler = (e: Record<string, unknown>) => void;
function boot(opts: { clients?: { url: string; focus: () => Promise<unknown>; navigate?: (u: string) => Promise<unknown> }[] } = {}) {
  const handlers: Record<string, Handler> = {};
  const shown: { title: string; opts: Record<string, unknown> }[] = [];
  const opened: string[] = [];
  const calls: { url: string; init?: Record<string, unknown> }[] = [];
  const subscribed: unknown[] = [];
  const self = {
    location: { origin: "https://gadu.example" },
    navigator: { userAgent: "Mozilla/5.0 (Linux; Android 16) Chrome/140 Mobile" },
    addEventListener: (t: string, h: Handler) => { handlers[t] = h; },
    skipWaiting: () => Promise.resolve(),
    registration: {
      showNotification: (title: string, o: Record<string, unknown>) => { shown.push({ title, opts: o }); return Promise.resolve(); },
      pushManager: { subscribe: (o: unknown) => { subscribed.push(o); return Promise.resolve({ toJSON: () => ({ endpoint: "https://push.example/novo", keys: { p256dh: "p".repeat(30), auth: "a".repeat(12) } }) }); } },
    },
    clients: {
      matchAll: () => Promise.resolve(opts.clients ?? []),
      openWindow: (u: string) => { opened.push(u); return Promise.resolve(null); },
      claim: () => Promise.resolve(),
    },
  };
  const ctx = vm.createContext({
    self, URL, Uint8Array, ArrayBuffer, JSON, Promise, console,
    caches: { open: () => Promise.resolve({ addAll: () => Promise.resolve(), put: () => {} }), keys: () => Promise.resolve([]), match: () => Promise.resolve(undefined), delete: () => Promise.resolve(true) },
    fetch: (url: string, init?: Record<string, unknown>) => { calls.push({ url, init }); return Promise.resolve({ ok: true }); },
    atob,
  });
  vm.runInContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), ctx);
  const fire = async (type: string, e: Record<string, unknown>) => {
    let p: Promise<unknown> = Promise.resolve();
    handlers[type]({ ...e, waitUntil: (x: Promise<unknown>) => { p = x; } });
    await p;
  };
  return { handlers, fire, shown, opened, calls, subscribed };
}

test("push: mostra a notificação com ícone, selo monocromático e a rota recebida", async () => {
  const sw = boot();
  await sw.fire("push", { data: { json: () => ({ title: "Lembrete", body: "Dentista", url: "/app?tab=agenda", tag: "t1" }) } });
  const n = sw.shown[0];
  assert.equal(n.title, "Lembrete");
  assert.match(String(n.opts.icon), /icon-192/);
  assert.match(String(n.opts.badge), /badge-96/);
  assert.equal((n.opts.data as { url: string }).url, "/app?tab=agenda");
});

test("push: endereço de fora do app é trocado por /app; sem dados mostra 'GaDu'", async () => {
  const sw = boot();
  await sw.fire("push", { data: { json: () => ({ title: "x", url: "https://evil.example/" }) } });
  await sw.fire("push", {});
  await sw.fire("push", { data: { json: () => ({ title: "y", url: "//evil.example/" }) } });
  assert.equal((sw.shown[0].opts.data as { url: string }).url, "/app");
  assert.equal((sw.shown[2].opts.data as { url: string }).url, "/app");
  assert.equal(sw.shown[1].title, "GaDu");
});

test("clique: foca a janela aberta e leva para a rota certa", async () => {
  const log: string[] = [];
  const win = { url: "https://gadu.example/app?tab=hoje", focus: () => { log.push("focus"); return Promise.resolve(win); }, navigate: (u: string) => { log.push(`navigate ${u}`); return Promise.resolve(win); } };
  const sw = boot({ clients: [win] });
  let closed = 0;
  await sw.fire("notificationclick", { notification: { close: () => closed++, data: { url: "/app?tab=agenda" } } });
  assert.equal(closed, 1);
  assert.deepEqual(log, ["focus", "navigate https://gadu.example/app?tab=agenda"]);
  assert.deepEqual(sw.opened, []);
});

test("clique: sem janela aberta, abre o app na rota; URL de outro site vira /app", async () => {
  const sw = boot();
  await sw.fire("notificationclick", { notification: { close() {}, data: { url: "/app?tab=tarefas" } } });
  await sw.fire("notificationclick", { notification: { close() {}, data: { url: "https://evil.example/x" } } });
  assert.deepEqual(sw.opened, ["https://gadu.example/app?tab=tarefas", "https://gadu.example/app"]);
});

test("pushsubscriptionchange: assina de novo com a mesma chave, salva a nova e só então apaga a velha", async () => {
  const sw = boot();
  const key = new Uint8Array([1, 2, 3]).buffer;
  await sw.fire("pushsubscriptionchange", { oldSubscription: { endpoint: "https://push.example/velho", options: { applicationServerKey: key } } });
  assert.equal(sw.subscribed.length, 1);
  assert.equal((sw.subscribed[0] as { userVisibleOnly: boolean }).userVisibleOnly, true);
  assert.equal(sw.calls.length, 2);
  assert.equal(sw.calls[0].init?.method, "POST");
  assert.match(String(sw.calls[0].init?.body), /push\.example\/novo/);
  assert.match(String(sw.calls[0].init?.body), /Android/);
  assert.equal(sw.calls[1].init?.method, "DELETE");
  assert.match(String(sw.calls[1].init?.body), /push\.example\/velho/);
});

test("pushsubscriptionchange: sem chave para reassinar, não faz nada (e não quebra)", async () => {
  const sw = boot();
  await sw.fire("pushsubscriptionchange", {});
  assert.equal(sw.subscribed.length, 0);
  assert.equal(sw.calls.length, 0);
});
