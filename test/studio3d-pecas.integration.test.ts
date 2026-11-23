// Rotas /api/3d/pecas/*: Supabase em memória (RLS imitada), sem rede, sem IA e sem chave secreta.
// Garante: 401 sem sessão, MODELING_3D_ENABLED desligado = 404, user_id SEMPRE da sessão, isolamento entre pessoas,
// versão só em peça da própria pessoa, só as 30 versões mais recentes, apagar a peça apaga as versões.
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
mock.module(src("lib/supabase/admin.ts"), { namedExports: { supabaseAdmin: () => { adminCalls++; throw new Error("o 3D nunca usa a chave secreta"); } } });
mock.module(src("lib/access.ts"), { namedExports: { accessOf: async () => ({ ok: true, admin: false }) } });
mock.module("next/server", { namedExports: { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } } });

const lista = await import(src("app/api/3d/pecas/route.ts"));
const peca = await import(src("app/api/3d/pecas/[id]/route.ts"));
const versoes = await import(src("app/api/3d/pecas/[id]/versoes/route.ts"));

const req = (path: string, method = "GET", body?: unknown) => new Request(`http://localhost${path}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const J = async (r: Response) => ({ status: r.status, json: (await r.json()) as Record<string, any> });
const ID_X = "33333333-3333-4333-8333-333333333333";
const criar = async (pedido = "Um suporte de celular com 70 mm", scad = "largura = 70; // [30:1:200] Largura\ncube([largura, 10, 5]);") =>
  J(await lista.POST(req("/api/3d/pecas", "POST", { pedido, scad })));

beforeEach(() => { sessionUser = A; store = {}; log = { tables: [], writes: [] }; adminCalls = 0; process.env.MODELING_3D_ENABLED = "1"; });
afterEach(() => { delete process.env.MODELING_3D_ENABLED; assert.equal(adminCalls, 0, "a chave secreta nunca é usada"); });

const todas = (): [string, () => Promise<Response>][] => [
  ["GET pecas", () => lista.GET()],
  ["POST pecas", () => lista.POST(req("/api/3d/pecas", "POST", { pedido: "x", scad: "cube(1);" }))],
  ["GET peca", () => peca.GET(req(`/api/3d/pecas/${ID_X}`), ctx(ID_X))],
  ["PATCH peca", () => peca.PATCH(req(`/api/3d/pecas/${ID_X}`, "PATCH", { valores: { a: 1 } }), ctx(ID_X))],
  ["DELETE peca", () => peca.DELETE(req(`/api/3d/pecas/${ID_X}`, "DELETE"), ctx(ID_X))],
  ["POST versao", () => versoes.POST(req(`/api/3d/pecas/${ID_X}/versoes`, "POST", { modo: "refinar", scad: "cube(2);" }), ctx(ID_X))],
];

test("sem sessão: 401 em todas, sem tocar no banco", async () => {
  sessionUser = null;
  for (const [n, f] of todas()) assert.equal((await f()).status, 401, n);
  assert.equal(log.tables.length, 0);
});

test("interruptor desligado: 404 em todas, sem tocar no banco", async () => {
  process.env.MODELING_3D_ENABLED = "0";
  for (const [n, f] of todas()) assert.equal((await f()).status, 404, n);
  assert.equal(log.tables.length, 0);
});

test("criar, listar, abrir, ajustar medidas e nova versão: tudo da própria pessoa", async () => {
  const c = await criar();
  assert.equal(c.status, 201);
  assert.equal(c.json.peca.titulo, "Suporte de celular com 70 mm");
  const id = c.json.peca.id as string;
  assert.equal(store.pecas_3d![0]!.user_id, A);
  assert.equal(store.pecas_3d_versoes![0]!.user_id, A);
  assert.equal((await J(await peca.PATCH(req(`/api/3d/pecas/${id}`, "PATCH", { valores: { largura: 90 } }), ctx(id)))).status, 200);
  const v = await J(await versoes.POST(req(`/api/3d/pecas/${id}/versoes`, "POST", { modo: "refinar", pedido: "mais alto", scad: "cube(3);" }), ctx(id)));
  assert.equal(v.status, 201);
  const g = await J(await peca.GET(req(`/api/3d/pecas/${id}`), ctx(id)));
  assert.equal(g.status, 200);
  assert.deepEqual(g.json.versoes.map((x: { scad: string }) => x.scad.slice(0, 7)), ["cube(3)", "largura"], "mais nova primeiro");
  assert.deepEqual(g.json.peca.valores, {}, "versão nova volta os controles ao padrão do código");
  const l = await J(await lista.GET());
  assert.equal(l.json.pecas.length, 1);
});

test("user_id no corpo é recusado (corpo estrito)", async () => {
  const r = await J(await lista.POST(req("/api/3d/pecas", "POST", { pedido: "x", scad: "cube(1);", user_id: B })));
  assert.equal(r.status, 400);
  assert.equal(store.pecas_3d?.length ?? 0, 0);
});

test("B não lê, não muda, não apaga e não pendura versão na peça de A", async () => {
  const id = (await criar()).json.peca.id as string;
  sessionUser = B;
  assert.equal((await J(await lista.GET())).json.pecas.length, 0);
  assert.equal((await peca.GET(req(`/api/3d/pecas/${id}`), ctx(id))).status, 404);
  assert.equal((await peca.PATCH(req(`/api/3d/pecas/${id}`, "PATCH", { titulo: "roubada" }), ctx(id))).status, 404);
  assert.equal((await peca.DELETE(req(`/api/3d/pecas/${id}`, "DELETE"), ctx(id))).status, 404);
  assert.equal((await versoes.POST(req(`/api/3d/pecas/${id}/versoes`, "POST", { modo: "refinar", scad: "cube(9);" }), ctx(id))).status, 404);
  assert.equal(store.pecas_3d!.length, 1);
  assert.equal(store.pecas_3d![0]!.titulo, "Suporte de celular com 70 mm");
  assert.equal(store.pecas_3d_versoes!.length, 1);
});

test("guarda só as 30 versões mais recentes; apagar a peça apaga as versões", async () => {
  const id = (await criar()).json.peca.id as string;
  for (let i = 0; i < 31; i++) await versoes.POST(req(`/api/3d/pecas/${id}/versoes`, "POST", { modo: "refinar", scad: `cube(${i});` }), ctx(id));
  assert.equal(store.pecas_3d_versoes!.length, 30);
  assert.ok(store.pecas_3d_versoes!.some((v) => v.scad === "cube(30);"));
  assert.ok(!store.pecas_3d_versoes!.some((v) => String(v.scad).startsWith("largura")), "a mais antiga saiu");
  assert.equal((await peca.DELETE(req(`/api/3d/pecas/${id}`, "DELETE"), ctx(id))).status, 200);
  assert.equal(store.pecas_3d!.length, 0);
  assert.equal(store.pecas_3d_versoes!.length, 0);
});

test("id que não é uuid: 404 sem consultar", async () => {
  assert.equal((await peca.GET(req("/api/3d/pecas/abc"), ctx("abc"))).status, 404);
  assert.equal(log.tables.length, 0);
});
