import assert from "node:assert/strict";
import { test } from "node:test";
import { destinoDe, validAcao } from "../acoes.ts";
import { resolveAcoes } from "../acoes-resolver.ts";
import { actionQuestion, describe } from "../chat-actions.ts";

const A = "00000000-0000-4000-8000-0000000000a1";
type Row = Record<string, unknown>;

/** Banco simulado só para leitura da agenda (o resolvedor nunca grava). */
function db(config: Row | null, ajustes: Row[] = []) {
  const escritas: string[] = [];
  const q = (rows: Row[]) => {
    const b = {
      select: () => b, eq: (c: string, v: unknown) => { if (c === "user_id") assert.equal(v, A, "sempre a pessoa da sessão"); return b; },
      order: () => b, limit: () => b,
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(ok),
      insert: () => { escritas.push("insert"); return b; }, update: () => { escritas.push("update"); return b; }, delete: () => { escritas.push("delete"); return b; },
    };
    return b;
  };
  return { escritas, from: (t: string) => q(t === "filhos_agenda_config" ? (config ? [config] : []) : ajustes) };
}
const cfg = { ancora: "2026-11-28", inicio: "sexta", fim: "domingo", feriado_segue: true };
const opts = { goals: true, finance: true, agendaFilhos: true };

test("validação: data real obrigatória; comigo opcional na troca e obrigatório na mudança", () => {
  assert.deepEqual(validAcao({ tipo: "filhos_troca", data: "2026-12-05" }), { tipo: "filhos_troca", data: "2026-12-05", comigo: null });
  assert.deepEqual(validAcao({ tipo: "filhos_troca", data: "2026-12-05", comigo: true }), { tipo: "filhos_troca", data: "2026-12-05", comigo: true });
  assert.equal(validAcao({ tipo: "filhos_troca", data: "2026-02-30" }), null);
  assert.equal(validAcao({ tipo: "filhos_mudar", data: "2027-01-02" }), null);
  assert.deepEqual(validAcao({ tipo: "filhos_troca_desfazer", data: "2026-12-06" }), { tipo: "filhos_troca_desfazer", data: "2026-12-06" });
  assert.equal(destinoDe("agenda de filhos"), "filhos");
});

test("resolvedor: sem referência avisa; troca sem comigo inverte; já no lugar avisa; nada é gravado", async () => {
  let d = db(null);
  let r = await resolveAcoes(d, A, [{ tipo: "filhos_troca", data: "2026-12-05", comigo: null }], opts);
  assert.equal(r.actions.length, 0);
  assert.match(r.misses[0], /referência/);

  d = db(cfg);
  r = await resolveAcoes(d, A, [{ tipo: "filhos_troca", data: "2026-12-06", comigo: null }], opts);
  assert.deepEqual(r.actions, [{ kind: "filhos_troca", sabado: "2026-12-05", comigo: true }], "05/12 é do outro; inverter = com você");

  r = await resolveAcoes(d, A, [{ tipo: "filhos_troca", data: "2026-11-28", comigo: true }], opts);
  assert.equal(r.actions.length, 0);
  assert.match(r.misses[0], /já está com você/);

  r = await resolveAcoes(d, A, [{ tipo: "filhos_mudar", data: "2027-01-02", comigo: true }], opts);
  assert.deepEqual(r.actions, [{ kind: "filhos_mudar", sabado: "2027-01-02", comigo: true }]);
  assert.deepEqual(d.escritas, []);
});

test("resolvedor: desfazer troca acha a troca daquele fim de semana; interruptor desligado ignora", async () => {
  const d = db(cfg, [{ id: "t1", tipo: "troca", data: "2026-12-05", comigo: true }]);
  let r = await resolveAcoes(d, A, [{ tipo: "filhos_troca_desfazer", data: "2026-12-04" }], opts);
  assert.deepEqual(r.actions, [{ kind: "filhos_troca_remover", id: "t1", sabado: "2026-12-05", comigo: true }]);
  r = await resolveAcoes(d, A, [{ tipo: "filhos_troca_desfazer", data: "2026-12-12" }], opts);
  assert.match(r.misses[0], /não tem troca/);
  r = await resolveAcoes(d, A, [{ tipo: "filhos_troca", data: "2026-12-12", comigo: false }, { tipo: "navegar", destino: "filhos" }], { ...opts, agendaFilhos: false });
  assert.equal(r.actions.length, 0);
  assert.match(r.misses[0], /desligado/);
});

test("cartão e pergunta falada", () => {
  const now = new Date("2026-11-24T12:00:00-03:00");
  const v = describe({ kind: "filhos_troca", sabado: "2026-12-05", comigo: true }, now);
  assert.equal(v.title, "Fim de semana de 05/12: fica com você");
  assert.equal(v.confirm, "Trocar");
  assert.equal(v.open?.view, "filhos");
  assert.match(actionQuestion({ kind: "filhos_troca", sabado: "2026-12-05", comigo: true }, now), /^Troco o fim de semana de sábado, dia 5, para ficar com você\?$/);
  assert.match(actionQuestion({ kind: "filhos_mudar", sabado: "2027-01-02", comigo: false }, now), /começando com o outro responsável\?$/);
  assert.match(describe({ kind: "filhos_mudar", sabado: "2027-01-02", comigo: false }, now).detail ?? "", /antes dessa data ficam como estavam/);
});
