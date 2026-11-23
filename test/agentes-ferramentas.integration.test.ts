// Agentes com ferramentas e teto próprios: /api/chat com Supabase (RLS imitada), IA e Google simulados.
// Garante: teto do agente atingido bloqueia ANTES da reserva, da cota e da IA; sem conseguir ler o gasto (com teto), bloqueia;
// o custo da resposta soma no mês do agente só pelo servidor (server_add_agent_usage); agente de outra pessoa não vale;
// ferramentas desligadas não entram no contexto e as ações delas não viram cartão.
import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

type Row = Record<string, unknown>;
const src = (p: string) => new URL(`../src/${p}`, import.meta.url).href;
const RID = "3f2b1c9e-8d7a-4b6c-9e5f-1a2b3c4d5e6f";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

let generic: Record<string, Row[]> = {};
let providerCalls: { context?: string }[] = [];
let rpcNames: string[] = [];
let adminRpc: { name: string; args?: Record<string, unknown> }[] = [];
let usoFail = false;
let modelText = "Olá!";

function query(table: string) {
  const eqs: [string, unknown][] = [];
  let mode: "rows" | "one" = "rows";
  const result = () => {
    if (table === "conversations") return { data: { id: 1 }, error: null };
    if (table === "agent_uso" && usoFail) return { data: null, error: { message: "indisponível" } };
    const rs = (generic[table] ?? []).filter((r) => (r.user_id ?? r.id) === A && eqs.every(([c, v]) => r[c] === v));
    return { data: mode === "one" ? rs[0] ?? null : rs, error: null };
  };
  const p: object = new Proxy(function () {}, {
    get: (_t, key) => {
      if (key === "then") return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(result()).then(res, rej);
      if (key === "eq") return (c: string, v: unknown) => { eqs.push([c, v]); return p; };
      if (key === "maybeSingle" || key === "single") return () => { mode = "one"; return Promise.resolve(result()); };
      return () => p;
    },
    apply: () => p,
  });
  return p;
}

mock.module(src("lib/supabase/server.ts"), {
  namedExports: {
    supabaseServer: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: A, email: "teste@exemplo.com" } } }) },
      rpc: (name: string) => {
        rpcNames.push(name);
        const ok: Record<string, unknown> = { month_spend_by_provider: [], consume_daily_quota: { allowed: true, used: 1, limit: 150 } };
        return Promise.resolve({ data: ok[name] ?? null, error: null });
      },
      from: (table: string) => query(table),
    }),
  },
});
mock.module(src("lib/supabase/admin.ts"), {
  namedExports: {
    supabaseAdmin: () => ({
      rpc: (name: string, args?: Record<string, unknown>) => {
        rpcNames.push(name); adminRpc.push({ name, args });
        const ok: Record<string, unknown> = {
          server_reserve_ai_budget: { allowed: true, reservation_id: RID, amount: 0.25, spent: 1, reserved: 0.25, limit: 20 },
          server_settle_ai_budget: { ok: true, cost: 0.01, over: false },
          server_release_ai_budget: { ok: true, released: true },
        };
        return Promise.resolve({ data: ok[name] ?? null, error: null });
      },
      from: () => { throw new Error("o chat não lê tabelas com a chave secreta"); },
    }),
  },
});
mock.module(src("lib/access.ts"), { namedExports: { accessOf: async () => ({ ok: true, admin: false }) } });
mock.module(src("lib/embeddings.ts"), { namedExports: { embeddingsAvailable: () => false, embed: async () => [], toVector: () => "[]" } });
mock.module(src("lib/llm/complete.ts"), { namedExports: { complete: async () => ({ text: "", provider: "anthropic", model: "x", input: 0, output: 0, cost: 0 }) } });
const fmt = await import(src("lib/google-format.ts"));
let googleReads = 0;
mock.module(src("lib/google.ts"), {
  namedExports: {
    googleIntent: fmt.googleIntent, formatEvents: fmt.formatEvents, formatMails: fmt.formatMails, GoogleError: class extends Error {},
    accessToken: async () => "tok", events: async () => { googleReads++; return []; }, inbox: async () => { googleReads++; return []; },
  },
});
class BudgetReached extends Error {}
class NoProviderError extends Error {}
class AllProvidersFailed extends Error { kind = "other"; }
mock.module(src("lib/llm/router.ts"), {
  namedExports: {
    BudgetReached, NoProviderError, AllProvidersFailed,
    routeChat: async function* (req: { onUsage?: (u: unknown) => void; context?: string }) {
      providerCalls.push({ context: req.context });
      yield { type: "provider", name: "Claude", id: "anthropic" };
      yield { type: "text", text: modelText };
      req.onUsage?.({ provider: "anthropic", model: "claude-opus-5-5", input_tokens: 1000, output_tokens: 100 });
    },
  },
});
mock.module("next/server", { namedExports: { after: () => {}, NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } } });

const { POST } = await import(src("app/api/chat/route.ts"));
const { mesSP } = await import(src("lib/agentes/ferramentas.ts"));

type Ev = { t: string; kind?: string; text?: string; items?: { kind: string }[] };
async function chat(message: string, extra: Record<string, unknown> = {}): Promise<Ev[]> {
  const res: Response = await POST(new Request("http://localhost/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message, ...extra }) }));
  if (res.status !== 200) return [{ t: "http", kind: String(res.status) }];
  return (await res.text()).trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as Ev);
}
const META_TXT = (acoes: unknown[]) => `Preparei, é só confirmar.\n<<<META>>>\n${JSON.stringify({ memorias: [], acoes })}`;
const TODAS = ["agenda", "email", "tarefas", "lembretes", "financas", "metas", "memoria", "acoes"];

beforeEach(() => {
  providerCalls = []; rpcNames = []; adminRpc = []; usoFail = false; modelText = "Olá!"; googleReads = 0;
  generic = {
    profiles: [{ id: A, display_name: "Ana Teste", settings: {} }],
    agents: [
      { id: 1, user_id: A, name: "Mentor", area: "Estudos", instructions: "", active: true, ferramentas: TODAS, teto_mensal_usd: "1.00" },
      { id: 2, user_id: A, name: "Só agenda", area: "Pessoal", instructions: "", active: true, ferramentas: ["agenda", "acoes"], teto_mensal_usd: null },
      { id: 3, user_id: A, name: "Livre", area: "Pessoal", instructions: "", active: true, ferramentas: TODAS, teto_mensal_usd: null },
      { id: 90, user_id: B, name: "SEGREDO-B", area: "Pessoal", instructions: "", active: true, ferramentas: [], teto_mensal_usd: "0.01" },
    ],
    agent_uso: [
      { user_id: A, agent_id: 1, mes: mesSP(), custo_usd: "1.000000", mensagens: 9 },
      { user_id: A, agent_id: 1, mes: "2000-01-01", custo_usd: "0", mensagens: 0 },
    ],
    tasks: [{ id: 5, user_id: A, title: "TAREFA-DE-A", status: "open", priority: 2, due_date: null }],
    memories: [{ id: 7, user_id: A, content: "MEMORIA-DE-A", area: "Pessoal", status: "approved" }],
  };
});

test("teto do agente atingido: para antes da reserva, da cota e da IA, e avisa com o nome e o teto", async () => {
  const ev = await chat("oi", { agentId: 1 });
  assert.equal(providerCalls.length, 0, "a IA não é chamada");
  assert.ok(!rpcNames.includes("server_reserve_ai_budget"), "nada é reservado");
  assert.ok(!rpcNames.includes("consume_daily_quota"), "a cota do dia não é gasta");
  const n = ev.find((e) => e.t === "notice");
  assert.equal(n?.kind, "quota");
  assert.match(n?.text ?? "", /Mentor.*US\$ 1\.00/);
});

test("abaixo do teto: responde e soma o custo no mês do agente pelo servidor", async () => {
  (generic.agent_uso[0] as Row).custo_usd = "0.40";
  await chat("oi", { agentId: 1 });
  assert.equal(providerCalls.length, 1);
  assert.deepEqual(rpcNames.slice(0, 3), ["month_spend_by_provider", "server_reserve_ai_budget", "consume_daily_quota"], "o teto global continua na mesma ordem");
  const add = adminRpc.filter((c) => c.name === "server_add_agent_usage");
  assert.equal(add.length, 1, "soma uma vez");
  assert.equal(add[0].args?.p_user, A, "o id vem da sessão");
  assert.equal(add[0].args?.p_agent, 1);
  assert.ok((add[0].args?.p_cost_usd as number) > 0);
});

test("com teto e sem conseguir ler o gasto: bloqueia (fail closed); sem teto, segue", async () => {
  usoFail = true;
  const ev = await chat("oi", { agentId: 1 });
  assert.equal(providerCalls.length, 0);
  assert.ok(!rpcNames.includes("server_reserve_ai_budget"));
  assert.equal(ev.find((e) => e.t === "notice")?.kind, "error");
  await chat("oi", { agentId: 3 });
  assert.equal(providerCalls.length, 1, "agente sem teto não depende do gasto");
});

test("sem agente e com agente de outra pessoa: nada muda e nada soma em agente", async () => {
  await chat("oi");
  await chat("oi", { agentId: 90 });
  assert.equal(providerCalls.length, 2, "agente de B não bloqueia nem restringe A");
  assert.equal(adminRpc.filter((c) => c.name === "server_add_agent_usage").length, 0);
  assert.ok(!JSON.stringify(providerCalls).includes("SEGREDO-B"));
  assert.match(providerCalls[0].context ?? "", /TAREFA-DE-A/);
});

test("ferramentas: o que está desligado não entra no contexto e as ações dele não viram cartão", async () => {
  modelText = META_TXT([{ tipo: "tarefa_concluir", tarefa: "TAREFA-DE-A" }, { tipo: "memoria_esquecer", memoria: "MEMORIA-DE-A" }, { tipo: "guia" }]);
  const ev = await chat("conclui a tarefa e me mostra o guia", { agentId: 2 });
  const c = providerCalls[0]?.context ?? "";
  assert.ok(!c.includes("TAREFA-DE-A"), "tarefas fora");
  assert.ok(!c.includes("MEMORIA-DE-A"), "memória fora");
  assert.match(c, /NÃO use nem proponha nada de .*Tarefas e projetos.*Memória/);
  const kinds = (ev.find((e) => e.t === "acoes")?.items ?? []).map((i) => i.kind);
  assert.ok(!kinds.some((k) => k.startsWith("tarefa") || k.startsWith("memoria")), `sem cartões de ferramentas desligadas (${kinds})`);
});

test("ferramentas: agente sem e-mail não lê a caixa de entrada", async () => {
  generic.agents[1].ferramentas = ["agenda"];
  await chat("tenho e-mails novos?", { agentId: 2 });
  assert.equal(googleReads, 0, "nada do Google é lido para e-mail");
  await chat("tenho e-mails novos?", { agentId: 3 });
  assert.ok(googleReads > 0, "com a ferramenta, lê");
});
