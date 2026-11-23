import assert from "node:assert/strict";
import { test } from "node:test";
import { AJUSTE_3D_VALIDADE_MS, lerAjuste } from "./ajuste-voz.ts";

const ID = "3f2b1c9e-8d7a-4b6c-9e5f-1a2b3c4d5e6f";
const NOW = 1_800_000_000_000;
const raw = (o: unknown) => JSON.stringify(o);

test("lerAjuste: só a mesma peça, recente e com texto", () => {
  assert.equal(lerAjuste(raw({ id: ID, pedido: " 2 mm mais alto ", t: NOW - 1000 }), ID, NOW), "2 mm mais alto");
  assert.equal(lerAjuste(raw({ id: "outra", pedido: "2 mm mais alto", t: NOW }), ID, NOW), null, "outra peça");
  assert.equal(lerAjuste(raw({ id: ID, pedido: "2 mm mais alto", t: NOW - AJUSTE_3D_VALIDADE_MS - 1 }), ID, NOW), null, "velho");
  assert.equal(lerAjuste(raw({ id: ID, pedido: "ok", t: NOW }), ID, NOW), null, "curto");
  assert.equal(lerAjuste("{quebrado", ID, NOW), null);
  assert.equal(lerAjuste(null, ID, NOW), null);
  assert.equal(lerAjuste(raw({ id: ID, pedido: "x".repeat(5000), t: NOW }), ID, NOW)!.length, 800, "limite do pedido");
});
