import assert from "node:assert/strict";
import { test } from "node:test";
import { collectFinance, financeProposalRules, formatFinanceBlock, FINANCE_MAX_CHARS } from "./finance.ts";
import { toItem, summarizeSources } from "./format.ts";
import { detectFinanceIntent, detectIntent } from "./plan.ts";
import { fakeDb } from "./testing.ts";

const NOW = new Date("2026-11-22T15:00:00Z"); // 22/11/2026, 12h em Brasília
const A = "user-a";
const B = "user-b";
const it = (id: string, user: string, over: Record<string, unknown> = {}) => ({ id, user_id: user, tipo: "despesa", grupo: "Geral", nome: `Conta ${id}`, nota: null, ordem: 0, dia: 10, dia_estimado: false, movivel: false, nao_caixa: false, cartao_id: null, segue_id: null, ...over });
const mm = (item: string, user: string, valor: number, over: Record<string, unknown> = {}) => ({ item_id: item, user_id: user, ano: 2026, mes: 11, valor, pago: false, via_reserva: false, nota: null, ...over });
const gs = (id: string, user: string, valor: number, over: Record<string, unknown> = {}) => ({ id, user_id: user, ano: 2026, mes: 11, dia: 5, valor, categoria: "Mercado", descricao: "", meio: "debito", origem: "manual", ...over });

const dataset = () => ({
  fin_itens: [it("sal", A, { tipo: "receita", nome: "Salário", dia: 5 }), it("alu", A, { nome: "Aluguel", dia: 8 }), it("luz", A, { nome: "Luz", dia: 25 }), it("seg-b", B, { nome: "SEGREDO-B conta" })],
  fin_item_meses: [mm("sal", A, 5000, { pago: true }), mm("alu", A, 1500, { pago: true }), mm("luz", A, 200), mm("seg-b", B, 777)],
  fin_gastos: [gs("g1", A, 100, { descricao: "feira" }), gs("g2", A, 50, { categoria: "Lazer", meio: "pix", descricao: "cinema" }), gs("g3", A, 25.5, { descricao: "padaria do bairro" }), gs("gb", B, 999, { descricao: "SEGREDO-B gasto" })],
  fin_config: [{ user_id: A, dia_adiantamento: 15, dia_restante: 1, adiantamento_pct: 0, receita_principal_id: null, cartao_principal_id: null }],
});

test("intenções: perguntas financeiras simples, sem IA; atenção e conversa comum não confundem", () => {
  const casos: [string, unknown][] = [
    ["Quanto gastei este mês?", { kind: "resumo" }],
    ["quanto gastei com mercado", { kind: "categoria", categoria: "Mercado" }],
    ["Quanto gastei no mercado este mês?", { kind: "categoria", categoria: "Mercado" }],
    ["quanto eu gastei em restaurantes esse mês", { kind: "categoria", categoria: "Restaurantes" }],
    ["quanto gastei com farmácia", { kind: "categoria", categoria: "Farmácia e saúde" }],
    ["quanto gastei na padaria hoje", { kind: "categoria", termo: "padaria" }],
    ["Como estão minhas contas?", { kind: "contas" }],
    ["quanto falta pagar", { kind: "contas" }],
    ["quanto sobrou este mês", { kind: "resumo" }],
    ["gastei 45 no mercado no pix", { kind: "gasto" }],
    ["paguei 120,50 de luz", { kind: "gasto" }],
    ["comprei um tênis por 200", { kind: "gasto" }],
    ["lança um gasto de 30 reais com lanche", { kind: "gasto" }],
  ];
  for (const [msg, esperado] of casos) assert.deepEqual(detectFinanceIntent(msg), esperado, msg);
  for (const msg of ["O que merece minha atenção hoje?", "Como está meu dia?", "Me conta uma piada", "anota aí: ligar para 3 clientes", "gastei tempo demais nisso", "quanto custa um voo para Lisboa", ""]) assert.equal(detectFinanceIntent(msg), null, msg);
  assert.equal(detectIntent("Quanto gastei este mês?"), null, "a pergunta de atenção continua separada");
});

test("coleta: só fatos de A, com etiquetas F1.., origem, números e tela Financeiro", async () => {
  const { db, calls } = fakeDb(A, dataset());
  const r = await collectFinance({ userId: A, db, blocked: [], intent: { kind: "resumo" }, now: NOW });
  const all = JSON.stringify(r);
  assert.ok(!all.includes("SEGREDO-B") && !all.includes("777") && !all.includes("999"), "nada de B");
  assert.deepEqual(r.facts.map((f) => f.tag), r.facts.map((_, i) => `F${i + 1}`));
  assert.ok(r.facts.every((f) => f.kind === "financa" && f.view === "financeiro" && f.module === "financeiro" && f.scope === "pessoal"));
  const texto = r.facts.map((f) => f.text).join("\n");
  assert.match(r.facts[0].text, /^Resumo do mês: novembro de 2026\. Receitas R\$ 5\.000,00 \(recebido R\$ 5\.000,00\); despesas R\$ 1\.875,50/);
  assert.match(r.facts[0].text, /contas R\$ 1\.700,00 \+ dia a dia R\$ 175,50/);
  assert.match(r.facts[0].text, /sobra prevista R\$ 3\.124,50/);
  assert.match(texto, /Categoria: Mercado R\$ 125,50 \(2 gastos\)/);
  assert.match(texto, /Conta em aberto: Luz R\$ 200,00, vence dia 25/);
  assert.match(texto, /1 em aberto somando R\$ 200,00; 1 paga/);
  // Defesa em profundidade: todas as consultas filtram pelo user_id da sessão.
  const eqUsers = calls.filter((c) => c.op === "eq" && c.args[0] === "user_id").map((c) => c.args[1]);
  assert.equal(eqUsers.length, 5, "itens, meses, gastos, config e tetos");
  assert.ok(eqUsers.every((u) => u === A));
  assert.equal(toItem(r.facts[0]).view, "financeiro");
  assert.equal(summarizeSources(r.facts.map(toItem)), `${r.facts.length} dados financeiros`);
});

test("sessão de B no mesmo banco: só dados de B", async () => {
  const { db } = fakeDb(B, dataset());
  const r = await collectFinance({ userId: B, db, blocked: [], intent: { kind: "resumo" }, now: NOW });
  const t = JSON.stringify(r);
  assert.ok(t.includes("999,00") && !t.includes("5.000,00") && !t.includes("Aluguel"));
});

test("RLS falhando (banco devolve tudo): o filtro por user_id da sessão ainda exclui B", async () => {
  const { db } = fakeDb(A, dataset(), { noRls: true });
  const r = await collectFinance({ userId: A, db, blocked: [], intent: { kind: "resumo" }, now: NOW });
  assert.ok(!JSON.stringify(r).includes("SEGREDO-B"));
});

test("categoria: total e últimos gastos; termo livre procura na descrição; sem resultado diz que não há", async () => {
  const { db } = fakeDb(A, dataset());
  const m = await collectFinance({ userId: A, db, blocked: [], intent: { kind: "categoria", categoria: "Mercado" }, now: NOW });
  assert.match(m.facts[0].text, /^Gasto na categoria: Mercado somou R\$ 125,50 em 2 gastos em novembro de 2026/);
  assert.ok(m.facts.some((f) => /Gasto: dia 05\/11, R\$ 100,00, Débito, feira/.test(f.text)));
  const t = await collectFinance({ userId: A, db, blocked: [], intent: { kind: "categoria", termo: "padaria" }, now: NOW });
  assert.match(t.facts[0].text, /padaria somou R\$ 25,50 em 1 gasto/);
  const n = await collectFinance({ userId: A, db, blocked: [], intent: { kind: "categoria", categoria: "Viagens" }, now: NOW });
  assert.match(n.facts[0].text, /nenhum gasto de Viagens lançado/);
});

test("privacidade: termo bloqueado e dado sensível ficam omitidos (nomes, descrições, categoria); números continuam", async () => {
  const d = dataset();
  d.fin_itens.push(it("emp", A, { nome: "Projeto Acme", dia: 12 })); d.fin_item_meses.push(mm("emp", A, 300));
  d.fin_gastos.push(gs("g9", A, 80, { categoria: "Acme viagens", descricao: "almoço com cliente da Acme" }), gs("g10", A, 15, { descricao: "senha do wifi 123" }));
  const { db } = fakeDb(A, d);
  const r = await collectFinance({ userId: A, db, blocked: ["acme"], intent: { kind: "resumo" }, now: NOW });
  const t = JSON.stringify(r);
  assert.ok(!/acme/i.test(t), "nenhum rastro do termo bloqueado");
  assert.ok(t.includes("(omitido pela regra de privacidade)"));
  assert.ok(t.includes("R$ 300,00") && t.includes("R$ 80,00"), "os valores ficam");
  assert.ok(r.facts.some((f) => f.omitted));
  const c = await collectFinance({ userId: A, db, blocked: ["acme"], intent: { kind: "categoria", categoria: "Mercado" }, now: NOW });
  assert.ok(!/senha|acme/i.test(JSON.stringify(c)), "descrição sensível não vai ao modelo");
  const q = await collectFinance({ userId: A, db, blocked: ["acme"], intent: { kind: "categoria", termo: "acme" }, now: NOW });
  assert.ok(!/acme/i.test(JSON.stringify(q)), "nem o termo da pergunta é repetido");
});

test("sem lançamentos: um fato honesto, sem inventar", async () => {
  const { db } = fakeDb(A, { fin_itens: [], fin_item_meses: [], fin_gastos: [], fin_config: [] });
  const r = await collectFinance({ userId: A, db, blocked: [], intent: { kind: "resumo" }, now: NOW });
  assert.match(r.facts[0].text, /^Sem lançamentos: a pessoa ainda não lançou contas nem gastos/);
  assert.match(r.facts[1].text, /Receitas R\$ 0,00/);
});

test("erro de leitura: lança (o chat avisa que não leu; nunca inventa)", async () => {
  const { db } = fakeDb(A, dataset(), { error: ["fin_gastos"] });
  await assert.rejects(collectFinance({ userId: A, db, blocked: [], intent: { kind: "resumo" }, now: NOW }));
});

test("limites de volume: o bloco respeita o máximo de caracteres e mantém F1", async () => {
  const d = dataset();
  for (let i = 0; i < 40; i++) { d.fin_itens.push(it(`x${i}`, A, { nome: `Conta ${"muito longa ".repeat(6)}${i}`, dia: 1 + (i % 28) })); d.fin_item_meses.push(mm(`x${i}`, A, 10 + i)); }
  const { db } = fakeDb(A, d);
  const r = await collectFinance({ userId: A, db, blocked: [], intent: { kind: "contas" }, now: NOW });
  assert.ok(r.facts.length <= 24);
  assert.ok(formatFinanceBlock(r).length <= FINANCE_MAX_CHARS);
  assert.equal(r.facts[0].tag, "F1");
});

test("bloco para o modelo: etiquetas, regra de citar, crédito sem somar duas vezes; regras de proposta de gasto não gravam", async () => {
  const { db } = fakeDb(A, dataset());
  const b = formatFinanceBlock(await collectFinance({ userId: A, db, blocked: [], intent: { kind: "resumo" }, now: NOW }));
  assert.match(b, /Core do GaDu · Finanças do mês/);
  assert.match(b, /\[F1\] Resumo do mês/);
  assert.match(b, /Cite a etiqueta/);
  assert.match(b, /não some os dois/);
  const regras = financeProposalRules("2026-11-22");
  assert.match(regras, /Você NÃO grava/);
  assert.match(regras, /"gastos":\[/);
  assert.match(regras, /2026-11-22/);
});

test("ano até hoje e tetos: intenção 'este ano', somas no servidor e tetos do mês; nada de B", async () => {
  assert.deepEqual(detectFinanceIntent("quanto gastei com mercado este ano?"), { kind: "categoria", categoria: "Mercado", ano: true });
  assert.deepEqual(detectFinanceIntent("quanto gastei em 2026"), { kind: "resumo", ano: true });
  assert.deepEqual(detectFinanceIntent("gastei 45 no mercado este ano"), { kind: "gasto" });
  const ds = dataset();
  const tabelas = {
    ...ds,
    fin_gastos: [...ds.fin_gastos, gs("g0", A, 200, { mes: 3 }), gs("gb2", B, 4321, { mes: 2 })],
    fin_tetos: [{ id: "t1", user_id: A, categoria: "Mercado", valor: 150 }, { id: "tb", user_id: B, categoria: "Mercado", valor: 1 }],
  };
  const { db } = fakeDb(A, tabelas);
  const r = await collectFinance({ userId: A, db, blocked: [], intent: { kind: "categoria", categoria: "Mercado", ano: true }, now: NOW });
  const texto = r.facts.map((f) => f.text).join("\n");
  assert.match(texto, /Acumulado do ano: Mercado: R\$\s?325,50 em 3 gastos/);
  assert.match(texto, /Teto da categoria: Mercado: gastou R\$\s?125,50 de R\$\s?150,00 .*\(83%, passou de 80% do teto/);
  assert.ok(!texto.includes("4.321") && !texto.includes("SEGREDO-B"));
});
