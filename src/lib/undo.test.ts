import test from "node:test";
import assert from "node:assert/strict";
import { failed, parseUndoCommand, UndoController, UNDO_MS, UNDO_TEXT, NOTICE_MS } from "./undo.ts";

/** Relógio falso: guarda o que foi agendado e deixa "passar o tempo". */
function fake() {
  const jobs = new Map<number, { fn: () => void; ms: number }>();
  let n = 0;
  return {
    timers: { set: (fn: () => void, ms: number) => { jobs.set(++n, { fn, ms }); return n; }, clear: (id: unknown) => { jobs.delete(id as number); } },
    fire: () => { const all = [...jobs.entries()]; jobs.clear(); all.forEach(([, j]) => j.fn()); },
    pending: () => [...jobs.values()].map((j) => j.ms),
  };
}

test("mostra o aviso com Desfazer e some depois do tempo", () => {
  const f = fake(); const c = new UndoController(f.timers);
  c.show({ text: "Feito.", revert: async () => ({}) });
  assert.deepEqual(c.getView(), { text: "Feito.", undoable: true });
  assert.equal(c.active, true);
  assert.deepEqual(f.pending(), [UNDO_MS]);
  f.fire();
  assert.equal(c.getView(), null);
  assert.equal(c.active, false);
});

test("um aviso novo troca o anterior (só um à vista) e reinicia o tempo", () => {
  const f = fake(); const c = new UndoController(f.timers);
  c.show({ text: "A", revert: async () => ({}) });
  c.show({ text: "B", revert: async () => ({}) });
  assert.equal(c.getView()?.text, "B");
  assert.equal(f.pending().length, 1);
});

test("undo roda o revert uma vez e confirma", async () => {
  const f = fake(); const c = new UndoController(f.timers);
  let n = 0;
  c.show({ text: "Feito.", revert: async () => { n++; return { error: null }; } });
  assert.equal(await c.undo(), true);
  assert.equal(n, 1);
  assert.deepEqual(c.getView(), { text: UNDO_TEXT.undone, undoable: false });
  assert.deepEqual(f.pending(), [NOTICE_MS]);
  assert.equal(await c.undo(), false); // já foi: nada para desfazer
  assert.equal(n, 1);
  assert.equal(c.getView()?.text, UNDO_TEXT.nothing);
});

test("revert que falha (erro do Supabase, ok:false ou exceção) avisa e não diz 'Desfeito'", async () => {
  for (const bad of [async () => ({ error: { message: "x" } }), async () => ({ ok: false }), async () => { throw new Error("rede"); }]) {
    const c = new UndoController(fake().timers);
    c.show({ text: "Feito.", revert: bad });
    assert.equal(await c.undo(), false);
    assert.equal(c.getView()?.text, UNDO_TEXT.failUndo);
    assert.equal(c.getView()?.undoable, false);
  }
});

test("notify mostra aviso sem botão e não deixa nada para desfazer", () => {
  const c = new UndoController(fake().timers);
  c.show({ text: "Feito.", revert: async () => ({}) });
  c.notify(UNDO_TEXT.failSave);
  assert.deepEqual(c.getView(), { text: UNDO_TEXT.failSave, undoable: false });
  assert.equal(c.active, false);
});

test("quem assina é avisado de cada mudança", () => {
  const c = new UndoController(fake().timers);
  let calls = 0;
  const off = c.subscribe(() => { calls++; });
  c.show({ text: "A", revert: async () => ({}) });
  c.dismiss();
  off();
  c.show({ text: "B", revert: async () => ({}) });
  assert.equal(calls, 2);
});

test("failed reconhece erro do Supabase e ok:false", () => {
  assert.equal(failed({ error: { message: "x" } }), true);
  assert.equal(failed({ ok: false }), true);
  assert.equal(failed({ error: null }), false);
  assert.equal(failed({ ok: true }), false);
  assert.equal(failed(undefined), false);
});

test("parseUndoCommand: 'desfaz' falado ou escrito", () => {
  for (const t of ["desfaz", "Desfazer", "desfaz isso!", "Desfaz a última", "pode desfazer", "gadu, desfaz isso por favor", "volta atrás", "foi sem querer"]) assert.equal(parseUndoCommand(t), true, t);
  for (const t of ["desfaz a tarefa de ontem e cria outra", "quero desfazer a conta do mês", "feito", "me lembra de desfazer a mala", ""]) assert.equal(parseUndoCommand(t), false, t);
});
