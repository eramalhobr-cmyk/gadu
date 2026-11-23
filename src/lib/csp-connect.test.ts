import { test } from "node:test";
import assert from "node:assert/strict";
import { supabaseConnectSources } from "./csp-connect.ts";

test("produção (https): só https e wss do host", () => {
  assert.deepEqual(supabaseConnectSources("https://abc.supabase.co"), ["https://abc.supabase.co", "wss://abc.supabase.co"]);
});
test("Supabase local (http em loopback): também http e ws, com a porta", () => {
  for (const host of ["127.0.0.1", "localhost"]) {
    assert.deepEqual(supabaseConnectSources(`http://${host}:54321`), [`https://${host}:54321`, `wss://${host}:54321`, `http://${host}:54321`, `ws://${host}:54321`]);
  }
});
test("http fora da própria máquina nunca abre http", () => {
  for (const u of ["http://abc.supabase.co", "http://10.0.0.5:54321", "http://127.0.0.1.evil.test", "http://localhost.evil.test"]) {
    const s = supabaseConnectSources(u);
    assert.ok(s.every((x) => x.startsWith("https://") || x.startsWith("wss://")), u);
  }
});
test("sem endereço ou endereço inválido: nada", () => {
  assert.deepEqual(supabaseConnectSources(""), []);
  assert.deepEqual(supabaseConnectSources(undefined), []);
  assert.deepEqual(supabaseConnectSources("não é url"), []);
});
