import assert from "node:assert/strict";
import { test } from "node:test";
import { destinoDe, validAcao } from "../acoes.ts";
import { resolveAcoes } from "../acoes-resolver.ts";
import { actionQuestion, describe } from "../chat-actions.ts";

const A = "00000000-0000-4000-8000-0000000000a1";
type Row = Record<string, unknown>;

/** Banco simulado só para leitura da agenda (o resolvedor nunca grava). */
function db(config: Row | null, ajustes: Row[] = [], extra: Record<string, Row[]> = {}) {
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
  return { escritas, from: (t: string) => q(t === "filhos_agenda_config" ? (config ? [config] : []) : t === "filhos_agenda_ajustes" ? ajustes : extra[t] ?? []) };
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
  assert.match(r.misses[0], /fim de semana em que as crianças ficam com você/);

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

test("configurar por voz sem referência: cartão de configuração primeiro, trocas calculadas sobre ela", async () => {
  const d = db(null);
  const r = await resolveAcoes(d, A, [
    { tipo: "filhos_configurar", data: "2026-12-04", inicio: "sexta", fim: "segunda", feriado_segue: null },
    { tipo: "filhos_troca", data: "2026-11-28", comigo: false },
  ], opts);
  assert.equal(r.actions[0].kind, "filhos_config");
  assert.deepEqual(r.actions[0], { kind: "filhos_config", ancora: "2026-12-05", inicio: "sexta", fim: "segunda", feriadoSegue: true, anterior: null });
  assert.equal(r.actions.length, 1, "28/11 já é do outro responsável pela referência nova: sem troca");
  assert.deepEqual(d.escritas, []);
});

test("dezembro: dois seguidos com você, dois com o outro, depois volta a revezar → um cartão só e a mudança", async () => {
  // Referência 28/11 com você: 05/12 outro, 12/12 você, 19/12 outro, 26/12 você.
  const d = db(cfg);
  const r = await resolveAcoes(d, A, [
    { tipo: "filhos_troca", data: "2026-12-05", comigo: true },
    { tipo: "filhos_troca", data: "2026-12-12", comigo: true },
    { tipo: "filhos_troca", data: "2026-12-19", comigo: false },
    { tipo: "filhos_troca", data: "2026-12-26", comigo: false },
    { tipo: "filhos_mudar", data: "2027-01-02", comigo: true },
  ], opts);
  assert.deepEqual(r.actions[0], { kind: "filhos_trocas", itens: [{ sabado: "2026-12-05", comigo: true }, { sabado: "2026-12-26", comigo: false }] }, "só os que mudam; os já certos ficam quietos");
  assert.deepEqual(r.actions[1], { kind: "filhos_mudar", sabado: "2027-01-02", comigo: true });
  assert.deepEqual(r.misses, []);
  const v = describe(r.actions[0]);
  assert.equal(v.title, "05/12: com você · 26/12: com o outro responsável");
  assert.match(actionQuestion(r.actions[0], new Date("2026-11-24T12:00:00-03:00")), /^Troco 2 fins de semana: sábado, dia 5, com você; sábado, dia 26, com o outro responsável\?$/);
});

test("mudar a referência existente e desfazer uma mudança de alternância", async () => {
  const d = db(cfg, [{ id: "r1", tipo: "recorrencia", data: "2027-01-02", comigo: true }]);
  let r = await resolveAcoes(d, A, [{ tipo: "filhos_configurar", data: "2026-12-06", inicio: null, fim: "segunda", feriado_segue: null }], opts);
  assert.deepEqual(r.actions[0], { kind: "filhos_config", ancora: "2026-12-05", inicio: "sexta", fim: "segunda", feriadoSegue: true, anterior: { ancora: "2026-11-28", inicio: "sexta", fim: "domingo", feriadoSegue: true } });
  r = await resolveAcoes(d, A, [{ tipo: "filhos_configurar", data: "2026-11-29", inicio: null, fim: null, feriado_segue: null }], opts);
  assert.match(r.misses[0], /já está assim/);
  r = await resolveAcoes(d, A, [{ tipo: "filhos_mudanca_remover", data: "2027-01-03" }], opts);
  assert.deepEqual(r.actions, [{ kind: "filhos_mudanca_remover", id: "r1", sabado: "2027-01-02", comigo: true }]);
});

test("apagar agente e termos bloqueados por voz", async () => {
  const d = db(null, [], { agents: [{ id: 7, name: "Mentor de estudos", area: "Estudos", instructions: "", active: true }], profiles: [{ settings: { blocked: ["Empresa X"] } }] });
  let r = await resolveAcoes(d, A, [{ tipo: "agente_apagar", agente: "mentor de estudos" }], opts);
  assert.deepEqual(r.actions, [{ kind: "agente_apagar", id: 7, nome: "Mentor de estudos" }]);
  assert.equal(describe(r.actions[0]).confirm, "Apagar");
  r = await resolveAcoes(d, A, [{ tipo: "termo_bloquear", termo: "Clínica" }, { tipo: "termo_desbloquear", termo: "empresa x" }], opts);
  assert.deepEqual(r.actions, [{ kind: "termo", termo: "Clínica", bloquear: true }, { kind: "termo", termo: "Empresa X", bloquear: false }]);
  r = await resolveAcoes(d, A, [{ tipo: "termo_bloquear", termo: "EMPRESA X" }], opts);
  assert.match(r.misses[0], /já está bloqueado/);
  assert.deepEqual(validAcao({ tipo: "termo_bloquear", termo: "x" }), null, "termo de 1 letra não vale");
  assert.deepEqual(validAcao({ tipo: "filhos_configurar", data: "2026-12-04", inicio: "domingo" }), { tipo: "filhos_configurar", data: "2026-12-04", inicio: null, fim: null, feriado_segue: null });
  assert.deepEqual(d.escritas, []);
});
