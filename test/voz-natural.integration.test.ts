import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const src = (p: string) => new URL(`../src/${p}`, import.meta.url).href;
const user = { id: "usuario-teste" };
const calls: string[] = [];
let session = true;
let allowed = true;
let codigo = 200;
mock.module(src("app/api/google/_auth.ts"), {
  namedExports: { signedIn: async () => session ? {
    user,
    supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { settings: { blocked: ["assunto bloqueado"] } } }) }) }) }) },
  } : null },
});
mock.module(src("lib/ai-budget.ts"), {
  namedExports: {
    reserveBudget: async (id: string, kind: string, cost: number) => {
      calls.push("reserva");
      assert.equal(id, user.id);
      assert.equal(kind, "speech");
      assert.ok(cost > 0);
      return allowed ? { ok: true, id: "r1" } : { ok: false, reason: "monthly" };
    },
    settleBudget: async (id: string, rid: string, kind: string) => {
      assert.deepEqual([id, rid, kind], [user.id, "r1", "speech"]);
      calls.push("liquida");
    },
  },
});
const route = await import(src("app/api/voz/falar/route.ts"));
const pedir = (texto: string) => route.POST(new Request("http://localhost/api/voz/falar", {
  method: "POST", body: JSON.stringify({ texto }),
}));
beforeEach(() => {
  calls.length = 0;
  process.env.SPEECH_ENABLED = "1";
  process.env.AI_GATEWAY_API_KEY = "credencial-ficticia";
  session = true;
  allowed = true;
  codigo = 200;
});

test("voz natural exige habilitação, sessão e filtros de privacidade", async () => {
  process.env.SPEECH_ENABLED = "0";
  assert.equal((await pedir("Oi")).status, 404);
  process.env.SPEECH_ENABLED = "1";
  session = false;
  assert.equal((await pedir("Oi")).status, 401);
  session = true;
  assert.equal((await pedir("assunto bloqueado")).status, 422);
  assert.deepEqual(calls, []);
});

test("reserva antes da síntese, retorna áudio sem cache e liquida o consumo", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url: string, req: RequestInit) => {
    calls.push("proveedor");
    assert.equal(JSON.parse(String(req.body)).text, "Oi");
    return Response.json({ audio: "SUQzAAAAAAAAAAA=" }, { status: codigo });
  });
  allowed = false;
  assert.equal((await pedir("Oi")).status, 402);
  assert.deepEqual(calls.splice(0), ["reserva"]);
  allowed = true;
  const r = await pedir("Oi");
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "audio/mpeg");
  assert.equal(r.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(calls.splice(0), ["reserva", "proveedor", "liquida"]);
  codigo = 503;
  assert.equal((await pedir("Oi")).status, 502);
  assert.deepEqual(calls, ["reserva", "proveedor", "liquida"]);
});
