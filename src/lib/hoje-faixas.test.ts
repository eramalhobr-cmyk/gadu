import { test } from "node:test";
import assert from "node:assert/strict";
import { dayProgress, laterToday, progressText, startOfTodayIso } from "./hoje-faixas.ts";

const now = new Date("2026-11-23T15:00:00-03:00");

test("laterToday: só o que vem hoje, sem o próximo já mostrado, em ordem", () => {
  const evs = [
    { title: "Reunião", start: "2026-11-23T16:00:00-03:00", end: "2026-11-23T17:00:00-03:00", allDay: false },
    { title: "Dentista", start: "2026-11-23T18:30:00-03:00", end: "2026-11-23T19:00:00-03:00", allDay: false },
    { title: "Feriado", start: "2026-11-23T00:00:00-03:00", end: "2026-11-24T00:00:00-03:00", allDay: true },
    { title: "Amanhã", start: "2026-11-24T09:00:00-03:00", end: "2026-11-24T10:00:00-03:00", allDay: false },
    { title: "Passou", start: "2026-11-23T10:00:00-03:00", end: "2026-11-23T11:00:00-03:00", allDay: false },
  ];
  const rems = [
    { text: "Ligar para a mãe", due_at: "2026-11-23T17:00:00-03:00", status: "pending" },
    { text: "Já avisado", due_at: "2026-11-23T17:30:00-03:00", status: "sent" },
    { text: "Tarde da noite", due_at: "2026-11-23T23:30:00-03:00", status: "pending" },
  ];
  const out = laterToday(evs, rems, now, "2026-11-23T16:00:00-03:00");
  assert.deepEqual(out.map((i) => i.title), ["Ligar para a mãe", "Dentista", "Tarde da noite"]);
  assert.equal(out[0].kind, "lembrete");
  assert.equal(laterToday(evs, rems, now, undefined, 2).length, 2);
});

test("startOfTodayIso usa o dia de Brasília", () => {
  assert.equal(startOfTodayIso(new Date("2026-11-24T01:30:00Z")), "2026-11-23T03:00:00.000Z");
});

test("progresso do dia", () => {
  assert.equal(dayProgress(0, 0), null);
  assert.equal(dayProgress(1, 3), 25);
  assert.match(progressText(0, 0), /Dia leve/);
  assert.match(progressText(2, 0), /Tudo feito: 2 tarefas/);
  assert.match(progressText(0, 1), /1 tarefa para hoje/);
  assert.equal(progressText(2, 2), "2 de 4 tarefas de hoje feitas.");
});
