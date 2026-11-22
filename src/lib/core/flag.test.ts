import assert from "node:assert/strict";
import { test } from "node:test";
import { coreEnabled } from "./flag.ts";

test("CORE_MVP: ligado por padrão; só o desligamento explícito desliga", () => {
  assert.equal(coreEnabled({}), true);
  assert.equal(coreEnabled({ CORE_MVP: "" }), true);
  assert.equal(coreEnabled({ CORE_MVP: "1" }), true);
  assert.equal(coreEnabled({ CORE_MVP: "qualquer" }), true);
  for (const v of ["0", " 0 ", "false", "OFF"]) assert.equal(coreEnabled({ CORE_MVP: v }), false, v);
});
