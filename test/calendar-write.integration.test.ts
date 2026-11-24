// Editar e apagar evento (PATCH/DELETE /api/calendar/:id): exige sessão, valida a entrada (zod estrito) e só chama o Google
// com o token da própria pessoa; erros do Google viram respostas claras. A permissão é a mesma de criar (calendar.events).
import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const src = (p: string) => new URL(`../src/${p}`, import.meta.url).href;
let sessionUser: string | null = "11111111-1111-4111-8111-111111111111";
let calls: { fn: string; args: unknown[] }[] = [];
let googleFail: string | null = null;
let tokenUsers: string[] = [];

class GoogleError extends Error { kind: string; constructor(kind: string) { super(kind); this.kind = kind; } }
mock.module(src("lib/supabase/server.ts"), {
  namedExports: { supabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: sessionUser ? { id: sessionUser, email: "teste@exemplo.com" } : null } }) } }) },
});
mock.module(src("lib/access.ts"), { namedExports: { accessOf: async () => ({ ok: true, admin: false }) } });
mock.module(src("lib/google.ts"), {
  namedExports: {
    GoogleError,
    accessToken: async (_db: unknown, userId: string) => { tokenUsers.push(userId); return "tok"; },
    updateEvent: async (...args: unknown[]) => { calls.push({ fn: "update", args }); if (googleFail) throw new GoogleError(googleFail); return { id: "ev1", htmlLink: "https://exemplo.test/ev1" }; },
    deleteEvent: async (...args: unknown[]) => { calls.push({ fn: "delete", args }); if (googleFail) throw new GoogleError(googleFail); },
    createEvent: async (...args: unknown[]) => { calls.push({ fn: "create", args }); return { id: "x", htmlLink: "" }; }, events: async () => [],
  },
});
mock.module("next/server", { namedExports: { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } } });

const route = await import(src("app/api/calendar/[id]/route.ts"));
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const patch = (id: string, body: unknown) => route.PATCH(new Request("http://localhost/api/calendar/x", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), ctx(id));
const del = (id: string) => route.DELETE(new Request("http://localhost/api/calendar/x", { method: "DELETE" }), ctx(id));

beforeEach(() => { sessionUser = "11111111-1111-4111-8111-111111111111"; calls = []; googleFail = null; tokenUsers = []; });

test("sem sessão: 401 e o Google nem é chamado", async () => {
  sessionUser = null;
  assert.equal((await patch("abc123def", { title: "Novo" })).status, 401);
  assert.equal((await del("abc123def")).status, 401);
  assert.equal(calls.length, 0);
  assert.equal(tokenUsers.length, 0);
});

test("entrada inválida: id estranho, corpo vazio, chave desconhecida (user_id) e horário invertido dão 400", async () => {
  assert.equal((await patch("abc123def", {})).status, 400);
  assert.equal((await patch("abc123def", { title: "x", user_id: "outra" })).status, 400);
  assert.equal((await patch("../../etc", { title: "x" })).status, 400);
  assert.equal((await patch("abc123def", { start: "2026-12-01T12:00:00-03:00", end: "2026-12-01T10:00:00-03:00" })).status, 400);
  assert.equal((await del("a b/c")).status, 400);
  assert.equal(calls.length, 0);
});

test("editar e apagar chamam o Google com o token da própria pessoa", async () => {
  const r = await patch("abc123def", { title: "Novo título", location: "Clínica" });
  assert.equal(r.status, 200);
  assert.deepEqual(calls[0], { fn: "update", args: ["tok", "abc123def", { title: "Novo título", location: "Clínica" }] });
  assert.equal((await del("abc123def")).status, 200);
  assert.deepEqual(calls[1], { fn: "delete", args: ["tok", "abc123def"] });
  assert.deepEqual(tokenUsers, [sessionUser, sessionUser]);
});

test("erros do Google: evento que não existe (404), falta de permissão (403) e Google fora (502)", async () => {
  googleFail = "gone"; assert.equal((await del("abc123def")).status, 404);
  googleFail = "scope"; assert.equal((await patch("abc123def", { title: "x" })).status, 403);
  googleFail = "api"; assert.equal((await del("abc123def")).status, 502);
});

const createRoute = await import(src("app/api/calendar/route.ts"));
const create = (body: unknown) => createRoute.POST(new Request("http://localhost/api/calendar", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
}));

test("série recorrente usa o token da sessão e rejeita regra inválida antes de chamar o Google", async () => {
  const start = new Date(Date.now() + 86_400_000).toISOString();
  const end = new Date(Date.parse(start) + 3_600_000).toISOString();
  const recurrence = { frequency: "WEEKLY", interval: 2, count: 5 };
  const draft = { title: "Aula", start, end, recurrence };
  assert.equal((await create({ ...draft, recurrence: { ...recurrence, interval: 0 } })).status, 400);
  assert.equal((await create({ ...draft, recurrence: { rrule: "RRULE:FREQ=SECONDLY" } })).status, 400);
  assert.equal((await create({ ...draft, recurrence: { frequency: "WEEKLY" } })).status, 400, "série sem fim não é aceita");
  assert.equal((await create({ ...draft, recurrence: { frequency: "DAILY", count: 366 } })).status, 400, "no máximo 365 repetições");
  assert.equal(calls.length, 0);
  assert.equal((await create(draft)).status, 200);
  assert.deepEqual(calls, [{ fn: "create", args: ["tok", { ...draft, location: undefined }] }]);
  assert.deepEqual(tokenUsers, [sessionUser]);
});
