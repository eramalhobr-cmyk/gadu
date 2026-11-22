import assert from "node:assert/strict";
import { test } from "node:test";
import { collectGoals, formatGoalsBlock, goalsProposalRules, GOALS_MAX_CHARS } from "./goals.ts";
import { summarizeSources, toItem } from "./format.ts";
import { detectFinanceIntent, detectGoalsIntent, detectIntent } from "./plan.ts";
import { fakeDb } from "./testing.ts";
import { splitMeta, validMetaProposta } from "../meta.ts";

const NOW = new Date("2026-07-02T15:00:00Z"); // 02/07/2026, 12h em Brasília
const A = "user-a";
const B = "user-b";
const goal = (id: string, user: string, over: Record<string, unknown> = {}) => ({
  id, user_id: user, titulo: `Meta ${id}`, descricao: null, categoria: "desenvolvimento", categoria_nome: null, medicao: "numerica", unidade: "livros", agregacao: "soma",
  valor_inicial: 0, valor_alvo: 12, inicio: "2026-01-01", prazo: "2026-12-31", status: "ativa", concluida_em: null, created_at: "2026-01-01T00:00:00Z", ...over,
});
const prog = (id: string, user: string, goalId: string, valor: number, data: string) => ({ id, user_id: user, goal_id: goalId, valor, data, origem: "manual", nota: null, created_at: `${data}T10:00:00Z` });

const dataset = () => ({
  goals: [
    goal("leitura", A, { titulo: "Ler 12 livros" }),
    goal("corrida", A, { titulo: "Correr 100 km", unidade: "km", valor_alvo: 100, prazo: "2026-07-10", inicio: "2026-06-01" }),
    goal("projx", A, { titulo: "Entregar projeto Acme" }),
    goal("pausa", A, { titulo: "Aprender violão", status: "pausada", medicao: "marcos", unidade: null, valor_alvo: null }),
    goal("seg-b", B, { titulo: "SEGREDO-B meta" }),
  ],
  goal_progress: [
    prog("p1", A, "leitura", 3, "2026-03-01"), prog("p2", A, "leitura", 4, "2026-06-20"), prog("p3", A, "corrida", 20, "2026-06-25"),
    prog("pb", B, "seg-b", 777, "2026-06-01"),
  ],
  goal_milestones: [], goal_tasks: [], tasks: [],
});

test("intenções de metas: perguntas e atualizações simples, sem IA; nada de falso positivo", () => {
  const casos: [string, unknown][] = [
    ["Como estão minhas metas?", { kind: "resumo" }],
    ["quais são as minhas metas", { kind: "resumo" }],
    ["quais metas estão atrasadas?", { kind: "resumo" }],
    ["Como estou nas metas?", { kind: "resumo" }],
    ["Como está minha meta de leitura?", { kind: "meta", termo: "leitura" }],
    ["quanto falta na meta de correr", { kind: "meta", termo: "correr" }],
    ["corri 5 km hoje", { kind: "atualizar" }],
    ["registra 2 livros na meta de leitura", { kind: "atualizar" }],
    ["li 30 páginas ontem", { kind: "atualizar" }],
    ["conclui a meta de leitura", { kind: "atualizar" }],
    ["bati a minha meta de poupança", { kind: "atualizar" }],
    ["economizei 500 esse mês", { kind: "atualizar" }],
  ];
  for (const [msg, esperado] of casos) assert.deepEqual(detectGoalsIntent(msg), esperado, msg);
  for (const msg of ["O que merece minha atenção hoje?", "Me conta uma piada", "gastei 45 no mercado", "quanto gastei este mês", "corri para pegar o ônibus", "li o e-mail", "quero metas para o ano", "", "meta"]) assert.equal(detectGoalsIntent(msg), null, msg);
  assert.equal(detectIntent("Como estão minhas metas?"), null, "atenção do dia continua separada");
  assert.equal(detectFinanceIntent("Como estão minhas metas?"), null, "finanças não captura metas");
  assert.equal(detectFinanceIntent("corri 5 km hoje"), null);
});

test("parser da proposta: etiqueta, ação, valor positivo e data válida; lixo é descartado; no máximo uma", () => {
  const now = NOW.getTime();
  assert.deepEqual(validMetaProposta({ meta: "m2", acao: "registrar", valor: "5,5", data: "2026-07-01" }, now), { meta: "M2", acao: "registrar", valor: 5.5, data: "2026-07-01" });
  assert.deepEqual(validMetaProposta({ meta: "M1", acao: "concluir" }, now), { meta: "M1", acao: "concluir", valor: null, data: null });
  assert.equal(validMetaProposta({ meta: "M1", acao: "registrar", valor: 3, data: "2026-12-01" }, now)?.data, null, "data futura é descartada (vira hoje no servidor)");
  assert.equal(validMetaProposta({ meta: "M1", acao: "registrar", valor: 3, data: "2026-02-31" }, now)?.data, null);
  assert.equal(validMetaProposta({ meta: "M1", acao: "registrar", valor: 3, data: "2020-01-01" }, now)?.data, null, "data muito antiga é descartada");
  for (const ruim of [{ meta: "uuid-123", acao: "registrar", valor: 1 }, { meta: "M1", acao: "registrar" }, { meta: "M1", acao: "registrar", valor: 0 }, { meta: "M1", acao: "registrar", valor: -2 },
    { meta: "M1", acao: "apagar" }, { acao: "concluir" }, { meta: "M999", acao: "concluir" }, { meta: "M1", acao: "registrar", valor: "abc" }]) assert.equal(validMetaProposta(ruim as never, now), null, JSON.stringify(ruim));
  const r = splitMeta(`Preparei.\n<<<META>>>\n${JSON.stringify({ metas: [{ meta: "M1", acao: "registrar", valor: 5 }, { meta: "M2", acao: "concluir" }, { lixo: true }], gastos: [] })}`, now);
  assert.equal(r.metas.length, 1, "no máximo uma proposta");
  assert.equal(r.body, "Preparei.");
  assert.deepEqual(splitMeta("Oi").metas, []);
  assert.deepEqual(splitMeta("Oi <<<META>>> {quebrado").metas, []);
});

test("coleta (resumo): só fatos de A, etiquetas M1.., origem, data do último registro e tela Metas", async () => {
  const { db } = fakeDb(A, dataset());
  const r = await collectGoals({ userId: A, db, blocked: [], intent: { kind: "resumo" }, now: NOW });
  const all = JSON.stringify(r);
  assert.ok(!all.includes("SEGREDO-B") && !all.includes("777"), "nada de B");
  assert.deepEqual(r.facts.map((f) => f.tag), r.facts.map((_, i) => `M${i + 1}`));
  assert.ok(r.facts.every((f) => f.kind === "meta" && f.view === "metas" && f.module === "metas" && f.scope === "pessoal"));
  const texto = r.facts.map((f) => f.text).join("\n");
  assert.match(texto, /Resumo das metas: 3 ativas/);
  assert.match(texto, /Ler 12 livros: 7 livros de 12 livros \(58%\)/);
  assert.match(texto, /último registro em 20\/06/);
  assert.match(texto, /Correr 100 km: 20 km de 100 km \(20%\); Atrasada/);
  assert.match(texto, /Entregar projeto Acme: Sem registros.*nenhum registro ainda/, "sem registro é dito, nunca vira 0%");
  assert.match(texto, /Aprender violão/, "pausada aparece no resumo");
  // a atrasada vem antes da no ritmo
  assert.ok(texto.indexOf("Correr 100 km") < texto.indexOf("Ler 12 livros"));
  assert.match(summarizeSources(r.facts.map(toItem)), /metas/);
  assert.equal(toItem(r.facts[1]).view, "metas");
});

test("coleta (meta pelo nome): mostra a meta e o ritmo; sem achar, lista as ativas", async () => {
  const { db } = fakeDb(A, dataset());
  const r = await collectGoals({ userId: A, db, blocked: [], intent: { kind: "meta", termo: "livros" }, now: NOW });
  assert.match(r.facts.map((f) => f.text).join("\n"), /Ler 12 livros: .*faltam 5 livros/);
  assert.ok(!r.facts.some((f) => f.text.includes("Correr")));
  const nada = await collectGoals({ userId: A, db, blocked: [], intent: { kind: "meta", termo: "viagem" }, now: NOW });
  assert.match(nada.facts[0].text, /nenhuma meta com "viagem".*Ler 12 livros/);
});

test("sem metas: diz que não há, sem inventar", async () => {
  const { db } = fakeDb("user-novo", dataset());
  const r = await collectGoals({ userId: "user-novo", db, blocked: [], intent: { kind: "resumo" }, now: NOW });
  assert.equal(r.facts.length, 1);
  assert.match(r.facts[0].text, /ainda não criou nenhuma meta/);
  assert.deepEqual(r.refs, []);
});

test("privacidade: termo bloqueado omite o título e a meta não pode ser atualizada pela conversa", async () => {
  const { db } = fakeDb(A, dataset());
  const r = await collectGoals({ userId: A, db, blocked: ["acme"], intent: { kind: "atualizar" }, now: NOW });
  const all = JSON.stringify(r);
  assert.ok(!all.toLowerCase().includes("acme"), "o termo bloqueado nunca sai");
  assert.match(r.facts.map((f) => f.text).join("\n"), /omitido pela regra de privacidade/);
  assert.ok(!r.refs.some((x) => x.id === "projx"));
  assert.deepEqual(r.refs.map((x) => x.id).sort(), ["corrida", "leitura"], "só as metas ativas e visíveis");
  assert.ok(r.facts.some((f) => f.omitted));
});

test("atualizar: refs ligam etiqueta ao id; o texto diz como o registro é calculado", async () => {
  const { db } = fakeDb(A, dataset());
  const r = await collectGoals({ userId: A, db, blocked: [], intent: { kind: "atualizar" }, now: NOW });
  const leitura = r.refs.find((x) => x.id === "leitura")!;
  assert.match(leitura.tag, /^M\d+$/);
  assert.equal(r.facts.find((f) => f.tag === leitura.tag)!.source.id, "leitura");
  assert.match(r.facts.map((f) => f.text).join("\n"), /valor SOMADO/);
  assert.match(goalsProposalRules("2026-07-02"), /NÃO grava/);
  assert.match(goalsProposalRules("2026-07-02"), /hoje é 2026-07-02/);
});

test("falha de leitura lança (o chat trata como indisponível); volume limitado", async () => {
  const { db } = fakeDb(A, dataset(), { error: ["goals"] });
  await assert.rejects(collectGoals({ userId: A, db, blocked: [], intent: { kind: "resumo" }, now: NOW }));
  const muitas = Array.from({ length: 60 }, (_, i) => goal(`g${i}`, A, { titulo: `Meta número ${i} ${"x".repeat(100)}` }));
  const { db: db2 } = fakeDb(A, { ...dataset(), goals: muitas });
  const r = await collectGoals({ userId: A, db: db2, blocked: [], intent: { kind: "resumo" }, now: NOW });
  assert.ok(r.facts.length <= 14);
  assert.ok(formatGoalsBlock(r).length <= GOALS_MAX_CHARS + 600);
});
