// Percepções com Aceitar/Ignorar (POST /api/insights e /api/insights/desfazer): Supabase em memória (RLS imitada) e Google simulado.
// Garante: 401 sem sessão (nada tocado), zod estrito, "cheio" só ignora, Aceitar faz só a ação do tipo nas linhas da própria pessoa,
// devolve o necessário para o Desfazer, e o Desfazer volta exatamente isso e apaga a resposta de hoje. B nunca mexe no que é de A.
import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import { makeFinDb, type FinStore } from "./fin-fake.ts";

const src = (p: string) => new URL(`../src/${p}`, import.meta.url).href;
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

let sessionUser: string | null = A;
let store: FinStore = {};
let log: { tables: string[]; writes: { table: string; op: string; rows: Record<string, unknown>[] }[] } = { tables: [], writes: [] };
let gcalls: { fn: string; args: unknown[] }[] = [];

class GoogleError extends Error { kind: string; constructor(kind: string) { super(kind); this.kind = kind; } }
mock.module(src("lib/supabase/server.ts"), {
  namedExports: { supabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: sessionUser ? { id: sessionUser, email: "t@e.com" } : null } }) }, ...makeFinDb(store, () => sessionUser, log) }) },
});
mock.module(src("lib/supabase/admin.ts"), { namedExports: { supabaseAdmin: () => { throw new Error("percepções nunca usam a chave secreta"); } } });
mock.module(src("lib/access.ts"), { namedExports: { accessOf: async () => ({ ok: true, admin: false }) } });
mock.module(src("lib/google.ts"), {
  namedExports: {
    GoogleError,
    accessToken: async () => "tok",
    createEvent: async (...args: unknown[]) => { gcalls.push({ fn: "create", args }); return { id: "focoabc123", htmlLink: "" }; },
    deleteEvent: async (...args: unknown[]) => { gcalls.push({ fn: "delete", args }); },
  },
});
mock.module("next/server", { namedExports: { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } } });

const rota = await import(src("app/api/insights/route.ts"));
const desfaz = await import(src("app/api/insights/desfazer/route.ts"));
const { spNow } = await import(src("lib/briefing.ts"));
const HOJE = spNow().day;
const post = (body: unknown) => new Request("http://localhost/api/insights", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const J = async (r: Response) => ({ status: r.status, json: (await r.json()) as any });
const task = (id: number, user_id: string, due_date: string | null, status = "open") => ({ id, user_id, title: `t${id}`, due_date, status, priority: 2, origin: "Você" });

beforeEach(() => {
  sessionUser = A; gcalls = []; log = { tables: [], writes: [] };
  store = { tasks: [task(1, A, "2026-01-10"), task(2, A, "2026-01-05"), task(3, A, null), task(4, A, "2026-01-01", "done"), task(9, B, "2026-01-01")], insight_respostas: [] };
});

test("sem sessão: 401 e nada é tocado; corpo inválido e 'cheio' aceito dão 400", async () => {
  sessionUser = null;
  assert.equal((await rota.POST(post({ tipo: "atrasadas", decisao: "aceita" }))).status, 401);
  assert.equal((await desfaz.POST(post({ tipo: "atrasadas" }))).status, 401);
  assert.deepEqual(log.tables, []);
  sessionUser = A;
  assert.equal((await rota.POST(post({ tipo: "atrasadas", decisao: "aceita", user_id: B }))).status, 400);
  assert.equal((await rota.POST(post({ tipo: "clima", decisao: "aceita" }))).status, 400);
  assert.equal((await rota.POST(post({ tipo: "cheio", decisao: "aceita" }))).status, 400);
});

test("aceitar atrasadas: só as abertas e vencidas de A vão para hoje; Desfazer volta as datas e a percepção reaparece", async () => {
  const r = await J(await rota.POST(post({ tipo: "atrasadas", decisao: "aceita" })));
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.desfazer.tarefas.map((t: any) => t.id), [2, 1]);
  const due = Object.fromEntries(store.tasks!.map((t) => [t.id, t.due_date]));
  assert.deepEqual(due, { 1: HOJE, 2: HOJE, 3: null, 4: "2026-01-01", 9: "2026-01-01" });
  assert.deepEqual(store.insight_respostas!.map((x) => [x.user_id, x.dia, x.tipo, x.decisao]), [[A, HOJE, "atrasadas", "aceita"]]);
  const u = await desfaz.POST(post({ tipo: "atrasadas", desfazer: r.json.desfazer }));
  assert.equal(u.status, 200);
  assert.deepEqual(store.tasks!.filter((t) => t.user_id === A).map((t) => t.due_date), ["2026-01-10", "2026-01-05", null, "2026-01-01"]);
  assert.equal(store.insight_respostas!.length, 0);
});

test("B não mexe no que é de A: aceitar não toca as tarefas de A e o Desfazer com ids de A não muda nada", async () => {
  sessionUser = B;
  const r = await J(await rota.POST(post({ tipo: "atrasadas", decisao: "aceita" })));
  assert.deepEqual(r.json.desfazer.tarefas.map((t: any) => t.id), [9]);
  await desfaz.POST(post({ tipo: "atrasadas", desfazer: { tarefas: [{ id: 1, due_date: "2000-01-01" }] } }));
  assert.equal(store.tasks!.find((t) => t.id === 1)!.due_date, "2026-01-10");
});

test("aceitar e-mail cria a tarefa de hoje; Desfazer cancela; ignorar grava só a decisão, sem conteúdo", async () => {
  const r = await J(await rota.POST(post({ tipo: "email", decisao: "aceita", ref: { from: "Banco <b@x.com>", subject: "Fatura" } })));
  assert.equal(r.status, 200);
  const nova = store.tasks!.find((t) => t.origin === "Percepção")!;
  assert.equal(nova.title, "Responder e-mail: Fatura (Banco)");
  assert.equal(nova.due_date, HOJE);
  await desfaz.POST(post({ tipo: "email", desfazer: r.json.desfazer }));
  assert.equal(nova.status, "cancelled");
  const ig = await J(await rota.POST(post({ tipo: "conflito", decisao: "ignorada" })));
  assert.equal(ig.status, 200);
  assert.deepEqual(Object.keys(store.insight_respostas![0]!).sort(), ["created_at", "decisao", "dia", "id", "tipo", "user_id"].filter((k) => k in store.insight_respostas![0]!).sort());
  assert.ok(!JSON.stringify(store.insight_respostas).includes("Fatura"));
});

test("aceitar janela livre reserva 'Foco' de até 2 h no Google; Desfazer apaga o evento", async () => {
  const ini = new Date(Date.now() + 3_600_000), fim = new Date(ini.getTime() + 5 * 3_600_000);
  const r = await J(await rota.POST(post({ tipo: "livre", decisao: "aceita", ref: { inicio: ini.toISOString(), fim: fim.toISOString() } })));
  assert.equal(r.status, 200);
  const ev = gcalls[0]!.args[1] as { title: string; start: string; end: string };
  assert.equal(ev.title, "Foco");
  assert.ok(Date.parse(ev.end) - Date.parse(ev.start) <= 2 * 3_600_000);
  await desfaz.POST(post({ tipo: "livre", desfazer: r.json.desfazer }));
  assert.deepEqual(gcalls.map((c) => c.fn), ["create", "delete"]);
  assert.equal((await rota.POST(post({ tipo: "livre", decisao: "aceita", ref: { inicio: new Date(Date.now() - 7_200_000).toISOString(), fim: new Date(Date.now() - 3_600_000).toISOString() } }))).status, 409);
});
