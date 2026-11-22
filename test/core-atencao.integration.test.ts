// Integração do Core "O que merece minha atenção hoje?": /api/chat e /api/attention com Supabase, Google e IA simulados.
// Garante: o bloco do Core entra no contexto do modelo só quando a intenção bate E a flag está ligada; só fatos da
// sessão (mesmo com `context` e ids de outra pessoa no corpo); Google desconectado vira aviso; nenhuma chamada de IA
// extra; o chat continua com limites → reserva → cota; CORE_MVP=0 volta ao comportamento anterior; o Core nunca usa a chave secreta.
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

type Row = Record<string, unknown>;
const src = (p: string) => new URL(`../src/${p}`, import.meta.url).href;
const RID = "3f2b1c9e-8d7a-4b6c-9e5f-1a2b3c4d5e6f";
const A = "user-a";
const B = "user-b";

let sessionUser: string | null = A;
let data: Record<string, Row[]> = {};
let tablesRead: string[] = [];
let adminCalls = 0;
let providerCalls: { context?: string; skip: string[] }[] = [];
let completeCalls = 0;
let rpcNames: string[] = [];
let googleCalls = { token: 0, events: 0, inbox: 0 };
let google: { connected: boolean; scopes: string[]; events: unknown[]; mails: unknown[] } = { connected: false, scopes: [], events: [], mails: [] };
let rpcFail: string | null = null;

const ownerOf = (r: Row) => (r.user_id ?? r.id) as string;

/** Consulta encadeável com RLS imitada: só devolve linhas do usuário da sessão; `eq` filtra por igualdade. */
function query(table: string) {
  const eqs: [string, unknown][] = [];
  let mode: "rows" | "one" = "rows";
  const rows = () => (data[table] ?? []).filter((r) => ownerOf(r) === sessionUser && eqs.every(([c, v]) => r[c] === v));
  const result = () => {
    if (table === "conversations") return { data: { id: 1 }, error: null };
    const rs = rows();
    return { data: mode === "one" ? rs[0] ?? null : rs, error: null, count: rs.length };
  };
  const p: object = new Proxy(function () {}, {
    get: (_t, key) => {
      if (key === "then") return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(result()).then(res, rej);
      if (key === "eq") return (c: string, v: unknown) => { eqs.push([c, v]); return p; };
      if (key === "maybeSingle" || key === "single") return () => { mode = "one"; return Promise.resolve(result()); };
      if (key === "insert") return () => p;
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
      from: (table: string) => { tablesRead.push(table); return query(table); },
    }),
  },
});
// Cliente com chave secreta: só orçamento/consumo. O Core nunca pode tocar em tabelas por aqui.
mock.module(src("lib/supabase/admin.ts"), {
  namedExports: {
    supabaseAdmin: () => ({
      rpc: (name: string) => {
        adminCalls++;
        rpcNames.push(name);
        const ok: Record<string, unknown> = {
          server_reserve_ai_budget: { allowed: true, reservation_id: RID, amount: 0.25, spent: 1, reserved: 0.25, limit: 20 },
          server_settle_ai_budget: { ok: true, cost: 0.01, over: false },
          server_release_ai_budget: { ok: true, released: true },
        };
        return Promise.resolve({ data: ok[name] ?? null, error: null });
      },
      from: () => { throw new Error("o Core não pode ler tabelas com a chave secreta"); },
    }),
  },
});
mock.module(src("lib/access.ts"), { namedExports: { accessOf: async () => ({ ok: true, admin: false }) } });
mock.module(src("lib/embeddings.ts"), { namedExports: { embeddingsAvailable: () => false, embed: async () => [], toVector: () => "[]" } });
mock.module(src("lib/llm/complete.ts"), { namedExports: { complete: async () => { completeCalls++; return { text: "", provider: "anthropic", model: "x", input: 0, output: 0, cost: 0 }; } } });
const fmt = await import(src("lib/google-format.ts"));
mock.module(src("lib/google.ts"), {
  namedExports: {
    googleIntent: fmt.googleIntent, formatEvents: fmt.formatEvents, formatMails: fmt.formatMails,
    GoogleError: class extends Error {},
    accessToken: async () => { googleCalls.token++; return "tok"; },
    events: async () => { googleCalls.events++; return google.events; },
    inbox: async () => { googleCalls.inbox++; return google.mails; },
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
      yield { type: "provider", name: "Claude", id: "anthropic" };
      yield { type: "text", text: "Resposta [T1]." };
      req.onUsage?.({ provider: "anthropic", model: "claude-opus-5-5", input_tokens: 1000, output_tokens: 100 });
    },
  },
});
mock.module("next/server", { namedExports: { after: () => {}, NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } } });

const { POST } = await import(src("app/api/chat/route.ts"));
const attention = await import(src("app/api/attention/route.ts"));
const { spNow } = await import(src("lib/briefing.ts"));

type Ev = { t: string; text?: string; kind?: string; items?: { tag: string; text: string; view: string }[]; unavailable?: string[] };
async function chat(message: string, extra: Record<string, unknown> = {}): Promise<Ev[]> {
  const res: Response = await POST(new Request("http://localhost/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message, ...extra }) }));
  if (res.status !== 200) return [{ t: "http", kind: String(res.status) }];
  return (await res.text()).trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as Ev);
}
const day = (offset: number) => new Date(Date.parse(`${spNow().day}T12:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
const ctxOf = () => providerCalls[0]?.context ?? "";
const ASK = "O que merece minha atenção hoje?";

function seed() {
  data = {
    profiles: [{ id: A, display_name: "Ana Teste", settings: { blocked: ["acme"] } }, { id: B, display_name: "Beto", settings: {} }],
    tasks: [
      { id: 1, user_id: A, title: "Pagar boleto do condomínio", status: "open", priority: 1, due_date: day(-3), projects: { name: "Casa" } },
      { id: 2, user_id: A, title: "Revisar proposta da Acme", status: "open", priority: 2, due_date: day(0), projects: null },
      { id: 3, user_id: B, title: "SEGREDO-B tarefa atrasada", status: "open", priority: 1, due_date: day(-9), projects: null },
    ],
    reminders: [
      { id: 10, user_id: A, text: "Buscar encomenda", status: "pending", due_at: new Date().toISOString() },
      { id: 11, user_id: B, text: "SEGREDO-B lembrete", status: "pending", due_at: new Date().toISOString() },
    ],
    google_connections: [],
  };
}
function resetAll() {
  sessionUser = A; tablesRead = []; adminCalls = 0; providerCalls = []; completeCalls = 0; rpcNames = []; rpcFail = null;
  googleCalls = { token: 0, events: 0, inbox: 0 };
  google = { connected: false, scopes: [], events: [], mails: [] };
  seed();
}
beforeEach(resetAll);
afterEach(() => { delete process.env.CORE_MVP; });
const connect = (scopes: string[]) => {
  data.google_connections = [{ user_id: A, scopes: scopes.join(" ") }];
  google.connected = true;
};
const CAL = "https://www.googleapis.com/auth/calendar.readonly";
const GML = "https://www.googleapis.com/auth/gmail.readonly";

test("chat com intenção: o contexto do modelo traz o bloco do Core só com fatos de A, etiquetas e instruções", async () => {
  const events = await chat(ASK);
  assert.equal(providerCalls.length, 1, "uma única chamada de IA");
  assert.equal(completeCalls, 0, "nenhuma IA extra");
  const c = ctxOf();
  assert.match(c, /Core do GaDu · O que merece atenção hoje/);
  assert.match(c, /\[T1\] Tarefa atrasada desde \d\d\/\d\d: Pagar boleto do condomínio \(projeto Casa\)/);
  assert.match(c, /\[L1\] Lembrete .*Buscar encomenda/);
  assert.match(c, /Cite a etiqueta/);
  assert.ok(!c.includes("SEGREDO-B"), "nada de B");
  assert.ok(!/Acme/i.test(c.split("Core do GaDu")[1] ?? ""), "termo bloqueado omitido no bloco");
  const sources = events.find((e) => e.t === "sources");
  assert.ok(sources?.items?.some((i) => i.tag === "T1" && i.view === "tarefas"), "Fontes com a tela de origem");
  assert.ok(!JSON.stringify(sources).includes("SEGREDO-B") && !/Acme/i.test(JSON.stringify(sources)));
  assert.ok(events.findIndex((e) => e.t === "sources") < events.findIndex((e) => e.t === "done"), "fontes antes do fim");
});

test("o custo continua passando por limites → reserva → cota → IA, e liquida a reserva", async () => {
  await chat(ASK);
  assert.deepEqual(rpcNames.slice(0, 3), ["month_spend_by_provider", "server_reserve_ai_budget", "consume_daily_quota"]);
  assert.ok(rpcNames.includes("server_settle_ai_budget"));
  assert.ok(!rpcNames.includes("server_release_ai_budget"));
});

test("fail closed preservado: sem reserva de orçamento, o Core nem é consultado e a IA não é chamada", async () => {
  rpcFail = "month_spend_by_provider";
  const events = await chat(ASK);
  assert.equal(providerCalls.length, 0);
  assert.ok(events.some((e) => e.t === "notice"));
  assert.ok(!tablesRead.includes("tasks") && !tablesRead.includes("reminders"));
});

test("`context` e ids de outra pessoa no corpo não ampliam o escopo", async () => {
  data.projects = [{ id: 5, user_id: B, name: "Projeto de B" }];
  await chat(ASK, { context: { module: "office", view: "agentes" }, projectId: 5, agentId: 9 });
  const c = ctxOf();
  assert.ok(c.includes("Pagar boleto") && !c.includes("SEGREDO-B") && !c.includes("Projeto de B"));
  // Com a sessão de B, só B.
  resetAll(); sessionUser = B;
  await chat(ASK, { context: { module: "pessoal", view: "tarefas" } });
  const cb = ctxOf();
  assert.ok(cb.includes("SEGREDO-B tarefa atrasada") && !cb.includes("Pagar boleto") && !cb.includes("Buscar encomenda"));
});

test("Google desconectado: o bloco diz explicitamente que a agenda não está conectada e o Google não é chamado", async () => {
  const events = await chat(ASK);
  assert.match(ctxOf(), /Sua agenda não está conectada\./);
  assert.match(ctxOf(), /Sua caixa de e-mail não está conectada\./);
  assert.deepEqual(googleCalls, { token: 0, events: 0, inbox: 0 });
  assert.ok(events.find((e) => e.t === "sources")?.unavailable?.includes("Sua agenda não está conectada."));
  assert.ok(!ctxOf().includes("Dados do Google (lidos agora"), "sem o bloco antigo do Google");
});

test("Google conectado: agenda e e-mail entram uma vez só (sem duplicar com o caminho antigo), e-mail sem corpo", async () => {
  connect([CAL, GML]);
  const t = Date.now();
  google.events = [{ id: "e1", title: "Reunião de equipe", start: new Date(t + 3_600_000).toISOString(), end: new Date(t + 7_200_000).toISOString(), allDay: false, meet: false, declined: false }];
  google.mails = [{ thread: "abc123", from: "Banco Exemplo", subject: "Fatura disponível", snippet: "CORPO-SECRETO", date: "", important: true }];
  await chat(ASK);
  const c = ctxOf();
  assert.match(c, /\[A1\] Agenda .*Reunião de equipe/);
  assert.match(c, /\[E1\] E-mail importante, de Banco Exemplo: "Fatura disponível"/);
  assert.ok(!c.includes("CORPO-SECRETO"));
  assert.equal(googleCalls.events, 1);
  assert.equal(googleCalls.inbox, 1);
  assert.ok(!c.includes("Dados do Google (lidos agora"));
});

test("Gmail não concedido: e-mail indisponível, Gmail não é consultado, agenda segue", async () => {
  connect([CAL]);
  await chat(ASK);
  assert.equal(googleCalls.inbox, 0);
  assert.match(ctxOf(), /acesso ao Gmail não foi concedido/);
});

test("mensagem sem a intenção: chat idêntico ao anterior (sem Core, sem Fontes, sem consultas do Core)", async () => {
  const events = await chat("Me conta uma piada");
  assert.ok(!ctxOf().includes("Core do GaDu"));
  assert.ok(!events.some((e) => e.t === "sources"));
  assert.ok(!tablesRead.includes("reminders") && !tablesRead.includes("google_connections"));
});

test("CORE_MVP=0: o chat volta ao comportamento anterior (caminho antigo do Google, sem bloco, sem Fontes)", async () => {
  process.env.CORE_MVP = "0";
  connect([CAL, GML]);
  const t = Date.now();
  google.events = [{ id: "e1", title: "Reunião de equipe", start: new Date(t + 3_600_000).toISOString(), end: new Date(t + 7_200_000).toISOString(), allDay: false, meet: false, declined: false }];
  const msg = "Como está meu dia?"; // o caminho antigo já lê agenda e e-mail para esta frase
  const events = await chat(msg);
  const c = ctxOf();
  assert.ok(!c.includes("Core do GaDu") && !c.includes("[T1]"), "sem bloco do Core");
  assert.ok(!events.some((e) => e.t === "sources"), "sem Fontes");
  assert.match(c, /Dados do Google \(lidos agora, só leitura\)/, "o caminho antigo continua");
  assert.ok(!tablesRead.includes("reminders"), "o Core não consultou lembretes");
  assert.equal(providerCalls.length, 1);
  // Mesmo comportamento com a flag explicitamente "false"/"off".
  for (const v of ["false", "off"]) {
    resetAll(); process.env.CORE_MVP = v; connect([CAL, GML]);
    await chat(msg);
    assert.ok(!ctxOf().includes("Core do GaDu"), v);
  }
});

test("flag ligada: a mesma frase usa o Core no lugar do caminho antigo", async () => {
  connect([CAL, GML]);
  await chat("Como está meu dia?");
  assert.match(ctxOf(), /Core do GaDu/);
});

test("o Core nunca usa a chave secreta: tabelas só pelo cliente da sessão", async () => {
  await chat(ASK);
  assert.ok(tablesRead.includes("tasks") && tablesRead.includes("reminders"));
  // supabaseAdmin().from lança se alguém tentar; o chat só usa o admin para orçamento (rpc).
  assert.ok(adminCalls >= 2);
});

// ---- /api/attention ----
const get = async (qs = "") => attention.GET(new Request(`http://localhost/api/attention${qs}`));

test("/api/attention: 401 sem sessão e nada é consultado", async () => {
  sessionUser = null;
  const res: Response = await get();
  assert.equal(res.status, 401);
  assert.ok(!tablesRead.includes("tasks"));
});

test("/api/attention: parâmetro inválido ou desconhecido vira 400 (zod)", async () => {
  for (const qs of ["?limit=0", "?limit=99", "?limit=abc", "?user_id=user-b", "?scope=org"]) assert.equal((await get(qs)).status, 400, qs);
});

test("/api/attention: itens só da sessão, com origem, sem IA e sem Fontes alheias", async () => {
  const res: Response = await get("?limit=8");
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.enabled, true);
  assert.ok(j.items.some((i: { tag: string; view: string }) => i.tag === "T1" && i.view === "tarefas"));
  // UX-2: tarefa traz a referência da linha para Feito/Adiar no próprio item; e-mail e agenda não trazem.
  const t1 = j.items.find((i: { tag: string }) => i.tag === "T1");
  assert.equal(t1.ref?.table, "tasks");
  assert.ok(j.items.filter((i: { kind: string }) => i.kind === "email" || i.kind === "evento").every((i: { ref?: unknown }) => i.ref === undefined));
  assert.ok(!JSON.stringify(j).includes("SEGREDO-B") && !/Acme/i.test(JSON.stringify(j)));
  assert.deepEqual(j.unavailable.map((u: { source: string }) => u.source), ["agenda", "email"]);
  assert.equal(providerCalls.length + completeCalls, 0, "custo zero de modelo");
  assert.equal(adminCalls, 0, "nenhum orçamento envolvido");
  assert.ok(!rpcNames.includes("consume_daily_quota"), "não gasta a cota de mensagens");
});

test("/api/attention: CORE_MVP=0 devolve enabled:false e não consulta nada", async () => {
  process.env.CORE_MVP = "0";
  const res: Response = await get();
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { enabled: false });
  assert.ok(!tablesRead.includes("tasks") && !tablesRead.includes("reminders"));
});

test("/api/attention: conta nova sem perfil gravado não quebra (sem termos bloqueados)", async () => {
  data.profiles = [];
  const res: Response = await get();
  // Perfil sem linha = nenhum termo bloqueado cadastrado. (Erro de leitura do perfil é 503: caminho coberto pelo try/catch da rota.)
  assert.equal(res.status, 200);
});
