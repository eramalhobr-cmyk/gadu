import assert from "node:assert/strict";
import { test } from "node:test";
import { apiErrorMessage, chatErrorMessage, micErrorMessage } from "./errors.ts";

test("erros do chat em português, por situação", () => {
  assert.match(chatErrorMessage(0), /internet/);
  assert.match(chatErrorMessage(429), /Espere um pouco/);
  assert.match(chatErrorMessage(503), /instável/);
  assert.match(chatErrorMessage(504), /demorou/);
  assert.match(chatErrorMessage(413), /grande demais/);
  assert.match(chatErrorMessage(418), /rascunho/);
  for (const s of [0, 400, 403, 413, 429, 500, 502, 503, 504, 418]) assert.doesNotMatch(chatErrorMessage(s), /error|failed|undefined/i);
});

test("erros do microfone: cancelar não avisa; desconhecido tem mensagem genérica", () => {
  assert.equal(micErrorMessage("aborted"), "");
  assert.match(micErrorMessage("no-speech"), /Não ouvi nada/);
  assert.match(micErrorMessage("not-allowed"), /bloqueado/);
  assert.match(micErrorMessage("qualquer-coisa"), /microfone/);
});

test("mensagem da API: prefere a frase em português e ignora códigos internos", () => {
  assert.equal(apiErrorMessage({ error: "invalid", message: "Confira o nome." }), "Confira o nome.");
  assert.equal(apiErrorMessage({ error: "Este convite já foi usado." }), "Este convite já foi usado.");
  assert.equal(apiErrorMessage({ error: "unauthorized" }), "Não consegui concluir. Tente de novo.");
  assert.equal(apiErrorMessage(null, "Falhou."), "Falhou.");
});
