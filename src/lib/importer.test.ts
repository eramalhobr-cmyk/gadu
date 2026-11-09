import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanItem, looksLikeList, parseImport } from "./importer.ts";

test("importa lista com marcadores e numeração, sem repetir", () => {
  const items = parseImport("# Sobre mim\n- Gosta de café sem açúcar\n2) Corre de manhã três vezes por semana\n* gosta de café sem açúcar\nPreferências:\n");
  assert.deepEqual(items, ["Gosta de café sem açúcar", "Corre de manhã três vezes por semana"]);
});

test("importa JSON de outras IAs", () => {
  const items = parseImport(JSON.stringify([{ content: "Prefere respostas curtas e diretas" }, { memory: "Tem um filho pequeno chamado Teo" }, "Mora em uma cidade litorânea"]));
  assert.equal(items.length, 3);
  assert.equal(items[1], "Tem um filho pequeno chamado Teo");
});

test("limpa item e reconhece texto livre", () => {
  assert.equal(cleanItem("  - **Lê** antes de dormir "), "Lê antes de dormir");
  assert.equal(looksLikeList("um parágrafo só, sem quebra de linha nenhuma"), false);
  assert.equal(looksLikeList("- item um aqui\n- item dois aqui"), true);
});

test("texto falado sem marcação, links e símbolos", async () => {
  const { speakable } = await import("./speech.ts");
  assert.equal(speakable("**Pronto!** Veja https://x.com/a 🙂"), "Pronto! Veja link");
  assert.equal(speakable("Custa R$ 50 e subiu 10%"), "Custa 50 reais e subiu 10 por cento");
  assert.equal(speakable("café/chá em 08/11"), "café ou chá em 08/11");
});
