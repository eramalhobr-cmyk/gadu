// Telemetria de erros: rota do navegador, captura do servidor, lista do Admin e resumo do alerta, com Supabase simulado.
// Garante: exige sessão, user_id vem da sessão, nenhuma mensagem/e-mail é guardado, limite de taxa, interruptor e papel de administrador.
import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

// A captura do servidor lê o cookie com o endereço do Supabase; sem ele (como no CI) não há como saber a pessoa.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "http://127.0.0.1:54321";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||= "chave-publica-ficticia";

const src = (p: string) => new URL(`../src/${p}`, import.meta.url).href;
const A = "00000000-0000-4000-8000-0000000000a1";
const B = "00000000-0000-4000-8000-0000000000b1";

type Row = Record<string, unknown>;
let rows: Row[] = [];
let session: { user: { id: string }; admin: boolean } | null = null;
let dbCalls = 0;
let tableMissing = false;
let deletes: { lt: string }[] = [];
let cookieUser: string | null = null;

class Q implements PromiseLike<{ data: Row[] | null; count: number | null; error: unknown }> {
  private filters: ((r: Row) => boolean)[] = [];
  private head = false;
  private mode: "select" | "delete" = "select";
  private ltVal = "";
  constructor(opts: { head?: boolean } = {}) { this.head = !!opts.head; }
  del() { this.mode = "delete"; return this; }
  eq(c: string, v: unknown) { this.filters.push((r) => r[c] === v); return this; }
  is(c: string, v: null) { this.filters.push((r) => (r[c] ?? null) === v); return this; }
  gte(c: string, v: string) { this.filters.push((r) => String(r[c]) >= v); return this; }
  lt(c: string, v: string) { this.ltVal = v; this.filters.push((r) => String(r[c]) < v); return this; }
  order() { return this; }
  limit() { return this; }
  then<T1, T2>(ok?: (v: { data: Row[] | null; count: number | null; error: unknown }) => T1 | PromiseLike<T1>, ko?: (e: unknown) => T2 | PromiseLike<T2>) {
    if (tableMissing) return Promise.resolve({ data: null, count: null, error: { message: "relation does not exist" } }).then(ok, ko);
    const hit = rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.mode === "delete") { deletes.push({ lt: this.ltVal }); rows = rows.filter((r) => !hit.includes(r)); return Promise.resolve({ data: null, count: hit.length, error: null }).then(ok, ko); }
    return Promise.resolve({ data: this.head ? null : hit, count: hit.length, error: null }).then(ok, ko);
  }
}

mock.module(src("lib/supabase/admin.ts"), {
  namedExports: {
    supabaseAdmin: () => {
      dbCalls++;
      return {
        from: (t: string) => {
          // O alerta (outro arquivo de teste) usa as tabelas de estado: aqui elas "não existem" e o alerta se cala.
          if (t !== "error_events") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: "sem tabela" } }) }) }) } as never;
          return {
            select: (_c: string, o?: { head?: boolean }) => new Q(o),
            insert: async (row: Row) => { if (tableMissing) return { error: { message: "x" } }; rows.push({ created_at: new Date().toISOString(), ...row }); return { error: null }; },
            delete: () => new Q().del(),
          };
        },
      };
    },
  },
});
mock.module(src("app/api/google/_auth.ts"), { namedExports: { signedIn: async () => session } });
mock.module(src("app/api/admin/_admin.ts"), { namedExports: { adminOnly: async () => (session?.admin ? session : null) } });
mock.module("@supabase/ssr", { namedExports: { createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: cookieUser ? { id: cookieUser } : null } }) } }) } });

const { POST } = await import(src("app/api/telemetria/erro/route.ts")) as { POST: (r: Request) => Promise<Response> };
const { GET: LISTA } = await import(src("app/api/admin/erros/route.ts")) as { GET: () => Promise<Response> };
const { POST: RESUMO } = await import(src("app/api/cron/telemetria-resumo/route.ts")) as { POST: (r: Request) => Promise<Response> };
const { registrarErroDeRequisicao } = await import(src("lib/telemetria/servidor.ts")) as { registrarErroDeRequisicao: (e: unknown, r: { path: string; headers: Record<string, string | undefined> }) => Promise<void> };

const post = (body: unknown, headers: Record<string, string> = {}) => POST(new Request("http://localhost/api/telemetria/erro", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) }));
const seed = (n: number, user = A, extra: Row = {}) => { for (let i = 0; i < n; i++) rows.push({ user_id: user, created_at: new Date().toISOString(), origem: "cliente", rota: "/app", nome: "TypeError", status: null, local_codigo: null, versao: null, impressao: "i".repeat(64), ...extra }); };

beforeEach(() => {
  rows = []; session = { user: { id: A }, admin: false }; dbCalls = 0; tableMissing = false; deletes = []; cookieUser = null;
  delete process.env.TELEMETRIA_ENABLED; delete process.env.TELEMETRIA_TOKEN; process.env.VERCEL_GIT_COMMIT_SHA = "a3b4a791cfc32b5c";
});

test("sem sessão: 401 e nada é gravado", async () => {
  session = null;
  assert.equal((await post({ rota: "/app", nome: "TypeError" })).status, 401);
  assert.equal(rows.length, 0);
});

test("grava com o user_id da SESSÃO, só campos permitidos e sem mensagem", async () => {
  const res = await post({ rota: "https://gadu-agent.vercel.app/app?tab=hoje&email=a@b.c", nome: "TypeError", local: "https://gadu-agent.vercel.app/_next/static/chunks/a.js:3:4" });
  assert.equal(res.status, 204);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].user_id, A);
  assert.equal(rows[0].origem, "cliente");
  assert.equal(rows[0].rota, "/app");
  assert.equal(rows[0].nome, "TypeError");
  assert.equal(rows[0].local_codigo, "/_next/static/chunks/a.js:3");
  assert.equal(rows[0].versao, "a3b4a791cfc3");
  assert.match(String(rows[0].impressao), /^[0-9a-f]{64}$/);
  assert.deepEqual(Object.keys(rows[0]).sort(), ["codigo", "created_at", "impressao", "local_codigo", "nome", "origem", "rota", "status", "user_id", "versao"]);
  assert.ok(!JSON.stringify(rows[0]).includes("@"), "nenhum e-mail");
});

test("outra pessoa grava no próprio nome (isolamento): B nunca escreve como A", async () => {
  session = { user: { id: B }, admin: false };
  await post({ rota: "/app", nome: "Erro" });
  assert.equal(rows[0].user_id, B);
});

test("corpo com user_id, message, e-mail ou stack é recusado (400) e nada é gravado", async () => {
  for (const extra of [{ user_id: A }, { message: "falhou para maria@exemplo.com" }, { email: "a@b.c" }, { stack: "x" }]) {
    assert.equal((await post({ rota: "/app", nome: "TypeError", ...extra })).status, 400, JSON.stringify(extra));
  }
  assert.equal((await POST(new Request("http://localhost/api/telemetria/erro", { method: "POST", body: "isto não é json" }))).status, 400);
  assert.equal(rows.length, 0);
});

test("pedido grande demais: 413", async () => {
  assert.equal((await post({ rota: "/app", nome: "TypeError" }, { "content-length": "5000" })).status, 413);
  assert.equal(rows.length, 0);
});

test("limite de taxa por pessoa: 30 em 10 minutos, depois 429 sem gravar; outra pessoa não é afetada", async () => {
  seed(30, A);
  const res = await post({ rota: "/app", nome: "TypeError" });
  assert.equal(res.status, 429);
  assert.equal(res.headers.get("retry-after"), "600");
  assert.equal(rows.length, 30);
  session = { user: { id: B }, admin: false };
  assert.equal((await post({ rota: "/app", nome: "TypeError" })).status, 204);
  assert.equal(rows.length, 31);
  // registros antigos (fora da janela) não contam
  rows = []; seed(30, A, { created_at: new Date(Date.now() - 3_600_000).toISOString() });
  session = { user: { id: A }, admin: false };
  assert.equal((await post({ rota: "/app", nome: "TypeError" })).status, 204);
});

test("tabela ausente ou banco fora: o app não recebe erro (204) e nada quebra", async () => {
  tableMissing = true;
  assert.equal((await post({ rota: "/app", nome: "TypeError" })).status, 204);
});

test("interruptor TELEMETRIA_ENABLED=0: 204 sem tocar no banco, nem a captura do servidor, nem a lista", async () => {
  process.env.TELEMETRIA_ENABLED = "0";
  assert.equal((await post({ rota: "/app", nome: "TypeError" })).status, 204);
  cookieUser = A;
  await registrarErroDeRequisicao(new Error("x"), { path: "/api/chat", headers: { cookie: "sb=1" } });
  assert.equal(dbCalls, 0);
  assert.equal(rows.length, 0);
  session = { user: { id: A }, admin: true };
  const j = await (await LISTA()).json();
  assert.equal(j.ligado, false);
  assert.equal(dbCalls, 0);
});

test("captura do servidor: com ou sem sessão, sem mensagem, com 'arquivo:linha', status 500 e nunca a própria rota", async () => {
  const err = Object.assign(new Error("saldo de maria@exemplo.com inválido"), { name: "RangeError" });
  err.stack = "RangeError: saldo de maria@exemplo.com inválido\n    at f (/var/task/.next/server/app/api/chat/route.js:9:5)";
  await registrarErroDeRequisicao(err, { path: "/api/chat?x=maria@exemplo.com", headers: { cookie: "sb-token=abc" } });
  assert.equal(rows.length, 1, "sem pessoa logada pelo cookie, o erro entra com user_id nulo");
  assert.equal(rows[0].user_id, null);
  rows = [];
  cookieUser = A;
  await registrarErroDeRequisicao(err, { path: "/api/chat?x=maria@exemplo.com", headers: { cookie: "sb-token=abc" } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].user_id, A);
  assert.equal(rows[0].origem, "servidor");
  assert.equal(rows[0].rota, "/api/chat");
  assert.equal(rows[0].nome, "RangeError");
  assert.equal(rows[0].status, 500);
  assert.equal(rows[0].local_codigo, "/var/task/.next/server/app/api/chat/route.js:9");
  assert.ok(!JSON.stringify(rows[0]).includes("maria"), "a mensagem do erro nunca é guardada");
  await registrarErroDeRequisicao(err, { path: "/api/telemetria/erro", headers: { cookie: "sb-token=abc" } });
  assert.equal(rows.length, 1, "não registra a própria rota (evita laço)");
  await registrarErroDeRequisicao(err, { path: "/api/chat", headers: {} });
  assert.equal(rows.length, 2, "sem cookie, entra com user_id nulo");
  assert.equal(rows[1].user_id, null);
});

test("Admin: pessoa comum 403; administrador vê grupos, totais e nenhum user_id", async () => {
  seed(2, A, { impressao: "a".repeat(64) }); seed(1, B, { impressao: "b".repeat(64), nome: "Outro" });
  assert.equal((await LISTA()).status, 403);
  session = { user: { id: A }, admin: true };
  const j = await (await LISTA()).json();
  assert.equal(j.disponivel, true);
  assert.equal(j.total24h, 3);
  assert.deepEqual(j.grupos.map((g: { vezes: number }) => g.vezes).sort(), [1, 2]);
  assert.ok(!JSON.stringify(j).includes(A) && !JSON.stringify(j).includes(B), "a resposta não carrega user_id");
  tableMissing = true;
  assert.equal((await (await LISTA()).json()).disponivel, false);
});

test("resumo do alerta: desligado sem token (404), 401 com token errado, resumo sem user_id e apaga o que passou de 30 dias", async () => {
  const chamar = (auth?: string) => RESUMO(new Request("http://localhost/api/cron/telemetria-resumo", { method: "POST", headers: auth ? { authorization: auth } : {} }));
  assert.equal((await chamar("Bearer qualquer")).status, 404);
  process.env.TELEMETRIA_TOKEN = "t".repeat(32);
  assert.equal((await chamar()).status, 401);
  assert.equal((await chamar("Bearer " + "x".repeat(32))).status, 401);
  assert.equal((await chamar("Bearer curto")).status, 401);
  seed(3, A, { origem: "servidor", status: 500 }); seed(1, B);
  seed(2, A, { created_at: new Date(Date.now() - 40 * 86_400_000).toISOString(), impressao: "v".repeat(64) });
  const res = await chamar("Bearer " + "t".repeat(32));
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.total24h, 4);
  assert.equal(j.servidor, 3);
  assert.equal(j.cliente, 1);
  assert.equal(j.apagados, 2);
  assert.equal(deletes.length, 1);
  assert.ok(!JSON.stringify(j).includes(A) && !JSON.stringify(j).includes(B));
  assert.equal(rows.length, 4, "só os antigos foram apagados");
  process.env.TELEMETRIA_ENABLED = "0";
  assert.equal((await chamar("Bearer " + "t".repeat(32))).status, 404);
});
