import { test } from "node:test";
import assert from "node:assert/strict";
import { formatEvents, formatMails, googleIntent } from "./google-format.ts";

test("intenção: começar o dia busca agenda e e-mail", () => {
  assert.deepEqual(googleIntent("Começar o dia"), { agenda: true, email: true, week: false });
  assert.equal(googleIntent("tenho reunião amanhã?").agenda, true);
  assert.equal(googleIntent("como está minha semana").week, true);
  assert.deepEqual(googleIntent("me conte uma piada"), { agenda: false, email: false, week: false });
});

test("agenda agrupada por dia, sem eventos recusados", () => {
  const txt = formatEvents([
    { title: "Corrida", start: "2026-11-10T09:00:00-03:00", end: "2026-11-10T10:00:00-03:00", allDay: false, meet: false, declined: false },
    { title: "Recusado", start: "2026-11-10T11:00:00-03:00", end: "2026-11-10T12:00:00-03:00", allDay: false, meet: true, declined: true },
  ]);
  assert.match(txt, /09:00–10:00 Corrida/);
  assert.doesNotMatch(txt, /Recusado/);
});

test("e-mail reprovado pela privacidade vira omitido", () => {
  const txt = formatMails(
    [{ from: "Loja", subject: "Seu pedido", snippet: "saiu para entrega", date: "", important: true }, { from: "Banco", subject: "Senha", snippet: "x", date: "", important: false }],
    (t) => /senha/i.test(t),
  );
  assert.match(txt, /\[importante\] De Loja/);
  assert.match(txt, /omitido/);
});
