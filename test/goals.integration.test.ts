// Integração das rotas /api/goals/*: Supabase em memória (com RLS imitada), sem rede e sem chave secreta.
// Garante: 401 sem sessão (antes de qualquer consulta), GOALS_ENABLED=0 desliga, validação zod, user_id SEMPRE da sessão
// (o do corpo é descartado), isolamento entre pessoas, vínculo só com tarefa da própria pessoa, progresso sempre com origem e data.
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { makeFinDb, type FinStore } from "./fin-fake.ts";

const src = (p: string) => new URL(`../src/${p}`, import.meta.url).href;
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

let sessionUser: string | null = A;
let store: FinStore = {};
let log: { tables: string[]; writes: { table: string; op: string; rows: Record<string, unknown>[] }[] } = { tables: [], writes: [] };
let adminCalls = 0;

mock.module(src("lib/supabase/server.ts"), {
  namedExports: {
    supabaseServer: async () => ({
      auth: { getUser: async () => ({ data: { user: sessionUser ? { id: sessionUser, email: "teste@exemplo.com" } : null } }) },
      ...makeFinDb(store, () => sessionUser, log),
    }),
  },
});
mock.module(src("lib/supabase/admin.ts"), { namedExports: { supabaseAdmin: () => { adminCalls++; throw new Error("metas nunca usa a chave secreta"); } } });
mock.module(src("lib/access.ts"), { namedExports: { accessOf: async () => ({ ok: true, admin: false }) } });
mock.module("next/server", { namedExports: { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } } });

const lista = await import(src("app/api/goals/route.ts"));
const resumo = await import(src("app/api/goals/resumo/route.ts"));
const meta = await import(src("app/api/goals/[id]/route.ts"));
const progresso = await import(src("app/api/goals/[id]/progresso/route.ts"));
const progressoId = await import(src("app/api/goals/[id]/progresso/[pid]/route.ts"));
const marcos = await import(src("app/api/goals/[id]/marcos/route.ts"));
const marcoId = await import(src("app/api/goals/[id]/marcos/[mid]/route.ts"));
const tarefas = await import(src("app/api/goals/[id]/tarefas/route.ts"));
const tarefaId = await import(src("app/api/goals/[id]/tarefas/[taskId]/route.ts"));
const projetosRota = await import(src("app/api/goals/[id]/projetos/route.ts"));
const projetoId = await import(src("app/api/goals/[id]/projetos/[projectId]/route.ts"));
const { hojeSP, isoDia } = await import(src("lib/finance/datas.ts"));

const req = (path: string, method = "GET", body?: unknown) => new Request(`http://localhost${path}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const ctx = (p: Record<string, string>) => ({ params: Promise.resolve(p) });
const J = async (r: Response) => ({ status: r.status, json: (await r.json()) as Record<string, any> });
const ID_X = "33333333-3333-4333-8333-333333333333";
const HOJE = isoDia(hojeSP());
const diasAtras = (n: number) => isoDia(hojeSP(Date.now() - n * 86_400_000));

beforeEach(() => {
  sessionUser = A; store = {}; log = { tables: [], writes: [] }; adminCalls = 0;
  delete process.env.GOALS_ENABLED;
});
afterEach(() => { delete process.env.GOALS_ENABLED; assert.equal(adminCalls, 0, "a chave secreta nunca é usada"); });

const todas = (): [string, () => Promise<Response>][] => [
  ["GET goals", () => lista.GET(req("/api/goals"))],
  ["POST goals", () => lista.POST(req("/api/goals", "POST", { titulo: "x", valor_alvo: 5 }))],
  ["GET resumo", () => resumo.GET()],
  ["GET goals/id", () => meta.GET(req(`/api/goals/${ID_X}`), ctx({ id: ID_X }))],
  ["PATCH goals/id", () => meta.PATCH(req(`/api/goals/${ID_X}`, "PATCH", { titulo: "y" }), ctx({ id: ID_X }))],
  ["POST progresso", () => progresso.POST(req(`/api/goals/${ID_X}/progresso`, "POST", { valor: 1 }), ctx({ id: ID_X }))],
  ["DELETE progresso", () => progressoId.DELETE(req(`/api/goals/${ID_X}/progresso/${ID_X}`, "DELETE"), ctx({ id: ID_X, pid: ID_X }))],
  ["POST marcos", () => marcos.POST(req(`/api/goals/${ID_X}/marcos`, "POST", { titulo: "x" }), ctx({ id: ID_X }))],
  ["PATCH marcos", () => marcoId.PATCH(req(`/api/goals/${ID_X}/marcos/${ID_X}`, "PATCH", { concluido: true }), ctx({ id: ID_X, mid: ID_X }))],
  ["DELETE marcos", () => marcoId.DELETE(req(`/api/goals/${ID_X}/marcos/${ID_X}`, "DELETE"), ctx({ id: ID_X, mid: ID_X }))],
  ["POST tarefas", () => tarefas.POST(req(`/api/goals/${ID_X}/tarefas`, "POST", { task_id: 1 }), ctx({ id: ID_X }))],
  ["DELETE tarefas", () => tarefaId.DELETE(req(`/api/goals/${ID_X}/tarefas/1`, "DELETE"), ctx({ id: ID_X, taskId: "1" }))],
  ["POST projetos", () => projetosRota.POST(req(`/api/goals/${ID_X}/projetos`, "POST", { project_id: 1 }), ctx({ id: ID_X }))],
  ["DELETE projetos", () => projetoId.DELETE(req(`/api/goals/${ID_X}/projetos/1`, "DELETE"), ctx({ id: ID_X, projectId: "1" }))],
];

test("sem sessão: TODAS as rotas respondem 401 e nada é consultado", async () => {
  sessionUser = null;
  for (const [nome, fn] of todas()) {
    const r = await J(await fn());
    assert.equal(r.status, 401, nome);
    assert.equal(r.json.error, "unauthorized", nome);
  }
  assert.deepEqual(log.tables, [], "nenhuma tabela foi tocada");
});

test("GOALS_ENABLED=0: todas as rotas respondem 404 'disabled' (com sessão) e nada é consultado; sem sessão continua 401", async () => {
  process.env.GOALS_ENABLED = "0";
  for (const [nome, fn] of todas()) {
    const r = await J(await fn());
    assert.equal(r.status, 404, nome);
    assert.equal(r.json.error, "disabled", nome);
  }
  assert.deepEqual(log.tables, []);
  sessionUser = null;
  assert.equal((await resumo.GET()).status, 401);
});

test("POST goals: user_id vem da sessão; o do corpo (e o id) são ignorados; validação por tipo", async () => {
  const r = await J(await lista.POST(req("/api/goals", "POST", { titulo: "  Ler 12 livros  ", categoria: "educacao", medicao: "numerica", unidade: "livros", valor_alvo: "12", prazo: "2099-12-31", user_id: B, id: ID_X })));
  assert.equal(r.status, 201);
  assert.equal(r.json.meta.goal.titulo, "Ler 12 livros");
  assert.equal(r.json.meta.goal.valor_alvo, 12);
  assert.equal(r.json.meta.progresso.semDados, true, "sem registro = sem dados");
  const gravado = store.goals[0];
  assert.equal(gravado.user_id, A);
  assert.notEqual(gravado.id, ID_X);
  assert.equal(gravado.inicio, HOJE);
  assert.equal(log.writes.filter((w) => w.table === "goals").every((w) => w.rows.every((x) => x.user_id === A)), true);

  const bad = async (body: unknown) => (await lista.POST(req("/api/goals", "POST", body))).status;
  assert.equal(await bad({}), 400, "sem título");
  assert.equal(await bad({ titulo: "x", medicao: "numerica" }), 400, "numérica sem alvo");
  assert.equal(await bad({ titulo: "x", medicao: "numerica", valor_inicial: 5, valor_alvo: 5 }), 400, "alvo igual ao início");
  assert.equal(await bad({ titulo: "x", valor_alvo: "abc" }), 400);
  assert.equal(await bad({ titulo: "x", categoria: "outra", valor_alvo: 5 }), 400);
  assert.equal(await bad({ titulo: "x", valor_alvo: 5, prazo: "2026-02-31" }), 400, "data inexistente");
  assert.equal(await bad({ titulo: "x", valor_alvo: 5, inicio: "2026-05-10", prazo: "2026-05-01" }), 400, "prazo antes do início");
  assert.equal(await bad({ titulo: "x", categoria: "personalizada", medicao: "marcos" }), 400, "personalizada sem nome");
  assert.equal(await bad({ titulo: "x".repeat(121), valor_alvo: 5 }), 400);
  assert.equal(store.goals.length, 1, "pedidos inválidos não gravam");
});

test("POST goals: percentual é normalizado; marcos viram linhas; unidade e alvo são ignorados onde não valem", async () => {
  const p = await J(await lista.POST(req("/api/goals", "POST", { titulo: "Curso", medicao: "percentual", valor_inicial: 10, valor_alvo: 50, unidade: "x", agregacao: "soma" })));
  assert.equal(p.status, 201);
  assert.deepEqual([p.json.meta.goal.valor_inicial, p.json.meta.goal.valor_alvo, p.json.meta.goal.agregacao, p.json.meta.goal.unidade], [0, 100, "ultimo", null]);
  const m = await J(await lista.POST(req("/api/goals", "POST", { titulo: "Certificação", medicao: "marcos", unidade: "kg", valor_alvo: 9, marcos: ["Módulo 1", "Módulo 2", "Prova"] })));
  assert.equal(m.status, 201);
  assert.equal(m.json.meta.progresso.alvo, 3);
  assert.equal(m.json.meta.goal.unidade, null);
  assert.deepEqual(store.goal_milestones.map((x) => [x.titulo, x.ordem, x.user_id]), [["Módulo 1", 0, A], ["Módulo 2", 1, A], ["Prova", 2, A]]);
});

test("progresso: registra com data e origem, recalcula, e recusa valores/datas/tipos inválidos", async () => {
  const c = await J(await lista.POST(req("/api/goals", "POST", { titulo: "Correr", unidade: "km", valor_alvo: 100 })));
  const id = c.json.meta.goal.id as string;
  const r1 = await J(await progresso.POST(req(`/api/goals/${id}/progresso`, "POST", { valor: "5,5", origem: "conversa", user_id: B }), ctx({ id })));
  assert.equal(r1.status, 201);
  assert.equal(r1.json.registro.origem, "conversa");
  assert.equal(r1.json.registro.data, HOJE);
  assert.equal(r1.json.meta.progresso.atual, 5.5);
  assert.equal(store.goal_progress[0].user_id, A);
  const r2 = await J(await progresso.POST(req(`/api/goals/${id}/progresso`, "POST", { valor: 4.5, data: diasAtras(2) }), ctx({ id })));
  assert.equal(r2.json.registro.origem, "manual", "origem padrão: manual");
  assert.equal(r2.json.meta.progresso.atual, 10);
  const bad = async (b: unknown) => (await progresso.POST(req(`/api/goals/${id}/progresso`, "POST", b), ctx({ id }))).status;
  assert.equal(await bad({ valor: 0 }), 400, "zero");
  assert.equal(await bad({ valor: -3 }), 400, "negativo em soma");
  assert.equal(await bad({ valor: "x" }), 400);
  assert.equal(await bad({ valor: 1, data: "2099-01-01" }), 400, "futuro");
  assert.equal(await bad({ valor: 1, data: diasAtras(400) }), 400, "antiga demais");
  assert.equal(await bad({ valor: 1, origem: "tarefa" }), 400, "origem 'tarefa' não vem do cliente");
  assert.equal(await bad({ valor: 1, origem: "inventada" }), 400);
  assert.equal(store.goal_progress.length, 2);
  // apagar um registro recalcula do que sobrou
  const del = await J(await progressoId.DELETE(req("/x", "DELETE"), ctx({ id, pid: r1.json.registro.id })));
  assert.equal(del.status, 200);
  assert.equal(del.json.meta.progresso.atual, 4.5);
  assert.equal((await progressoId.DELETE(req("/x", "DELETE"), ctx({ id, pid: r1.json.registro.id }))).status, 404);
});

test("progresso: percentual 0..100; metas por marcos/tarefas e arquivadas/concluídas não recebem valor", async () => {
  const pct = (await J(await lista.POST(req("/api/goals", "POST", { titulo: "Curso", medicao: "percentual" })))).json.meta.goal.id as string;
  const post = async (id: string, b: unknown) => (await progresso.POST(req("/x", "POST", b), ctx({ id }))).status;
  assert.equal(await post(pct, { valor: 101 }), 400);
  assert.equal(await post(pct, { valor: 40 }), 201);
  assert.equal(await post(pct, { valor: 0 }), 201, "0% é uma medida válida em percentual");
  const mc = (await J(await lista.POST(req("/api/goals", "POST", { titulo: "Marcos", medicao: "marcos" })))).json.meta.goal.id as string;
  assert.equal(await post(mc, { valor: 1 }), 400);
  const tf = (await J(await lista.POST(req("/api/goals", "POST", { titulo: "Tarefas", medicao: "tarefas" })))).json.meta.goal.id as string;
  assert.equal(await post(tf, { valor: 1 }), 400);
  await meta.PATCH(req("/x", "PATCH", { status: "arquivada" }), ctx({ id: pct }));
  assert.equal(await post(pct, { valor: 10 }), 400, "arquivada");
  assert.equal(await post(ID_X, { valor: 10 }), 404, "meta que não existe");
  assert.equal(await post("nao-e-uuid", { valor: 10 }), 400);
});

test("PATCH: concluir grava a data; reativar limpa; alvo só em numérica; arquivadas somem da lista", async () => {
  const id = (await J(await lista.POST(req("/api/goals", "POST", { titulo: "Ler", valor_alvo: 12 })))).json.meta.goal.id as string;
  const done = await J(await meta.PATCH(req("/x", "PATCH", { status: "concluida", user_id: B }), ctx({ id })));
  assert.equal(done.json.meta.goal.status, "concluida");
  assert.ok(store.goals[0].concluida_em);
  assert.equal(store.goals[0].user_id, A, "user_id não muda");
  const back = await J(await meta.PATCH(req("/x", "PATCH", { status: "ativa" }), ctx({ id })));
  assert.equal(back.json.meta.goal.status, "ativa");
  assert.equal(store.goals[0].concluida_em, null);
  assert.equal((await meta.PATCH(req("/x", "PATCH", {}), ctx({ id }))).status, 400, "nada para alterar");
  assert.equal((await meta.PATCH(req("/x", "PATCH", { status: "feita" }), ctx({ id }))).status, 400);
  assert.equal((await meta.PATCH(req("/x", "PATCH", { valor_alvo: 20, prazo: "2099-01-01", titulo: "Ler 20" }), ctx({ id }))).status, 200);
  const marc = (await J(await lista.POST(req("/api/goals", "POST", { titulo: "M", medicao: "marcos" })))).json.meta.goal.id as string;
  assert.equal((await meta.PATCH(req("/x", "PATCH", { valor_alvo: 3 }), ctx({ id: marc }))).status, 400);
  assert.equal((await meta.PATCH(req("/x", "PATCH", { categoria: "personalizada" }), ctx({ id }))).status, 400, "personalizada exige nome");
  assert.equal((await meta.PATCH(req("/x", "PATCH", { categoria: "personalizada", categoria_nome: "Minha" }), ctx({ id }))).status, 200);
  assert.equal((await meta.PATCH(req("/x", "PATCH", { titulo: "x" }), ctx({ id: ID_X }))).status, 404);
  // arquivar tira da lista padrão
  await meta.PATCH(req("/x", "PATCH", { status: "arquivada" }), ctx({ id }));
  const l = await J(await lista.GET(req("/api/goals")));
  assert.ok(!l.json.metas.some((m: any) => m.goal.id === id));
  const arq = await J(await lista.GET(req("/api/goals?status=arquivada")));
  assert.deepEqual(arq.json.metas.map((m: any) => m.goal.id), [id]);
  assert.equal((await lista.GET(req("/api/goals?status=xyz"))).status, 400);
});

test("isolamento: B não vê, não altera, não registra nem apaga nada de A (404), e a lista de B é só dele", async () => {
  const id = (await J(await lista.POST(req("/api/goals", "POST", { titulo: "Meta de A", valor_alvo: 10 })))).json.meta.goal.id as string;
  const reg = (await J(await progresso.POST(req("/x", "POST", { valor: 2 }), ctx({ id })))).json.registro.id as string;
  const mc = (await J(await lista.POST(req("/api/goals", "POST", { titulo: "Marcos A", medicao: "marcos", marcos: ["um"] })))).json.meta.goal.id as string;
  const marcoDeA = store.goal_milestones[0].id as string;
  sessionUser = B;
  assert.equal((await meta.GET(req("/x"), ctx({ id }))).status, 404);
  assert.equal((await meta.PATCH(req("/x", "PATCH", { titulo: "hack" }), ctx({ id }))).status, 404);
  assert.equal((await progresso.POST(req("/x", "POST", { valor: 9 }), ctx({ id }))).status, 404);
  assert.equal((await progressoId.DELETE(req("/x", "DELETE"), ctx({ id, pid: reg }))).status, 404);
  assert.equal((await marcos.POST(req("/x", "POST", { titulo: "x" }), ctx({ id: mc }))).status, 404);
  assert.equal((await marcoId.PATCH(req("/x", "PATCH", { concluido: true }), ctx({ id: mc, mid: marcoDeA }))).status, 404);
  assert.equal((await marcoId.DELETE(req("/x", "DELETE"), ctx({ id: mc, mid: marcoDeA }))).status, 404);
  assert.deepEqual((await J(await lista.GET(req("/api/goals")))).json.metas, []);
  assert.equal((await J(await resumo.GET())).json.total, 0);
  assert.equal(store.goals.find((g) => g.id === id)!.titulo, "Meta de A");
  assert.equal(store.goal_progress.length, 1);
  assert.equal(store.goal_milestones[0].concluido_em ?? null, null);
});

test("marcos: criar, concluir (grava data), reabrir e apagar; progresso por marcos", async () => {
  const id = (await J(await lista.POST(req("/api/goals", "POST", { titulo: "Cert", medicao: "marcos", marcos: ["a", "b"] })))).json.meta.goal.id as string;
  const novo = await J(await marcos.POST(req("/x", "POST", { titulo: "c", data_alvo: "2099-01-01" }), ctx({ id })));
  assert.equal(novo.status, 201);
  assert.equal(novo.json.marco.ordem, 2);
  assert.equal(novo.json.meta.progresso.alvo, 3);
  const mid = store.goal_milestones[0].id as string;
  const feito = await J(await marcoId.PATCH(req("/x", "PATCH", { concluido: true }), ctx({ id, mid })));
  assert.equal(feito.json.meta.progresso.atual, 1);
  assert.equal(feito.json.meta.progresso.pct, 33);
  assert.ok(store.goal_milestones[0].concluido_em);
  const reaberto = await J(await marcoId.PATCH(req("/x", "PATCH", { concluido: false }), ctx({ id, mid })));
  assert.equal(reaberto.json.meta.progresso.atual, 0);
  const del = await J(await marcoId.DELETE(req("/x", "DELETE"), ctx({ id, mid })));
  assert.equal(del.json.meta.progresso.alvo, 2);
  const num = (await J(await lista.POST(req("/api/goals", "POST", { titulo: "N", valor_alvo: 5 })))).json.meta.goal.id as string;
  assert.equal((await marcos.POST(req("/x", "POST", { titulo: "x" }), ctx({ id: num }))).status, 400, "só metas por marcos");
  assert.equal((await marcoId.PATCH(req("/x", "PATCH", {}), ctx({ id, mid }))).status, 400);
});

test("tarefas: vincula só tarefa da própria pessoa; B não vincula a tarefa de A; progresso por tarefas concluídas", async () => {
  store.tasks = [
    { id: 1, user_id: A, title: "Tarefa de A", status: "done", due_date: null },
    { id: 2, user_id: A, title: "Outra de A", status: "open", due_date: null },
    { id: 9, user_id: B, title: "SEGREDO-B tarefa", status: "open", due_date: null },
  ];
  const id = (await J(await lista.POST(req("/api/goals", "POST", { titulo: "Por tarefas", medicao: "tarefas" })))).json.meta.goal.id as string;
  const ok1 = await J(await tarefas.POST(req("/x", "POST", { task_id: 1, user_id: B }), ctx({ id })));
  assert.equal(ok1.status, 201);
  assert.equal(store.goal_tasks[0].user_id, A);
  assert.equal((await tarefas.POST(req("/x", "POST", { task_id: 1 }), ctx({ id }))).status, 409, "duplicado");
  await tarefas.POST(req("/x", "POST", { task_id: 2 }), ctx({ id }));
  assert.equal((await tarefas.POST(req("/x", "POST", { task_id: 9 }), ctx({ id }))).status, 404, "tarefa de B não é visível para A");
  assert.equal((await tarefas.POST(req("/x", "POST", { task_id: 0 }), ctx({ id }))).status, 400);
  assert.equal((await tarefas.POST(req("/x", "POST", { task_id: "abc" }), ctx({ id }))).status, 400);
  const det = await J(await meta.GET(req("/x"), ctx({ id })));
  assert.deepEqual([det.json.meta.progresso.atual, det.json.meta.progresso.alvo, det.json.meta.progresso.pct], [1, 2, 50]);
  assert.deepEqual(det.json.tarefas.map((t: any) => t.title).sort(), ["Outra de A", "Tarefa de A"]);
  assert.ok(!JSON.stringify(det.json).includes("SEGREDO-B"));
  assert.deepEqual(det.json.tarefasAbertas, [], "as abertas de A já estão vinculadas; as de B nunca aparecem");
  // B tenta vincular a tarefa dele à meta de A e a tarefa de A à meta dele
  sessionUser = B;
  assert.equal((await tarefas.POST(req("/x", "POST", { task_id: 9 }), ctx({ id }))).status, 404, "meta de A é invisível para B");
  const idB = (await J(await lista.POST(req("/api/goals", "POST", { titulo: "Meta de B", medicao: "tarefas" })))).json.meta.goal.id as string;
  assert.equal((await tarefas.POST(req("/x", "POST", { task_id: 1 }), ctx({ id: idB }))).status, 404, "tarefa de A não é visível para B");
  assert.equal((await tarefaId.DELETE(req("/x", "DELETE"), ctx({ id, taskId: "1" }))).status, 404);
  assert.equal(store.goal_tasks.length, 2);
  // desvincular
  sessionUser = A;
  const un = await J(await tarefaId.DELETE(req("/x", "DELETE"), ctx({ id, taskId: "2" })));
  assert.equal(un.status, 200);
  assert.equal(un.json.meta.progresso.alvo, 1);
  assert.equal((await tarefaId.DELETE(req("/x", "DELETE"), ctx({ id, taskId: "2" }))).status, 404);
  assert.equal(store.tasks.length, 3, "a tarefa continua existindo");
});

test("resumo: contagens e metas que pedem atenção; sem metas devolve zeros (estado vazio honesto)", async () => {
  const vazio = await J(await resumo.GET());
  assert.deepEqual([vazio.json.total, vazio.json.ativas, vazio.json.atencao], [0, 0, []]);
  const ontem = diasAtras(1), mes = diasAtras(40);
  store.goals = [
    { id: "g1", user_id: A, titulo: "Vencida", categoria: "saude", medicao: "numerica", agregacao: "soma", valor_inicial: 0, valor_alvo: 10, inicio: mes, prazo: ontem, status: "ativa", unidade: null, descricao: null, categoria_nome: null, concluida_em: null, created_at: "2026-01-01" },
    { id: "g2", user_id: A, titulo: "Longe", categoria: "saude", medicao: "numerica", agregacao: "soma", valor_inicial: 0, valor_alvo: 10, inicio: mes, prazo: "2099-01-01", status: "ativa", unidade: null, descricao: null, categoria_nome: null, concluida_em: null, created_at: "2026-01-02" },
    { id: "g3", user_id: A, titulo: "Feita", categoria: "saude", medicao: "marcos", agregacao: "soma", valor_inicial: 0, valor_alvo: null, inicio: mes, prazo: null, status: "concluida", unidade: null, descricao: null, categoria_nome: null, concluida_em: "2026-01-03T00:00:00Z", created_at: "2026-01-03" },
    { id: "gb", user_id: B, titulo: "SEGREDO-B", categoria: "saude", medicao: "marcos", agregacao: "soma", valor_inicial: 0, valor_alvo: null, inicio: mes, prazo: ontem, status: "ativa", unidade: null, descricao: null, categoria_nome: null, concluida_em: null, created_at: "2026-01-04" },
  ];
  const r = await J(await resumo.GET());
  assert.deepEqual([r.json.total, r.json.ativas, r.json.concluidas, r.json.atrasadas], [3, 2, 1, 1]);
  assert.deepEqual(r.json.atencao.map((a: any) => a.titulo), ["Vencida"]);
  assert.ok(!JSON.stringify(r.json).includes("SEGREDO-B"));
});

test("projetos: liga só projeto da própria pessoa; B não liga o projeto de A nem mexe na meta de A; GET traz ligados e disponíveis", async () => {
  store.projects = [
    { id: 1, user_id: A, name: "Saúde", status: "active" },
    { id: 2, user_id: A, name: "Casa", status: "paused" },
    { id: 9, user_id: B, name: "SEGREDO-B projeto", status: "active" },
  ];
  const id = (await J(await lista.POST(req("/api/goals", "POST", { titulo: "Correr 50 km", valor_alvo: 50 })))).json.meta.goal.id as string;
  const ok1 = await J(await projetosRota.POST(req("/x", "POST", { project_id: 1, user_id: B }), ctx({ id })));
  assert.equal(ok1.status, 201);
  assert.equal(store.goal_projects[0].user_id, A, "o user_id vem da sessão, nunca do corpo");
  assert.deepEqual(ok1.json.projetos.map((p: any) => p.name), ["Saúde"]);
  assert.equal((await projetosRota.POST(req("/x", "POST", { project_id: 1 }), ctx({ id }))).status, 409, "duplicado");
  assert.equal((await projetosRota.POST(req("/x", "POST", { project_id: 9 }), ctx({ id }))).status, 404, "projeto de B não é visível para A");
  assert.equal((await projetosRota.POST(req("/x", "POST", { project_id: 0 }), ctx({ id }))).status, 400);
  assert.equal((await projetosRota.POST(req("/x", "POST", { project_id: "abc" }), ctx({ id }))).status, 400);
  const det = await J(await meta.GET(req("/x"), ctx({ id })));
  assert.deepEqual(det.json.projetos.map((p: any) => p.name), ["Saúde"]);
  assert.deepEqual(det.json.projetosDisponiveis.map((p: any) => p.name), ["Casa"]);
  assert.ok(!JSON.stringify(det.json).includes("SEGREDO-B"));
  // B tenta ligar o projeto dele à meta de A, o projeto de A à meta dele e desligar o vínculo de A
  sessionUser = B;
  assert.equal((await projetosRota.POST(req("/x", "POST", { project_id: 9 }), ctx({ id }))).status, 404, "meta de A é invisível para B");
  const idB = (await J(await lista.POST(req("/api/goals", "POST", { titulo: "Meta de B", valor_alvo: 5 })))).json.meta.goal.id as string;
  assert.equal((await projetosRota.POST(req("/x", "POST", { project_id: 1 }), ctx({ id: idB }))).status, 404, "projeto de A não é visível para B");
  assert.equal((await projetoId.DELETE(req("/x", "DELETE"), ctx({ id, projectId: "1" }))).status, 404);
  assert.equal(store.goal_projects.length, 1);
  // A desliga: o projeto e a meta continuam
  sessionUser = A;
  const off = await J(await projetoId.DELETE(req("/x", "DELETE"), ctx({ id, projectId: "1" })));
  assert.equal(off.status, 200);
  assert.deepEqual(off.json.projetos, []);
  assert.equal(store.projects.length, 3);
  assert.equal((await projetoId.DELETE(req("/x", "DELETE"), ctx({ id, projectId: "1" }))).status, 404, "já desligado");
});

test("projetos: GOALS_ENABLED=0 desliga as rotas (404)", async () => {
  process.env.GOALS_ENABLED = "0";
  try {
    assert.equal((await projetosRota.POST(req("/x", "POST", { project_id: 1 }), ctx({ id: ID_X }))).status, 404);
    assert.equal((await projetoId.DELETE(req("/x", "DELETE"), ctx({ id: ID_X, projectId: "1" }))).status, 404);
  } finally { delete process.env.GOALS_ENABLED; }
});
