// Rotas de agenda da meta (POST /api/goals/:id/agenda e DELETE /api/goals/:id/agenda/:eventId): Supabase em memória (RLS imitada) e Google simulado.
// Garante: 401 sem sessão (antes de tocar no Google), GOALS_ENABLED=0 (404), zod estrito (título e user_id do cliente não existem), meta só da própria pessoa,
// token do Google só da sessão, desfazer em bloco se um evento falhar, e que a rota de liberar só apaga evento que o GaDu reservou para meta dela.
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { makeFinDb, type FinStore } from "./fin-fake.ts";

const src = (p: string) => new URL(`../src/${p}`, import.meta.url).href;
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const GA = "10000000-0000-4000-8000-000000000001";
const GB = "10000000-0000-4000-8000-0000000000b1";

let sessionUser: string | null = A;
let store: FinStore = {};
let log: { tables: string[]; writes: { table: string; op: string; rows: Record<string, unknown>[] }[] } = { tables: [], writes: [] };
let gcalls: { fn: string; args: unknown[] }[] = [];
let tokenUsers: string[] = [];
let createN = 0;
let failOnCreate = 0; // falha na N-ésima criação (1 = primeira)
let deleteKind: string | null = null;

class GoogleError extends Error { kind: string; constructor(kind: string) { super(kind); this.kind = kind; } }
mock.module(src("lib/supabase/server.ts"), {
  namedExports: { supabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: sessionUser ? { id: sessionUser, email: "teste@exemplo.com" } : null } }) }, ...makeFinDb(store, () => sessionUser, log) }) },
});
mock.module(src("lib/supabase/admin.ts"), { namedExports: { supabaseAdmin: () => { throw new Error("metas nunca usa a chave secreta"); } } });
mock.module(src("lib/access.ts"), { namedExports: { accessOf: async () => ({ ok: true, admin: false }) } });
mock.module(src("lib/google.ts"), {
  namedExports: {
    GoogleError,
    accessToken: async (_db: unknown, userId: string) => { tokenUsers.push(userId); return "tok"; },
    createEvent: async (...args: unknown[]) => { gcalls.push({ fn: "create", args }); createN++; if (failOnCreate && createN === failOnCreate) throw new GoogleError("api"); return { id: `evento${createN}abc`, htmlLink: "" }; },
    deleteEvent: async (...args: unknown[]) => { gcalls.push({ fn: "delete", args }); if (deleteKind) throw new GoogleError(deleteKind); },
    events: async () => [],
  },
});
mock.module("next/server", { namedExports: { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } } });

const agenda = await import(src("app/api/goals/[id]/agenda/route.ts"));
const agendaId = await import(src("app/api/goals/[id]/agenda/[eventId]/route.ts"));
const meta = await import(src("app/api/goals/[id]/route.ts"));

const ctx = (p: Record<string, string>) => ({ params: Promise.resolve(p) });
const req = (method: string, body?: unknown) => new Request("http://localhost/x", { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const amanha = (h: number) => { const d = new Date(Date.now() + 86_400_000); d.setUTCHours(h, 0, 0, 0); return d; };
const bloco = (h: number) => ({ inicio: amanha(h).toISOString(), fim: new Date(amanha(h).getTime() + 3_600_000).toISOString() });
const J = async (r: Response) => ({ status: r.status, json: (await r.json()) as any });

beforeEach(() => {
  sessionUser = A; gcalls = []; tokenUsers = []; createN = 0; failOnCreate = 0; deleteKind = null;
  log = { tables: [], writes: [] };
  store = {
    goals: [
      { id: GA, user_id: A, titulo: "Correr 50 km", medicao: "numerica", status: "ativa", categoria: "saude", agregacao: "soma", valor_inicial: 0, valor_alvo: 50, inicio: "2026-11-01", prazo: null, descricao: null, categoria_nome: null, unidade: "km", concluida_em: null, created_at: new Date().toISOString() },
      { id: "10000000-0000-4000-8000-000000000009", user_id: A, titulo: "Antiga", medicao: "numerica", status: "arquivada", categoria: "saude", agregacao: "soma", valor_inicial: 0, valor_alvo: 5, inicio: "2026-01-01", prazo: null, descricao: null, categoria_nome: null, unidade: null, concluida_em: null, created_at: new Date().toISOString() },
      { id: GB, user_id: B, titulo: "SEGREDO-B meta", medicao: "numerica", status: "ativa", categoria: "saude", agregacao: "soma", valor_inicial: 0, valor_alvo: 5, inicio: "2026-11-01", prazo: null, descricao: null, categoria_nome: null, unidade: null, concluida_em: null, created_at: new Date().toISOString() },
    ],
    goal_events: [],
  };
});
afterEach(() => { delete process.env.GOALS_ENABLED; });

test("sem sessão: 401 e nem o Google nem o banco são tocados; GOALS_ENABLED=0 dá 404", async () => {
  sessionUser = null;
  assert.equal((await agenda.POST(req("POST", { blocos: [bloco(10)] }), ctx({ id: GA }))).status, 401);
  assert.equal((await agendaId.DELETE(req("DELETE"), ctx({ id: GA, eventId: "evento1abc" }))).status, 401);
  assert.equal(gcalls.length, 0);
  assert.equal(tokenUsers.length, 0);
  assert.equal(log.tables.length, 0);
  sessionUser = A;
  process.env.GOALS_ENABLED = "0";
  assert.equal((await agenda.POST(req("POST", { blocos: [bloco(10)] }), ctx({ id: GA }))).status, 404);
  assert.equal((await agendaId.DELETE(req("DELETE"), ctx({ id: GA, eventId: "evento1abc" }))).status, 404);
  assert.equal(gcalls.length, 0);
});

test("entrada inválida: título e user_id do cliente, lista vazia, horário invertido, passado e meta arquivada dão 400", async () => {
  const ruins: unknown[] = [
    { blocos: [bloco(10)], titulo: "Invadido" }, { blocos: [{ ...bloco(10), user_id: B }] }, { blocos: [] }, {},
    { blocos: [{ inicio: amanha(11).toISOString(), fim: amanha(10).toISOString() }] },
    { blocos: [{ inicio: new Date(Date.now() - 86_400_000).toISOString(), fim: new Date(Date.now() - 82_800_000).toISOString() }] },
    { blocos: Array.from({ length: 21 }, () => bloco(10)) },
  ];
  for (const b of ruins) assert.equal((await agenda.POST(req("POST", b), ctx({ id: GA }))).status, 400, JSON.stringify(b).slice(0, 60));
  assert.equal((await agenda.POST(req("POST", { blocos: [bloco(10)] }), ctx({ id: "10000000-0000-4000-8000-000000000009" }))).status, 400, "meta arquivada");
  assert.equal((await agenda.POST(req("POST", { blocos: [bloco(10)] }), ctx({ id: "nao-e-uuid" }))).status, 400);
  assert.equal(gcalls.length, 0);
});

test("reservar: título vem da meta, token da sessão, vínculo com user_id da sessão; B não reserva em meta de A", async () => {
  const r = await J(await agenda.POST(req("POST", { blocos: [bloco(10), bloco(14)] }), ctx({ id: GA })));
  assert.equal(r.status, 201);
  assert.equal(r.json.ids.length, 2);
  assert.deepEqual(gcalls.filter((c) => c.fn === "create").map((c) => (c.args[1] as { title: string }).title), ["Meta: Correr 50 km", "Meta: Correr 50 km"]);
  assert.deepEqual([...new Set(tokenUsers)], [A]);
  assert.equal(store.goal_events.length, 2);
  assert.ok(store.goal_events.every((e) => e.user_id === A && e.goal_id === GA && e.titulo === "Meta: Correr 50 km"));
  const det = await J(await meta.GET(req("GET"), ctx({ id: GA })));
  assert.equal(det.json.agenda.length, 2, "o detalhe da meta lista os blocos");
  sessionUser = B;
  const antes = gcalls.length;
  assert.equal((await agenda.POST(req("POST", { blocos: [bloco(10)] }), ctx({ id: GA }))).status, 404, "meta de A é invisível para B");
  assert.equal(gcalls.length, antes, "nada foi criado no Google de B");
  assert.equal((await J(await meta.GET(req("GET"), ctx({ id: GB })))).json.agenda.length, 0);
});

test("se um bloco falhar, os já criados nesta chamada são desfeitos (Google e vínculo)", async () => {
  failOnCreate = 2;
  const r = await agenda.POST(req("POST", { blocos: [bloco(10), bloco(14), bloco(16)] }), ctx({ id: GA }));
  assert.equal(r.status, 502);
  assert.equal(store.goal_events.length, 0, "nenhum vínculo sobrou");
  assert.deepEqual(gcalls.filter((c) => c.fn === "delete").map((c) => c.args[1]), ["evento1abc"]);
});

test("liberar: só apaga evento reservado para meta da própria pessoa; B nunca apaga o de A; evento já apagado no Google só limpa o vínculo", async () => {
  await agenda.POST(req("POST", { blocos: [bloco(10)] }), ctx({ id: GA }));
  const eid = store.goal_events[0].event_id as string;
  gcalls = [];
  assert.equal((await agendaId.DELETE(req("DELETE"), ctx({ id: GA, eventId: "outro-evento-qualquer" }))).status, 404, "evento que o GaDu não reservou nunca é apagado");
  assert.equal(gcalls.length, 0);
  sessionUser = B;
  assert.equal((await agendaId.DELETE(req("DELETE"), ctx({ id: GA, eventId: eid }))).status, 404);
  assert.equal(gcalls.length, 0);
  assert.equal(store.goal_events.length, 1);
  sessionUser = A;
  assert.equal((await agendaId.DELETE(req("DELETE"), ctx({ id: GA, eventId: "a b/c" }))).status, 400);
  deleteKind = "api";
  assert.equal((await agendaId.DELETE(req("DELETE"), ctx({ id: GA, eventId: eid }))).status, 502);
  assert.equal(store.goal_events.length, 1, "erro do Google mantém tudo");
  deleteKind = "gone";
  const ok = await J(await agendaId.DELETE(req("DELETE"), ctx({ id: GA, eventId: eid })));
  assert.equal(ok.status, 200);
  assert.equal(store.goal_events.length, 0);
  assert.deepEqual(ok.json.agenda, []);
});
