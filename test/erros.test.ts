// UX-4 · erros claros: as mensagens vivem em src/lib/errors.ts; as telas não repetem a frase solta.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const dir = new URL("../src/components/", import.meta.url);
const arquivos = readdirSync(dir).filter((f) => f.endsWith(".tsx"));
const read = (n: string) => readFileSync(new URL(n, dir), "utf8");

test("nenhuma tela escreve à mão as frases de erro que o catálogo já tem", () => {
  for (const f of arquivos) {
    const src = read(f);
    assert.doesNotMatch(src, /"Não salvou\. Tente de novo\."/, `${f}: use MSG.save`);
    assert.doesNotMatch(src, /"Sem conexão\. Tente de novo\."/, `${f}: use MSG.offlineDo`);
    assert.doesNotMatch(src, /"Não consegui salvar\. Tente de novo\."/, `${f}: use MSG.save`);
    assert.doesNotMatch(src, /"Você está sem internet/, `${f}: use MSG.offline`);
  }
});

test("chat: o erro mostra Tentar de novo, guarda a mensagem e fala quando a pessoa usa voz", () => {
  const app = read("GaduApp.tsx");
  assert.match(app, /failChat\(chatFailure\(/, "erro do servidor passa pelo catálogo");
  assert.match(app, /failChat\(\{ text: MSG\.offline, retry: true \}/, "sem internet passa pelo catálogo");
  assert.match(app, /spokenFailure\(f\)/, "o erro é falado");
  assert.match(app, /setDraft\(message\);\s*\n\s*setMessages/, "a mensagem fica guardada no rascunho");
  assert.match(app, /parseRetryCommand\(message\)/, "'tenta de novo' falado");
  assert.match(app, /RETRY_LABEL/, "botão Tentar de novo");
  assert.match(read("Assistant.tsx"), /RETRY_LABEL/, "o painel também tem o botão");
});

test("cartão com erro vira Tentar de novo", () => {
  assert.match(read("ActionCard.tsx"), /state === "error" \? RETRY_LABEL/);
});
