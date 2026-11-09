import { test } from "node:test";
import assert from "node:assert/strict";
import { briefingText, parseTime, spNow } from "./briefing.ts";

test("texto da manhã com agenda, e-mails e lembretes", () => {
  const r = briefingText({ name: "Ana", tasks: 3, events: [{ title: "Corrida", start: "2026-11-10T09:00:00-03:00", allDay: false }, { title: "Feriado", start: "2026-11-10", allDay: true }], mails: 5, important: 2, reminders: 1 });
  assert.equal(r.title, "Bom dia, Ana!");
  assert.match(r.body, /2 compromissos hoje, o primeiro às 09:00 \(Corrida\)/);
  assert.match(r.body, /2 e-mails importantes/);
  assert.match(r.body, /1 lembrete para hoje/);
  assert.match(r.body, /3 tarefas vencem até hoje/);
});

test("sem Google: só lembretes e convite", () => {
  const r = briefingText({ name: "", events: null, mails: null, important: null, reminders: 0 });
  assert.equal(r.body, "Toque para começar o dia.");
});

test("horário de Brasília e hora do briefing", () => {
  const s = spNow(Date.parse("2026-11-10T10:05:00Z"));
  assert.equal(s.day, "2026-11-10");
  assert.equal(s.minutes, 7 * 60 + 5);
  assert.equal(s.start.toISOString(), "2026-11-10T03:00:00.000Z");
  assert.equal(parseTime("06:30"), 390);
  assert.equal(parseTime("25:00"), 420);
});
