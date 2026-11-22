import assert from "node:assert/strict";
import { test } from "node:test";
import { item } from "./fixtures.ts";
import { idsParaMarcar } from "./pagamento.ts";

const itens = [
  item("cartao"), item("a", { cartao_id: "cartao" }), item("b", { cartao_id: "cartao" }), item("solta"),
  item("sal", { tipo: "receita" }), item("prev", { segue_id: "sal" }),
];
const set = (x: string[] | null) => new Set(x);

test("marcar o cartão marca as assinaturas vinculadas", () => assert.deepEqual(set(idsParaMarcar(itens, "cartao")), new Set(["cartao", "a", "b"])));
test("marcar uma assinatura sozinha marca o cartão (e todas)", () => assert.deepEqual(set(idsParaMarcar(itens, "a")), new Set(["cartao", "a", "b"])));
test("item solto muda sozinho", () => assert.deepEqual(idsParaMarcar(itens, "solta"), ["solta"]));
test("receita marca quem segue ela; quem segue marcado sozinho muda só ele", () => {
  assert.deepEqual(set(idsParaMarcar(itens, "sal")), new Set(["sal", "prev"]));
  assert.deepEqual(idsParaMarcar(itens, "prev"), ["prev"]);
});
test("item desconhecido: null", () => assert.equal(idsParaMarcar(itens, "nao-existe"), null));
test("cartao_id apontando para item que não existe mais: age só sobre o item", () => assert.deepEqual(idsParaMarcar([item("x", { cartao_id: "sumiu" })], "x"), ["x"]));
