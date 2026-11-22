// Teste de integração da rota POST /api/chat: a rota real roda com Supabase e provedor de IA simulados.
// Garante: o provedor NÃO é chamado quando os limites não podem ser validados (fail closed); a ordem
// limites → reserva de orçamento → cota → IA; a reserva é liquidada pelo custo real ou liberada.
// S-01: reserva, liquidação e liberação só pelo cliente do servidor (funções server_*), nunca pelo cliente da pessoa.
// S-02: resposta cortada com texto já enviado é liquidada por estimativa; sem texto, a reserva é liberada.
// S-07: sem contingência na cota (consume_quota não existe mais): falhou, bloqueou.
import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

type Rpc = { data: unknown; error: unknown };
const src = (p: string) => new URL(`../src/${p}`, import.meta.url).href;
const RID = "3f2b1c9e-8d7a-4b6c-9e5f-1a2b3c4d5e6f";

// Estado controlado por cada teste.
let rpcs: Record<string, (args?: Record<string, unknown>) => Promise<Rpc>> = {};
let tables: string[] = [];
let adminTables: string[] = [];
let inserts: { table: string; row: unknown }[] = [];
let providerCalls: { skip: string[]; context?: string }[] = [];
let rpcCalls: { name: string; args?: Record<string, unknown>; client: "user" | "admin" }[] = [];
let providerMode: "ok" | "throw" | "partial" | "abort" = "ok";
let abortCtl = new AbortController();

const ok = (data: unknown) => async () => ({ data, error: null });
const err = async () => ({ data: null, error: { message: "database unavailable" } });
const boom = async (): Promise<Rpc> => { throw new Error("fetch failed"); };
const missing = async () => ({ data: null, error: { code: "PGRST202", message: "Could not find the function" } });
const healthy = () => ({
  month_spend_by_provider: ok([]),
  server_reserve_ai_budget: ok({ allowed: true, reservation_id: RID, amount: 0.25, spent: 1, reserved: 0.25, limit: 20 }),
  consume_daily_quota: ok({ allowed: true, used: 1, limit: 150 }),
  server_settle_ai_budget: ok({ ok: true, cost: 0.01, over: false }),
  server_release_ai_budget: ok({ ok: true, released: true }),
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
      rpc: (name: string, args?: Record<string, unknown>) => { rpcCalls.push({ name, args, client: "user" }); return (rpcs[name] ?? err)(args); },
      from: (table: string) => { tables.push(table); return query(table); },
    }),
  },
});
// Cliente com a chave secreta (só o servidor): orçamento e consumo passam por aqui.
mock.module(src("lib/supabase/admin.ts"), {
  namedExports: {
    supabaseAdmin: () => ({
      rpc: (name: string, args?: Record<string, unknown>) => { rpcCalls.push({ name, args, client: "admin" }); return (rpcs[name] ?? err)(args); },
      from: (table: string) => { adminTables.push(table); return { insert: async (row: unknown) => { inserts.push({ table, row }); return { error: null }; } }; },
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
    routeChat: async function* (req: { onUsage?: (u: unknown) => void; context?: string }, skip: Set<string>) {
      providerCalls.push({ skip: [...skip], context: req.context });
      if (providerMode === "throw") throw new AllProvidersFailed("down");
      yield { type: "provider", name: "Claude", id: "anthropic" };
      yield { type: "text", text: "Olá!" };
      // Resposta cortada no meio: sem relatório final de uso (onUsage só vem no fim).
      if (providerMode === "partial") throw new Error("conexão caiu no meio");
      if (providerMode === "abort") { abortCtl.abort(); throw new Error("aborted"); }
      req.onUsage?.({ provider: "anthropic", model: "claude-opus-5-5", input_tokens: 1000, output_tokens: 100 });
    },
  },
});
mock.module("next/server", { namedExports: { after: () => {} } });

const { POST } = await import(src("app/api/chat/route.ts"));

async function chat(message = "oi", extra: Record<string, unknown> = {}) {
  const res: Response = await POST(new Request("http://localhost/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message, ...extra }), signal: abortCtl.signal }));
  if (res.status !== 200) return [{ t: "http", kind: String(res.status) }];
  const text = await res.text();
  return text.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as { t: string; kind?: string; text?: string });
}

function reset(over: Record<string, (args?: Record<string, unknown>) => Promise<Rpc>> = {}) {
  rpcs = { ...healthy(), ...over }; tables = []; adminTables = []; inserts = []; providerCalls = []; rpcCalls = []; providerMode = "ok"; abortCtl = new AbortController();
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
  assert.deepEqual(rpcCalls.map((c) => c.name).slice(0, 3), ["month_spend_by_provider", "server_reserve_ai_budget", "consume_daily_quota"], "ordem: limites → reserva → cota");
  const settle = called("server_settle_ai_budget");
  assert.equal(settle.length, 1, "liquida uma vez");
  assert.equal(settle[0].args?.p_reservation, RID);
  assert.equal(settle[0].args?.p_user, "user-test", "o id vem da sessão");
  assert.ok((settle[0].args?.p_cost_usd as number) > 0, "custo real calculado");
  assert.equal(called("server_release_ai_budget").length, 0, "reserva liquidada não é liberada");
  assert.ok(!inserts.some((i) => i.table === "usage_events"), "consumo é gravado pela liquidação, não direto");
});

test("reserva: estimativa enviada é positiva e limitada", async () => {
  await chat();
  const est = called("server_reserve_ai_budget")[0].args?.p_estimate_usd as number;
  assert.ok(est > 0 && est < 5, `estimativa razoável (${est})`);
  assert.equal(called("server_reserve_ai_budget")[0].args?.p_kind, "chat");
});

test("teto mensal atingido na reserva: avisa, não chama a IA e não gasta cota", async () => {
  reset({ server_reserve_ai_budget: ok({ allowed: false, reason: "monthly", spent: 19.9, reserved: 0, limit: 20 }) });
  assertBlocked(await chat(), "quota", /teto de gasto do mês \(US\$ 20\.00\)/);
  assert.equal(called("consume_daily_quota").length, 0);
});

test("teto global da conta atingido: avisa sem chamar a IA", async () => {
  reset({ server_reserve_ai_budget: ok({ allowed: false, reason: "global" }) });
  assertBlocked(await chat(), "quota", /limite de gasto com IA da conta/);
});

test("reserva indisponível (falha, erro, formato inválido) bloqueia", async () => {
  for (const r of [boom, err, ok(null), ok({ allowed: true }), ok({ allowed: false, reason: "auth" })]) {
    reset({ server_reserve_ai_budget: r });
    assertBlocked(await chat(), "error", /orçamento de IA/);
    assert.equal(called("consume_daily_quota").length, 0);
  }
});

test("cota esgotada depois da reserva: libera a reserva", async () => {
  reset({ consume_daily_quota: ok({ allowed: false, used: 40, limit: 40 }) });
  assertBlocked(await chat(), "quota", /limite de 40 mensagens de hoje/);
  assert.equal(called("server_release_ai_budget").length, 1);
  assert.equal(called("server_release_ai_budget")[0].args?.p_reservation, RID);
});

test("cota: falha de comunicação, erro ou resposta inválida bloqueiam e liberam a reserva", async () => {
  for (const r of [boom, err, ok(null), ok(true), ok({ allowed: "sim", used: 1, limit: 2 })]) {
    reset({ consume_daily_quota: r });
    assertBlocked(await chat(), "error", /limite de mensagens/);
    assert.equal(called("server_release_ai_budget").length, 1);
  }
});

test("provedor falhou: reserva liberada, nada liquidado", async () => {
  reset(); providerMode = "throw";
  await chat();
  assert.equal(providerCalls.length, 1);
  assert.equal(called("server_settle_ai_budget").length, 0);
  assert.equal(called("server_release_ai_budget").length, 1);
});

test("liquidação falhou: consumo gravado direto e reserva liberada", async () => {
  reset({ server_settle_ai_budget: err });
  await chat();
  assert.ok(inserts.some((i) => i.table === "usage_events"), "o custo não se perde");
  assert.equal(called("server_release_ai_budget").length, 1);
});

test("limites por provedor: falha ou linha inválida bloqueiam antes da reserva", async () => {
  for (const r of [boom, err, ok(null), ok([{ provider: "anthropic", cost_usd: null }])]) {
    reset({ month_spend_by_provider: r });
    assertBlocked(await chat(), "error", /limites dos motores/);
    assert.equal(called("server_reserve_ai_budget").length, 0);
  }
});

test("provedor que passou do limite fica de fora desta resposta", async () => {
  reset({ month_spend_by_provider: ok([{ provider: "anthropic", cost_usd: "6.00" }, { provider: "gateway", cost_usd: 1 }]) });
  await chat();
  assert.deepEqual(providerCalls[0].skip, ["anthropic"]);
});

test("sem a função de reserva no banco: bloqueia, sem caminho antigo (fail closed)", async () => {
  reset({ server_reserve_ai_budget: missing, month_spend: ok(1.25) });
  assertBlocked(await chat(), "error", /orçamento de IA/);
  assert.equal(called("month_spend").length, 0, "não volta para a leitura antiga");
  assert.equal(called("server_settle_ai_budget").length, 0);
});

test("S-07: sem consume_quota. Cota que falha ou não existe bloqueia e nunca chama a função antiga", async () => {
  for (const r of [missing, err, boom, async () => ({ data: null, error: { code: "PGRST301", message: "JWT expired" } })]) {
    reset({ consume_daily_quota: r, consume_quota: ok(true) });
    assertBlocked(await chat(), "error", /limite de mensagens/);
    assert.equal(called("consume_quota").length, 0, "consume_quota não é mais chamada");
    assert.equal(called("server_release_ai_budget").length, 1, "a reserva é liberada");
  }
});

test("cota esgotada: aviso com o limite do banco e nenhuma chamada de contingência", async () => {
  reset({ consume_daily_quota: ok({ allowed: false, used: 150, limit: 150 }), consume_quota: ok(true) });
  assertBlocked(await chat(), "quota", /limite de 150 mensagens de hoje/);
  assert.equal(called("consume_quota").length, 0);
});

test("S-01: reserva, liquidação e liberação só pelo cliente do servidor, com o id da sessão", async () => {
  await chat();
  reset(); providerMode = "throw"; await chat();
  const budget = rpcCalls.filter((c) => /ai_budget/.test(c.name));
  assert.ok(budget.length > 0);
  for (const c of budget) {
    assert.match(c.name, /^server_/, "só as funções server_*");
    assert.equal(c.client, "admin", "só o cliente do servidor");
    assert.equal(c.args?.p_user, "user-test");
  }
  assert.equal(rpcCalls.filter((c) => c.client === "user" && /budget/.test(c.name)).length, 0, "o cliente da pessoa não toca no orçamento");
});

test("S-01: liquidação que volta 'already' conta como liquidada (o banco completa o custo real) e não libera", async () => {
  reset({ server_settle_ai_budget: ok({ ok: true, already: true, cost: 0, adjusted: 0.0124 }) });
  await chat();
  assert.equal(called("server_settle_ai_budget").length, 1);
  assert.ok((called("server_settle_ai_budget")[0].args?.p_cost_usd as number) > 0, "o servidor sempre manda o custo real");
  assert.equal(called("server_release_ai_budget").length, 0);
});

test("liquidação falhou: o consumo vai direto pelo cliente do servidor, com o id da sessão", async () => {
  reset({ server_settle_ai_budget: boom });
  await chat();
  const direct = inserts.filter((i) => i.table === "usage_events");
  assert.equal(direct.length, 1);
  assert.equal((direct[0].row as { user_id: string }).user_id, "user-test");
  assert.ok(adminTables.includes("usage_events"), "pelo cliente do servidor");
  assert.ok(!tables.includes("usage_events"), "nunca pelo cliente da pessoa (S-10)");
});

test("S-02: resposta cortada depois de sair texto é liquidada por estimativa, não liberada", async () => {
  reset(); providerMode = "partial";
  const events = await chat();
  assert.ok(events.some((e) => e.t === "delta" && e.text === "Olá!"), "a pessoa recebeu texto");
  const settle = called("server_settle_ai_budget");
  assert.equal(settle.length, 1, "liquida uma vez");
  assert.equal(settle[0].args?.p_reservation, RID);
  assert.equal(settle[0].args?.p_provider, "anthropic");
  const cost = settle[0].args?.p_cost_usd as number;
  assert.ok(cost > 0 && cost <= 0.25, `custo estimado positivo e limitado ao reservado (${cost})`);
  assert.ok((settle[0].args?.p_input_tokens as number) > 0 && (settle[0].args?.p_output_tokens as number) > 0);
  assert.equal(called("server_release_ai_budget").length, 0, "não libera quem já gastou");
});

test("S-02: a estimativa nunca passa do valor reservado", async () => {
  reset({ server_reserve_ai_budget: ok({ allowed: true, reservation_id: RID, amount: 0.000001, spent: 0, reserved: 0.000001, limit: 20 }) });
  providerMode = "partial";
  await chat("a".repeat(3000));
  assert.ok((called("server_settle_ai_budget")[0].args?.p_cost_usd as number) <= 0.000001);
});

test("S-02: cancelamento (aborto) no meio da resposta também liquida por estimativa", async () => {
  reset(); providerMode = "abort";
  await chat();
  assert.equal(called("server_settle_ai_budget").length, 1);
  assert.equal(called("server_release_ai_budget").length, 0);
});

test("S-02: estimativa cujo registro falha: grava o consumo direto e libera a reserva", async () => {
  reset({ server_settle_ai_budget: err }); providerMode = "partial";
  await chat();
  assert.equal(inserts.filter((i) => i.table === "usage_events").length, 1, "o custo não se perde");
  assert.equal(called("server_release_ai_budget").length, 1);
});

test("S-02: nada saiu (falha antes do primeiro texto): libera, sem estimar custo", async () => {
  reset(); providerMode = "throw";
  await chat();
  assert.equal(called("server_settle_ai_budget").length, 0);
  assert.equal(called("server_release_ai_budget").length, 1);
});

test("o app nunca envia o limite da cota ao banco", async () => {
  await chat();
  assert.equal(called("consume_daily_quota")[0].args, undefined);
});

test("assistente universal: o contexto da tela chega ao modelo como rótulo", async () => {
  await chat("oi", { context: { module: "pessoal", view: "hoje" } });
  assert.match(providerCalls[0].context ?? "", /módulo Pessoal, tela Hoje/);

  reset();
  await chat("oi", { context: { module: "casa", view: "casa" } });
  assert.match(providerCalls[0].context ?? "", /ainda está planejado/);

  reset();
  await chat("oi", { context: { module: "metas", view: "metas" } });
  assert.match(providerCalls[0].context ?? "", /em beta/);

  reset();
  await chat("oi");
  assert.doesNotMatch(providerCalls[0].context ?? "", /Tela atual/, "sem contexto, nada é acrescentado");
});

test("assistente universal: contexto inválido ou com campos extras é recusado antes de qualquer custo", async () => {
  for (const context of [{ module: "financeiro", view: "hoje" }, { module: "pessoal", view: "hoje", org: "outra-empresa" }, { module: "x", view: "y" }, "texto livre"]) {
    reset();
    const out = await chat("oi", { context });
    assert.deepEqual(out, [{ t: "http", kind: "400" }]);
    assert.equal(providerCalls.length, 0);
    assert.equal(rpcCalls.length, 0, "nem consulta o banco");
  }
});
