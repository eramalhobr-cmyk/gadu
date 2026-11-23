// Integração do assistente com Finanças: /api/chat com Supabase (RLS imitada), IA e Google simulados.
// Garante: a fonte `finance` do Core (perguntas) injeta o bloco [F1]… só com dados da sessão e SEM IA extra; "gastei 45 no mercado"
// só PROPÕE (nada é gravado até a pessoa confirmar, e a gravação é pela rota com a sessão); tudo continua passando por
// limites → reserva → cota → IA; FINANCE_ENABLED=0 e CORE_MVP=0 desligam o que devem; falha de leitura nunca inventa valores.
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
let modelText = "Resposta [F1].";
let finFail = false;
let calendarFail = false;
let calEvents: { id?: string; title: string; start: string; end: string; allDay: boolean; where?: string; meet: boolean; declined: boolean }[] = [];

const finDb = () => makeFinDb(store, () => sessionUser, log);

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
        if (table.startsWith("fin_")) {
          if (finFail) throw new Error("falha simulada em finanças");
          return finDb().from(table);
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
      from: () => { throw new Error("finanças e Core não podem ler tabelas com a chave secreta"); },
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
    accessToken: async () => "tok", events: async () => { if (calendarFail) throw new Error("google fora"); return calEvents; }, inbox: async () => [],
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
const gastosRoute = await import(src("app/api/finance/gastos/route.ts"));
const { hojeSP, isoDia } = await import(src("lib/finance/datas.ts"));

type Ev = { t: string; kind?: string; text?: string; items?: any[]; unavailable?: string[] };
async function chat(message: string, extra: Record<string, unknown> = {}): Promise<Ev[]> {
  const res: Response = await POST(new Request("http://localhost/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message, ...extra }) }));
  if (res.status !== 200) return [{ t: "http", kind: String(res.status) }];
  return (await res.text()).trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as Ev);
}
const ctxOf = () => providerCalls[0]?.context ?? "";
const finTablesRead = () => tablesRead.filter((t) => t.startsWith("fin_"));
const HOJE = hojeSP();

function seed() {
  const { ano, mes } = HOJE;
  generic = { profiles: [{ id: A, display_name: "Ana Teste", settings: { blocked: ["acme"] } }, { id: B, display_name: "Beto", settings: {} }] };
  store = {
    fin_itens: [
      { id: "i1", user_id: A, tipo: "receita", grupo: "Receitas", nome: "Salário", nota: null, ordem: 0, dia: 5, dia_estimado: false, movivel: false, nao_caixa: false, cartao_id: null, segue_id: null },
      { id: "i2", user_id: A, tipo: "despesa", grupo: "Moradia", nome: "Aluguel", nota: null, ordem: 0, dia: 8, dia_estimado: false, movivel: false, nao_caixa: false, cartao_id: null, segue_id: null },
      { id: "i3", user_id: A, tipo: "despesa", grupo: "Projetos", nome: "Projeto Acme", nota: null, ordem: 0, dia: 9, dia_estimado: false, movivel: false, nao_caixa: false, cartao_id: null, segue_id: null },
      { id: "ib", user_id: B, tipo: "despesa", grupo: "Geral", nome: "SEGREDO-B conta", nota: null, ordem: 0, dia: 3, dia_estimado: false, movivel: false, nao_caixa: false, cartao_id: null, segue_id: null },
    ],
    fin_item_meses: [
      { item_id: "i1", user_id: A, ano, mes, valor: 5000, pago: true, via_reserva: false, nota: null },
      { item_id: "i2", user_id: A, ano, mes, valor: 1500, pago: false, via_reserva: false, nota: null },
      { item_id: "i3", user_id: A, ano, mes, valor: 321, pago: false, via_reserva: false, nota: null },
      { item_id: "ib", user_id: B, ano, mes, valor: 7777, pago: false, via_reserva: false, nota: null },
    ],
    fin_gastos: [
      { id: "g1", user_id: A, ano, mes, dia: 1, valor: 100, categoria: "Mercado", descricao: "feira", meio: "pix", origem: "manual" },
      { id: "g2", user_id: A, ano, mes, dia: 2, valor: 45.5, categoria: "Mercado", descricao: "", meio: "debito", origem: "manual" },
      { id: "gb", user_id: B, ano, mes, dia: 2, valor: 8888, categoria: "Mercado", descricao: "SEGREDO-B gasto", meio: "pix", origem: "manual" },
    ],
    fin_config: [],
  };
}
function resetAll() {
  sessionUser = A; tablesRead = []; providerCalls = []; completeCalls = 0; rpcNames = []; rpcFail = null; reserveAllowed = true; modelText = "Resposta [F1]."; finFail = false; calendarFail = false; calEvents = [];
  log = { tables: [], writes: [] };
  delete process.env.FINANCE_ENABLED; delete process.env.CORE_MVP;
  seed();
}
beforeEach(resetAll);
afterEach(() => { delete process.env.FINANCE_ENABLED; delete process.env.CORE_MVP; });

test("pergunta financeira: o contexto traz o bloco [F1]… só com dados de A, sem IA extra, e Fontes apontam para o Financeiro", async () => {
  const events = await chat("Quanto gastei com mercado este mês?");
  assert.equal(providerCalls.length, 1, "uma única chamada de IA");
  assert.equal(completeCalls, 0, "nenhuma IA extra");
  const c = ctxOf();
  assert.match(c, /Core do GaDu · Finanças do mês/);
  assert.match(c, /\[F1\] Gasto na categoria: Mercado somou R\$ 145,50 em 2 gastos/);
  assert.match(c, /Cite a etiqueta/);
  assert.ok(!c.includes("SEGREDO-B") && !c.includes("7.777") && !c.includes("8.888"), "nada de B");
  assert.ok(!/Lançamento de gasto/.test(c), "pergunta não ensina a propor lançamento");
  const sources = events.find((e) => e.t === "sources");
  assert.ok(sources?.items?.some((i) => i.tag === "F1" && i.view === "financeiro"), "Fontes com o link para a tela Financeiro");
  assert.ok(events.findIndex((e) => e.t === "sources") < events.findIndex((e) => e.t === "done"));
  assert.ok(!JSON.stringify(sources).includes("SEGREDO-B"));
  assert.equal(log.writes.length, 0, "perguntar não grava nada");
});

test("resumo e contas: números do mês e contas em aberto; termo bloqueado omitido", async () => {
  await chat("Como estão minhas contas?");
  const c = ctxOf();
  assert.match(c, /Contas: 2 em aberto somando R\$ 1\.821,00/);
  assert.match(c, /Conta em aberto: Aluguel R\$ 1\.500,00/);
  assert.ok(!/Acme/i.test(c.split("Core do GaDu")[1] ?? ""), "termo bloqueado não vai ao modelo");
  assert.match(c, /\(omitido pela regra de privacidade\) R\$ 321,00/);
});

test("o custo continua passando por limites → reserva → cota → IA, e liquida a reserva (pergunta e lançamento)", async () => {
  for (const msg of ["Quanto gastei este mês?", "gastei 45 no mercado no pix"]) {
    resetAll();
    await chat(msg);
    assert.deepEqual(rpcNames.slice(0, 3), ["month_spend_by_provider", "server_reserve_ai_budget", "consume_daily_quota"], msg);
    assert.ok(rpcNames.includes("server_settle_ai_budget"), msg);
    assert.ok(!rpcNames.includes("server_release_ai_budget"), msg);
  }
});

test("fail closed: sem verificar limites, ou com o teto atingido, a IA não é chamada e nenhuma tabela de finanças é lida", async () => {
  rpcFail = "month_spend_by_provider";
  assert.ok((await chat("Quanto gastei este mês?")).some((e) => e.t === "notice"));
  assert.equal(providerCalls.length, 0); assert.deepEqual(finTablesRead(), []);
  resetAll(); reserveAllowed = false;
  const ev = await chat("gastei 45 no mercado no pix");
  assert.ok(ev.some((e) => e.t === "notice" && e.kind === "quota"));
  assert.equal(providerCalls.length, 0); assert.deepEqual(finTablesRead(), []); assert.ok(!ev.some((e) => e.t === "gastos"));
  resetAll(); rpcFail = "consume_daily_quota";
  await chat("Quanto gastei este mês?");
  assert.equal(providerCalls.length, 0); assert.deepEqual(finTablesRead(), []);
});

test("sem sessão: 401, nada é consultado nem custa", async () => {
  sessionUser = null;
  assert.deepEqual(await chat("Quanto gastei este mês?"), [{ t: "http", kind: "401" }]);
  assert.equal(providerCalls.length, 0); assert.equal(tablesRead.length, 0); assert.equal(rpcNames.length, 0);
});

test("sessão de B: só os dados de B, mesmo com ids e contexto de A no corpo", async () => {
  sessionUser = B;
  await chat("Quanto gastei este mês?", { context: { module: "financeiro", view: "financeiro" }, projectId: 5, agentId: 9 });
  const c = ctxOf();
  assert.ok(c.includes("8.888") || c.includes("8.888,00"), "dados de B");
  assert.ok(!c.includes("5.000,00") && !c.includes("Aluguel") && !c.includes("145,50"), "nada de A");
});

test("lançar pela conversa: a IA só PROPÕE; nada é gravado; a gravação é pela rota, com a sessão, depois da confirmação", async () => {
  modelText = `Preparei o lançamento, confira e toque em Lançar.\n<<<META>>>\n${JSON.stringify({ memorias: [], gastos: [{ valor: 45, categoria: "Mercado", descricao: "mercado", meio: "pix" }] })}`;
  const events = await chat("gastei 45 no mercado no pix");
  const c = ctxOf();
  assert.match(c, /Lançamento de gasto \(Finanças\)/);
  assert.match(c, /Você NÃO grava/);
  assert.ok(!c.includes("Core do GaDu · Finanças"), "lançar não injeta o bloco de leitura");
  const prop = events.find((e) => e.t === "gastos");
  assert.deepEqual(prop?.items, [{ valor: 45, categoria: "Mercado", descricao: "mercado", meio: "pix", data: isoDia(HOJE) }]);
  assert.equal(completeCalls, 0);
  assert.equal(store.fin_gastos.length, 3, "nenhum gasto novo gravado pelo chat");
  assert.equal(log.writes.filter((w) => w.table.startsWith("fin_")).length, 0);
  assert.deepEqual(finTablesRead(), [], "nem leu as tabelas de finanças");
  // A pessoa toca em "Lançar": o app chama a rota com a sessão dela (user_id do corpo é ignorado).
  const item = prop!.items![0] as { valor: number; categoria: string; descricao: string; meio: string; data: string };
  const [ano, mes, dia] = item.data.split("-").map(Number);
  const r: Response = await gastosRoute.POST(new Request("http://localhost/api/finance/gastos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ano, mes, dia, valor: item.valor, categoria: item.categoria, descricao: item.descricao, meio: item.meio, origem: "conversa", user_id: B }) }));
  assert.equal(r.status, 201);
  const novo = store.fin_gastos.find((g) => g.origem === "conversa")!;
  assert.equal(novo.user_id, A);
  assert.equal(novo.valor, 45);
});

test("proposta com valor inválido, data futura ou fora da conversa de lançamento não vira cartão", async () => {
  modelText = `Ok.\n<<<META>>>\n${JSON.stringify({ gastos: [{ valor: 0 }, { valor: -2 }, { valor: 10, data: "2999-01-01" }] })}`;
  assert.ok(!(await chat("gastei 45 no mercado no pix")).some((e) => e.t === "gastos"), "propostas inválidas descartadas");
  resetAll();
  modelText = `Ok.\n<<<META>>>\n${JSON.stringify({ gastos: [{ valor: 45, categoria: "Mercado" }] })}`;
  assert.ok(!(await chat("Me conta uma piada")).some((e) => e.t === "gastos"), "sem intenção de lançar, o servidor ignora gastos do modelo");
  assert.ok(!ctxOf().includes("Lançamento de gasto"));
});

test("proposta: descrição com termo bloqueado ou dado sensível é descartada, valor e categoria ficam", async () => {
  modelText = `Ok.\n<<<META>>>\n${JSON.stringify({ gastos: [{ valor: 80, categoria: "Trabalho", descricao: "almoço da Acme" }, { valor: 15, categoria: "Casa", descricao: "senha do wifi" }, { valor: 7, categoria: "Lazer", descricao: "cinema" }] })}`;
  const g = (await chat("gastei 80 no almoço do trabalho")).find((e) => e.t === "gastos")!;
  assert.deepEqual(g.items!.map((i) => [i.valor, i.descricao]), [[80, ""], [15, ""], [7, "cinema"]]);
});

test("FINANCE_ENABLED=0: sem bloco, sem leitura, sem regras de lançamento e sem proposta, mesmo se o modelo propuser", async () => {
  process.env.FINANCE_ENABLED = "0";
  modelText = `Ok.\n<<<META>>>\n${JSON.stringify({ gastos: [{ valor: 45, categoria: "Mercado" }] })}`;
  for (const msg of ["Quanto gastei este mês?", "gastei 45 no mercado no pix"]) {
    providerCalls = []; tablesRead = [];
    const events = await chat(msg);
    const c = ctxOf();
    assert.ok(!c.includes("Finanças") && !c.includes("Lançamento de gasto") && !c.includes("[F1]"), msg);
    assert.deepEqual(finTablesRead(), [], msg);
    assert.ok(!events.some((e) => e.t === "gastos" || e.t === "sources"), msg);
    assert.equal(providerCalls.length, 1, "o chat segue funcionando");
  }
});

test("CORE_MVP=0: a fonte finance do Core some (nenhuma leitura de finanças, sem bloco, sem Fontes); o chat segue como antes", async () => {
  process.env.CORE_MVP = "0";
  const events = await chat("Quanto gastei com mercado este mês?");
  assert.ok(!ctxOf().includes("Core do GaDu") && !ctxOf().includes("[F1]"));
  assert.deepEqual(finTablesRead(), []);
  assert.ok(!events.some((e) => e.t === "sources"));
  assert.equal(providerCalls.length, 1);
});

test("a pergunta de atenção do dia tem prioridade e não puxa finanças", async () => {
  await chat("O que merece minha atenção hoje?");
  assert.match(ctxOf(), /O que merece atenção hoje/);
  assert.ok(!ctxOf().includes("Finanças do mês"));
  assert.deepEqual(finTablesRead(), []);
});

test("falha ao ler finanças: o modelo é avisado para não inventar valores, as Fontes dizem que não leu, e o chat responde", async () => {
  finFail = true;
  const events = await chat("Quanto gastei este mês?");
  assert.match(ctxOf(), /Não consegui ler seus dados financeiros agora\. Diga isso com franqueza e não invente valores/);
  assert.ok(!ctxOf().includes("[F1]"));
  assert.deepEqual(events.find((e) => e.t === "sources")?.unavailable, ["Não consegui ler seus dados financeiros agora."]);
  assert.ok(events.some((e) => e.t === "done"));
  assert.ok(rpcNames.includes("server_settle_ai_budget"), "o custo foi liquidado normalmente");
});

test("mensagem comum: chat idêntico ao anterior (sem Finanças)", async () => {
  const events = await chat("Me conta uma piada");
  assert.ok(!ctxOf().includes("Finanças"));
  assert.deepEqual(finTablesRead(), []);
  assert.ok(!events.some((e) => e.t === "sources" || e.t === "gastos"));
});

test("finanças nunca usa a chave secreta para tabelas (só orçamento, por rpc)", async () => {
  await chat("Quanto gastei este mês?");
  assert.ok(finTablesRead().length >= 4);
  // supabaseAdmin().from lança se alguém tentar; chegar aqui sem erro prova que não tentou.
});

// ---- "Tudo por voz": "paguei o aluguel" marca a conta do mês como paga (só com confirmação) ----
test("tudo por voz: conta_paga acha a conta de A no mês e só propõe; conta de B nunca", async () => {
  modelText = `Preparei, é só confirmar.\n<<<META>>>\n${JSON.stringify({ acoes: [{ tipo: "conta_paga", conta: "aluguel" }, { tipo: "conta_paga", conta: "SEGREDO-B conta" }] })}`;
  const events = await chat("paguei o aluguel");
  const items = events.find((e) => e.t === "acoes")?.items ?? [];
  assert.deepEqual(items, [{ kind: "conta_paga", itemId: "i2", nome: "Aluguel", valor: 1500, ano: hojeSP().ano, mes: hojeSP().mes }]);
  assert.ok(events.some((e) => e.t === "notice" && /Não achei a conta/.test(e.text ?? "")));
  assert.ok(!JSON.stringify(events).includes("7777") && !JSON.stringify(events).includes("\"ib\""), "nada de B");
  assert.equal(log.writes.length, 0, "nada gravado antes de confirmar");
});

test("tudo por voz: FINANCE_ENABLED=0 não gera cartão de conta", async () => {
  process.env.FINANCE_ENABLED = "0";
  modelText = `Ok.\n<<<META>>>\n${JSON.stringify({ acoes: [{ tipo: "conta_paga", conta: "aluguel" }] })}`;
  const events = await chat("paguei o aluguel");
  assert.equal(events.find((e) => e.t === "acoes"), undefined);
});

// ---- "Tudo por voz": desmarcar conta, valor do mês, gasto editar/apagar, evento editar/apagar ----
const ACOES_TXT = (acoes: unknown[]) => `Preparei, é só confirmar.\n<<<META>>>\n${JSON.stringify({ acoes })}`;
const eventosDe = (evs: Ev[]) => evs.find((e) => e.t === "acoes")?.items ?? [];

test("tudo por voz: desmarcar conta, mudar valor do mês, editar e apagar gasto só propõem e só acham itens de A", async () => {
  const { ano, mes } = HOJE;
  store.fin_itens.push({ id: "i4", user_id: A, tipo: "despesa", grupo: "Moradia", nome: "Internet", nota: null, ordem: 1, dia: 10, dia_estimado: false, movivel: false, nao_caixa: false, cartao_id: null, segue_id: null });
  store.fin_item_meses.push({ item_id: "i4", user_id: A, ano, mes, valor: 120, pago: true, via_reserva: false, nota: null });
  modelText = ACOES_TXT([
    { tipo: "conta_desmarcar", conta: "internet" },
    { tipo: "conta_valor", conta: "aluguel", valor: "1.650,00", escopo: "proximos" },
    { tipo: "gasto_apagar", gasto: "mercado", valor: 45.5 },
    { tipo: "gasto_editar", gasto: "feira", valor: 120, meio: "credito" },
    { tipo: "gasto_apagar", gasto: "SEGREDO-B gasto" },
    { tipo: "conta_valor", conta: "SEGREDO-B conta", valor: 1 },
  ]);
  const events = await chat("a internet ainda não foi paga, o aluguel subiu, apaga o gasto de 45,50 e a feira foi 120 no crédito");
  const items = eventosDe(events);
  assert.deepEqual(items.map((i) => i.kind), ["conta_desmarcar", "conta_valor", "gasto_apagar", "gasto_editar"]);
  assert.deepEqual(items[0], { kind: "conta_desmarcar", itemId: "i4", nome: "Internet", valor: 120, ano, mes });
  assert.deepEqual(items[1], { kind: "conta_valor", itemId: "i2", nome: "Aluguel", antes: 1500, valor: 1650, escopo: "proximos", ano, mes });
  assert.equal(items[2].id, "g2");
  assert.deepEqual(items[3].mudancas, { valor: 120, meio: "credito" });
  assert.equal(items[3].id, "g1");
  assert.ok(events.filter((e) => e.t === "notice").length >= 1, "o que é de B vira aviso");
  assert.ok(!JSON.stringify(events).includes("SEGREDO-B") && !JSON.stringify(events).includes("8888") && !JSON.stringify(events).includes("7777"), "nada de B");
  assert.equal(log.writes.length, 0, "nada gravado antes de confirmar");
});

test("tudo por voz: FINANCE_ENABLED=0 não gera cartão de conta nem de gasto (e a agenda continua)", async () => {
  process.env.FINANCE_ENABLED = "0";
  calEvents = [{ id: "ev1", title: "Dentista", start: new Date(Date.now() + 86_400_000).toISOString(), end: new Date(Date.now() + 90_000_000).toISOString(), allDay: false, meet: false, declined: false }];
  modelText = ACOES_TXT([{ tipo: "conta_desmarcar", conta: "salário" }, { tipo: "conta_valor", conta: "aluguel", valor: 1 }, { tipo: "gasto_apagar", gasto: "feira" }, { tipo: "gasto_editar", gasto: "feira", valor: 3 }, { tipo: "evento_apagar", evento: "dentista" }]);
  const events = await chat("faz tudo isso");
  assert.deepEqual(eventosDe(events).map((i) => i.kind), ["evento_apagar"]);
  assert.deepEqual(finTablesRead(), []);
});

test("tudo por voz: evento editar e apagar acham o evento na agenda da pessoa, só propõem e mantêm a duração", async () => {
  const ini = new Date(Date.now() + 2 * 86_400_000); ini.setUTCMinutes(0, 0, 0);
  const fim = new Date(ini.getTime() + 3_600_000);
  const novo = new Date(ini.getTime() + 7_200_000).toISOString();
  calEvents = [
    { id: "ev1", title: "Dentista", start: ini.toISOString(), end: fim.toISOString(), allDay: false, meet: false, declined: false },
    { id: "ev2", title: "Aniversário", start: ini.toISOString().slice(0, 10), end: ini.toISOString().slice(0, 10), allDay: true, meet: false, declined: false },
  ];
  modelText = ACOES_TXT([
    { tipo: "evento_editar", evento: "dentista", titulo: "Dentista da Ana", inicio: novo, local: "Clínica Sorriso" },
    { tipo: "evento_editar", evento: "aniversário", inicio: novo },
    { tipo: "evento_apagar", evento: "dentista" },
    { tipo: "evento_apagar", evento: "reunião inexistente" },
  ]);
  const events = await chat("muda o dentista pras duas horas depois, apaga o dentista");
  const items = eventosDe(events);
  assert.deepEqual(items.map((i) => i.kind), ["evento_editar", "evento_apagar"]);
  assert.deepEqual(items[0].mudancas, { title: "Dentista da Ana", location: "Clínica Sorriso", start: novo, end: new Date(Date.parse(novo) + 3_600_000).toISOString() });
  assert.equal(items[1].eventId, "ev1");
  assert.equal(events.filter((e) => e.t === "notice" && e.kind === "acao").length, 2, "dia inteiro e evento inexistente viram aviso");
  assert.equal(log.writes.length, 0);
});

test("tudo por voz: agenda do Google fora do ar vira aviso, sem cartão", async () => {
  calendarFail = true;
  modelText = ACOES_TXT([{ tipo: "evento_apagar", evento: "dentista" }]);
  const events = await chat("apaga o dentista");
  assert.equal(eventosDe(events).length, 0);
  assert.ok(events.some((e) => e.t === "notice" && /agenda do Google/.test(e.text ?? "")));
});

// ---- Simulador de salário bruto → líquido: o servidor calcula, o modelo só repete; salvar só com confirmação ----
test("salário: 'quanto fica líquido um salário de 8 mil?' calcula no servidor, injeta o resultado no contexto e manda o cartão (sem gravar)", async () => {
  modelText = "O líquido fica em R$ 6.040,64. O cartão tem o passo a passo.";
  const events = await chat("Quanto fica líquido um salário de 8 mil?");
  const c = ctxOf();
  assert.match(c, /Cálculo do salário \(feito pelo servidor/);
  assert.match(c, /líquido R\$ 6\.040,64/);
  assert.match(c, /INSS R\$ 921,51, imposto de renda R\$ 1\.037,85/);
  const items = eventosDe(events);
  assert.equal(items.length, 1, "o servidor propõe o cartão mesmo sem a ação do modelo");
  assert.equal(items[0].kind, "salario");
  assert.equal(items[0].salvar, null, "só informa");
  assert.deepEqual({ liquido: items[0].calc.liquido, inss: items[0].calc.inss, irrf: items[0].calc.irrf }, { liquido: 6040.64, inss: 921.51, irrf: 1037.85 });
  assert.equal(completeCalls, 0, "nenhuma IA extra");
  assert.equal(log.writes.length, 0, "calcular não grava nada");
});

test("salário: dependentes ditos entram no cálculo; o valor do cartão é o que a pessoa disse, não o que o modelo repetiu", async () => {
  modelText = ACOES_TXT([{ tipo: "salario_simular", bruto: 9999, dependentes: 5 }]);
  const events = await chat("quanto sobra de um salário bruto de R$ 6.500 com 2 dependentes?");
  const items = eventosDe(events);
  assert.equal(items.length, 1, "uma ação só (a do modelo é trocada pela do servidor)");
  assert.deepEqual({ bruto: items[0].calc.bruto, dependentes: items[0].calc.dependentes, liquido: items[0].calc.liquido }, { bruto: 6500, dependentes: 2, liquido: 5322.84 });
  assert.match(ctxOf(), /líquido R\$ 5\.322,84/);
});

test("salário: sem receita principal, 'salvar' só mostra o cálculo e avisa; nada de B vaza", async () => {
  store.fin_itens.push({ id: "rb", user_id: B, tipo: "receita", grupo: "Receitas", nome: "SEGREDO-B salário", nota: null, ordem: 0, dia: 5, dia_estimado: false, movivel: false, nao_caixa: false, cartao_id: null, segue_id: null });
  store.fin_config.push({ user_id: B, dia_adiantamento: 15, dia_restante: 1, adiantamento_pct: 0, receita_principal_id: "rb", cartao_principal_id: null });
  modelText = ACOES_TXT([{ tipo: "salario_simular", bruto: 8000, dependentes: 0, salvar: true }]);
  const events = await chat("salva um salário de 8 mil como meu salário do mês");
  const items = eventosDe(events);
  assert.equal(items.length, 1);
  assert.equal(items[0].salvar, null, "A não tem receita principal: nunca usa a de B");
  assert.ok(events.some((e) => e.t === "notice" && /receita principal/.test(e.text ?? "")));
  assert.ok(!JSON.stringify(events).includes("SEGREDO-B") && !JSON.stringify(events).includes("\"rb\""));
  assert.equal(log.writes.length, 0);
});

test("salário: com receita principal, 'salvar' vira cartão de confirmação com o valor de antes e NÃO grava antes do sim", async () => {
  store.fin_config.push({ user_id: A, dia_adiantamento: 15, dia_restante: 1, adiantamento_pct: 0, receita_principal_id: "i1", cartao_principal_id: null });
  modelText = ACOES_TXT([{ tipo: "salario_simular", bruto: 8000, dependentes: 0, salvar: true }]);
  const events = await chat("guarda o líquido de um salário de 8 mil como meu salário deste mês");
  const items = eventosDe(events);
  assert.equal(items.length, 1);
  assert.deepEqual(items[0].salvar, { itemId: "i1", nome: "Salário", antes: 5000, ano: HOJE.ano, mes: HOJE.mes });
  assert.equal(items[0].calc.liquido, 6040.64);
  assert.equal(log.writes.length, 0, "só propõe: quem grava é a pessoa, pela rota com a sessão");
});

test("salário: FINANCE_ENABLED=0 desliga o cálculo (sem bloco no contexto e sem cartão)", async () => {
  process.env.FINANCE_ENABLED = "0";
  modelText = ACOES_TXT([{ tipo: "salario_simular", bruto: 8000, dependentes: 0 }]);
  const events = await chat("Quanto fica líquido um salário de 8 mil?");
  assert.ok(!/Cálculo do salário/.test(ctxOf()));
  assert.equal(events.find((e) => e.t === "acoes"), undefined);
  assert.equal(log.writes.length, 0);
});

test("salário: conversa comum não ganha o bloco de cálculo; ação do modelo com valor inválido é descartada", async () => {
  modelText = ACOES_TXT([{ tipo: "salario_simular", bruto: -5 }, { tipo: "salario_simular", bruto: 5000, dependentes: 99 }]);
  const events = await chat("gastei 45 no mercado no pix");
  assert.ok(!/Cálculo do salário/.test(ctxOf()));
  assert.equal(eventosDe(events).filter((i) => i.kind === "salario").length, 0);
});

test("salário: o custo continua passando por limites → reserva → cota → IA", async () => {
  await chat("Quanto fica líquido um salário de 8 mil?");
  assert.deepEqual(rpcNames.slice(0, 3), ["month_spend_by_provider", "server_reserve_ai_budget", "consume_daily_quota"]);
  assert.ok(rpcNames.includes("server_settle_ai_budget"));
});
