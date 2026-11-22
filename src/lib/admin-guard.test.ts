import assert from "node:assert/strict";
import { test } from "node:test";
import { refuseBlock } from "./admin-guard.ts";

const ADMINS = ["dono@exemplo.com"];

test("não bloqueia a si mesmo", () => {
  assert.equal(refuseBlock("a", { id: "a", role: "member", email: "x@exemplo.com" }, ADMINS)?.status, 400);
});

test("não bloqueia outro admin, nem e-mail de ADMIN_EMAILS (sem diferenciar maiúsculas)", () => {
  assert.equal(refuseBlock("a", { id: "b", role: "admin", email: "outro@exemplo.com" }, ADMINS)?.status, 403);
  assert.equal(refuseBlock("a", { id: "b", role: "member", email: " Dono@Exemplo.com " }, ADMINS)?.status, 403);
});

test("pessoa comum pode ser bloqueada", () => {
  assert.equal(refuseBlock("a", { id: "b", role: "member", email: "x@exemplo.com" }, ADMINS), null);
  assert.equal(refuseBlock("a", { id: "b", role: null, email: null }, []), null);
});
