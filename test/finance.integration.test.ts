// Integração das rotas /api/finance/*: Supabase em memória (com RLS imitada), sem rede e sem chave secreta.
// Garante: 401 sem sessão (antes de qualquer consulta), FINANCE_ENABLED=0 desliga, validação zod, user_id SEMPRE da sessão
// (o do corpo é descartado), isolamento entre pessoas, vínculos de cartão, "este e os próximos" e o resumo sem dupla contagem.
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
mock.module(src("lib/supabase/admin.ts"), { namedExports: { supabaseAdmin: () => { adminCalls++; throw new Error("finanças nunca usa a chave secreta"); } } });
mock.module(src("lib/access.ts"), { namedExports: { accessOf: async () => ({ ok: true, admin: false }) } });
mock.module("next/server", { namedExports: { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } } });

const resumo = await import(src("app/api/finance/resumo/route.ts"));
const itens = await import(src("app/api/finance/itens/route.ts"));
const itemId = await import(src("app/api/finance/itens/[id]/route.ts"));
const itemMes = await import(src("app/api/finance/itens/[id]/mes/route.ts"));
const gastos = await import(src("app/api/finance/gastos/route.ts"));
const gastoId = await import(src("app/api/finance/gastos/[id]/route.ts"));
const config = await import(src("app/api/finance/config/route.ts"));
const { hojeSP } = await import(src("lib/finance/datas.ts"));

const req = (path: string, method = "GET", body?: unknown) => new Request(`http://localhost${path}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const J = async (r: Response) => ({ status: r.status, json: (await r.json()) as Record<string, any> });
const ID_X = "33333333-3333-4333-8333-333333333333";
const HOJE = hojeSP();

beforeEach(() => {
  sessionUser = A; store = {}; log = { tables: [], writes: [] }; adminCalls = 0;
  delete process.env.FINANCE_ENABLED;
});
afterEach(() => { delete process.env.FINANCE_ENABLED; assert.equal(adminCalls, 0, "a chave secreta nunca é usada"); });

const todas = (): [string, () => Promise<Response>][] => [
  ["GET resumo", () => resumo.GET(req("/api/finance/resumo?ano=2026&mes=11"))],
  ["GET itens", () => itens.GET(req("/api/finance/itens?ano=2026&mes=11"))],
  ["POST itens", () => itens.POST(req("/api/finance/itens", "POST", { tipo: "despesa", nome: "x" }))],
  ["PATCH itens/id", () => itemId.PATCH(req(`/api/finance/itens/${ID_X}`, "PATCH", { nome: "y" }), ctx(ID_X))],
  ["DELETE itens/id", () => itemId.DELETE(req(`/api/finance/itens/${ID_X}`, "DELETE"), ctx(ID_X))],
  ["PUT itens/id/mes", () => itemMes.PUT(req(`/api/finance/itens/${ID_X}/mes`, "PUT", { ano: 2026, mes: 11, pago: true }), ctx(ID_X))],
  ["GET gastos", () => gastos.GET(req("/api/finance/gastos?ano=2026&mes=11"))],
  ["POST gastos", () => gastos.POST(req("/api/finance/gastos", "POST", { ano: 2026, mes: 11, dia: 5, valor: 10 }))],
  ["PATCH gastos/id", () => gastoId.PATCH(req(`/api/finance/gastos/${ID_X}`, "PATCH", { valor: 5 }), ctx(ID_X))],
  ["DELETE gastos/id", () => gastoId.DELETE(req(`/api/finance/gastos/${ID_X}`, "DELETE"), ctx(ID_X))],
  ["GET config", () => config.GET()],
  ["PUT config", () => config.PUT(req("/api/finance/config", "PUT", { dia_restante: 5 }))],
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

test("FINANCE_ENABLED=0: todas as rotas respondem 404 'disabled' (com sessão) e nada é consultado; sem sessão continua 401", async () => {
  process.env.FINANCE_ENABLED = "0";
  for (const [nome, fn] of todas()) {
    const r = await J(await fn());
    assert.equal(r.status, 404, nome);
    assert.equal(r.json.error, "disabled", nome);
  }
  assert.deepEqual(log.tables, []);
  sessionUser = null;
  assert.equal((await resumo.GET(req("/api/finance/resumo?ano=2026&mes=11"))).status, 401);
});

test("POST gastos: user_id vem da sessão; o do corpo (e o id) são ignorados; valor em texto pt-BR", async () => {
  const r = await J(await gastos.POST(req("/api/finance/gastos", "POST", { ano: 2026, mes: 11, dia: 5, valor: "45,90", categoria: "Mercado", meio: "pix", user_id: B, id: ID_X })));
  assert.equal(r.status, 201);
  assert.equal(r.json.gasto.valor, 45.9);
  assert.equal(store.fin_gastos.length, 1);
  assert.equal(store.fin_gastos[0].user_id, A, "gravado como A, não como B");
  assert.notEqual(store.fin_gastos[0].id, ID_X);
  assert.equal(log.writes[0].rows[0].user_id, A);
});

test("POST gastos: corpo inválido vira 400 e nada é gravado", async () => {
  const ruins = [{ ano: 2026, mes: 11, dia: 32, valor: 5 }, { ano: 2026, mes: 2, dia: 31, valor: 5 }, { ano: 2026, mes: 13, dia: 1, valor: 5 }, { ano: 2026, mes: 11, dia: 1, valor: 0 },
    { ano: 2026, mes: 11, dia: 1, valor: -3 }, { ano: 2026, mes: 11, dia: 1, valor: "abc" }, { ano: 2026, mes: 11, dia: 1, valor: 5, meio: "dinheiro" }, { ano: 2026, mes: 11, dia: 1, valor: 5, origem: "hack" }, {}, null, "texto"];
  for (const b of ruins) assert.equal((await gastos.POST(req("/api/finance/gastos", "POST", b))).status, 400, JSON.stringify(b));
  assert.equal(store.fin_gastos?.length ?? 0, 0);
  assert.equal((await gastos.GET(req("/api/finance/gastos?ano=2026"))).status, 400, "consulta sem mês");
  assert.equal((await gastoId.PATCH(req("/api/finance/gastos/nao-e-uuid", "PATCH", { valor: 5 }), ctx("nao-e-uuid"))).status, 400);
});

test("isolamento: B não lê, não edita e não apaga gasto de A (404), e a lista de B vem vazia", async () => {
  const c = await J(await gastos.POST(req("/api/finance/gastos", "POST", { ano: 2026, mes: 11, dia: 5, valor: 20 })));
  const id = c.json.gasto.id as string;
  sessionUser = B;
  assert.deepEqual((await J(await gastos.GET(req("/api/finance/gastos?ano=2026&mes=11")))).json.gastos, []);
  assert.equal((await gastoId.PATCH(req(`/api/finance/gastos/${id}`, "PATCH", { valor: 999 }), ctx(id))).status, 404);
  assert.equal((await gastoId.DELETE(req(`/api/finance/gastos/${id}`, "DELETE"), ctx(id))).status, 404);
  assert.equal(store.fin_gastos[0].valor, 20, "intacto");
  sessionUser = A;
  assert.equal((await J(await gastoId.PATCH(req(`/api/finance/gastos/${id}`, "PATCH", { valor: "21,5", user_id: B }), ctx(id)))).json.gasto.valor, 21.5);
  assert.equal(store.fin_gastos[0].user_id, A);
  assert.equal((await gastoId.DELETE(req(`/api/finance/gastos/${id}`, "DELETE"), ctx(id))).status, 200);
  assert.equal(store.fin_gastos.length, 0);
});

test("itens: criar com valor inicial 'até dezembro', user_id da sessão, e o item de A não aparece para B", async () => {
  const r = await J(await itens.POST(req("/api/finance/itens", "POST", { tipo: "despesa", nome: "Aluguel", grupo: "Moradia", dia: 10, user_id: B, inicial: { ano: 2026, mes: 10, valor: "1.500,00", escopo: "proximos" } })));
  assert.equal(r.status, 201);
  assert.equal(store.fin_itens[0].user_id, A);
  assert.deepEqual(store.fin_item_meses.map((m) => m.mes).sort((a, b) => Number(a) - Number(b)), [10, 11, 12]);
  assert.ok(store.fin_item_meses.every((m) => m.user_id === A && m.valor === 1500));
  sessionUser = B;
  assert.deepEqual((await J(await itens.GET(req("/api/finance/itens?ano=2026&mes=11")))).json.itens, []);
  assert.equal((await itemId.DELETE(req(`/api/finance/itens/${r.json.item.id}`, "DELETE"), ctx(r.json.item.id))).status, 404);
  assert.equal((await itemMes.PUT(req(`/api/finance/itens/${r.json.item.id}/mes`, "PUT", { ano: 2026, mes: 11, pago: true }), ctx(r.json.item.id))).status, 404);
  assert.ok(store.fin_item_meses.every((m) => m.pago === false), "B não marcou nada de A");
});

test("itens: corpo inválido (400) e vínculo com item de outra pessoa ou de tipo errado (400)", async () => {
  for (const b of [{ tipo: "transferencia", nome: "x" }, { tipo: "despesa", nome: "" }, { tipo: "despesa", nome: "x", dia: 40 }, { tipo: "despesa", nome: "x", inicial: { ano: 2026, mes: 11, valor: 0 } }, { tipo: "despesa", nome: "x", cartao_id: "nao-uuid" }])
    assert.equal((await itens.POST(req("/api/finance/itens", "POST", b))).status, 400, JSON.stringify(b));
  assert.equal(store.fin_itens?.length ?? 0, 0);
  // item de B; A tenta vincular a ele.
  sessionUser = B;
  const deB = await J(await itens.POST(req("/api/finance/itens", "POST", { tipo: "despesa", nome: "Cartão de B" })));
  sessionUser = A;
  const r = await itens.POST(req("/api/finance/itens", "POST", { tipo: "despesa", nome: "Assinatura", cartao_id: deB.json.item.id }));
  assert.equal(r.status, 400, "cartão de outra pessoa não existe para A");
  const sal = await J(await itens.POST(req("/api/finance/itens", "POST", { tipo: "receita", nome: "Salário" })));
  assert.equal((await itens.POST(req("/api/finance/itens", "POST", { tipo: "despesa", nome: "x", cartao_id: sal.json.item.id }))).status, 400, "cartão precisa ser despesa");
  assert.equal((await itens.POST(req("/api/finance/itens", "POST", { tipo: "receita", nome: "y", segue_id: sal.json.item.id }))).status, 400, "receita não segue receita");
  assert.equal((await itemId.PATCH(req(`/api/finance/itens/${sal.json.item.id}`, "PATCH", { cartao_id: sal.json.item.id }), ctx(sal.json.item.id))).status, 400, "item não é o próprio cartão");
});

const criar = async (body: Record<string, unknown>) => (await J(await itens.POST(req("/api/finance/itens", "POST", body)))).json.item.id as string;
const pagoDe = (id: string, mes = 11) => store.fin_item_meses.find((m) => m.item_id === id && m.mes === mes)?.pago;

test("marcar pago: cartão marca as assinaturas; assinatura marca o cartão; só no mês pedido", async () => {
  const mes = (valor: number) => ({ ano: 2026, mes: 11, valor, escopo: "proximos" });
  const cartao = await criar({ tipo: "despesa", nome: "Cartão", inicial: mes(500) });
  const a1 = await criar({ tipo: "despesa", nome: "Streaming", cartao_id: cartao, inicial: mes(40) });
  const a2 = await criar({ tipo: "despesa", nome: "App", cartao_id: cartao, inicial: mes(20) });
  const solta = await criar({ tipo: "despesa", nome: "Luz", inicial: mes(100) });
  const r = await J(await itemMes.PUT(req(`/api/finance/itens/${a1}/mes`, "PUT", { ano: 2026, mes: 11, pago: true }), ctx(a1)));
  assert.equal(r.status, 200);
  assert.deepEqual([cartao, a1, a2].map((i) => pagoDe(i)), [true, true, true]);
  assert.equal(pagoDe(solta), false);
  assert.deepEqual([cartao, a1, a2].map((i) => pagoDe(i, 12)), [false, false, false], "dezembro não muda");
  await itemMes.PUT(req(`/api/finance/itens/${cartao}/mes`, "PUT", { ano: 2026, mes: 11, pago: false }), ctx(cartao));
  assert.deepEqual([cartao, a1, a2].map((i) => pagoDe(i)), [false, false, false]);
  // Receita marca quem segue.
  const sal = await criar({ tipo: "receita", nome: "Salário", inicial: mes(3000) });
  const prev = await criar({ tipo: "despesa", nome: "Previdência", segue_id: sal, inicial: mes(300) });
  await itemMes.PUT(req(`/api/finance/itens/${sal}/mes`, "PUT", { ano: 2026, mes: 11, pago: true }), ctx(sal));
  assert.equal(pagoDe(prev), true);
});

test("valor do mês: 'só este mês', 'este e os próximos' (mantém o pago), zero tira do mês, sem valor não dá para marcar (409)", async () => {
  const id = await criar({ tipo: "despesa", nome: "Escola", inicial: { ano: 2026, mes: 1, valor: 800, escopo: "proximos" } });
  await itemMes.PUT(req(`/api/finance/itens/${id}/mes`, "PUT", { ano: 2026, mes: 3, pago: true }), ctx(id));
  assert.equal((await itemMes.PUT(req(`/api/finance/itens/${id}/mes`, "PUT", { ano: 2026, mes: 3, valor: "900" }), ctx(id))).status, 200);
  const v = (m: number) => store.fin_item_meses.find((x) => x.mes === m)?.valor;
  assert.deepEqual([v(2), v(3), v(4)], [800, 900, 800], "só março mudou");
  assert.equal(pagoDe(id, 3), true, "o pago de março foi mantido");
  await itemMes.PUT(req(`/api/finance/itens/${id}/mes`, "PUT", { ano: 2026, mes: 6, valor: 950, escopo: "proximos", nota: "reajuste" }), ctx(id));
  assert.deepEqual([6, 7, 12].map(v), [950, 950, 950]);
  assert.equal(v(5), 800);
  assert.equal(store.fin_item_meses.find((x) => x.mes === 6)?.nota, "reajuste");
  assert.equal(store.fin_item_meses.find((x) => x.mes === 7)?.nota ?? null, null, "a nota é só do primeiro mês");
  await itemMes.PUT(req(`/api/finance/itens/${id}/mes`, "PUT", { ano: 2026, mes: 8, valor: 0 }), ctx(id));
  assert.equal(store.fin_item_meses.some((m) => m.mes === 8), false, "agosto removido");
  assert.equal(store.fin_item_meses.some((m) => m.mes === 9), true, "setembro permanece");
  const r = await J(await itemMes.PUT(req(`/api/finance/itens/${id}/mes`, "PUT", { ano: 2026, mes: 8, pago: true }), ctx(id)));
  assert.equal(r.status, 409);
  for (const b of [{ ano: 2026, mes: 3 }, { ano: 2026, mes: 13, pago: true }, { ano: 2026, mes: 3, valor: -5 }, { ano: 1900, mes: 3, pago: true }])
    assert.equal((await itemMes.PUT(req(`/api/finance/itens/${id}/mes`, "PUT", b), ctx(id))).status, 400, JSON.stringify(b));
});

test("apagar item apaga os meses; vinculados são soltos", async () => {
  const cartao = await criar({ tipo: "despesa", nome: "Cartão", inicial: { ano: 2026, mes: 11, valor: 500 } });
  const a = await criar({ tipo: "despesa", nome: "Assinatura", cartao_id: cartao, inicial: { ano: 2026, mes: 11, valor: 30 } });
  assert.equal((await itemId.DELETE(req(`/api/finance/itens/${cartao}`, "DELETE"), ctx(cartao))).status, 200);
  assert.equal(store.fin_item_meses.some((m) => m.item_id === cartao), false);
  assert.equal(store.fin_itens.find((i) => i.id === a)?.cartao_id, null);
  assert.equal((await itemId.DELETE(req(`/api/finance/itens/${cartao}`, "DELETE"), ctx(cartao))).status, 404);
});

test("resumo: números do mês sem dupla contagem; previsão só no mês atual", async () => {
  const { ano, mes } = HOJE;
  const m = (valor: number) => ({ ano, mes, valor });
  const sal = await criar({ tipo: "receita", nome: "Salário", dia: 5, inicial: m(5000) });
  const cartao = await criar({ tipo: "despesa", nome: "Cartão", dia: 28, inicial: m(600) });
  await criar({ tipo: "despesa", nome: "Streaming", cartao_id: cartao, dia: 28, inicial: m(40) });
  await criar({ tipo: "despesa", nome: "Aluguel", dia: 28, inicial: m(1500) });
  await config.PUT(req("/api/finance/config", "PUT", { receita_principal_id: sal, cartao_principal_id: cartao }));
  await gastos.POST(req("/api/finance/gastos", "POST", { ano, mes, dia: 1, valor: 100, categoria: "Mercado", meio: "pix" }));
  await gastos.POST(req("/api/finance/gastos", "POST", { ano, mes, dia: 2, valor: 50, categoria: "Lazer", meio: "credito" }));
  const r = await J(await resumo.GET(req(`/api/finance/resumo?ano=${ano}&mes=${mes}`)));
  assert.equal(r.status, 200);
  const x = r.json.resumo;
  assert.equal(x.receitas, 5000);
  assert.equal(x.contas.total, 2100, "cartão + aluguel (assinatura dentro do cartão não soma)");
  assert.equal(x.diaADia.total, 100, "o crédito já está na fatura");
  assert.equal(x.credito.naFatura, true);
  assert.equal(x.despesas, 2200);
  assert.equal(x.sobra, 2800);
  assert.equal(x.cartao.conteudo, 90);
  assert.equal(r.json.itens.length, 4);
  assert.ok(r.json.previsao, "mês atual tem previsão");
  const passado = await J(await resumo.GET(req(`/api/finance/resumo?ano=${ano - 1}&mes=${mes}`)));
  assert.equal(passado.json.previsao, null);
  assert.equal(passado.json.resumo.despesas, 0);
  // B não vê nada disso.
  sessionUser = B;
  const deB = await J(await resumo.GET(req(`/api/finance/resumo?ano=${ano}&mes=${mes}`)));
  assert.equal(deB.json.resumo.despesas, 0); assert.deepEqual(deB.json.itens, []); assert.deepEqual(deB.json.gastos, []);
});

test("config: padrão 15 e 1 sem linha; só aceita receita/cartão da própria pessoa e do tipo certo; validação", async () => {
  const g = await J(await config.GET());
  assert.deepEqual(g.json.config, { dia_adiantamento: 15, dia_restante: 1, adiantamento_pct: 0, receita_principal_id: null, cartao_principal_id: null });
  assert.equal(g.json.salva, false);
  const sal = await criar({ tipo: "receita", nome: "Salário" });
  const desp = await criar({ tipo: "despesa", nome: "Cartão" });
  assert.equal((await config.PUT(req("/api/finance/config", "PUT", { receita_principal_id: desp }))).status, 400, "receita principal precisa ser receita");
  assert.equal((await config.PUT(req("/api/finance/config", "PUT", { cartao_principal_id: sal }))).status, 400);
  assert.equal((await config.PUT(req("/api/finance/config", "PUT", { receita_principal_id: ID_X }))).status, 400, "item que não existe");
  for (const b of [{}, { dia_restante: 0 }, { dia_adiantamento: 32 }, { adiantamento_pct: 120 }, { adiantamento_pct: -1 }]) assert.equal((await config.PUT(req("/api/finance/config", "PUT", b))).status, 400, JSON.stringify(b));
  const ok = await J(await config.PUT(req("/api/finance/config", "PUT", { receita_principal_id: sal, adiantamento_pct: 40, dia_adiantamento: 20, user_id: B })));
  assert.equal(ok.status, 200);
  assert.equal(store.fin_config.length, 1);
  assert.equal(store.fin_config[0].user_id, A);
  const again = await J(await config.PUT(req("/api/finance/config", "PUT", { dia_restante: 5 })));
  assert.equal(again.json.config.adiantamento_pct, 40, "mantém o que não foi enviado");
  assert.equal(again.json.config.dia_restante, 5);
  assert.equal(store.fin_config.length, 1, "uma linha por pessoa");
  sessionUser = B;
  assert.equal((await J(await config.GET())).json.salva, false, "config de A não vaza para B");
});
