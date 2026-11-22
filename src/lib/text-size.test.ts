import assert from "node:assert/strict";
import { test } from "node:test";
import { parseTextSize, TEXT_SIZES } from "./text-size.ts";

test("tamanho do texto: aceita só 100, 115 e 130; o resto vira normal", () => {
  assert.equal(parseTextSize("115"), "115");
  assert.equal(parseTextSize("130"), "130");
  assert.equal(parseTextSize("100"), "100");
  assert.equal(parseTextSize("200"), "100");
  assert.equal(parseTextSize(undefined), "100");
  assert.equal(parseTextSize("<script>"), "100");
});
test("tamanho do texto: três opções em ordem", () => {
  assert.deepEqual(TEXT_SIZES.map((t) => t.id), ["100", "115", "130"]);
});
