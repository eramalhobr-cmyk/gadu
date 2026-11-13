// Teste de integração da rota POST /api/chat: a rota real roda com Supabase e provedor de IA simulados.
// Objetivo: provar que o provedor NÃO é chamado quando cota, teto mensal ou limites por provedor
// não podem ser validados (fail closed), e que nada é gravado nesses casos.
import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

type Rpc = { data: unknown; error: unknown };
const src = (p: string) => new URL(`../src/${p}`, import.meta.url).href;

// Estado controlado por cada teste.
let rpcs: Record<string, () => Promise<Rpc>> = {};
let tables: string[] = [];
let providerCalls: { skip: string[] }[] = [];

const ok = (data: unknown) => async () => ({ data, error: null });
const err = async () => ({ data: null, error: { message: "database unavailable" } });
const boom = async (): Promise<Rpc> => { throw new Error("fetch failed"); };
const healthy = () => ({ consume_quota: ok(true), month_spend: ok(1.25), month_spend_by_provider: ok([]) });

/** Consulta encadeável do Supabase que resolve sempre para uma linha vazia (conversa nova recebe id 1). */
function query(table: string) {
  const result = { data: table === "conversations" ? { id: 1 } : [], error: null, count: 0 };
  const p: object = new Proxy(function () {}, {
    get: (_t, key) => (key === "then" ? (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(result).then(res, rej) : () => p),
    apply: () => p,
  });
  return p;
}

mock.module(src("lib/supabase/server.ts"), {
  namedExports: {
    supabaseServer: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: "user-test", email: "teste@exemplo.com" } } }) },
      rpc: (name: string) => (rpcs[name] ?? err)(),
      from: (table: string) => { tables.push(table); return query(table); },
    }),
  },
});
mock.module(src("lib/access.ts"), { namedExports: { accessOf: async () => ({ ok: true, admin: false }) } });
mock.module(src("lib/embeddings.ts"), { namedExports: { embeddingsAvailable: () => false, embed: async () => [], toVector: () => "[]" } });
mock.module(src("lib/llm/complete.ts"), { namedExports: { complete: async () => ({ text: "", provider: "anthropic", model: "x", input: 0, output: 0, cost: 0 }) } });
mock.module(src("lib/google.ts"), {
  namedExports: {
    googleIntent: () => ({ agenda: false, email: false, week: false }),
    accessToken: async () => "", events: async () => [], inbox: async () => [],
    formatEvents: () => "", formatMails: () => "", GoogleError: class extends Error {},
  },
});
class BudgetReached extends Error {}
class NoProviderError extends Error {}
class AllProvidersFailed extends Error { kind = "other"; }
mock.module(src("lib/llm/router.ts"), {
  namedExports: {
    BudgetReached, NoProviderError, AllProvidersFailed,
    routeChat: async function* (_req: unknown, skip: Set<string>) {
      providerCalls.push({ skip: [...skip] });
      yield { type: "provider", name: "Claude", id: "anthropic" };
      yield { type: "text", text: "Olá!" };
    },
  },
});
mock.module("next/server", { namedExports: { after: () => {} } });

const { POST } = await import(src("app/api/chat/route.ts"));

async function chat(message = "oi") {
  const res: Response = await POST(new Request("http://localhost/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message }) }));
  const text = await res.text();
  return text.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as { t: string; kind?: string; text?: string });
}

beforeEach(() => { rpcs = healthy(); tables = []; providerCalls = []; });

function assertBlocked(events: { t: string; kind?: string; text?: string }[], kind: string, words: RegExp) {
  assert.equal(providerCalls.length, 0, "o provedor de IA não pode ser chamado");
  assert.ok(!tables.includes("conversations"), "nada deve ser gravado quando os limites não foram validados");
  const notice = events.find((e) => e.t === "notice");
  assert.ok(notice, "a pessoa recebe um aviso");
  assert.equal(notice!.kind, kind);
  assert.match(notice!.text ?? "", words);
}

test("caminho feliz: limites validados chamam o provedor uma vez", async () => {
  const events = await chat();
  assert.equal(providerCalls.length, 1);
  assert.deepEqual(providerCalls[0].skip, []);
  assert.ok(events.some((e) => e.t === "delta" && e.text === "Olá!"));
});

test("cota: falha de comunicação com o Supabase bloqueia", async () => {
  rpcs.consume_quota = boom;
  assertBlocked(await chat(), "error", /limite de mensagens/);
});

test("cota: erro da RPC e resposta nula bloqueiam", async () => {
  for (const r of [err, ok(null), ok("true"), ok(1)]) {
    rpcs = { ...healthy(), consume_quota: r }; tables = []; providerCalls = [];
    assertBlocked(await chat(), "error", /limite de mensagens/);
  }
});

test("cota diária esgotada avisa sem chamar o provedor", async () => {
  rpcs.consume_quota = ok(false);
  assertBlocked(await chat(), "quota", /limite de \d+ mensagens de hoje/);
});

test("teto mensal: falha, nulo e valor inválido bloqueiam", async () => {
  for (const r of [boom, err, ok(null), ok("abc"), ok(-3)]) {
    rpcs = { ...healthy(), month_spend: r }; tables = []; providerCalls = [];
    assertBlocked(await chat(), "error", /orçamento de IA/);
  }
});

test("teto mensal atingido avisa sem chamar o provedor", async () => {
  rpcs.month_spend = ok(20);
  assertBlocked(await chat(), "quota", /teto de gasto do mês/);
});

test("limites por provedor: falha ou linha inválida bloqueiam", async () => {
  for (const r of [boom, err, ok(null), ok([{ provider: "anthropic", cost_usd: null }])]) {
    rpcs = { ...healthy(), month_spend_by_provider: r }; tables = []; providerCalls = [];
    assertBlocked(await chat(), "error", /limites dos motores/);
  }
});

test("provedor que passou do limite fica de fora desta resposta", async () => {
  rpcs.month_spend_by_provider = ok([{ provider: "anthropic", cost_usd: "6.00" }, { provider: "gateway", cost_usd: 1 }]);
  await chat();
  assert.equal(providerCalls.length, 1);
  assert.deepEqual(providerCalls[0].skip, ["anthropic"]);
});
