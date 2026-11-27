import assert from "node:assert/strict";
import { test } from "node:test";
import { sinaisEnabled } from "./flag.ts";

test("interruptor dos sinais: ligado por padrão, =0 desliga", () => {
  assert.equal(sinaisEnabled({}), true);
  assert.equal(sinaisEnabled({ INVESTIMENTOS_SINAIS_ENABLED: "1" }), true);
  assert.equal(sinaisEnabled({ INVESTIMENTOS_SINAIS_ENABLED: "0" }), false);
  assert.equal(sinaisEnabled({ INVESTIMENTOS_SINAIS_ENABLED: " off " }), false);
});
