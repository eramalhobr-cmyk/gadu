import assert from "node:assert/strict";
import { test } from "node:test";
import { agruparLembretes, horarioFuturo, lerQuando, paraCampo, quandoTexto, situacaoTexto, sugestaoQuando, textoLembrete, type Lembrete } from "./lembretes.ts";
import { validAcao } from "./acoes.ts";
import { resolveAcoes } from "./acoes-resolver.ts";
import { actionQuestion, describe } from "./chat-actions.ts";
import { parseNavIntent, navSpoken } from "./nav-intent.ts";
import { MAIN_VIEWS, NAV_GROUPS, parseView, viewDef } from "./modules.ts";
import { sayHere } from "./o-que-dizer.ts";

// Quinta, 26/11/2026, 15:00 em Brasília.
const NOW = Date.parse("2026-11-26T15:00:00-03:00");
const L = (id: number, due: string, status: Lembrete["status"] = "pending"): Lembrete => ({ id, text: `Lembrete ${id}`, due_at: new Date(due).toISOString(), status, sent_at: null });

test("texto do lembrete: limpa espaços e recusa vazio, longo demais e caractere nulo", () => {
  assert.equal(textoLembrete("  pagar   a conta "), "pagar a conta");
  assert.equal(textoLembrete("   "), null);
  assert.equal(textoLembrete("a".repeat(301)), null);
  assert.equal(textoLembrete("a\0b"), null);
  assert.equal(textoLembrete(42), null);
});

test("horário do campo é lido como Brasília; data inexistente e formato estranho são recusados", () => {
  assert.equal(lerQuando("2026-11-27T09:00"), "2026-11-27T12:00:00.000Z");
  assert.equal(lerQuando("2026-11-27T09:00:00-03:00"), "2026-11-27T12:00:00.000Z");
  assert.equal(lerQuando("2026-11-27T12:00:00Z"), "2026-11-27T12:00:00.000Z");
  assert.equal(lerQuando("2026-02-31T09:00"), null);
  assert.equal(lerQuando("amanhã às 9"), null);
  assert.equal(lerQuando("2026-11-27"), null);
  assert.equal(paraCampo("2026-11-27T12:00:00.000Z"), "2026-11-27T09:00");
  assert.equal(paraCampo(lerQuando("2026-12-31T23:30")!), "2026-12-31T23:30");
});

test("sugestão é a próxima hora cheia com folga; horário novo precisa ser futuro", () => {
  assert.equal(sugestaoQuando(NOW), "2026-11-26T16:00");
  assert.equal(sugestaoQuando(Date.parse("2026-11-26T15:50:00-03:00")), "2026-11-26T17:00");
  assert.equal(horarioFuturo(new Date(NOW + 60_000).toISOString(), NOW), true);
  assert.equal(horarioFuturo(new Date(NOW + 10_000).toISOString(), NOW), false);
  assert.equal(horarioFuturo(new Date(NOW - 60_000).toISOString(), NOW), false);
  assert.equal(horarioFuturo(new Date(NOW + 800 * 86_400_000).toISOString(), NOW), false);
});

test("agrupa em próximos, atrasados e recentes, em ordem; apagados e antigos ficam de fora", () => {
  const rows = [
    L(1, "2026-11-28T09:00:00-03:00"),
    L(2, "2026-11-26T18:00:00-03:00"),
    L(3, "2026-11-26T10:00:00-03:00"),
    L(4, "2026-11-25T08:00:00-03:00"),
    L(5, "2026-11-26T09:00:00-03:00", "sent"),
    L(6, "2026-11-24T09:00:00-03:00", "done"),
    L(7, "2026-11-10T09:00:00-03:00", "done"),
    L(8, "2026-11-27T09:00:00-03:00", "cancelled"),
    { ...L(9, "2026-11-27T09:00:00-03:00"), due_at: "data ruim" },
  ];
  const g = agruparLembretes(rows, NOW);
  assert.deepEqual(g.proximos.map((r) => r.id), [2, 1]);
  assert.deepEqual(g.atrasados.map((r) => r.id), [4, 3]);
  assert.deepEqual(g.recentes.map((r) => r.id), [5, 6]);
});

test("datas em português e no fuso de Brasília", () => {
  assert.equal(quandoTexto("2026-11-26T21:30:00.000Z", NOW), "hoje 18:30");
  assert.equal(quandoTexto("2026-11-27T02:30:00.000Z", NOW), "hoje 23:30", "23h30 de Brasília ainda é hoje");
  assert.equal(quandoTexto("2026-11-27T12:00:00.000Z", NOW), "amanhã 09:00");
  assert.equal(quandoTexto("2026-11-25T12:00:00.000Z", NOW), "ontem 09:00");
  assert.match(quandoTexto("2026-12-04T12:00:00.000Z", NOW), /^sex 04\/12 09:00$/);
  assert.equal(situacaoTexto(L(1, "2026-11-26T10:00:00-03:00"), NOW), "Atrasado · hoje 10:00");
  assert.equal(situacaoTexto(L(1, "2026-11-26T10:00:00-03:00", "sent"), NOW), "Avisado · hoje 10:00");
  assert.equal(situacaoTexto(L(1, "2026-11-26T10:00:00-03:00", "done"), NOW), "Concluído · hoje 10:00");
  assert.equal(situacaoTexto(L(1, "2026-11-26T18:00:00-03:00"), NOW), "hoje 18:00");
});

test("catálogo e voz: a tela existe, está no menu e abre por voz", () => {
  assert.equal(viewDef("lembretes").label, "Lembretes");
  assert.ok(MAIN_VIEWS.includes("lembretes"));
  assert.ok(NAV_GROUPS.find((g) => g.id === "dia")?.views.includes("lembretes"));
  assert.equal(parseView("lembretes", false), "lembretes");
  for (const frase of ["abre os lembretes", "Abre meus lembretes", "vai para os lembretes"]) {
    assert.deepEqual(parseNavIntent(frase), { tipo: "abrir", view: "lembretes" }, frase);
  }
  assert.equal(navSpoken({ tipo: "abrir", view: "lembretes" }, "lembretes"), "Abrindo Lembretes.");
  assert.deepEqual(validAcao({ tipo: "navegar", destino: "lembretes" }), { tipo: "navegar", destino: "lembretes" });
  assert.equal(sayHere("lembretes").length, 4);
});

test("concluir lembrete pela conversa: valida, acha só os da pessoa e pede confirmação", async () => {
  assert.deepEqual(validAcao({ tipo: "lembrete_concluir", lembrete: "  conta de luz " }), { tipo: "lembrete_concluir", lembrete: "conta de luz" });
  assert.equal(validAcao({ tipo: "lembrete_concluir", lembrete: "  " }), null);
  const tabelas: Record<string, Record<string, unknown>[]> = {
    reminders: [
      { id: 1, text: "Pagar a conta de luz", due_at: "2026-11-26T12:00:00.000Z", status: "sent", user_id: "u1" },
      { id: 2, text: "Pagar a conta de água", due_at: "2026-11-27T12:00:00.000Z", status: "pending", user_id: "outra" },
    ],
  };
  const chamadas: [string, unknown][][] = [];
  const db = {
    from(table: string) {
      const f: [string, unknown][] = [];
      chamadas.push(f);
      const q = {
        select: () => q, order: () => q, limit: () => q,
        eq: (k: string, v: unknown) => { f.push([k, v]); return q; },
        in: (k: string, v: unknown[]) => { f.push([k, v]); return q; },
        then: (res: (v: unknown) => void) => res({ error: null, data: (tabelas[table] ?? []).filter((r) => f.every(([k, v]) => (Array.isArray(v) ? v.includes(r[k]) : r[k] === v))) }),
      };
      return q;
    },
  };
  const r = await resolveAcoes(db as never, "u1", [{ tipo: "lembrete_concluir", lembrete: "conta de luz" }, { tipo: "lembrete_concluir", lembrete: "conta de água" }], { goals: false, finance: false, now: NOW });
  assert.deepEqual(r.actions, [{ kind: "lembrete_ok", id: 1, text: "Pagar a conta de luz", dueAt: "2026-11-26T12:00:00.000Z" }]);
  assert.equal(r.misses.length, 1, "o lembrete de outra pessoa não é achado");
  assert.ok(chamadas.every((f) => f.some(([k, v]) => k === "user_id" && v === "u1")));
  const a = r.actions[0];
  const v = describe(a, new Date(NOW));
  assert.equal(v.applied, false, "nada é gravado antes do sim");
  assert.equal(v.open?.view, "lembretes");
  assert.equal(actionQuestion(a, new Date(NOW)), "Marco o lembrete Pagar a conta de luz como feito?");
  assert.equal(describe({ kind: "lembrete_off", id: 1, text: "x", dueAt: a.kind === "lembrete_ok" ? a.dueAt : "" }).open?.view, "lembretes");
});
