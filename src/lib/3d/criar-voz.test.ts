import assert from "node:assert/strict";
import { test } from "node:test";
import { lerCriacao } from "./ajuste-voz.ts";
import { validAcao } from "../acoes.ts";
import { resolveAcoes } from "../acoes-resolver.ts";
import { actionQuestion, describe } from "../chat-actions.ts";

const A = "00000000-0000-4000-8000-0000000000a1";
const db = { from: () => { throw new Error("criar peça não lê o banco"); } };
const opts = { goals: true, finance: true, modeling3d: true };

test("peça nova pela conversa: pedido guardado vale uma vez, por 2 minutos", () => {
  const agora = Date.parse("2026-11-24T12:00:00Z");
  const raw = JSON.stringify({ pedido: "  Suporte de celular com 70 mm  ", t: agora - 1000 });
  assert.equal(lerCriacao(raw, agora), "Suporte de celular com 70 mm");
  assert.equal(lerCriacao(JSON.stringify({ pedido: "Suporte", t: agora - 3 * 60_000 }), agora), null, "velho");
  assert.equal(lerCriacao(JSON.stringify({ pedido: "ab", t: agora }), agora), null, "curto demais");
  assert.equal(lerCriacao("{quebrado", agora), null);
  assert.equal(lerCriacao(null, agora), null);
});

test("ação peca3d_criar: valida, respeita o interruptor do 3D e o termo bloqueado, e não lê o banco", async () => {
  assert.deepEqual(validAcao({ tipo: "peca3d_criar", pedido: "gancho de parede para chaves" }), { tipo: "peca3d_criar", pedido: "gancho de parede para chaves" });
  assert.equal(validAcao({ tipo: "peca3d_criar", pedido: "x" }), null);
  let r = await resolveAcoes(db, A, [{ tipo: "peca3d_criar", pedido: "gancho de parede para chaves" }], opts);
  assert.deepEqual(r.actions, [{ kind: "peca3d_criar", pedido: "gancho de parede para chaves" }]);
  r = await resolveAcoes(db, A, [{ tipo: "peca3d_criar", pedido: "gancho de parede" }], { ...opts, modeling3d: false });
  assert.equal(r.actions.length, 0);
  assert.match(r.misses[0], /desligado/);
  r = await resolveAcoes(db, A, [{ tipo: "peca3d_criar", pedido: "logo da Empresa X" }], { ...opts, blocked: (t: string) => t.includes("Empresa X") });
  assert.equal(r.actions.length, 0);
});

test("cartão e pergunta falada da peça nova", () => {
  const a = { kind: "peca3d_criar" as const, pedido: "Suporte de celular com 70 mm de largura" };
  const v = describe(a);
  assert.equal(v.confirm, "Criar peça");
  assert.match(v.detail ?? "", /cota do dia/);
  assert.equal(actionQuestion(a), "Crio no 3D: Suporte de celular com 70 mm de largura?");
});
