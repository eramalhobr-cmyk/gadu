// Contraprova de S-11: com a configuração presente e sem sessão, rota protegida continua recusando (401), e pública passa.
import assert from "node:assert/strict";
import { mock, test } from "node:test";

const src = (p: string) => new URL(`../src/${p}`, import.meta.url).href;

mock.module(src("lib/config.ts"), { namedExports: { SUPABASE_URL: "https://exemplo.supabase.co", SUPABASE_KEY: "chave-publica", isAllowed: () => false } });
mock.module(src("lib/access.ts"), { namedExports: { accessOf: async () => ({ ok: false, admin: false }) } });
mock.module("@supabase/ssr", { namedExports: { createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }), signOut: async () => ({}) } }) } });

const { NextRequest } = await import("next/server.js") as { NextRequest: new (u: string) => unknown };
const { proxy } = await import(src("proxy.ts")) as { proxy: (r: unknown) => Promise<Response> };
const go = (path: string) => proxy(new NextRequest(`http://localhost${path}`));

test("com configuração e sem sessão: API protegida responde 401, nunca 503", async () => {
  const res = await go("/api/chat");
  assert.equal(res.status, 401);
});

test("com configuração e sem sessão: página protegida manda para o login", async () => {
  const res = await go("/app");
  assert.equal(res.status, 307);
  assert.match(res.headers.get("location") ?? "", /\/login/);
});

test("com configuração: rotas públicas passam", async () => {
  for (const path of ["/", "/login", "/api/health"]) assert.ok((await go(path)).status < 400, path);
});
