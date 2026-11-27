// Tela de Lembretes: rotas com Supabase simulado em memória (só dados sintéticos).
// Garante: exige sessão, valida com zod, sempre filtra pela pessoa da sessão, rearma o aviso ao mudar o horário
// e não mexe no lembrete de outra pessoa.
import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const src = (p: string) => new URL(`../src/${p}`, import.meta.url).href;
const A = "00000000-0000-4000-8000-0000000000a1";
const B = "00000000-0000-4000-8000-0000000000b1";

type Row = Record<string, unknown>;
let rows: Row[] = [];
let semFiltroUser = 0;
let seq = 100;

function from(t: string) {
  assert.equal(t, "reminders");
  let op: "select" | "insert" | "update" = "select";
  let payload: Row = {};
  const filtros: ((r: Row) => boolean)[] = [];
  let temUser = false;
  const run = () => {
    if (op !== "insert" && !temUser) semFiltroUser++;
    if (op === "insert") { const r = { id: ++seq, status: "pending", sent_at: null, ...payload }; rows.push(r); return [r]; }
    const hit = rows.filter((r) => filtros.every((f) => f(r)));
    if (op === "update") hit.forEach((r) => Object.assign(r, payload));
    return hit;
  };
  const q = {
    select: () => q,
    insert: (p: Row) => { op = "insert"; payload = p; return q; },
    update: (p: Row) => { op = "update"; payload = p; return q; },
    eq: (c: string, v: unknown) => { if (c === "user_id") temUser = true; filtros.push((r) => r[c] === v); return q; },
    in: (c: string, v: unknown[]) => { filtros.push((r) => v.includes(r[c])); return q; },
    gte: (c: string, v: string) => { filtros.push((r) => String(r[c]) >= v); return q; },
    order: () => q,
    limit: () => q,
    maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
    single: async () => ({ data: run()[0] ?? null, error: null }),
    then: (ok: (v: { data: Row[]; error: null }) => unknown) => Promise.resolve({ data: run(), error: null }).then(ok),
  };
  return q;
}

let session: { supabase: unknown; user: { id: string }; admin: boolean } | null = null;
mock.module(src("app/api/google/_auth.ts"), { namedExports: { signedIn: async () => session } });

const raiz = await import("../src/app/api/lembretes/route.ts");
const um = await import("../src/app/api/lembretes/[id]/route.ts");

const req = (url: string, method = "GET", body?: unknown) => new Request(`http://t${url}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const iso = (ms: number) => new Date(Date.now() + ms).toISOString();
const H = 3_600_000;

beforeEach(() => {
  semFiltroUser = 0;
  session = { supabase: { from }, user: { id: A }, admin: false };
  rows = [
    { id: 1, user_id: A, text: "Regar as plantas", due_at: iso(2 * H), status: "pending", sent_at: null },
    { id: 2, user_id: A, text: "Levar o lixo", due_at: iso(-2 * H), status: "sent", sent_at: iso(-2 * H) },
    { id: 3, user_id: A, text: "Antigo", due_at: iso(-30 * 24 * H), status: "done", sent_at: null },
    { id: 4, user_id: A, text: "Apagado", due_at: iso(3 * H), status: "cancelled", sent_at: null },
    { id: 9, user_id: B, text: "Da outra pessoa", due_at: iso(H), status: "pending", sent_at: null },
  ];
});

test("sem sessão: 401 em todas as rotas", async () => {
  session = null;
  assert.equal((await raiz.GET(req("/api/lembretes"))).status, 401);
  assert.equal((await raiz.POST(req("/api/lembretes", "POST", { texto: "x", quando: "2030-01-01T09:00" }))).status, 401);
  assert.equal((await um.PATCH(req("/api/lembretes/1", "PATCH", { status: "done" }), ctx("1"))).status, 401);
});

test("lista só os da pessoa: pendentes e os avisados/concluídos recentes", async () => {
  const r = await raiz.GET(req("/api/lembretes"));
  assert.equal(r.status, 200);
  const ids = (await r.json()).lembretes.map((l: { id: number }) => l.id).sort();
  assert.deepEqual(ids, [1, 2]);
  assert.equal(semFiltroUser, 0);
  assert.equal((await raiz.GET(req("/api/lembretes?user_id=" + B))).status, 400, "parâmetro desconhecido é recusado");
});

test("cria com o user_id da sessão, horário de Brasília e só no futuro", async () => {
  const r = await raiz.POST(req("/api/lembretes", "POST", { texto: "  Pagar   a conta ", quando: "2027-06-10T09:00" }));
  assert.equal(r.status, 201);
  const { lembrete } = await r.json();
  assert.equal(lembrete.text, "Pagar a conta");
  assert.equal(lembrete.due_at, "2027-06-10T12:00:00.000Z");
  assert.equal(rows.at(-1)!.user_id, A);
  const passado = await raiz.POST(req("/api/lembretes", "POST", { texto: "x", quando: "2020-01-10T09:00" }));
  assert.equal(passado.status, 400);
  assert.match((await passado.json()).message, /futuro/);
  assert.equal((await raiz.POST(req("/api/lembretes", "POST", { texto: "", quando: "2027-06-10T09:00" }))).status, 400);
  assert.equal((await raiz.POST(req("/api/lembretes", "POST", { texto: "x", quando: "2027-06-10T09:00", user_id: B }))).status, 400, "campo extra é recusado");
});

test("concluir, editar (rearma o aviso) e desfazer; lembrete de outra pessoa não é achado", async () => {
  let r = await um.PATCH(req("/api/lembretes/2", "PATCH", { status: "done" }), ctx("2"));
  assert.equal(r.status, 200);
  assert.equal(rows.find((x) => x.id === 2)!.status, "done");
  r = await um.PATCH(req("/api/lembretes/2", "PATCH", { status: "sent" }), ctx("2"));
  assert.equal(rows.find((x) => x.id === 2)!.status, "sent", "Desfazer volta à situação anterior");

  r = await um.PATCH(req("/api/lembretes/2", "PATCH", { texto: "Levar o lixo reciclável", quando: "2027-07-01T20:00" }), ctx("2"));
  assert.equal(r.status, 200);
  const l = rows.find((x) => x.id === 2)!;
  assert.deepEqual([l.text, l.due_at, l.status, l.sent_at], ["Levar o lixo reciclável", "2027-07-01T23:00:00.000Z", "pending", null]);

  assert.equal((await um.PATCH(req("/api/lembretes/1", "PATCH", { quando: "2020-01-01T09:00" }), ctx("1"))).status, 400, "editar para o passado não");
  const volta = await um.PATCH(req("/api/lembretes/1", "PATCH", { quando: iso(-H), status: "pending", desfazer: true }), ctx("1"));
  assert.equal(volta.status, 200, "o Desfazer pode voltar a um horário que já passou");

  r = await um.PATCH(req("/api/lembretes/9", "PATCH", { status: "cancelled" }), ctx("9"));
  assert.equal(r.status, 404);
  assert.equal(rows.find((x) => x.id === 9)!.status, "pending");
  assert.equal(semFiltroUser, 0);
});

test("entrada inválida: id, corpo vazio e status desconhecido", async () => {
  assert.equal((await um.PATCH(req("/api/lembretes/abc", "PATCH", { status: "done" }), ctx("abc"))).status, 400);
  assert.equal((await um.PATCH(req("/api/lembretes/1", "PATCH", {}), ctx("1"))).status, 400);
  assert.equal((await um.PATCH(req("/api/lembretes/1", "PATCH", { status: "apagado" }), ctx("1"))).status, 400);
  assert.equal((await um.PATCH(req("/api/lembretes/1", "PATCH", { texto: "a".repeat(301) }), ctx("1"))).status, 400);
});
