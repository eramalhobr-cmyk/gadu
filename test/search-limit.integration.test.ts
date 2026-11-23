// Revisão de 23/11 (PR #22): /api/search só chama os embeddings pagos dentro do limite por pessoa; sem contador, não chama (fail closed).
import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const src = (p: string) => new URL(`../src/${p}`, import.meta.url).href;
let answer: () => Promise<{ data: unknown; error: unknown }> = async () => ({ data: { allowed: true }, error: null });
let adminThrows = false;
let embeds = 0;
let hits: { bucket: string; hash: string; limit: number }[] = [];

mock.module(src("lib/supabase/admin.ts"), {
  namedExports: {
    supabaseAdmin: () => {
      if (adminThrows) throw new Error("sem chave");
      return { rpc: (_n: string, a: { p_bucket: string; p_key_hash: string; p_limit: number }) => { hits.push({ bucket: a.p_bucket, hash: a.p_key_hash, limit: a.p_limit }); return answer(); } };
    },
  },
});
mock.module(src("lib/embeddings.ts"), {
  namedExports: {
    embeddingsAvailable: () => true,
    embed: async (t: string[]) => { embeds++; return t.map(() => [0.1]); },
    toVector: (v: number[]) => `[${v.join(",")}]`,
  },
});
mock.module(src("app/api/google/_auth.ts"), {
  namedExports: {
    signedIn: async () => ({ user: { id: "11111111-1111-1111-1111-111111111111" }, admin: false, supabase: { rpc: async () => ({ data: [{ kind: "memoria", ref_id: 1, content: "x", similarity: 0.9 }], error: null }) } }),
  },
});

const { GET } = await import(src("app/api/search/route.ts"));
const call = async () => (await GET(new Request("http://localhost/api/search?q=condominio"))).json();

beforeEach(() => { embeds = 0; hits = []; adminThrows = false; answer = async () => ({ data: { allowed: true }, error: null }); });

test("dentro do limite: chama embeddings e conta por pessoa (só hash)", async () => {
  const j = await call();
  assert.equal(j.semantic, true);
  assert.equal(embeds, 1);
  assert.equal(hits[0].bucket, "verify_email");
  assert.equal(hits[0].limit, 60);
  assert.ok(!hits[0].hash.includes("1111"), "só o hash vai para o banco");
});

test("acima do limite: não chama a IA paga", async () => {
  answer = async () => ({ data: { allowed: false, retry_after: 300 }, error: null });
  const j = await call();
  assert.equal(j.semantic, false);
  assert.equal(j.limited, true);
  assert.equal(embeds, 0);
});

test("contador indisponível: fail closed, sem IA", async () => {
  adminThrows = true;
  assert.equal((await call()).semantic, false);
  answer = async () => ({ data: null, error: { message: "fora" } });
  adminThrows = false;
  assert.equal((await call()).semantic, false);
  assert.equal(embeds, 0);
});

test("o balde usado pela busca existe no CHECK de private.rate_limits (o banco recusaria qualquer outro)", async () => {
  const { readFileSync } = await import("node:fs");
  const { SEARCH_BUCKET } = await import(src("lib/rate-limit.ts"));
  const sql = readFileSync(new URL("../supabase/migrations/20261122120001_seguranca_p1_aditiva.sql", import.meta.url), "utf8");
  const lista = /bucket text not null check \(bucket in \(([^)]*)\)\)/.exec(sql)?.[1] ?? "";
  const buckets = [...lista.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  assert.ok(buckets.length >= 8);
  assert.ok(buckets.includes(SEARCH_BUCKET), `${SEARCH_BUCKET} fora do CHECK`);
  await call();
  assert.ok(hits.every((h) => buckets.includes(h.bucket)));
});
