// Integração de /api/finance/tetos e /api/finance/ano: Supabase em memória (RLS imitada), sem rede e sem chave secreta.
// Garante: 401 sem sessão, FINANCE_ENABLED=0 desliga, um teto por categoria (PUT troca e devolve o anterior para Desfazer),
// DELETE 404 quando não há teto, isolamento entre pessoas e o acumulado do ano calculado no servidor só com dados da sessão.
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { makeFinDb, type FinStore } from "./fin-fake.ts";

const src = (p: string) => new URL(`../src/${p}`, import.meta.url).href;
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

let sessionUser: string | null = A;
let store: FinStore = {};
let log: { tables: string[]; writes: { table: string; op: string; rows: Record<string, unknown>[] }[] } = { tables: [], writes: [] };
let adminCalls = 0;

mock.module(src("lib/supabase/server.ts"), {
  namedExports: {
    supabaseServer: async () => ({
      auth: { getUser: async () => ({ data: { user: sessionUser ? { id: sessionUser, email: "teste@exemplo.com" } : null } }) },
      ...makeFinDb(store, () => sessionUser, log),
    }),
  },
});
mock.module(src("lib/supabase/admin.ts"), { namedExports: { supabaseAdmin: () => { adminCalls++; throw new Error("finanças nunca usa a chave secreta"); } } });
mock.module(src("lib/access.ts"), { namedExports: { accessOf: async () => ({ ok: true, admin: false }) } });
mock.module("next/server", { namedExports: { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } } });

const tetos = await import(src("app/api/finance/tetos/route.ts"));
const ano = await import(src("app/api/finance/ano/route.ts"));
const { hojeSP } = await import(src("lib/finance/datas.ts"));
const HOJE = hojeSP();

const req = (path: string, method = "GET", body?: unknown) => new Request(`http://localhost${path}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const J = async (r: Response) => ({ status: r.status, json: (await r.json()) as Record<string, any> });
const gasto = (user_id: string, categoria: string, valor: number, mes: number, a = HOJE.ano) => ({ id: crypto.randomUUID(), user_id, ano: a, mes, dia: 1, valor, categoria, meio: "pix", descricao: null, cartao_id: null, created_at: "", updated_at: "" });

beforeEach(() => { sessionUser = A; store = {}; log = { tables: [], writes: [] }; adminCalls = 0; delete process.env.FINANCE_ENABLED; });
afterEach(() => { delete process.env.FINANCE_ENABLED; assert.equal(adminCalls, 0, "a chave secreta nunca é usada"); });

const todas = (): [string, () => Promise<Response>][] => [
  ["GET tetos", () => tetos.GET(req("/api/finance/tetos"))],
  ["PUT tetos", () => tetos.PUT(req("/api/finance/tetos", "PUT", { categoria: "Mercado", valor: 100 }))],
  ["DELETE tetos", () => tetos.DELETE(req("/api/finance/tetos?categoria=Mercado", "DELETE"))],
  ["GET ano", () => ano.GET(req("/api/finance/ano"))],
];

test("sem sessão: 401 e nada é consultado; FINANCE_ENABLED=0: 404 'disabled'", async () => {
  sessionUser = null;
  for (const [nome, fn] of todas()) assert.equal((await J(await fn())).status, 401, nome);
  assert.deepEqual(log.tables, []);
  sessionUser = A; process.env.FINANCE_ENABLED = "0";
  for (const [nome, fn] of todas()) {
    const r = await J(await fn());
    assert.equal(r.status, 404, nome); assert.equal(r.json.error, "disabled", nome);
  }
  assert.deepEqual(log.tables, []);
});

test("PUT cria e depois troca o teto (um por categoria, nome padrão), devolvendo o anterior; DELETE tira e 404 sem teto", async () => {
  let r = await J(await tetos.PUT(req("/api/finance/tetos", "PUT", { categoria: "restaurante", valor: "600", user_id: B })));
  assert.equal(r.status, 200);
  assert.equal(r.json.teto.categoria, "Restaurantes");
  assert.equal(r.json.anterior, null);
  r = await J(await tetos.PUT(req("/api/finance/tetos", "PUT", { categoria: "Restaurantes", valor: 800 })));
  assert.equal(r.json.anterior, 600);
  assert.equal(r.json.teto.valor, 800);
  assert.equal((store.fin_tetos ?? []).length, 1);
  assert.equal(store.fin_tetos![0]!.user_id, A, "user_id sempre da sessão");
  assert.equal((await J(await tetos.PUT(req("/api/finance/tetos", "PUT", { categoria: "Lazer", valor: 0 })))).status, 400);
  r = await J(await tetos.DELETE(req("/api/finance/tetos?categoria=restaurante", "DELETE")));
  assert.equal(r.status, 200); assert.equal(r.json.anterior, 800);
  assert.equal((await J(await tetos.DELETE(req("/api/finance/tetos?categoria=Restaurantes", "DELETE")))).status, 404);
});

test("GET tetos: status do mês com % e nível; B não vê nem apaga o teto de A", async () => {
  store.fin_tetos = [{ id: crypto.randomUUID(), user_id: A, categoria: "Mercado", valor: 100, created_at: "", updated_at: "" }];
  store.fin_gastos = [gasto(A, "Mercado", 85, HOJE.mes), gasto(B, "Mercado", 900, HOJE.mes)];
  const r = await J(await tetos.GET(req(`/api/finance/tetos?ano=${HOJE.ano}&mes=${HOJE.mes}`)));
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.tetos.map((t: any) => [t.categoria, t.gasto, t.pct, t.nivel]), [["Mercado", 85, 85, "alerta"]]);
  sessionUser = B;
  assert.deepEqual((await J(await tetos.GET(req("/api/finance/tetos")))).json.tetos, []);
  assert.equal((await J(await tetos.DELETE(req("/api/finance/tetos?categoria=Mercado", "DELETE")))).status, 404);
  assert.equal(store.fin_tetos.length, 1);
});

test("GET ano: soma do ano até o mês atual, por categoria e por mês, só da sessão; ano futuro é recusado", async () => {
  store.fin_gastos = [gasto(A, "Mercado", 100, 1), gasto(A, "Lazer", 40.5, HOJE.mes), gasto(A, "Mercado", 70, 5, HOJE.ano - 1), gasto(B, "Mercado", 4321, 1)];
  let r = await J(await ano.GET(req(`/api/finance/ano?ano=${HOJE.ano}`)));
  assert.equal(r.status, 200);
  assert.equal(r.json.total, 140.5);
  assert.equal(r.json.qtd, 2);
  r = await J(await ano.GET(req(`/api/finance/ano?ano=${HOJE.ano}&categoria=mercado`)));
  assert.equal(r.json.total, 100);
  assert.equal((await J(await ano.GET(req(`/api/finance/ano?ano=${HOJE.ano + 1}`)))).status, 400);
});
