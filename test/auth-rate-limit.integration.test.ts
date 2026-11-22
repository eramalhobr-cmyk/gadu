// S-03: limite de tentativas por IP e por e-mail (hash) em /api/auth/* e /api/invite/*.
// As rotas reais rodam com Supabase simulado. Garante: 429 em português com Retry-After e SEM tentar o login;
// o banco só recebe hashes; contador indisponível não trava o login de todos (fail open).
import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const src = (p: string) => new URL(`../src/${p}`, import.meta.url).href;

type Hit = { bucket: string; hash: string; limit: number; window: number };
let hits: Hit[] = [];
let answer: (h: Hit) => Promise<{ data: unknown; error: unknown }> = async () => ({ data: { allowed: true, hits: 1, limit: 5, retry_after: 600 }, error: null });
let adminThrows = false;
let authCalls: string[] = [];
let inviteQueries = 0;

mock.module(src("lib/supabase/admin.ts"), {
  namedExports: {
    supabaseAdmin: () => {
      if (adminThrows) throw new Error("SUPABASE_SECRET_KEY ausente");
      return {
        rpc: (name: string, a: { p_bucket: string; p_key_hash: string; p_limit: number; p_window_seconds: number }) => {
          assert.equal(name, "auth_rate_limit_hit");
          const h = { bucket: a.p_bucket, hash: a.p_key_hash, limit: a.p_limit, window: a.p_window_seconds };
          hits.push(h);
          return answer(h);
        },
        from: () => { inviteQueries++; throw new Error("não deveria consultar convites"); },
      };
    },
  },
});
mock.module(src("lib/supabase/server.ts"), {
  namedExports: {
    supabaseServer: async () => ({
      auth: {
        signInWithPassword: async () => { authCalls.push("password"); return { data: { user: { id: "u1", email: "a@exemplo.com" } }, error: null }; },
        signInWithOtp: async () => { authCalls.push("otp"); return { error: null }; },
        verifyOtp: async () => { authCalls.push("verify"); return { data: { user: { id: "u1" } }, error: null }; },
        signOut: async () => ({}),
      },
    }),
  },
});
mock.module(src("lib/access.ts"), { namedExports: { accessOf: async () => ({ ok: true, admin: false }) } });

const password = (await import(src("app/api/auth/password/route.ts"))).POST as (r: Request) => Promise<Response>;
const otp = (await import(src("app/api/auth/otp/route.ts"))).POST as (r: Request) => Promise<Response>;
const verify = (await import(src("app/api/auth/verify/route.ts"))).POST as (r: Request) => Promise<Response>;
const invite = (await import(src("app/api/invite/accept/route.ts"))).POST as (r: Request) => Promise<Response>;

const IP = "203.0.113.7";
const req = (path: string, body: unknown, headers: Record<string, string> = { "x-forwarded-for": IP }) =>
  new Request(`http://localhost${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
const login = { email: "Pessoa@Exemplo.com", password: "senha-qualquer" };
const TOKEN = "A".repeat(43);

beforeEach(() => {
  hits = []; authCalls = []; inviteQueries = 0; adminThrows = false;
  answer = async () => ({ data: { allowed: true, hits: 1, limit: 5, retry_after: 600 }, error: null });
});

test("dentro do limite: o login segue normalmente e conta por IP e por e-mail", async () => {
  const res = await password(req("/api/auth/password", login));
  assert.equal(res.status, 200);
  assert.deepEqual(authCalls, ["password"]);
  assert.deepEqual(hits.map((h) => h.bucket).sort(), ["password_email", "password_ip"]);
  assert.ok(hits.every((h) => h.window === 600));
});

test("o banco só recebe hashes: nunca o e-mail nem o IP puros", async () => {
  await password(req("/api/auth/password", login));
  for (const h of hits) {
    assert.match(h.hash, /^[0-9a-f]{64}$/);
    assert.ok(!h.hash.includes("pessoa") && !h.hash.includes("203"));
  }
  // O mesmo e-mail com outra caixa cai no mesmo contador.
  const first = hits.find((h) => h.bucket === "password_email")!.hash;
  hits = [];
  await password(req("/api/auth/password", { ...login, email: "pessoa@exemplo.com" }));
  assert.equal(hits.find((h) => h.bucket === "password_email")!.hash, first);
});

test("estourou o limite por IP: 429 em português, Retry-After, e o login nem é tentado", async () => {
  answer = async (h) => ({ data: { allowed: !h.bucket.endsWith("_ip"), hits: 99, limit: h.limit, retry_after: 180 }, error: null });
  const res = await password(req("/api/auth/password", login));
  assert.equal(res.status, 429);
  assert.equal(res.headers.get("retry-after"), "180");
  const j = (await res.json()) as { error: string };
  assert.match(j.error, /Muitas tentativas\. Aguarde 3 minutos/);
  assert.deepEqual(authCalls, [], "nenhuma tentativa de senha chega ao Supabase");
});

test("estourou o limite por e-mail: 429 mesmo com o IP livre", async () => {
  answer = async (h) => ({ data: { allowed: !h.bucket.endsWith("_email"), hits: 99, limit: h.limit, retry_after: 30 }, error: null });
  const res = await password(req("/api/auth/password", login));
  assert.equal(res.status, 429);
  assert.match(((await res.json()) as { error: string }).error, /Aguarde 1 minuto e/);
  assert.deepEqual(authCalls, []);
});

test("código por e-mail e verificação do código têm limite próprio", async () => {
  answer = async (h) => ({ data: { allowed: false, hits: 99, limit: h.limit, retry_after: 600 }, error: null });
  assert.equal((await otp(req("/api/auth/otp", { email: "a@exemplo.com" }))).status, 429);
  assert.equal((await verify(req("/api/auth/verify", { email: "a@exemplo.com", token: "123456" }))).status, 429);
  assert.deepEqual(authCalls, []);
  assert.deepEqual([...new Set(hits.map((h) => h.bucket))].sort(), ["otp_email", "otp_ip", "verify_email", "verify_ip"]);
});

test("convite: limite por IP e por token (hash) antes de consultar qualquer convite", async () => {
  answer = async (h) => ({ data: { allowed: false, hits: 99, limit: h.limit, retry_after: 600 }, error: null });
  const res = await invite(req("/api/invite/accept", { token: TOKEN, name: "Pessoa", password: "uma-senha-longa-123" }));
  assert.equal(res.status, 429);
  assert.equal(inviteQueries, 0, "não toca na tabela de convites");
  assert.deepEqual(hits.map((h) => h.bucket).sort(), ["invite_ip", "invite_token"]);
  assert.ok(hits.every((h) => !h.hash.includes(TOKEN)));
});

test("sem IP legível: só o limite por e-mail é contado", async () => {
  const res = await password(req("/api/auth/password", login, {}));
  assert.equal(res.status, 200);
  assert.deepEqual(hits.map((h) => h.bucket), ["password_email"]);
});

test("contador indisponível (erro, formato inválido, função ausente): NÃO trava o login (fail open)", async () => {
  for (const a of [
    async () => ({ data: null, error: { message: "database unavailable" } }),
    async () => ({ data: null, error: { code: "PGRST202", message: "function not found" } }),
    async () => ({ data: { allowed: "sim" }, error: null }),
    async () => { throw new Error("fetch failed"); },
  ]) {
    answer = a as typeof answer; authCalls = [];
    const res = await password(req("/api/auth/password", login));
    assert.equal(res.status, 200);
    assert.deepEqual(authCalls, ["password"]);
  }
});

test("sem a chave do servidor: o login continua (fail open) e a falha vai para o log", async () => {
  adminThrows = true;
  const res = await password(req("/api/auth/password", login));
  assert.equal(res.status, 200);
  assert.deepEqual(authCalls, ["password"]);
});
