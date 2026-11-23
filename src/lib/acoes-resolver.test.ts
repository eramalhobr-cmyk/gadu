import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveAcoes } from "./acoes-resolver.ts";

const NOW = Date.parse("2026-11-22T15:00:00-03:00");
// Banco falso: guarda os filtros e devolve as linhas da tabela que batem com eq/in.
function fakeDb(tables: Record<string, Record<string, unknown>[]>) {
  const calls: { table: string; filters: [string, unknown][] }[] = [];
  return {
    calls,
    from(table: string) {
      const filters: [string, unknown][] = [];
      calls.push({ table, filters });
      const q = {
        select: () => q, order: () => q, limit: () => q, maybeSingle: () => Promise.resolve({ data: null, error: null }),
        eq: (k: string, v: unknown) => { filters.push([k, v]); return q; },
        in: (k: string, v: unknown[]) => { filters.push([k, v]); return q; },
        then: (res: (v: unknown) => void) => res({ error: null, data: (tables[table] ?? []).filter((r) => filters.every(([k, v]) => (Array.isArray(v) ? v.includes(r[k]) : r[k] === v))) }),
      };
      return q;
    },
  };
}
const U = "u1";
const db = fakeDb({
  goals: [
    { id: "g1", titulo: "Correr 50 km em novembro", medicao: "numerica", unidade: "km", agregacao: "soma", status: "ativa", user_id: U },
    { id: "g2", titulo: "Mudar de casa", medicao: "marcos", unidade: null, agregacao: "soma", status: "ativa", user_id: U },
    { id: "gX", titulo: "Correr maratona", medicao: "numerica", unidade: "km", agregacao: "soma", status: "ativa", user_id: "outra" },
  ],
  goal_milestones: [{ id: "m1", goal_id: "g2", titulo: "Achar a casa", concluido_em: null, user_id: U }],
  tasks: [{ id: 5, title: "Ler aviso do condomínio", status: "open", user_id: U }],
  reminders: [{ id: 9, text: "Tomar o remédio", due_at: "2026-11-22T23:00:00.000Z", status: "pending", user_id: U }],
  fin_itens: [{ id: "i1", tipo: "despesa", grupo: "Moradia", nome: "Luz (Enel)", ordem: 1, user_id: U }, { id: "i2", tipo: "despesa", grupo: "Moradia", nome: "Internet", ordem: 2, user_id: U }],
  fin_item_meses: [{ item_id: "i1", ano: 2026, mes: 11, valor: 180.5, pago: false, user_id: U }, { item_id: "i2", ano: 2026, mes: 11, valor: 100, pago: true, user_id: U }],
  fin_gastos: [], fin_config: [],
});

test("resolve metas, marcos, tarefas, lembretes e contas só da própria pessoa", async () => {
  const r = await resolveAcoes(db, U, [
    { tipo: "meta_registrar", meta: "correr", valor: 5, data: null },
    { tipo: "meta_marco_concluir", meta: "mudar de casa", marco: "achar casa" },
    { tipo: "tarefa_concluir", tarefa: "aviso do condomínio" },
    { tipo: "lembrete_cancelar", lembrete: "remédio" },
    { tipo: "conta_paga", conta: "luz" },
  ], { goals: true, finance: true, now: NOW });
  assert.deepEqual(r.actions.map((a) => a.kind), ["meta", "marco_ok", "tarefa_ok", "lembrete_off", "conta_paga"]);
  const meta = r.actions[0] as { d: { goalId: string; data: string } };
  assert.equal(meta.d.goalId, "g1", "não pega a meta de outra pessoa");
  assert.equal(meta.d.data, "2026-11-22");
  assert.deepEqual(r.actions[4], { kind: "conta_paga", itemId: "i1", nome: "Luz (Enel)", valor: 180.5, ano: 2026, mes: 11 });
  assert.deepEqual(r.misses, []);
  assert.ok(db.calls.every((c) => c.filters.some(([k, v]) => k === "user_id" && v === U)), "toda leitura filtra por user_id");
});
test("avisa o que não achou e o que não faz sentido", async () => {
  const r = await resolveAcoes(db, U, [
    { tipo: "meta_registrar", meta: "maratona", valor: 5, data: null },
    { tipo: "meta_registrar", meta: "mudar de casa", valor: 1, data: null },
    { tipo: "conta_paga", conta: "internet" },
    { tipo: "tarefa_adiar", tarefa: "comprar pão", prazo: "2026-11-25" },
  ], { goals: true, finance: true, now: NOW });
  assert.equal(r.actions.length, 0);
  assert.equal(r.misses.length, 3);
  assert.match(r.misses.join(" "), /maratona/);
});
test("módulo desligado não gera cartão; termo bloqueado também não", async () => {
  const r = await resolveAcoes(db, U, [
    { tipo: "conta_paga", conta: "luz" },
    { tipo: "meta_criar", titulo: "Projeto Acme", medicao: "tarefas", unidade: null, alvo: null, inicial: 0, prazo: null, categoria: "profissional", marcos: [] },
    { tipo: "projeto_criar", nome: "Reforma", objetivo: null },
    { tipo: "ajuste", ajuste: { opcao: "texto", valor: "130" } },
  ], { goals: true, finance: false, now: NOW, blocked: (t) => /acme/i.test(t) });
  assert.deepEqual(r.actions.map((a) => a.kind), ["projeto", "ajuste"]);
});

const db2 = fakeDb({
  tasks: [
    { id: 5, title: "Ler aviso do condomínio", status: "open", user_id: U },
    { id: 6, title: "Pagar boleto da escola", status: "done", user_id: U },
    { id: 7, title: "Ligar para o dentista", status: "cancelled", user_id: U },
    { id: 8, title: "Fatura segredo-b", status: "done", user_id: "outra" },
  ],
  projects: [{ id: 3, name: "Casa nova", status: "active", user_id: U }, { id: 4, name: "Projeto alheio", status: "active", user_id: "outra" }],
  reminders: [
    { id: 9, text: "Tomar o remédio", due_at: "2026-11-22T23:00:00.000Z", status: "pending", user_id: U },
    { id: 10, text: "Buscar encomenda", due_at: "2026-11-22T12:00:00.000Z", status: "sent", user_id: U },
    { id: 11, text: "Remédio de outra pessoa", due_at: "2026-11-22T23:00:00.000Z", status: "pending", user_id: "outra" },
  ],
});
test("tarefa cancelar, reabrir e editar; lembrete adiar: só itens da própria pessoa", async () => {
  const r = await resolveAcoes(db2, U, [
    { tipo: "tarefa_cancelar", tarefa: "aviso do condomínio" },
    { tipo: "tarefa_reabrir", tarefa: "dentista" },
    { tipo: "tarefa_editar", tarefa: "aviso", titulo: null, prioridade: 1, prazo: "2026-11-25", projeto: "casa" },
    { tipo: "lembrete_adiar", lembrete: "encomenda", quando: "2026-11-23T12:00:00.000Z" },
    { tipo: "lembrete_adiar", lembrete: "remédio", quando: "2026-11-23T12:00:00.000Z" },
  ], { goals: true, finance: true, now: NOW });
  assert.deepEqual(r.actions, [
    { kind: "tarefa_cancelar", id: 5, titulo: "Ler aviso do condomínio" },
    { kind: "tarefa_reabrir", id: 7, titulo: "Ligar para o dentista" },
    { kind: "tarefa_editar", id: 5, titulo: "Ler aviso do condomínio", mudancas: { prioridade: 1, prazo: "2026-11-25", projetoId: 3, projeto: "Casa nova" } },
    { kind: "lembrete_adiar", id: 10, text: "Buscar encomenda", dueAt: "2026-11-22T12:00:00.000Z", novoDueAt: "2026-11-23T12:00:00.000Z" },
    { kind: "lembrete_adiar", id: 9, text: "Tomar o remédio", dueAt: "2026-11-22T23:00:00.000Z", novoDueAt: "2026-11-23T12:00:00.000Z" },
  ]);
  assert.deepEqual(r.misses, []);
  assert.ok(db2.calls.every((c) => c.filters.some(([k, v]) => k === "user_id" && v === U)), "toda leitura filtra por user_id");
});
test("tarefa/projeto de outra pessoa, projeto inexistente e título bloqueado não geram cartão", async () => {
  const r = await resolveAcoes(db2, U, [
    { tipo: "tarefa_reabrir", tarefa: "fatura segredo" },
    { tipo: "tarefa_editar", tarefa: "aviso", titulo: null, prioridade: null, prazo: null, projeto: "projeto alheio" },
    { tipo: "tarefa_editar", tarefa: "aviso", titulo: "Reunião Acme", prioridade: null, prazo: null, projeto: null },
    { tipo: "tarefa_cancelar", tarefa: "comprar pão" },
  ], { goals: true, finance: true, now: NOW, blocked: (t) => /acme/i.test(t) });
  assert.equal(r.actions.length, 0);
  assert.equal(r.misses.length, 3);
});

const MES = { ano: 2026, mes: 11 };
const db3 = fakeDb({
  fin_itens: [
    { id: "i1", tipo: "despesa", grupo: "Moradia", nome: "Luz", ordem: 1, user_id: U }, { id: "i2", tipo: "despesa", grupo: "Moradia", nome: "Internet", ordem: 2, user_id: U },
    { id: "iX", tipo: "despesa", grupo: "Geral", nome: "Conta secreta", ordem: 1, user_id: "outra" },
  ],
  fin_item_meses: [
    { item_id: "i1", ...MES, valor: 180, pago: false, user_id: U }, { item_id: "i2", ...MES, valor: 100, pago: true, user_id: U },
    { item_id: "iX", ...MES, valor: 999, pago: true, user_id: "outra" },
  ],
  fin_gastos: [
    { id: "g1", ...MES, dia: 3, valor: 100, categoria: "Mercado", descricao: "feira", meio: "pix", origem: "manual", user_id: U },
    { id: "g2", ...MES, dia: 5, valor: 45.5, categoria: "Mercado", descricao: "", meio: "debito", origem: "manual", user_id: U },
    { id: "g3", ...MES, dia: 6, valor: 30, categoria: "Lazer", descricao: "cinema", meio: "credito", origem: "manual", user_id: U },
    { id: "gX", ...MES, dia: 6, valor: 77, categoria: "Lazer", descricao: "cinema secreto", meio: "pix", origem: "manual", user_id: "outra" },
  ],
  fin_config: [],
});
const agenda = [
  { id: "e1", title: "Dentista", start: "2026-11-23T13:00:00.000Z", end: "2026-11-23T14:00:00.000Z", allDay: false, meet: false, declined: false },
  { id: "e2", title: "Aniversário", start: "2026-11-25", end: "2026-11-26", allDay: true, meet: false, declined: false },
  { id: "e3", title: "Reunião recusada", start: "2026-11-24T13:00:00.000Z", end: "2026-11-24T14:00:00.000Z", allDay: false, meet: false, declined: true },
];

test("conta desmarcar/valor e gasto apagar/editar: só da própria pessoa, filtrando por valor", async () => {
  const r = await resolveAcoes(db3, U, [
    { tipo: "conta_desmarcar", conta: "internet" },
    { tipo: "conta_valor", conta: "luz", valor: 210, escopo: "mes" },
    { tipo: "gasto_apagar", gasto: "mercado", valor: 45.5, data: null },
    { tipo: "gasto_editar", gasto: "cinema", de_valor: null, de_data: null, valor: 35, categoria: "Lazer", descricao: null, meio: "pix", data: "2026-11-07" },
  ], { goals: true, finance: true, now: NOW });
  assert.deepEqual(r.actions, [
    { kind: "conta_desmarcar", itemId: "i2", nome: "Internet", valor: 100, ano: 2026, mes: 11 },
    { kind: "conta_valor", itemId: "i1", nome: "Luz", antes: 180, valor: 210, escopo: "mes", ano: 2026, mes: 11 },
    { kind: "gasto_apagar", id: "g2", valor: 45.5, categoria: "Mercado", descricao: "", data: "2026-11-05" },
    { kind: "gasto_editar", id: "g3", atual: { valor: 30, categoria: "Lazer", descricao: "cinema", data: "2026-11-06" }, mudancas: { valor: 35, meio: "pix", data: "2026-11-07" } },
  ]);
  assert.deepEqual(r.misses, []);
  assert.ok(db3.calls.every((c) => c.filters.some(([k, v]) => k === "user_id" && v === U)), "toda leitura filtra por user_id");
});
test("gasto ambíguo, de outra pessoa ou já assim; conta já no estado pedido; finanças desligado", async () => {
  const r = await resolveAcoes(db3, U, [
    { tipo: "gasto_apagar", gasto: "mercado", valor: null, data: null },
    { tipo: "gasto_apagar", gasto: "cinema secreto", valor: 77, data: null },
    { tipo: "gasto_editar", gasto: "feira", de_valor: null, de_data: null, valor: 100, categoria: null, descricao: null, meio: null, data: null },
    { tipo: "conta_desmarcar", conta: "luz" },
    { tipo: "conta_valor", conta: "luz", valor: 180, escopo: "mes" },
  ], { goals: true, finance: true, now: NOW });
  assert.equal(r.actions.length, 0);
  assert.equal(r.misses.length, 3, "avisos únicos e no máximo 3");
  const off = await resolveAcoes(db3, U, [{ tipo: "gasto_apagar", gasto: "feira", valor: null, data: null }, { tipo: "conta_valor", conta: "luz", valor: 1, escopo: "mes" }, { tipo: "conta_desmarcar", conta: "internet" }], { goals: true, finance: false, now: NOW });
  assert.deepEqual(off.actions, []);
  assert.deepEqual(off.misses, []);
});
test("evento editar e apagar: acha na agenda, mantém a duração, recusa dia inteiro e agenda fora do ar", async () => {
  const calendar = async () => agenda;
  const r = await resolveAcoes(db3, U, [
    { tipo: "evento_editar", evento: "dentista", titulo: "Dentista da Ana", inicio: "2026-11-23T16:00:00.000Z", fim: null, local: null },
    { tipo: "evento_apagar", evento: "aniversário" },
    { tipo: "evento_editar", evento: "aniversário", titulo: null, inicio: "2026-11-25T16:00:00.000Z", fim: null, local: null },
    { tipo: "evento_apagar", evento: "recusada" },
  ], { goals: true, finance: true, now: NOW, calendar });
  assert.deepEqual(r.actions, [
    { kind: "evento_editar", eventId: "e1", title: "Dentista", start: "2026-11-23T13:00:00.000Z", end: "2026-11-23T14:00:00.000Z", mudancas: { title: "Dentista da Ana", start: "2026-11-23T16:00:00.000Z", end: "2026-11-23T17:00:00.000Z" } },
    { kind: "evento_apagar", eventId: "e2", title: "Aniversário", start: "2026-11-25", end: "2026-11-26" },
  ]);
  assert.equal(r.misses.length, 2, "dia inteiro e evento recusado (fora da lista)");
  const fora = await resolveAcoes(db3, U, [{ tipo: "evento_apagar", evento: "dentista" }], { goals: true, finance: true, now: NOW, calendar: async () => { throw new Error("google"); } });
  assert.deepEqual(fora.actions, []);
  assert.match(fora.misses[0], /agenda do Google/);
  const semAgenda = await resolveAcoes(db3, U, [{ tipo: "evento_apagar", evento: "dentista" }], { goals: true, finance: true, now: NOW });
  assert.match(semAgenda.misses[0], /agenda do Google/);
  const bloqueado = await resolveAcoes(db3, U, [{ tipo: "evento_editar", evento: "dentista", titulo: "Reunião Acme", inicio: null, fim: null, local: null }], { goals: true, finance: true, now: NOW, calendar, blocked: (t) => /acme/i.test(t) });
  assert.deepEqual(bloqueado.actions, []);
});

const db4 = fakeDb({
  goals: [
    { id: "g1", titulo: "Correr 50 km em novembro", medicao: "numerica", unidade: "km", agregacao: "soma", status: "ativa", valor_alvo: "50", prazo: "2026-11-30", user_id: U },
    { id: "g2", titulo: "Mudar de casa", medicao: "marcos", unidade: null, agregacao: "soma", status: "ativa", valor_alvo: null, prazo: null, user_id: U },
    { id: "g3", titulo: "Ler 12 livros", medicao: "numerica", unidade: "livros", agregacao: "soma", status: "pausada", valor_alvo: 12, prazo: null, user_id: U },
    { id: "gX", titulo: "Meta secreta", medicao: "numerica", unidade: "km", agregacao: "soma", status: "ativa", valor_alvo: 9, prazo: null, user_id: "outra" },
  ],
  projects: [{ id: 3, name: "Casa nova", goal: "Mudar até junho", status: "active", user_id: U }, { id: 4, name: "Projeto secreto", goal: null, status: "active", user_id: "outra" }],
});
test("meta pausar, retomar, arquivar e editar; projeto editar e arquivar: só da própria pessoa", async () => {
  const r = await resolveAcoes(db4, U, [
    { tipo: "meta_pausar", meta: "correr" },
    { tipo: "meta_retomar", meta: "livros" },
    { tipo: "meta_arquivar", meta: "mudar de casa" },
    { tipo: "meta_editar", meta: "correr", titulo: null, alvo: 60, prazo: "2026-12-31" },
    { tipo: "projeto_editar", projeto: "casa", nome: "Casa pronta", objetivo: "" },
  ], { goals: true, finance: true, now: NOW });
  const pa = await resolveAcoes(db4, U, [{ tipo: "projeto_arquivar", projeto: "casa nova" }], { goals: true, finance: true, now: NOW });
  assert.deepEqual(pa.actions, [{ kind: "projeto_arquivar", id: 3, nome: "Casa nova" }]);
  assert.deepEqual(r.actions, [
    { kind: "meta_status", goalId: "g1", titulo: "Correr 50 km em novembro", para: "pausada" },
    { kind: "meta_status", goalId: "g3", titulo: "Ler 12 livros", para: "ativa" },
    { kind: "meta_status", goalId: "g2", titulo: "Mudar de casa", para: "arquivada" },
    { kind: "meta_editar", goalId: "g1", titulo: "Correr 50 km em novembro", unidade: "km", mudancas: { alvo: 60, prazo: "2026-12-31" } },
    { kind: "projeto_editar", id: 3, nome: "Casa nova", mudancas: { nome: "Casa pronta", objetivo: "" } },
  ]);
  assert.deepEqual(r.misses, []);
  assert.ok(db4.calls.every((c) => c.filters.some(([k, v]) => k === "user_id" && v === U)), "toda leitura filtra por user_id");
});
test("meta e projeto: de outra pessoa, estado errado, nada para mudar, alvo em meta por marcos, módulo desligado e termo bloqueado", async () => {
  const r = await resolveAcoes(db4, U, [
    { tipo: "meta_pausar", meta: "meta secreta" },
    { tipo: "meta_pausar", meta: "livros" },
    { tipo: "meta_retomar", meta: "correr" },
    { tipo: "meta_editar", meta: "mudar de casa", titulo: null, alvo: 5, prazo: null },
    { tipo: "meta_editar", meta: "correr", titulo: null, alvo: 50, prazo: "2026-11-30" },
    { tipo: "projeto_arquivar", projeto: "projeto secreto" },
  ], { goals: true, finance: true, now: NOW });
  assert.equal(r.actions.length, 0);
  assert.equal(r.misses.length, 3);
  const off = await resolveAcoes(db4, U, [{ tipo: "meta_pausar", meta: "correr" }, { tipo: "meta_editar", meta: "correr", titulo: "Novo", alvo: null, prazo: null }, { tipo: "projeto_arquivar", projeto: "casa" }], { goals: false, finance: true, now: NOW });
  assert.deepEqual(off.actions.map((a) => a.kind), ["projeto_arquivar"], "projeto não depende de Metas");
  const bl = await resolveAcoes(db4, U, [{ tipo: "meta_editar", meta: "correr", titulo: "Meta Acme", alvo: null, prazo: null }, { tipo: "projeto_editar", projeto: "casa", nome: "Acme", objetivo: null }], { goals: true, finance: true, now: NOW, blocked: (t) => /acme/i.test(t) });
  assert.deepEqual(bl.actions, []);
});

const db5 = fakeDb({
  memories: [
    { id: 1, content: "A pessoa mora em Curitiba", status: "approved", user_id: U },
    { id: 2, content: "Prefere reuniões pela manhã", status: "pending", user_id: U },
    { id: 3, content: "Gosta de café sem açúcar", status: "pending", user_id: U },
    { id: 4, content: "Memória secreta de outra pessoa", status: "pending", user_id: "outra" },
    { id: 5, content: "Fato secreto aprovado de outra pessoa", status: "approved", user_id: "outra" },
  ],
});
test("memória aprovar, recusar e esquecer: só da própria pessoa e do estado certo", async () => {
  const r = await resolveAcoes(db5, U, [
    { tipo: "memoria_aprovar", memoria: "reuniões pela manhã", todas: false },
    { tipo: "memoria_recusar", memoria: "café", },
    { tipo: "memoria_esquecer", memoria: "Curitiba" },
    { tipo: "memoria_aprovar", memoria: null, todas: true },
  ], { goals: true, finance: true, now: NOW });
  assert.deepEqual(r.actions, [
    { kind: "memoria_aprovar", ids: [2], texto: "Prefere reuniões pela manhã" },
    { kind: "memoria_recusar", id: 3, texto: "Gosta de café sem açúcar" },
    { kind: "memoria_esquecer", id: 1, texto: "A pessoa mora em Curitiba" },
    { kind: "memoria_aprovar", ids: [2, 3], texto: "2 memórias pendentes" },
  ]);
  assert.ok(db5.calls.every((c) => c.filters.some(([k, v]) => k === "user_id" && v === U)), "toda leitura filtra por user_id");
});
test("memória de outra pessoa, de outro estado ou inexistente vira aviso", async () => {
  const r = await resolveAcoes(db5, U, [
    { tipo: "memoria_recusar", memoria: "secreta" },
    { tipo: "memoria_esquecer", memoria: "secreto aprovado" },
    { tipo: "memoria_esquecer", memoria: "reuniões pela manhã" },
    { tipo: "memoria_aprovar", memoria: "Curitiba", todas: false },
  ], { goals: true, finance: true, now: NOW });
  assert.equal(r.actions.length, 0, "a de Curitiba já está aprovada; a de reuniões ainda está pendente");
  assert.equal(r.misses.length, 3);
  const vazio = await resolveAcoes(fakeDb({ memories: [] }), U, [{ tipo: "memoria_aprovar", memoria: null, todas: true }], { goals: true, finance: true, now: NOW });
  assert.deepEqual(vazio.actions, []);
  assert.equal(vazio.misses.length, 1);
});
test("nova conversa e navegação não leem nada; telas desligadas não abrem", async () => {
  const sem = fakeDb({});
  const r = await resolveAcoes(sem, U, [{ tipo: "nova_conversa" }, { tipo: "navegar", destino: "tarefas" }, { tipo: "navegar", destino: "financeiro" }, { tipo: "navegar", destino: "metas" }], { goals: true, finance: true, now: NOW });
  assert.deepEqual(r.actions, [{ kind: "nova_conversa" }, { kind: "navegar", view: "tarefas" }, { kind: "navegar", view: "financeiro" }, { kind: "navegar", view: "metas" }]);
  assert.equal(sem.calls.length, 0, "nenhuma consulta ao banco");
  const off = await resolveAcoes(sem, U, [{ tipo: "navegar", destino: "financeiro" }, { tipo: "navegar", destino: "metas" }, { tipo: "navegar", destino: "agenda" }], { goals: false, finance: false, now: NOW });
  assert.deepEqual(off.actions, [{ kind: "navegar", view: "agenda" }]);
  assert.equal(off.misses.length, 2);
});

test("guia não lê nada do banco", async () => {
  const sem = fakeDb({});
  const r = await resolveAcoes(sem, U, [{ tipo: "guia" }], { goals: false, finance: false, now: NOW });
  assert.deepEqual(r.actions, [{ kind: "guia" }]);
  assert.equal(sem.calls.length, 0);
});

test("salario_simular: calcula no servidor, só informa; 'salvar' usa a receita principal da PRÓPRIA pessoa e avisa quando não há", async () => {
  const base = { fin_itens: [{ id: "r1", tipo: "receita", grupo: "Receitas", nome: "Salário", ordem: 0, user_id: U }, { id: "rx", tipo: "receita", grupo: "Receitas", nome: "SEGREDO", ordem: 0, user_id: "outra" }], fin_item_meses: [{ item_id: "r1", ano: 2026, mes: 11, valor: 4000, pago: false, user_id: U }], fin_gastos: [] };
  const sem = fakeDb({ ...base, fin_config: [{ user_id: "outra", receita_principal_id: "rx" }] });
  const r1 = await resolveAcoes(sem, U, [{ tipo: "salario_simular", bruto: 8000, dependentes: 0, salvar: false }, { tipo: "salario_simular", bruto: 6500, dependentes: 2, salvar: true }], { goals: true, finance: true, now: NOW });
  assert.deepEqual(r1.actions.map((a) => a.kind === "salario" && [a.calc.liquido, a.salvar]), [[6040.64, null], [5322.84, null]]);
  assert.equal(r1.misses.length, 1, "avisa que falta a receita principal");
  assert.ok(sem.calls.every((c) => c.filters.some(([k, v]) => k === "user_id" && v === U)), "toda leitura filtra por user_id");
  const com = fakeDb({ ...base, fin_config: [{ user_id: U, receita_principal_id: "r1", dia_adiantamento: 15, dia_restante: 1, adiantamento_pct: 0 }] });
  // este banco falso não imita maybeSingle (a config vem vazia): aqui só vale que nada quebra; o caminho com receita principal é coberto em test/finance-chat.integration.test.ts
  const r2 = await resolveAcoes(com, U, [{ tipo: "salario_simular", bruto: 8000, dependentes: 0, salvar: true }], { goals: true, finance: true, now: NOW });
  assert.equal(r2.actions.length, 1);
  const off = await resolveAcoes(com, U, [{ tipo: "salario_simular", bruto: 8000, dependentes: 0, salvar: false }], { goals: true, finance: false, now: NOW });
  assert.deepEqual(off.actions, [], "interruptor do Financeiro desligado: nada");
});

test("abrir conversa anterior: só as da própria pessoa, pelo título ou resumo; nada achado vira aviso", async () => {
  const cdb = fakeDb({
    conversations: [
      { id: 7, title: "Assembleia do condomínio", summary: "votação da obra", updated_at: "2026-11-20T13:00:00.000Z", user_id: U },
      { id: 8, title: "Viagem para Recife", summary: "passagens e hotel", updated_at: "2026-11-18T13:00:00.000Z", user_id: U },
      { id: 99, title: "Condomínio da outra pessoa", summary: "SEGREDO", updated_at: "2026-11-21T13:00:00.000Z", user_id: "outra" },
    ],
  });
  (cdb as unknown as { from: (t: string) => Record<string, unknown> }).from = ((orig) => (t: string) => { const q = orig(t) as Record<string, unknown>; q.textSearch = (_c: string, term: string) => { const then = q.then as (r: (v: { data: { title: string; summary: string }[] }) => void) => void; q.then = (res: (v: unknown) => void) => then((v) => res({ ...v, data: v.data.filter((x) => `${x.title} ${x.summary}`.toLowerCase().includes(term.toLowerCase())) })); return q; }; return q; })(cdb.from.bind(cdb));
  const r = await resolveAcoes(cdb, U, [
    { tipo: "conversa_abrir", busca: "condomínio" },
    { tipo: "conversa_abrir", busca: "passagens" },
    { tipo: "conversa_abrir", busca: "dentista" },
  ], { goals: true, finance: true, now: NOW });
  assert.deepEqual(r.actions.map((a) => (a as { id: number }).id), [7, 8]);
  assert.equal((r.actions[0] as { quando: string }).quando, "20/11");
  assert.ok(!JSON.stringify(r).includes("SEGREDO"));
  assert.ok(cdb.calls.filter((c) => c.table === "conversations").every((c) => c.filters.some(([k, v]) => k === "user_id" && v === U)));
  assert.equal(r.misses.length, 1);
});

test("abrir peça do 3D: a mais recente ou pelo nome, só da própria pessoa; interruptor desligado não lê nada", async () => {
  const pdb = fakeDb({
    pecas_3d: [
      { id: "p2", titulo: "Gancho de parede", updated_at: "2026-11-23T13:00:00.000Z", user_id: U },
      { id: "p1", titulo: "Suporte de celular", updated_at: "2026-11-22T13:00:00.000Z", user_id: U },
      { id: "pX", titulo: "Suporte SEGREDO", updated_at: "2026-11-23T14:00:00.000Z", user_id: "outra" },
    ],
  });
  const r = await resolveAcoes(pdb, U, [
    { tipo: "peca3d_abrir", busca: null },
    { tipo: "peca3d_abrir", busca: "suporte" },
    { tipo: "peca3d_abrir", busca: "vaso" },
  ], { goals: true, finance: true, modeling3d: true, now: NOW });
  assert.deepEqual(r.actions, [
    { kind: "peca3d_abrir", id: "p2", titulo: "Gancho de parede", quando: "23/11" },
    { kind: "peca3d_abrir", id: "p1", titulo: "Suporte de celular", quando: "22/11" },
  ]);
  assert.equal(r.misses.length, 1);
  assert.ok(!JSON.stringify(r).includes("SEGREDO"));
  assert.ok(pdb.calls.every((c) => c.filters.some(([k, v]) => k === "user_id" && v === U)));
  const off = fakeDb({ pecas_3d: [{ id: "p2", titulo: "Gancho", updated_at: "2026-11-23T13:00:00.000Z", user_id: U }] });
  const r2 = await resolveAcoes(off, U, [{ tipo: "peca3d_abrir", busca: null }], { goals: true, finance: true, now: NOW });
  assert.deepEqual(r2.actions, []);
  assert.equal(off.calls.length, 0, "3D desligado: nenhuma leitura");
});

test("ajustar peça do 3D por voz: só peça da própria pessoa; termo bloqueado no pedido não vira cartão; 3D desligado não lê", async () => {
  const pdb = fakeDb({ pecas_3d: [
    { id: "p1", titulo: "Suporte de celular", updated_at: "2026-11-22T13:00:00.000Z", user_id: U },
    { id: "pX", titulo: "Suporte SEGREDO", updated_at: "2026-11-23T14:00:00.000Z", user_id: "outra" },
  ] });
  const r = await resolveAcoes(pdb, U, [
    { tipo: "peca3d_ajustar", busca: "suporte", pedido: "2 mm mais alto" },
    { tipo: "peca3d_ajustar", busca: null, pedido: "bordas arredondadas" },
    { tipo: "peca3d_ajustar", busca: null, pedido: "logo da Acme" },
  ], { goals: true, finance: true, modeling3d: true, now: NOW, blocked: (t) => /acme/i.test(t) });
  assert.deepEqual(r.actions, [
    { kind: "peca3d_ajustar", id: "p1", titulo: "Suporte de celular", quando: "22/11", pedido: "2 mm mais alto" },
    { kind: "peca3d_ajustar", id: "p1", titulo: "Suporte de celular", quando: "22/11", pedido: "bordas arredondadas" },
  ]);
  assert.ok(!JSON.stringify(r).includes("SEGREDO"));
  const off = fakeDb({ pecas_3d: [{ id: "p1", titulo: "Gancho", updated_at: "2026-11-23T13:00:00.000Z", user_id: U }] });
  assert.deepEqual((await resolveAcoes(off, U, [{ tipo: "peca3d_ajustar", busca: null, pedido: "mais alto" }], { goals: true, finance: true, now: NOW })).actions, []);
  assert.equal(off.calls.length, 0);
});

test("teto por categoria: nome padrão, valor anterior só da própria pessoa; tirar sem teto vira aviso; Financeiro desligado não lê", async () => {
  const tdb = fakeDb({ fin_tetos: [{ categoria: "Restaurantes", valor: 600, user_id: U }, { categoria: "Lazer", valor: 99, user_id: "outra" }] });
  const r = await resolveAcoes(tdb, U, [
    { tipo: "teto_definir", categoria: "restaurante", valor: 800 },
    { tipo: "teto_definir", categoria: "lazer", valor: 300 },
    { tipo: "teto_definir", categoria: "lazer", valor: null },
  ], { goals: true, finance: true, now: NOW });
  assert.deepEqual(r.actions, [
    { kind: "teto", categoria: "Restaurantes", valor: 800, anterior: 600 },
    { kind: "teto", categoria: "Lazer", valor: 300, anterior: null },
  ]);
  assert.equal(r.misses.length, 1);
  assert.ok(tdb.calls.every((c) => c.filters.some(([k, v]) => k === "user_id" && v === U)));
  const off = fakeDb({ fin_tetos: [] });
  assert.deepEqual((await resolveAcoes(off, U, [{ tipo: "teto_definir", categoria: "Lazer", valor: 1 }], { goals: true, finance: false, now: NOW })).actions, []);
  assert.equal(off.calls.length, 0);
});

const dbAg = fakeDb({
  agents: [
    { id: 1, name: "Mentor de estudos", area: "Estudos", instructions: "Explique com exemplos.", active: true, user_id: U },
    { id: 2, name: "Casa e contas", area: "Finanças", instructions: "", active: false, user_id: U },
    { id: 9, name: "Agente secreto", area: "Pessoal", instructions: "x", active: true, user_id: "outra" },
  ],
});
test("agentes: criar e editar só entre os da própria pessoa; sem mudança, repetido e área inválida avisam", async () => {
  const r = await resolveAcoes(dbAg, U, [
    { tipo: "agente_criar", nome: "Treino", area: "saúde", instrucoes: "Seja direto." },
    { tipo: "agente_editar", agente: "mentor", nome: null, area: "Trabalho", instrucoes: null, ativo: null },
    { tipo: "agente_editar", agente: "casa e contas", nome: null, area: null, instrucoes: null, ativo: true },
  ], { goals: true, finance: true, now: NOW });
  assert.deepEqual(r.actions, [
    { kind: "agente_novo", nome: "Treino", area: "Saúde", instrucoes: "Seja direto." },
    { kind: "agente_editar", id: 1, nome: "Mentor de estudos", mudancas: { area: "Trabalho" } },
    { kind: "agente_editar", id: 2, nome: "Casa e contas", mudancas: { ativo: true } },
  ]);
  assert.ok(dbAg.calls.every((c) => c.filters.some(([k, v]) => k === "user_id" && v === U)), "toda leitura filtra por user_id");
  const m = await resolveAcoes(dbAg, U, [
    { tipo: "agente_editar", agente: "agente secreto", nome: "Meu", area: null, instrucoes: null, ativo: null },
    { tipo: "agente_editar", agente: "mentor", nome: null, area: null, instrucoes: "Explique com exemplos.", ativo: true },
    { tipo: "agente_criar", nome: "mentor DE estudos", area: null, instrucoes: null },
    { tipo: "agente_editar", agente: "casa e contas", nome: null, area: "Astronomia", instrucoes: null, ativo: null },
  ], { goals: true, finance: true, now: NOW });
  assert.deepEqual(m.actions, []);
  assert.equal(m.misses.length, 3, "o resolvedor mostra no máximo 3 avisos");
  const b = await resolveAcoes(dbAg, U, [{ tipo: "agente_criar", nome: "Acme", area: null, instrucoes: null }, { tipo: "agente_editar", agente: "mentor", nome: null, area: null, instrucoes: "para a Acme", ativo: null }], { goals: true, finance: true, now: NOW, blocked: (t) => /acme/i.test(t) });
  assert.deepEqual(b.actions, []);
});

test("agentes: ferramentas e teto viram só a mudança real; agente de outra pessoa não", async () => {
  const db = fakeDb({ agents: [
    { id: 1, name: "Mentor", area: "Estudos", instructions: "", active: true, user_id: U, ferramentas: ["agenda", "email", "tarefas", "acoes"], teto_mensal_usd: "5.00" },
    { id: 9, name: "Secreto", area: "Pessoal", instructions: "", active: true, user_id: "outra", ferramentas: [], teto_mensal_usd: null },
  ] });
  const base = { nome: null, area: null, instrucoes: null, ativo: null } as const;
  const r = await resolveAcoes(db, U, [
    { tipo: "agente_editar", agente: "mentor", ...base, bloquear: ["email"], liberar: ["financas"], teto: 10 },
  ], { goals: true, finance: true, now: NOW });
  assert.deepEqual(r.actions, [{ kind: "agente_editar", id: 1, nome: "Mentor", mudancas: { ferramentas: ["agenda", "tarefas", "financas", "acoes"], teto: 10 } }]);
  const s = await resolveAcoes(db, U, [{ tipo: "agente_editar", agente: "mentor", ...base, teto: 0 }], { goals: true, finance: true, now: NOW });
  assert.deepEqual(s.actions[0], { kind: "agente_editar", id: 1, nome: "Mentor", mudancas: { teto: null } }, "0 tira o teto próprio");
  const igual = await resolveAcoes(db, U, [{ tipo: "agente_editar", agente: "mentor", ...base, liberar: ["agenda"], teto: 5 }], { goals: true, finance: true, now: NOW });
  assert.deepEqual(igual.actions, []);
  assert.match(igual.misses[0], /já está assim/);
  const outro = await resolveAcoes(db, U, [{ tipo: "agente_editar", agente: "secreto", ...base, liberar: ["financas"] }], { goals: true, finance: true, now: NOW });
  assert.deepEqual(outro.actions, []);
});

test("percepções: recalculadas no servidor só com dados da própria pessoa; já respondida ou ausente vira aviso; dia cheio só ignora", async () => {
  const pdb = fakeDb({
    tasks: [
      { title: "Pagar boleto", due_date: "2026-11-20", priority: 2, status: "open", user_id: U },
      { title: "SEGREDO-B tarefa", due_date: "2026-11-01", priority: 2, status: "open", user_id: "outra" },
    ],
    insight_respostas: [{ tipo: "email", decisao: "ignorada", dia: "2026-11-22", user_id: U }, { tipo: "atrasadas", decisao: "ignorada", dia: "2026-11-22", user_id: "outra" }],
  });
  const ev = (title: string, s: string, e: string) => ({ id: title, title, start: `2026-11-22T${s}:00-03:00`, end: `2026-11-22T${e}:00-03:00`, allDay: false, meet: false, declined: false });
  const calendar = async () => [ev("Dentista", "16:00", "17:00"), ev("Reunião", "16:30", "17:30")];
  const inbox = async () => [{ from: "Banco", subject: "Fatura", snippet: "", date: "2026-11-20T10:00:00-03:00", important: true }];
  const r = await resolveAcoes(pdb, U, [
    { tipo: "percepcao", percepcao: "atrasadas", decisao: "aceitar" },
    { tipo: "percepcao", percepcao: "conflito", decisao: "ignorar" },
    { tipo: "percepcao", percepcao: "email", decisao: "aceitar" },
    { tipo: "percepcao", percepcao: "cheio", decisao: "aceitar" },
  ], { goals: true, finance: true, now: NOW, calendar, inbox });
  assert.deepEqual(r.actions.map((a) => a.kind === "percepcao" && [a.tipo, a.decisao, a.rotulo]), [["atrasadas", "aceita", "Passar para hoje"], ["conflito", "ignorada", "Ver na agenda"]]);
  const t = r.actions[0]!;
  assert.ok(t.kind === "percepcao" && /Pagar boleto/.test(t.texto) && !/SEGREDO-B/.test(t.texto));
  assert.deepEqual(r.misses, ["Não há esse aviso entre as percepções de hoje (ou você já respondeu)."], "e-mail já respondido hoje e dia cheio ausente (avisos iguais aparecem uma vez)");
  assert.ok(pdb.calls.filter((c) => c.table === "tasks" || c.table === "insight_respostas").every((c) => c.filters.some(([k, v]) => k === "user_id" && v === U)));
});
