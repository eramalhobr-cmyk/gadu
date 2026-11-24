import assert from "node:assert/strict";
import { test } from "node:test";
import { validAcao } from "./acoes.ts";
import { actionQuestion, describe } from "./chat-actions.ts";
import { parseNavIntent } from "./nav-intent.ts";

test("valida itens da lista e resolve o nome da tela para voz", () => {
  assert.deepEqual(validAcao({ tipo: "lista_compra_adicionar", nome: "   café  moído " }), { tipo: "lista_compra_adicionar", nome: "café moído" });
  assert.equal(validAcao({ tipo: "lista_compra_adicionar", nome: "  " }), null);
  assert.equal(validAcao({ tipo: "lista_compra_remover", nome: "a".repeat(121) }), null);
  assert.equal(validAcao({ tipo: "lista_compra_marcar", id: "42" }), null);
  assert.deepEqual(parseNavIntent("Abre minha lista de compras"), { tipo: "abrir", view: "lista_compras" });
});

test("cartões e perguntas faladas deixam explícita a ação na lista", () => {
  const add = { kind: "lista_compra_adicionar", nome: "café" } as const;
  const mark = { kind: "lista_compra_status", id: "1", nome: "café", comprado: true } as const;
  const remove = { kind: "lista_compra_remover", id: "1", nome: "café" } as const;
  assert.deepEqual([add, mark, remove].map((a) => describe(a).applied), [false, false, false]);
  assert.equal(describe(add).open?.view, "lista_compras");
  assert.equal(actionQuestion(add), "Adiciono café à Lista de compras?");
  assert.equal(actionQuestion(mark), "Marco café como comprado?");
  assert.equal(actionQuestion({ ...mark, comprado: false }), "Volto café para os pendentes?");
  assert.equal(actionQuestion(remove), "Removo café da Lista de compras?");
});
