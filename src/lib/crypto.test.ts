import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { open, seal } from "./crypto.ts";

test("token criptografado abre só para o dono", () => {
  const k = randomBytes(32).toString("base64");
  const s = seal("token-de-teste", "pessoa-a", k);
  assert.notEqual(s.includes("token-de-teste"), true);
  assert.equal(open(s, "pessoa-a", k), "token-de-teste");
  assert.throws(() => open(s, "pessoa-b", k));
  assert.throws(() => open(s, "pessoa-a", randomBytes(32).toString("base64")));
});
