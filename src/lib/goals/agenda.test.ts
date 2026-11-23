import assert from "node:assert/strict";
import { test } from "node:test";
import { planejarAgenda } from "./agenda.ts";

// Segunda-feira, 23/11/2026, 10:00 em Brasília (13:00 UTC).
const NOW = Date.parse("2026-11-23T13:00:00Z");
const dia = (iso: string) => new Date(Date.parse(iso) - 3 * 3_600_000).toISOString().slice(0, 10);
const hora = (iso: string) => new Date(Date.parse(iso) - 3 * 3_600_000).toISOString().slice(11, 16);
const base = { now: NOW, vezes: 3, semanas: 1, periodo: "manha" as const, duracaoMin: 60, ocupados: [] };

test("3 manhãs por semana: dias espalhados e primeiro horário da janela (07:00)", () => {
  const p = planejarAgenda(base);
  assert.deepEqual(p.blocos.map((b) => dia(b.inicio)), ["2026-11-24", "2026-11-26", "2026-11-28"]);
  assert.deepEqual(p.blocos.map((b) => hora(b.inicio)), ["07:00", "07:00", "07:00"]);
  assert.deepEqual([p.pulados, p.faltaram], [0, 0]);
  assert.ok(p.blocos.every((b) => Date.parse(b.fim) - Date.parse(b.inicio) === 3_600_000));
});

test("conflito: pula para o próximo horário livre do dia e, se o dia lota, para outro dia da semana", () => {
  const ev = (d: string, a: string, b: string) => ({ start: `${d}T${a}:00-03:00`, end: `${d}T${b}:00-03:00` });
  const p = planejarAgenda({ ...base, ocupados: [ev("2026-11-24", "07:00", "08:30"), ev("2026-11-26", "07:00", "12:00")] });
  assert.equal(hora(p.blocos.find((b) => dia(b.inicio) === "2026-11-24")!.inicio), "08:30", "mesmo dia, depois do compromisso");
  assert.ok(!p.blocos.some((b) => dia(b.inicio) === "2026-11-26"), "quinta lotada: não reserva nada nela");
  assert.equal(p.blocos.length, 3);
  assert.equal(p.pulados, 1);
  for (const b of p.blocos) assert.ok(!(Date.parse(b.inicio) < Date.parse("2026-11-26T15:00:00Z") && Date.parse(b.fim) > Date.parse("2026-11-26T10:00:00Z")));
});

test("nunca reserva no passado nem em cima de compromisso; dia inteiro não bloqueia", () => {
  const p = planejarAgenda({ ...base, vezes: 7, ocupados: [{ start: "2026-11-25", end: "2026-11-26", allDay: true }] });
  assert.ok(p.blocos.every((b) => Date.parse(b.inicio) >= NOW + 30 * 60_000));
  assert.ok(p.blocos.some((b) => dia(b.inicio) === "2026-11-25"), "evento de dia inteiro não impede");
  assert.equal(p.blocos.length + p.faltaram, 7);
});

test("quando não cabe, conta o que faltou (sem inventar horário)", () => {
  const tudo = Array.from({ length: 8 }, (_, i) => ({ start: `2026-11-${String(23 + i).padStart(2, "0")}T00:00:00-03:00`, end: `2026-11-${String(24 + i).padStart(2, "0")}T00:00:00-03:00` }));
  const p = planejarAgenda({ ...base, ocupados: tudo });
  assert.deepEqual([p.blocos.length, p.faltaram], [0, 3]);
});

test("várias semanas, limites e períodos", () => {
  const p = planejarAgenda({ ...base, vezes: 2, semanas: 3, periodo: "noite", duracaoMin: 45 });
  assert.equal(p.blocos.length, 6);
  assert.ok(p.blocos.every((b) => hora(b.inicio) >= "19:00" && hora(b.fim) <= "22:00"));
  assert.ok(planejarAgenda({ ...base, vezes: 7, semanas: 6 }).blocos.length <= 20, "teto de 20 blocos");
  assert.equal(planejarAgenda({ ...base, periodo: "tarde" }).blocos[0] && hora(planejarAgenda({ ...base, periodo: "tarde" }).blocos[0].inicio), "13:00");
  const dup = planejarAgenda({ ...base, vezes: 3, semanas: 2 }).blocos.map((b) => b.inicio);
  assert.equal(new Set(dup).size, dup.length, "sem blocos repetidos");
});
