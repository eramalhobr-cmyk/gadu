import assert from "node:assert/strict";
import { test } from "node:test";
import { clientIp, keyHash } from "./client-ip.ts";

const h = (o: Record<string, string>) => new Headers(o);

test("IP: x-real-ip tem prioridade; senão o primeiro do x-forwarded-for", () => {
  assert.equal(clientIp(h({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "198.51.100.1" })), "203.0.113.9");
  assert.equal(clientIp(h({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" })), "198.51.100.1");
  assert.equal(clientIp(h({ "x-forwarded-for": "2001:DB8::1" })), "2001:db8::1");
});

test("IP: ausente ou inválido vira null", () => {
  assert.equal(clientIp(h({})), null);
  assert.equal(clientIp(h({ "x-forwarded-for": "não é ip" })), null);
  assert.equal(clientIp(h({ "x-real-ip": "<script>" })), null);
});

test("hash: estável, sem diferenciar maiúsculas, separado por escopo e sem o valor puro", () => {
  const a = keyHash("email", "Pessoa@Exemplo.com ");
  assert.equal(a, keyHash("email", "pessoa@exemplo.com"));
  assert.notEqual(a, keyHash("ip", "pessoa@exemplo.com"));
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.ok(!a.includes("pessoa"));
});
