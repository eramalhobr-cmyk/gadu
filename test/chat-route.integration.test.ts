// Teste de integração da rota POST /api/chat: a rota real roda com Supabase e provedor de IA simulados.
// Garante: o provedor NÃO é chamado quando os limites não podem ser validados (fail closed); a ordem
// limites → reserva de orçamento → cota → IA; a reserva é liquidada pelo custo real ou liberada.
import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

type Rpc = { data: unknown; error: unknown };
const src = (p: string) => new URL(`../src/${p}`, import.meta.url).href;
const RID = "3f2b1c9e-8d7a-4b6c-9e5f-1a2b3c4d5e6f";

// Estado controlado por cada teste.
let rpcs: Record<string, (args?: Record<string, unknown>) => Promise<Rpc>> = {};
let tables: string[] = [];
let inserts: { table: string; row: unknown }[] = [];
let providerCalls: { skip: string[] }[] = [];
let rpcCalls: { name: string; args?: Record<string, unknown> }[] = [];
let providerMode: "ok" | "throw" = "ok";

const ok = (data: unknown) => async () => ({ data, error: null });
const err = async () => ({ data: null, error: { message: "database unavailable" } });
const boom = async (): Promise<Rpc> => { throw new Error("fetch failed"); };
const missing = async () => ({ data: null, error: { code: "PGRST202", message: "Could not find the function" } });
const healthy = () => ({
  month_spend_by_provider: ok([]),
  reserve_ai_budget: ok({ allowed: true, reservation_id: RID, amount: 0.25, spent: 1, reserved: 0.25, limit: 20 }),
  consume_daily_quota: ok({ allowed: true, used: 1, limit: 150 }),
  settle_ai_budget: ok({ ok: true, cost: 0.01, over: false }),
  release_ai_budget: ok({ ok: true, released: true }),
});
const called = (name: string) => rpcCalls.filter((c) => c.name === name);

/** Consulta encadeável do Supabase que resolve sempre para uma linha vazia (conversa nova recebe id 1). */
function query(table: string) {
  const result = { data: table === "conversations" ? { id: 1 } : [], error: null, count: 0 };
  const p: object = new Proxy(function () {}, {
    get: (_t, key) => {
      if (key === "then") return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(result).then(res, rej);
      if (key === "insert") return (row: unknown) => { inserts.push({ table, row }); return p; };
      return () => p;
    },
    apply: () => p,
  });
  return p;
}

mock.module(src("lib/supabase/server.ts"), {
  namedExports: {
    supabaseServer: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: "user-test", email: "teste@exemplo.com" } } }) },
      rpc: (name: string, args?: Record<string, unknown>) => { rpcCalls.push({ name, args }); return (rpcs[name] ?? err)(args); },
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
    routeChat: async function* (req: { onUsage?: (u: unknown) => void }, skip: Set<string>) {
      providerCalls.push({ skip: [...skip] });
      if (providerMode === "throw") throw new AllProvidersFailed("down");
      yield { type: "provider", name: "Claude", id: "anthropic" };
      yield { type: "text", text: "Olá!" };
      req.onUsage?.({ provider: "anthropic", model: "claude-opus-5-5", input_tokens: 1000, output_tokens: 100 });
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

function reset(over: Record<string, (args?: Record<string, unknown>) => Promise<Rpc>> = {}) {
  rpcs = { ...healthy(), ...over }; tables = []; inserts = []; providerCalls = []; rpcCalls = []; providerMode = "ok";
}
beforeEach(() => reset());

function assertBlocked(events: { t: string; kind?: string; text?: string }[], kind: string, words: RegExp) {
  assert.equal(providerCalls.length, 0, "o provedor de IA não pode ser chamado");
  assert.ok(!tables.includes("conversations"), "nada deve ser gravado quando os limites não foram validados");
  const notice = events.find((e) => e.t === "notice");
  assert.ok(notice, "a pessoa recebe um aviso");
  assert.equal(notice!.kind, kind);
  assert.match(notice!.text ?? "", words);
}

test("caminho feliz: reserva, cota, IA e liquidação pelo custo real", async () => {
  const events = await chat();
  assert.equal(providerCalls.length, 1);
  assert.ok(events.some((e) => e.t === "delta" && e.text === "Olá!"));
  assert.deepEqual(rpcCalls.map((c) => c.name).slice(0, 3), ["month_spend_by_provider", "reserve_ai_budget", "consume_daily_quota"], "ordem: limites → reserva → cota");
  const settle = called("settle_ai_budget");
  assert.equal(settle.length, 1, "liquida uma vez");
  assert.equal(settle[0].args?.p_reservation, RID);
  assert.ok((settle[0].args?.p_cost_usd as number) > 0, "custo real calculado");
  assert.equal(called("release_ai_budget").length, 0, "reserva liquidada não é liberada");
  assert.ok(!inserts.some((i) => i.table === "usage_events"), "consumo é gravado pela liquidação, não direto");
});

test("reserva: estimativa enviada é positiva e limitada", async () => {
  await chat();
  const est = called("reserve_ai_budget")[0].args?.p_estimate_usd as number;
  assert.ok(est > 0 && est < 5, `estimativa razoável (${est})`);
  assert.equal(called("reserve_ai_budget")[0].args?.p_kind, "chat");
});

test("teto mensal atingido na reserva: avisa, não chama a IA e não gasta cota", async () => {
  reset({ reserve_ai_budget: ok({ allowed: false, reason: "monthly", spent: 19.9, reserved: 0, limit: 20 }) });
  assertBlocked(await chat(), "quota", /teto de gasto do mês \(US\$ 20\.00\)/);
  assert.equal(called("consume_daily_quota").length, 0);
});

test("teto global da conta atingido: avisa sem chamar a IA", async () => {
  reset({ reserve_ai_budget: ok({ allowed: false, reason: "global" }) });
  assertBlocked(await chat(), "quota", /limite de gasto com IA da conta/);
});

test("reserva indisponível (falha, erro, formato inválido) bloqueia", async () => {
  for (const r of [boom, err, ok(null), ok({ allowed: true }), ok({ allowed: false, reason: "auth" })]) {
    reset({ reserve_ai_budget: r });
    assertBlocked(await chat(), "error", /orçamento de IA/);
    assert.equal(called("consume_daily_quota").length, 0);
  }
});

test("cota esgotada depois da reserva: libera a reserva", async () => {
  reset({ consume_daily_quota: ok({ allowed: false, used: 40, limit: 40 }) });
  assertBlocked(await chat(), "quota", /limite de 40 mensagens de hoje/);
  assert.equal(called("release_ai_budget").length, 1);
  assert.equal(called("release_ai_budget")[0].args?.p_reservation, RID);
});

test("cota: falha de comunicação, erro ou resposta inválida bloqueiam e liberam a reserva", async () => {
  for (const r of [boom, err, ok(null), ok(true), ok({ allowed: "sim", used: 1, limit: 2 })]) {
    reset({ consume_daily_quota: r });
    assertBlocked(await chat(), "error", /limite de mensagens/);
    assert.equal(called("release_ai_budget").length, 1);
  }
});

test("provedor falhou: reserva liberada, nada liquidado", async () => {
  reset(); providerMode = "throw";
  await chat();
  assert.equal(providerCalls.length, 1);
  assert.equal(called("settle_ai_budget").length, 0);
  assert.equal(called("release_ai_budget").length, 1);
});

test("liquidação falhou: consumo gravado direto e reserva liberada", async () => {
  reset({ settle_ai_budget: err });
  await chat();
  assert.ok(inserts.some((i) => i.table === "usage_events"), "o custo não se perde");
  assert.equal(called("release_ai_budget").length, 1);
});

test("limites por provedor: falha ou linha inválida bloqueiam antes da reserva", async () => {
  for (const r of [boom, err, ok(null), ok([{ provider: "anthropic", cost_usd: null }])]) {
    reset({ month_spend_by_provider: r });
    assertBlocked(await chat(), "error", /limites dos motores/);
    assert.equal(called("reserve_ai_budget").length, 0);
  }
});

test("provedor que passou do limite fica de fora desta resposta", async () => {
  reset({ month_spend_by_provider: ok([{ provider: "anthropic", cost_usd: "6.00" }, { provider: "gateway", cost_usd: 1 }]) });
  await chat();
  assert.deepEqual(providerCalls[0].skip, ["anthropic"]);
});

test("transição: banco sem a migração de orçamento usa a leitura de month_spend", async () => {
  reset({ reserve_ai_budget: missing, month_spend: ok(1.25) });
  await chat();
  assert.equal(called("month_spend").length, 1);
  assert.equal(providerCalls.length, 1, "o chat continua funcionando");
  assert.equal(called("settle_ai_budget").length, 0, "sem reserva, não há liquidação");
  assert.ok(inserts.some((i) => i.table === "usage_events"), "consumo gravado como hoje");

  for (const [r, kind, words] of [[ok(20), "quota", /teto de gasto do mês/], [err, "error", /orçamento de IA/], [ok("abc"), "error", /orçamento de IA/]] as const) {
    reset({ reserve_ai_budget: missing, month_spend: r });
    assertBlocked(await chat(), kind, words);
  }
});

test("transição: sem a função nova de cota, usa a antiga com o limite do servidor", async () => {
  reset({ consume_daily_quota: missing, consume_quota: ok(true) });
  await chat();
  assert.equal(called("consume_quota").length, 1);
  assert.equal(providerCalls.length, 1);

  reset({ consume_daily_quota: missing, consume_quota: ok(false) });
  assertBlocked(await chat(), "quota", /limite de 150 mensagens de hoje/);

  reset({ consume_daily_quota: async () => ({ data: null, error: { code: "PGRST301", message: "JWT expired" } }), consume_quota: ok(true) });
  assertBlocked(await chat(), "error", /limite de mensagens/);
  assert.equal(called("consume_quota").length, 0, "outros erros não caem na função antiga");
});

test("o app nunca envia o limite da cota ao banco", async () => {
  await chat();
  assert.equal(called("consume_daily_quota")[0].args, undefined);
});
