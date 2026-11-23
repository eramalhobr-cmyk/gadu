import assert from "node:assert/strict";
import { test } from "node:test";
import { insights } from "./insights.ts";
import { ACEITAR, blocoFoco, pendentes, RespostaBody, tarefaDoEmail } from "./percepcoes.ts";

const NOW = Date.parse("2026-11-23T09:10:00-03:00");

test("percepções trazem o necessário para o Aceitar: janela livre com horário; e-mail único com remetente e assunto", () => {
  const l = insights({ events: [], tasks: [], mails: [{ from: "Banco <b@x.com>", subject: "Fatura", date: "2026-11-21T10:00:00-03:00", important: true }], now: NOW, today: "2026-11-23" });
  const livre = l.find((i) => i.kind === "livre")!;
  assert.equal(livre.ref?.inicio, new Date(NOW).toISOString());
  assert.equal(livre.ref?.fim, "2026-11-23T21:00:00.000Z");
  assert.deepEqual(l.find((i) => i.kind === "email")!.ref, { from: "Banco <b@x.com>", subject: "Fatura" });
});

test("respondidas hoje somem; Aceitar só onde faz sentido (dia cheio é só aviso)", () => {
  const l = [{ kind: "atrasadas" as const, text: "a" }, { kind: "email" as const, text: "b" }, { kind: "cheio" as const, text: "c" }];
  assert.deepEqual(pendentes(l, [{ tipo: "email", decisao: "ignorada" }]).map((i) => i.kind), ["atrasadas", "cheio"]);
  assert.equal(ACEITAR.cheio, null);
  assert.equal(ACEITAR.atrasadas?.rotulo, "Passar para hoje");
});

test("tarefa do e-mail: assunto e remetente limpos, até 200 caracteres; sem assunto, texto genérico", () => {
  assert.equal(tarefaDoEmail({ from: "\"Banco\" <b@x.com>", subject: " Fatura " }), "Responder e-mail: Fatura (Banco)");
  assert.equal(tarefaDoEmail(undefined, 3), "Responder 3 e-mails importantes");
  assert.equal(tarefaDoEmail({ subject: "x".repeat(400) }).length, 200);
});

test("bloco de foco: dentro da janela, a partir de agora, até 2 h; janela curta ou inválida não reserva", () => {
  const b = blocoFoco({ inicio: "2026-11-23T12:00:00.000Z", fim: "2026-11-23T17:00:00.000Z" }, NOW);
  assert.deepEqual(b, { start: "2026-11-23T12:10:00.000Z", end: "2026-11-23T14:10:00.000Z" });
  assert.equal(blocoFoco({ inicio: "2026-11-23T12:00:00.000Z", fim: "2026-11-23T12:20:00.000Z" }, NOW), null);
  assert.equal(blocoFoco({}, NOW), null);
});

test("corpo da resposta: tipo e decisão conhecidos, campo extra recusado", () => {
  assert.ok(RespostaBody.safeParse({ tipo: "email", decisao: "ignorada" }).success);
  assert.equal(RespostaBody.safeParse({ tipo: "email", decisao: "talvez" }).success, false);
  assert.equal(RespostaBody.safeParse({ tipo: "email", decisao: "aceita", user_id: "x" }).success, false);
});
