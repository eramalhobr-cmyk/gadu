import assert from "node:assert/strict";
import { test } from "node:test";
import { confirmPrompt, confirmQuestion, norm, parseAnswer, resultLine, spokenDay, spokenTime } from "./voice-confirm.ts";

const NOW = new Date("2026-11-22T15:00:00-03:00"); // domingo

test("parseAnswer: sim e variações", () => {
  for (const t of ["Sim", "sim, pode", "Pode lançar", "isso mesmo", "Ok", "beleza!", "Confirmo", "pode criar", "Tá certo"]) assert.deepEqual(parseAnswer(t), { kind: "yes" }, t);
});
test("parseAnswer: não e variações", () => {
  for (const t of ["Não", "não, obrigado", "Cancela", "deixa pra lá", "esquece", "Descarta", "apaga"]) assert.deepEqual(parseAnswer(t), { kind: "no" }, t);
});
test("parseAnswer: troca vira mensagem nova", () => {
  assert.deepEqual(parseAnswer("muda para 60 reais"), { kind: "change", text: "muda para 60 reais" });
  assert.deepEqual(parseAnswer("Não, foi 60 reais"), { kind: "change", text: "Não, foi 60 reais" });
  assert.deepEqual(parseAnswer("na verdade é amanhã às 10"), { kind: "change", text: "na verdade é amanhã às 10" });
  assert.deepEqual(parseAnswer("troca para sexta"), { kind: "change", text: "troca para sexta" });
});
test("parseAnswer: o que não entende devolve null", () => {
  assert.equal(parseAnswer(""), null);
  assert.equal(parseAnswer("qual a previsão do tempo"), null);
  assert.equal(parseAnswer("simpático"), null);
});
test("norm tira acento e pontuação", () => {
  assert.equal(norm("  Não, É   isso! "), "nao e isso");
});
test("spokenDay e spokenTime", () => {
  assert.equal(spokenDay("2026-11-22", NOW), "hoje");
  assert.equal(spokenDay("2026-11-23", NOW), "amanhã");
  assert.equal(spokenDay("2026-11-21", NOW), "ontem");
  assert.equal(spokenDay("2026-11-27", NOW), "sexta, dia 27");
  assert.equal(spokenTime("2026-11-23T09:00:00-03:00"), "às 9h");
  assert.equal(spokenTime("2026-11-23T14:30:00-03:00"), "às 14h30");
});
test("perguntas por tipo", () => {
  assert.equal(confirmQuestion({ kind: "gasto", valor: 50, categoria: "Mercado", descricao: "", data: "2026-11-22" }, NOW), "Lanço o gasto de 50 reais em Mercado, hoje?");
  assert.equal(confirmQuestion({ kind: "gasto", valor: 1.5, categoria: "Transporte", descricao: "ônibus", data: "2026-11-21" }, NOW), "Lanço o gasto de 1 real e 50 centavos em Transporte, ônibus, ontem?");
  assert.equal(confirmQuestion({ kind: "meta", titulo: "Correr", acao: "registrar", valor: 5, unidade: "km" }, NOW), "Registro 5 km na meta Correr?");
  assert.equal(confirmQuestion({ kind: "meta", titulo: "Ler 10 livros", acao: "concluir", valor: null, unidade: null }, NOW), "Marco a meta Ler 10 livros como concluída?");
  assert.equal(confirmQuestion({ kind: "evento", title: "Dentista", start: "2026-11-23T10:00:00-03:00" }, NOW), "Crio na agenda: Dentista, amanhã às 10h?");
  assert.equal(confirmQuestion({ kind: "lembrete", text: "Ligar para a mãe", dueAt: "2026-11-22T20:00:00-03:00" }, NOW), "Anotei o lembrete Ligar para a mãe, hoje às 20h. Está certo?");
  assert.match(confirmPrompt({ kind: "evento", title: "X", start: "2026-11-23T10:00:00-03:00" }, NOW), /Diga sim ou não\.$/);
});
test("frases de resultado", () => {
  assert.equal(resultLine("gasto", "yes"), "Pronto, gasto lançado.");
  assert.equal(resultLine("lembrete", "no"), "Tudo bem, apaguei o lembrete.");
  assert.equal(resultLine("evento", "no"), "Tudo bem, descartei.");
  assert.match(resultLine("meta", "yes", false), /Não consegui/);
});

test("parseAnswer: sim com negação ou pausa não confirma (pergunta de novo)", () => {
  assert.equal(parseAnswer("claro que não"), null);
  assert.equal(parseAnswer("sim, espera"), null);
  assert.equal(parseAnswer("isso, mas não"), null);
  assert.deepEqual(parseAnswer("sim"), { kind: "yes" });
  assert.deepEqual(parseAnswer("pode lançar"), { kind: "yes" });
});

test("resultLine: falha fala o motivo e manda tocar em tentar de novo", () => {
  assert.match(resultLine("gasto", "yes", false, "Sem internet. Confira a conexão e tente de novo."), /^Sem internet\..*O cartão ficou na tela\. Toque em tentar de novo\.$/);
  assert.match(resultLine("gasto", "yes", false), /^Não consegui gravar\. O cartão ficou na tela/);
});
