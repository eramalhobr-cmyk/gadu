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
