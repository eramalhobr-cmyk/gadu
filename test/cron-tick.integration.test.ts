// S-04: o agendador ignora quem não está ativo (members.access <> 'active'): sem push, sem leitura do Google,
// sem indexação. A rota real roda com banco, push e Google simulados.
import assert from "node:assert/strict";
import { mock, test } from "node:test";

const src = (p: string) => new URL(`../src/${p}`, import.meta.url).href;
const BLOCKED = "blocked-user";
const ACTIVE = "active-user";

const data: Record<string, unknown[]> = {
  members: [{ user_id: BLOCKED }],
  reminders: [{ id: 1, user_id: BLOCKED, text: "a" }, { id: 2, user_id: ACTIVE, text: "b" }],
  profiles: [{ id: BLOCKED, display_name: "A", settings: { briefing: { enabled: true, time: "08:00" }, evening: { enabled: true } } }, { id: ACTIVE, display_name: "B", settings: { briefing: { enabled: true, time: "08:00" }, evening: { enabled: true } } }],
  push_subscriptions: [{ id: 9, endpoint: "https://push.exemplo.com/x", p256dh: "k", auth: "a" }],
};
let claimed: unknown[] = [];
let pushedTo: string[] = [];
let googleFor: string[] = [];
let upserts: { user_id: string }[] = [];
let notIn: unknown[] = [];
let membersError = false;
let rpcRows: { user_id: string; kind: string; ref_id: number; content: string }[] = [];

function from(table: string) {
  let op = "select";
  let userEq: string | null = null;
  const p: object = new Proxy(function () {}, {
    get: (_t, key) => {
      if (key === "then") {
        return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
          if (table === "members" && membersError) return Promise.resolve({ data: null, error: { message: "indisponível" } }).then(res, rej);
          let rows = data[table] ?? [];
          if (table === "push_subscriptions" && userEq) pushedTo.push(userEq);
          if (op === "update") rows = [{ id: 1 }];
          if (op === "insert") return Promise.resolve({ data: null, error: null }).then(res, rej);
          return Promise.resolve({ data: rows, error: null, count: rows.length }).then(res, rej);
        };
      }
      if (key === "update") return (row: unknown) => { op = "update"; claimed.push({ table, row }); return p; };
      if (key === "insert") return () => { op = "insert"; return p; };
      if (key === "upsert") return (rows: { user_id: string }[]) => { upserts.push(...rows); return Promise.resolve({ error: null }); };
      if (key === "eq") return (c: string, v: string) => { if (c === "user_id") userEq = v; return p; };
      if (key === "not") return (...a: unknown[]) => { notIn.push(a); return p; };
      return () => p;
    },
    apply: () => p,
  });
  return p;
}
mock.module(src("lib/supabase/admin.ts"), { namedExports: { supabaseAdmin: () => ({ from, rpc: async (name: string) => (name === "index_backlog" ? { data: rpcRows, error: null } : { data: 0, error: null }) }) } });
mock.module(src("lib/push.ts"), { namedExports: { pushConfigured: () => true, sendPush: async () => ({ sent: 1, gone: [] }) } });
mock.module(src("lib/google.ts"), { namedExports: { accessToken: async (_db: unknown, id: string) => { googleFor.push(id); return "t"; }, events: async () => [], inbox: async () => [] } });
mock.module(src("lib/embeddings.ts"), { namedExports: { embeddingsAvailable: () => true, embed: async (xs: string[]) => xs.map(() => [0]), toVector: () => "[0]" } });
mock.module(src("lib/briefing.ts"), {
  namedExports: {
    spNow: () => ({ minutes: 600, day: "2026-11-22", start: new Date("2026-11-22T03:00:00Z") }),
    parseTime: () => 480,
    briefingText: () => ({ title: "Bom dia", body: "Toque para começar o dia." }),
  },
});
mock.module(src("lib/insights.ts"), { namedExports: { insights: () => [] } });

process.env.CRON_SECRET = "segredo-de-teste";
process.env.SUPABASE_SECRET_KEY = "chave-de-teste";
const { GET } = await import(src("app/api/cron/tick/route.ts")) as { GET: (r: Request) => Promise<Response> };
const tick = () => GET(new Request("http://localhost/api/cron/tick", { headers: { authorization: "Bearer segredo-de-teste" } }));

test("lembretes, briefing, revisão da noite e indexação ignoram quem está bloqueado", async () => {
  claimed = []; pushedTo = []; googleFor = []; upserts = []; notIn = [];
  rpcRows = [
    { user_id: BLOCKED, kind: "memory", ref_id: 1, content: "texto de quem está bloqueado" },
    { user_id: ACTIVE, kind: "memory", ref_id: 2, content: "texto de quem está ativo" },
  ];
  const res = await tick();
  assert.equal(res.status, 200);

  // Lembretes: o filtro vai para o banco (not in) e o código também pula quem está bloqueado.
  assert.ok(notIn.some((a) => (a as string[])[0] === "user_id" && String((a as string[])[2]).includes(BLOCKED)), "filtro de bloqueados na consulta");
  const reminderClaims = claimed.filter((c) => (c as { table: string }).table === "reminders");
  assert.equal(reminderClaims.length, 1, "só o lembrete da pessoa ativa é marcado como enviado");

  // Push e Google: nunca para o bloqueado.
  assert.ok(!pushedTo.includes(BLOCKED), "sem push para bloqueado");
  assert.ok(pushedTo.includes(ACTIVE), "pessoa ativa continua recebendo");
  assert.ok(!googleFor.includes(BLOCKED), "Google não é lido para bloqueado");
  assert.ok(googleFor.includes(ACTIVE));

  // Indexação: nada do bloqueado vai para o índice.
  assert.deepEqual(upserts.map((u) => u.user_id), [ACTIVE]);
});

test("sem conseguir saber quem está bloqueado, não processa ninguém às cegas", async () => {
  membersError = true;
  const res = await tick();
  const j = (await res.json()) as { reminders: number; briefings: number; evenings: number; indexed: number };
  assert.equal(res.status, 200);
  assert.equal(j.reminders, -1, "a tarefa falha em vez de enviar");
  assert.equal(j.briefings, -1);
  assert.equal(j.evenings, -1);
  assert.equal(j.indexed, -1);
  membersError = false;
});

test("sem o segredo do agendador, recusa", async () => {
  const res = await GET(new Request("http://localhost/api/cron/tick"));
  assert.equal(res.status, 401);
});
