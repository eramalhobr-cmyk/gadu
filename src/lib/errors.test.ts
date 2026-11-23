import assert from "node:assert/strict";
import { test } from "node:test";
import { actionFailed, apiErrorMessage, chatErrorMessage, chatFailure, loadFailed, MSG, micErrorMessage, parseRetryCommand, RETRY_LABEL, spokenFailure } from "./errors.ts";

test("erros do chat em português, por situação", () => {
  assert.match(chatErrorMessage(0), /internet/);
  assert.match(chatErrorMessage(429), /Espere um pouco/);
  assert.match(chatErrorMessage(503), /instável/);
  assert.match(chatErrorMessage(504), /demorou/);
  assert.match(chatErrorMessage(413), /grande demais/);
  assert.match(chatErrorMessage(418), /guardada/);
  for (const s of [0, 400, 403, 413, 429, 500, 502, 503, 504, 418]) assert.doesNotMatch(chatErrorMessage(s), /error|failed|undefined/i);
});

test("erros do microfone: cancelar não avisa; desconhecido tem mensagem genérica", () => {
  assert.equal(micErrorMessage("aborted"), "");
  assert.match(micErrorMessage("no-speech"), /Não ouvi nada/);
  assert.match(micErrorMessage("not-allowed"), /bloqueado/);
  assert.match(micErrorMessage("service-not-allowed"), /Chrome/);
  assert.match(micErrorMessage("no-speech"), /Não ouvi/);
  assert.match(micErrorMessage("network"), /internet/);
  assert.equal(micErrorMessage("aborted"), "");
  assert.match(micErrorMessage("qualquer-coisa"), /microfone/);
});

test("mensagem da API: prefere a frase em português e ignora códigos internos", () => {
  assert.equal(apiErrorMessage({ error: "invalid", message: "Confira o nome." }), "Confira o nome.");
  assert.equal(apiErrorMessage({ error: "Este convite já foi usado." }), "Este convite já foi usado.");
  assert.equal(apiErrorMessage({ error: "unauthorized" }), "Não consegui concluir. Tente de novo.");
  assert.equal(apiErrorMessage(null, "Falhou."), "Falhou.");
});

test("sem internet: a frase diz o que houve e que a mensagem ficou guardada", () => {
  assert.equal(chatFailure(0).text, "Sem internet. Sua mensagem ficou guardada.");
  assert.equal(chatFailure(0).retry, true);
  assert.equal(RETRY_LABEL, "Tentar de novo");
});

test("tentar de novo só é oferecido quando repetir pode resolver", () => {
  for (const s of [0, 429, 500, 503, 504, 418]) assert.equal(chatFailure(s).retry, true, String(s));
  for (const s of [400, 403, 413, 422]) assert.equal(chatFailure(s).retry, false, String(s));
});

test("falado: a mesma frase e, se der para repetir, como repetir", () => {
  assert.match(spokenFailure(chatFailure(0)), /Sem internet\. Sua mensagem ficou guardada\. Para repetir, diga: tenta de novo\./);
  assert.equal(spokenFailure(chatFailure(413)), chatFailure(413).text);
});

test("toda mensagem do catálogo é curta, em português e diz o que fazer", () => {
  const todas = [...Object.values(MSG), loadFailed("as tarefas"), actionFailed("apagar"), ...[0, 400, 403, 413, 429, 500, 504, 418].map((s) => chatFailure(s).text), ...["service-not-allowed", "not-allowed", "audio-capture", "network", "no-speech", "language-not-supported", "x"].map(micErrorMessage)];
  for (const m of todas) {
    assert.ok(m.length <= 110, `longa: ${m}`);
    assert.match(m, /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/, m);
    assert.match(m, /[.!?]$/, m);
    assert.doesNotMatch(m, /error|failed|undefined|null|exception|HTTP|\b[45]\d\d\b/i, m);
    assert.match(m, /(tente|Tente|Confira|confira|Espere|Toque|toque|Use|Libere|Fale|fale|Divida|guardada|Entre|Escreva|escreva|Diga|ficou|pode ter|desligada|Não encontrei|Não ouvi|Não encontrei)/, `sem o que fazer: ${m}`);
  }
  assert.equal(loadFailed("as tarefas"), "Não consegui carregar as tarefas. Tente de novo.");
  assert.equal(actionFailed("apagar"), "Não consegui apagar. Tente de novo.");
});

test("parseRetryCommand: 'tenta de novo' falado ou escrito", () => {
  for (const t of ["tenta de novo", "Tentar de novo!", "gadu, tenta de novo por favor", "manda de novo", "de novo", "outra vez", "pode tentar de novo"]) assert.equal(parseRetryCommand(t), true, t);
  for (const t of ["tenta de novo amanhã", "me lembra de novo de pagar a luz", "novo", "sim", ""]) assert.equal(parseRetryCommand(t), false, t);
});
