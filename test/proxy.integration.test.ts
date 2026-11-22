// S-11: sem a configuração do Supabase, o proxy não deixa passar as rotas protegidas (503), mas o que é público segue.
import assert from "node:assert/strict";
import { mock, test } from "node:test";

const src = (p: string) => new URL(`../src/${p}`, import.meta.url).href;
let configured = false;

mock.module(src("lib/config.ts"), {
  get namedExports() {
    return { SUPABASE_URL: configured ? "https://exemplo.supabase.co" : "", SUPABASE_KEY: configured ? "chave-publica" : "", isAllowed: () => false };
  },
});
mock.module(src("lib/access.ts"), { namedExports: { accessOf: async () => ({ ok: false, admin: false }) } });
mock.module("@supabase/ssr", { namedExports: { createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }), signOut: async () => ({}) } }) } });

const { NextRequest } = await import("next/server.js") as { NextRequest: new (u: string) => unknown };
const { proxy } = await import(src("proxy.ts")) as { proxy: (r: unknown) => Promise<Response> };
const go = (path: string) => proxy(new NextRequest(`http://localhost${path}`));

test("configuração ausente: rotas protegidas recebem 503 (API em JSON, página em texto), nunca passam", async () => {
  configured = false;
  for (const path of ["/api/chat", "/api/memories/import", "/api/admin/people", "/api/today"]) {
    const res = await go(path);
    assert.equal(res.status, 503, path);
    assert.match(((await res.json()) as { error: string }).error, /indisponível/);
    assert.equal(res.headers.get("cache-control"), "no-store");
  }
  const page = await go("/app");
  assert.equal(page.status, 503);
  assert.match(await page.text(), /indisponível/);
  assert.ok(page.headers.get("content-security-policy"), "mantém a CSP");
});

test("configuração ausente: o que é público continua no ar", async () => {
  configured = false;
  for (const path of ["/", "/login", "/api/health", "/api/auth/otp", "/api/invite/accept", "/api/cron/tick"]) {
    const res = await go(path);
    assert.notEqual(res.status, 503, path);
    assert.ok(res.status < 400, path);
  }
});
