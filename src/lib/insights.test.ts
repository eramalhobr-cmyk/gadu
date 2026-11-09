import { test } from "node:test";
import assert from "node:assert/strict";
import { insights } from "./insights.ts";

const now = Date.parse("2026-11-10T11:00:00-03:00");
const today = "2026-11-10";

test("conflito, janela livre e tarefas atrasadas", () => {
  const r = insights({
    now, today,
    events: [
      { title: "Corrida", start: "2026-11-10T12:00:00-03:00", end: "2026-11-10T13:00:00-03:00", allDay: false },
      { title: "Almoço", start: "2026-11-10T12:30:00-03:00", end: "2026-11-10T13:30:00-03:00", allDay: false },
    ],
    tasks: [{ title: "Pagar IPVA", due_date: "2026-11-07", priority: 1 }, { title: "Ler", due_date: null, priority: 2 }],
    mails: [{ from: "Escola", subject: "Reunião de pais", date: "Sun, 09 Nov 2026 08:00:00 -0300", important: true }],
  });
  const kinds = r.map((x) => x.kind);
  assert.deepEqual(kinds, ["conflito", "livre", "atrasadas", "email"]);
  assert.match(r[0].text, /12:30/);
  assert.match(r[1].text, /13:30 às 18:00/);
  assert.match(r[2].text, /há 3 dias: "Pagar IPVA"/);
});

test("dia sem nada: só a janela livre", () => {
  const r = insights({ now, today, events: [], tasks: [], mails: [] });
  assert.equal(r.length, 1);
  assert.equal(r[0].kind, "livre");
});
