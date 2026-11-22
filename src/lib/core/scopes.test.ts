import assert from "node:assert/strict";
import { test } from "node:test";
import { personalUserId, resolveScopes } from "./scopes.ts";

test("escopo é sempre e somente pessoal, com o user_id da sessão", () => {
  assert.deepEqual(resolveScopes({ userId: "user-a" }), [{ kind: "pessoal", userId: "user-a" }]);
});

test("o contexto enviado pelo cliente nunca altera o escopo", () => {
  const hints: unknown[] = [
    null, undefined, { module: "office", view: "agentes" }, { module: "pessoal", view: "tarefas" },
    { scopes: ["organizacao"], userId: "user-b", orgId: "org-1", kind: "cliente" },
    { userId: "user-b" }, "user-b", 42,
  ];
  for (const h of hints) assert.deepEqual(resolveScopes({ userId: "user-a" }, h), [{ kind: "pessoal", userId: "user-a" }]);
});

test("sem usuário na sessão não há escopo", () => {
  assert.throws(() => resolveScopes({ userId: "" }));
  assert.throws(() => personalUserId([]));
  assert.equal(personalUserId(resolveScopes({ userId: "user-a" })), "user-a");
});
