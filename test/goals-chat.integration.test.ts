// Integração do assistente com Metas: /api/chat com Supabase (RLS imitada), IA e Google simulados.
// Garante: a fonte `goals` do Core (perguntas) injeta o bloco [M1]… só com dados da sessão e SEM IA extra; "corri 5 km hoje"
// só PROPÕE (nada é gravado até a pessoa confirmar, e a gravação é pela rota com a sessão); tudo continua passando por
// limites → reserva → cota → IA; GOALS_ENABLED=0 e CORE_MVP=0 desligam o que devem; falha de leitura nunca inventa progresso.
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { makeFinDb, type FinStore } from "./fin-fake.ts";

type Row = Record<string, unknown>;
const src = (p: string) => new URL(`../src/${p}`, import.meta.url).href;
const RID = "3f2b1c9e-8d7a-4b6c-9e5f-1a2b3c4d5e6f";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

let sessionUser: string | null = A;
let generic: Record<string, Row[]> = {};
let store: FinStore = {};
let log: { tables: string[]; writes: { table: string; op: string; rows: Row[] }[] } = { tables: [], writes: [] };
let tablesRead: string[] = [];
let providerCalls: { context?: string }[] = [];
let completeCalls = 0;
let rpcNames: string[] = [];
let rpcFail: string | null = null;
let reserveAllowed = true;
let modelText = "Resposta [M1].";
let goalsFail = false;
let voiceWrites: { table: string; op: string; rows: Row[] }[] = [];

const goalDb = () => makeFinDb(store, () => sessionUser, log);

function query(table: string) {
  const eqs: [string, unknown][] = [];
  let mode: "rows" | "one" = "rows";
  const rows = () => (generic[table] ?? []).filter((r) => (r.user_id ?? r.id) === sessionUser && eqs.every(([c, v]) => r[c] === v));
  const result = () => {
    if (table === "conversations") return { data: { id: 1 }, error: null };
    const rs = rows();
    return { data: mode === "one" ? rs[0] ?? null : rs, error: null };
  };
  const p: object = new Proxy(function () {}, {
    get: (_t, key) => {
      if (key === "then") return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(result()).then(res, rej);
      if (key === "eq") return (c: string, v: unknown) => { eqs.push([c, v]); return p; };
      if (key === "insert" || key === "update" || key === "delete" || key === "upsert") return (...rows: unknown[]) => { if (["tasks", "reminders", "projects"].includes(table)) voiceWrites.push({ table, op: String(key), rows: rows as Row[] }); return p; };
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
      auth: { getUser: async () => ({ data: { user: sessionUser ? { id: sessionUser, email: "teste@exemplo.com" } : null } }) },
      rpc: (name: string) => {
        rpcNames.push(name);
        if (rpcFail === name) return Promise.resolve({ data: null, error: { message: "indisponível" } });
        const ok: Record<string, unknown> = { month_spend_by_provider: [], consume_daily_quota: { allowed: true, used: 1, limit: 150 } };
        return Promise.resolve({ data: ok[name] ?? null, error: null });
      },
      from: (table: string) => {
        tablesRead.push(table);
        if (table.startsWith("goal")) {
          if (goalsFail) throw new Error("falha simulada em metas");
          return goalDb().from(table);
        }
        return query(table);
      },
    }),
  },
});
mock.module(src("lib/supabase/admin.ts"), {
  namedExports: {
    supabaseAdmin: () => ({
      rpc: (name: string) => {
        rpcNames.push(name);
        const ok: Record<string, unknown> = {
          server_reserve_ai_budget: reserveAllowed ? { allowed: true, reservation_id: RID, amount: 0.25, spent: 1, reserved: 0.25, limit: 20 } : { allowed: false, reason: "monthly", limit: 20 },
          server_settle_ai_budget: { ok: true, cost: 0.01, over: false },
          server_release_ai_budget: { ok: true, released: true },
        };
        return Promise.resolve({ data: ok[name] ?? null, error: null });
      },
      from: () => { throw new Error("metas e Core não podem ler tabelas com a chave secreta"); },
    }),
  },
});
mock.module(src("lib/access.ts"), { namedExports: { accessOf: async () => ({ ok: true, admin: false }) } });
mock.module(src("lib/embeddings.ts"), { namedExports: { embeddingsAvailable: () => false, embed: async () => [], toVector: () => "[]" } });
mock.module(src("lib/llm/complete.ts"), { namedExports: { complete: async () => { completeCalls++; return { text: "", provider: "anthropic", model: "x", input: 0, output: 0, cost: 0 }; } } });
const fmt = await import(src("lib/google-format.ts"));
mock.module(src("lib/google.ts"), {
  namedExports: {
    googleIntent: fmt.googleIntent, formatEvents: fmt.formatEvents, formatMails: fmt.formatMails, GoogleError: class extends Error {},
    accessToken: async () => "tok", events: async () => [], inbox: async () => [],
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
const progressoRoute = await import(src("app/api/goals/[id]/progresso/route.ts"));
const metaRoute = await import(src("app/api/goals/[id]/route.ts"));
const { hojeSP, isoDia } = await import(src("lib/finance/datas.ts"));

type Ev = { t: string; kind?: string; text?: string; items?: any[]; unavailable?: string[] };
async function chat(message: string, extra: Record<string, unknown> = {}): Promise<Ev[]> {
  const res: Response = await POST(new Request("http://localhost/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message, ...extra }) }));
  if (res.status !== 200) return [{ t: "http", kind: String(res.status) }];
  return (await res.text()).trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as Ev);
}
const ctxOf = () => providerCalls[0]?.context ?? "";
const goalTablesRead = () => tablesRead.filter((t) => t.startsWith("goal"));
const HOJE = hojeSP();

const mk = (id: string, user: string, over: Record<string, unknown> = {}) => ({
  id, user_id: user, titulo: `Meta ${id}`, descricao: null, categoria: "desenvolvimento", categoria_nome: null, medicao: "numerica", unidade: "livros", agregacao: "soma",
  valor_inicial: 0, valor_alvo: 12, inicio: "2026-01-01", prazo: "2099-12-31", status: "ativa", concluida_em: null, created_at: "2026-01-01T00:00:00Z", ...over,
});
function seed() {
  generic = { profiles: [{ id: A, display_name: "Ana Teste", settings: { blocked: ["acme"] } }, { id: B, display_name: "Beto", settings: {} }] };
  store = {
    goals: [
      mk("10000000-0000-4000-8000-000000000001", A, { titulo: "Ler 12 livros" }),
      mk("10000000-0000-4000-8000-000000000002", A, { titulo: "Chegar ao peso de 75 kg", unidade: "kg", agregacao: "ultimo", valor_inicial: 82, valor_alvo: 75 }),
      mk("10000000-0000-4000-8000-000000000003", A, { titulo: "Entregar projeto Acme" }),
      mk("10000000-0000-4000-8000-000000000004", A, { titulo: "Certificação", medicao: "marcos", unidade: null, valor_alvo: null }),
      mk("10000000-0000-4000-8000-0000000000b1", B, { titulo: "SEGREDO-B meta" }),
    ],
    goal_progress: [
      { id: "p1", user_id: A, goal_id: "10000000-0000-4000-8000-000000000001", valor: 3, data: "2026-06-01", origem: "manual", nota: null, created_at: "2026-06-01T10:00:00Z" },
      { id: "p2", user_id: A, goal_id: "10000000-0000-4000-8000-000000000002", valor: 80, data: "2026-06-10", origem: "manual", nota: null, created_at: "2026-06-10T10:00:00Z" },
      { id: "pb", user_id: B, goal_id: "10000000-0000-4000-8000-0000000000b1", valor: 7777, data: "2026-06-10", origem: "manual", nota: null, created_at: "2026-06-10T10:00:00Z" },
    ],
    goal_milestones: [], goal_tasks: [],
  };
}
const tagOf = (titulo: string) => /\[(M\d+)\] [^\n]*?/.exec(ctxOf().split("\n").find((l) => l.includes(titulo)) ?? "")?.[1] ?? "";
function resetAll() {
  sessionUser = A; tablesRead = []; providerCalls = []; completeCalls = 0; rpcNames = []; rpcFail = null; reserveAllowed = true; modelText = "Resposta [M1]."; goalsFail = false; voiceWrites = [];
  log = { tables: [], writes: [] };
  delete process.env.GOALS_ENABLED; delete process.env.CORE_MVP; delete process.env.FINANCE_ENABLED;
  seed();
}
beforeEach(resetAll);
afterEach(() => { delete process.env.GOALS_ENABLED; delete process.env.CORE_MVP; delete process.env.FINANCE_ENABLED; });

test("pergunta sobre metas: o contexto traz o bloco [M1]… só com dados de A, sem IA extra, e Fontes apontam para a tela Metas", async () => {
  const events = await chat("Como estão minhas metas?");
  assert.equal(providerCalls.length, 1, "uma única chamada de IA");
  assert.equal(completeCalls, 0, "nenhuma IA extra");
  const c = ctxOf();
  assert.match(c, /Core do GaDu · Metas/);
  assert.match(c, /\[M\d+\] Meta \(Desenvolvimento pessoal\): Ler 12 livros: 3 livros de 12 livros \(25%\)/);
  assert.match(c, /último registro em 01\/06/);
  assert.match(c, /nenhum registro ainda/, "sem registro é dito");
  assert.match(c, /Cite a etiqueta/);
  assert.ok(!c.includes("SEGREDO-B") && !c.includes("7.777") && !c.includes("7777"), "nada de B");
  assert.ok(!/Atualização de meta/.test(c), "pergunta não ensina a propor atualização");
  const sources = events.find((e) => e.t === "sources");
  assert.ok(sources?.items?.some((i) => /^M\d+$/.test(i.tag) && i.view === "metas" && i.kind === "meta"), "Fontes com o link para a tela Metas");
  assert.ok(events.findIndex((e) => e.t === "sources") < events.findIndex((e) => e.t === "done"));
  assert.ok(!JSON.stringify(sources).includes("SEGREDO-B"));
  assert.equal(log.writes.length, 0, "perguntar não grava nada");
  assert.ok(!c.toLowerCase().split("core do gadu · metas")[1].includes("acme"), "termo bloqueado não vai ao modelo");
  assert.match(c, /omitido pela regra de privacidade/);
});

test("pergunta pelo nome da meta: só a meta pedida", async () => {
  await chat("Como está minha meta de peso, quanto falta?");
  const c = ctxOf();
  assert.match(c, /Chegar ao peso de 75 kg: 80 kg de 75 kg/);
  assert.ok(!c.includes("Ler 12 livros"));
});

test("o custo continua passando por limites → reserva → cota → IA, e liquida a reserva (pergunta e atualização)", async () => {
  for (const msg of ["Como estão minhas metas?", "corri 5 km hoje"]) {
    resetAll();
    await chat(msg);
    assert.deepEqual(rpcNames.slice(0, 3), ["month_spend_by_provider", "server_reserve_ai_budget", "consume_daily_quota"], msg);
    assert.ok(rpcNames.includes("server_settle_ai_budget"), msg);
    assert.ok(!rpcNames.includes("server_release_ai_budget"), msg);
  }
});

test("fail closed: sem verificar limites, ou com o teto atingido, a IA não é chamada e nenhuma tabela de metas é lida", async () => {
  rpcFail = "month_spend_by_provider";
  assert.ok((await chat("Como estão minhas metas?")).some((e) => e.t === "notice"));
  assert.equal(providerCalls.length, 0); assert.deepEqual(goalTablesRead(), []);
  resetAll(); reserveAllowed = false;
  const ev = await chat("corri 5 km hoje");
  assert.ok(ev.some((e) => e.t === "notice" && e.kind === "quota"));
  assert.equal(providerCalls.length, 0); assert.deepEqual(goalTablesRead(), []); assert.ok(!ev.some((e) => e.t === "metas"));
  resetAll(); rpcFail = "consume_daily_quota";
  await chat("Como estão minhas metas?");
  assert.equal(providerCalls.length, 0); assert.deepEqual(goalTablesRead(), []);
});

test("sem sessão: 401, nada é consultado nem custa", async () => {
  sessionUser = null;
  assert.deepEqual(await chat("Como estão minhas metas?"), [{ t: "http", kind: "401" }]);
  assert.equal(providerCalls.length, 0); assert.equal(tablesRead.length, 0); assert.equal(rpcNames.length, 0);
});

test("sessão de B: só as metas de B, mesmo com ids e contexto de A no corpo", async () => {
  sessionUser = B;
  await chat("Como estão minhas metas?", { context: { module: "metas", view: "metas" }, projectId: 5, agentId: 9 });
  const c = ctxOf();
  assert.ok(c.includes("SEGREDO-B meta"), "dados de B");
  assert.ok(!c.includes("Ler 12 livros") && !c.includes("Chegar ao peso de 75 kg"), "nada de A");
});

test("atualizar pela conversa: a IA só PROPÕE; nada é gravado; a etiqueta vira o id real no servidor; a gravação é pela rota, com a sessão, depois da confirmação", async () => {
  // 1ª chamada só para descobrir a etiqueta que o servidor atribuiu à meta de leitura
  await chat("registra 2 livros na meta de leitura");
  const tag = tagOf("Ler 12 livros");
  assert.match(tag, /^M\d+$/);
  resetAll();
  modelText = `Preparei a atualização, confira e toque em Confirmar.\n<<<META>>>\n${JSON.stringify({ metas: [{ meta: tag, acao: "registrar", valor: 2 }] })}`;
  const events = await chat("registra 2 livros na meta de leitura");
  const c = ctxOf();
  assert.match(c, /Atualização de meta/);
  assert.match(c, /Você NÃO grava|NÃO grava/);
  assert.match(c, /valor SOMADO/);
  const prop = events.find((e) => e.t === "metas");
  assert.deepEqual(prop?.items, [{ goalId: "10000000-0000-4000-8000-000000000001", titulo: "Ler 12 livros", unidade: "livros", acao: "registrar", valor: 2, data: isoDia(HOJE), agregacao: "soma" }]);
  assert.equal(completeCalls, 0);
  assert.equal(store.goal_progress.length, 3, "nenhum registro novo gravado pelo chat");
  assert.equal(log.writes.filter((w) => w.table.startsWith("goal")).length, 0);
  // A pessoa toca em "Confirmar": o app chama a rota com a sessão dela (user_id do corpo é ignorado).
  const item = prop!.items![0] as { goalId: string; valor: number; data: string };
  const r: Response = await progressoRoute.POST(new Request("http://localhost/x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ valor: item.valor, data: item.data, origem: "conversa", user_id: B }) }), { params: Promise.resolve({ id: item.goalId }) });
  assert.equal(r.status, 201);
  const novo = store.goal_progress.find((g) => g.origem === "conversa")!;
  assert.deepEqual([novo.user_id, novo.valor, novo.goal_id], [A, 2, "10000000-0000-4000-8000-000000000001"]);
});

test("concluir pela conversa: proposta; a conclusão só acontece pela rota, depois da confirmação", async () => {
  await chat("conclui a meta de certificação");
  const tag = tagOf("Certificação");
  resetAll();
  modelText = `Preparei.\n<<<META>>>\n${JSON.stringify({ metas: [{ meta: tag, acao: "concluir" }] })}`;
  const events = await chat("conclui a meta de certificação");
  const prop = events.find((e) => e.t === "metas");
  assert.deepEqual(prop?.items, [{ goalId: "10000000-0000-4000-8000-000000000004", titulo: "Certificação", unidade: null, acao: "concluir", valor: null, data: null, agregacao: "soma" }]);
  assert.equal(store.goals.find((g) => g.id === "10000000-0000-4000-8000-000000000004")!.status, "ativa", "ainda ativa: ninguém confirmou");
  const r: Response = await metaRoute.PATCH(new Request("http://localhost/x", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "concluida" }) }), { params: Promise.resolve({ id: "10000000-0000-4000-8000-000000000004" }) });
  assert.equal(r.status, 200);
  assert.equal(store.goals.find((g) => g.id === "10000000-0000-4000-8000-000000000004")!.status, "concluida");
  assert.ok(store.goals.find((g) => g.id === "10000000-0000-4000-8000-000000000004")!.concluida_em);
});

test("proposta inválida não vira cartão: etiqueta inventada/de B, valor 0, registrar em meta por marcos, meta com termo bloqueado, fora da conversa de atualização", async () => {
  await chat("registra 2 livros na meta de leitura");
  const tagMarcos = tagOf("Certificação"), tagAcme = tagOf("Acme"), tagLeitura = tagOf("Ler 12 livros");
  assert.ok(tagMarcos && tagLeitura);
  assert.equal(tagAcme, "", "meta com termo bloqueado não recebe etiqueta utilizável");
  const casos: unknown[] = [
    { meta: "M99", acao: "registrar", valor: 2 },
    { meta: "10000000-0000-4000-8000-0000000000b1", acao: "registrar", valor: 2 },
    { meta: tagLeitura, acao: "registrar", valor: 0 },
    { meta: tagLeitura, acao: "registrar", valor: -3 },
    { meta: tagMarcos, acao: "registrar", valor: 2 },
    { meta: tagLeitura, acao: "apagar" },
  ];
  for (const c of casos) {
    resetAll();
    modelText = `Ok.\n<<<META>>>\n${JSON.stringify({ metas: [c] })}`;
    assert.ok(!(await chat("registra 2 livros na meta de leitura")).some((e) => e.t === "metas"), JSON.stringify(c));
  }
  // meta por percentual não aceita mais de 100
  resetAll();
  store.goals.push(mk("10000000-0000-4000-8000-000000000005", A, { titulo: "Curso online", medicao: "percentual", unidade: null, agregacao: "ultimo", valor_inicial: 0, valor_alvo: 100 }));
  await chat("li 30 páginas do curso");
  const tagPct = tagOf("Curso online");
  resetAll();
  store.goals.push(mk("10000000-0000-4000-8000-000000000005", A, { titulo: "Curso online", medicao: "percentual", unidade: null, agregacao: "ultimo", valor_inicial: 0, valor_alvo: 100 }));
  modelText = `Ok.\n<<<META>>>\n${JSON.stringify({ metas: [{ meta: tagPct, acao: "registrar", valor: 140 }] })}`;
  assert.ok(!(await chat("li 30 páginas do curso")).some((e) => e.t === "metas"), "percentual acima de 100");
  // sem intenção de atualizar, o servidor ignora metas vindas do modelo
  resetAll();
  modelText = `Ok.\n<<<META>>>\n${JSON.stringify({ metas: [{ meta: "M1", acao: "concluir" }] })}`;
  assert.ok(!(await chat("Me conta uma piada")).some((e) => e.t === "metas"));
  assert.ok(!ctxOf().includes("Atualização de meta"));
  // pergunta (não atualização) também não vira proposta
  resetAll();
  modelText = `Ok.\n<<<META>>>\n${JSON.stringify({ metas: [{ meta: "M1", acao: "concluir" }] })}`;
  assert.ok(!(await chat("Como estão minhas metas?")).some((e) => e.t === "metas"));
});

test("GOALS_ENABLED=0: sem bloco, sem leitura, sem regras de atualização e sem proposta, mesmo se o modelo propuser", async () => {
  process.env.GOALS_ENABLED = "0";
  modelText = `Ok.\n<<<META>>>\n${JSON.stringify({ metas: [{ meta: "M1", acao: "registrar", valor: 2 }] })}`;
  for (const msg of ["Como estão minhas metas?", "corri 5 km hoje"]) {
    providerCalls = []; tablesRead = [];
    const events = await chat(msg);
    const c = ctxOf();
    assert.ok(!c.includes("Metas") && !c.includes("Atualização de meta") && !c.includes("[M1]"), msg);
    assert.deepEqual(goalTablesRead(), [], msg);
    assert.ok(!events.some((e) => e.t === "metas" || e.t === "sources"), msg);
    assert.equal(providerCalls.length, 1, "o chat segue funcionando");
  }
});

test("CORE_MVP=0: a fonte goals do Core some (nenhuma leitura de metas, sem bloco, sem Fontes, sem proposta); o chat segue como antes", async () => {
  process.env.CORE_MVP = "0";
  modelText = `Ok.\n<<<META>>>\n${JSON.stringify({ metas: [{ meta: "M1", acao: "registrar", valor: 2 }] })}`;
  for (const msg of ["Como estão minhas metas?", "corri 5 km hoje"]) {
    providerCalls = []; tablesRead = [];
    const events = await chat(msg);
    assert.ok(!ctxOf().includes("Core do GaDu") && !ctxOf().includes("[M1]") && !ctxOf().includes("Atualização de meta"), msg);
    assert.deepEqual(goalTablesRead(), [], msg);
    assert.ok(!events.some((e) => e.t === "sources" || e.t === "metas"), msg);
    assert.equal(providerCalls.length, 1);
  }
});

test("a pergunta de atenção do dia tem prioridade e não puxa metas; finanças também tem prioridade", async () => {
  await chat("O que merece minha atenção hoje?");
  assert.match(ctxOf(), /O que merece atenção hoje/);
  assert.ok(!ctxOf().includes("Core do GaDu · Metas"));
  assert.deepEqual(goalTablesRead(), []);
  resetAll();
  await chat("gastei 45 no mercado no pix");
  assert.ok(!ctxOf().includes("Atualização de meta"));
  assert.deepEqual(goalTablesRead(), []);
});

test("falha ao ler metas: o modelo é avisado para não inventar progresso, as Fontes dizem que não leu, e o chat responde", async () => {
  goalsFail = true;
  const events = await chat("Como estão minhas metas?");
  assert.match(ctxOf(), /Não consegui ler suas metas agora\. Diga isso com franqueza e não invente progresso/);
  assert.ok(!ctxOf().includes("[M1]"));
  assert.deepEqual(events.find((e) => e.t === "sources")?.unavailable, ["Não consegui ler suas metas agora."]);
  assert.ok(events.some((e) => e.t === "done"));
  assert.ok(rpcNames.includes("server_settle_ai_budget"), "o custo foi liquidado normalmente");
  // falha na leitura + modelo propõe: nada de cartão
  resetAll(); goalsFail = true;
  modelText = `Ok.\n<<<META>>>\n${JSON.stringify({ metas: [{ meta: "M1", acao: "registrar", valor: 2 }] })}`;
  assert.ok(!(await chat("corri 5 km hoje")).some((e) => e.t === "metas"));
});

test("mensagem comum: chat idêntico ao anterior (sem Metas)", async () => {
  const events = await chat("Me conta uma piada");
  assert.ok(!ctxOf().includes("Metas"));
  assert.deepEqual(goalTablesRead(), []);
  assert.ok(!events.some((e) => e.t === "sources" || e.t === "metas"));
});

test("metas nunca usa a chave secreta para tabelas (só orçamento, por rpc)", async () => {
  await chat("Como estão minhas metas?");
  assert.ok(goalTablesRead().length >= 3);
});

// ---- "Tudo por voz": bloco "acoes" (criar meta, registrar pelo nome, marco, tarefa) ----
const META_TXT = (acoes: unknown[]) => `Preparei, é só confirmar.\n<<<META>>>\n${JSON.stringify({ memorias: [], acoes })}`;

test("tudo por voz: criar meta vira cartão para confirmar; nada é gravado", async () => {
  modelText = META_TXT([{ tipo: "meta_criar", titulo: "Correr 50 km", medicao: "numerica", unidade: "km", alvo: 50, prazo: "2027-06-30", categoria: "saude" }]);
  const events = await chat("cria uma meta de correr 50 km até o fim do ano");
  const acoes = events.find((e) => e.t === "acoes");
  assert.deepEqual(acoes?.items?.[0], { kind: "meta_nova", titulo: "Correr 50 km", medicao: "numerica", unidade: "km", alvo: 50, inicial: 0, prazo: "2027-06-30", categoria: "saude", marcos: [] });
  assert.equal(log.writes.length, 0, "só proposta");
  assert.ok(!events.some((e) => e.t === "delta" && /<<<META/.test(e.text ?? "")), "bloco de controle não vaza");
});

test("tudo por voz: registrar e concluir pelo nome só acham metas de A; meta de B vira aviso", async () => {
  modelText = META_TXT([{ tipo: "meta_registrar", meta: "livros", valor: 2 }, { tipo: "meta_concluir", meta: "SEGREDO-B meta" }, { tipo: "meta_marco", meta: "certificação", titulo: "Prova final" }]);
  const events = await chat("li 2 livros, e adiciona um marco");
  const items = events.find((e) => e.t === "acoes")?.items ?? [];
  assert.deepEqual(items.map((i) => i.kind), ["meta", "marco"]);
  assert.equal(items[0].d.goalId, "10000000-0000-4000-8000-000000000001");
  assert.equal(items[0].d.valor, 2);
  assert.equal(items[1].goalId, "10000000-0000-4000-8000-000000000004");
  assert.ok(events.some((e) => e.t === "notice" && /Não achei a meta/.test(e.text ?? "")), "avisa o que não achou");
  assert.ok(!JSON.stringify(events).includes("10000000-0000-4000-8000-0000000000b1"), "nunca o id de B");
  assert.equal(log.writes.length, 0);
});

test("tudo por voz: GOALS_ENABLED=0 não gera cartão de meta", async () => {
  process.env.GOALS_ENABLED = "0";
  modelText = META_TXT([{ tipo: "meta_criar", titulo: "Ler", medicao: "tarefas" }, { tipo: "projeto_criar", nome: "Reforma" }]);
  const events = await chat("cria uma meta de ler e um projeto reforma");
  assert.deepEqual((events.find((e) => e.t === "acoes")?.items ?? []).map((i) => i.kind), ["projeto"]);
});

test("tudo por voz: termo bloqueado não vira cartão", async () => {
  modelText = META_TXT([{ tipo: "meta_criar", titulo: "Projeto ACME grande", medicao: "tarefas" }]);
  const events = await chat("cria uma meta do projeto");
  assert.equal(events.find((e) => e.t === "acoes"), undefined);
});

// ---- "Tudo por voz": tarefas (cancelar, reabrir, editar) e lembrete (adiar) ----
function seedTarefas() {
  generic.tasks = [
    { id: 5, user_id: A, title: "Ler aviso do condomínio", status: "open" },
    { id: 6, user_id: A, title: "Ligar para o dentista", status: "cancelled" },
    { id: 50, user_id: B, title: "SEGREDO-B tarefa", status: "open" },
  ];
  generic.projects = [{ id: 3, user_id: A, name: "Casa nova", status: "active" }, { id: 30, user_id: B, name: "SEGREDO-B projeto", status: "active" }];
  generic.reminders = [{ id: 9, user_id: A, text: "Tomar o remédio", due_at: "2026-12-30T23:00:00.000Z", status: "pending" }, { id: 90, user_id: B, text: "SEGREDO-B lembrete", due_at: "2026-12-30T23:00:00.000Z", status: "pending" }];
}
const AMANHA = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

test("tudo por voz: cancelar, reabrir e editar tarefa e adiar lembrete viram cartões; nada é gravado", async () => {
  seedTarefas();
  const quando = new Date(Date.now() + 3_600_000).toISOString();
  modelText = META_TXT([
    { tipo: "tarefa_cancelar", tarefa: "aviso do condomínio" },
    { tipo: "tarefa_reabrir", tarefa: "dentista" },
    { tipo: "tarefa_editar", tarefa: "aviso", prioridade: 1, prazo: AMANHA, projeto: "casa nova" },
    { tipo: "lembrete_adiar", lembrete: "remédio", quando },
  ]);
  const events = await chat("cancela o aviso, reabre o dentista, muda o aviso e adia o remédio");
  const items = events.find((e) => e.t === "acoes")?.items ?? [];
  assert.deepEqual(items.map((i) => i.kind), ["tarefa_cancelar", "tarefa_reabrir", "tarefa_editar", "lembrete_adiar"]);
  assert.deepEqual(items[2].mudancas, { prioridade: 1, prazo: AMANHA, projetoId: 3, projeto: "Casa nova" });
  assert.equal(items[3].id, 9);
  assert.equal(items[3].novoDueAt, quando);
  assert.equal(voiceWrites.length, 0, "só proposta: nada gravado em tarefas, lembretes ou projetos antes da confirmação");
  assert.ok(!JSON.stringify(events).includes("SEGREDO-B"));
});

test("tudo por voz: tarefa, projeto e lembrete de B nunca viram cartão (viram aviso)", async () => {
  seedTarefas();
  modelText = META_TXT([
    { tipo: "tarefa_cancelar", tarefa: "SEGREDO-B tarefa" },
    { tipo: "tarefa_editar", tarefa: "aviso", projeto: "SEGREDO-B projeto" },
    { tipo: "lembrete_adiar", lembrete: "SEGREDO-B lembrete", quando: new Date(Date.now() + 3_600_000).toISOString() },
  ]);
  const events = await chat("mexe nas coisas do outro");
  assert.equal(events.find((e) => e.t === "acoes"), undefined);
  assert.ok(events.some((e) => e.t === "notice" && e.kind === "acao"));
  assert.ok(!JSON.stringify(events.filter((e) => e.t === "acoes")).includes("SEGREDO-B"));
  assert.equal(voiceWrites.length, 0);
});

test("tudo por voz: ações de tarefa e lembrete continuam com Metas desligado, e título bloqueado não vira cartão", async () => {
  process.env.GOALS_ENABLED = "0";
  process.env.FINANCE_ENABLED = "0";
  seedTarefas();
  modelText = META_TXT([{ tipo: "tarefa_cancelar", tarefa: "aviso" }, { tipo: "tarefa_editar", tarefa: "aviso", titulo: "Reunião Acme" }]);
  const events = await chat("cancela o aviso e renomeia");
  assert.deepEqual((events.find((e) => e.t === "acoes")?.items ?? []).map((i) => i.kind), ["tarefa_cancelar"]);
});
