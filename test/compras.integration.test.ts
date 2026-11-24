// Compras: rota /api/compras com Google e Supabase simulados (nenhuma chamada real, só dados sintéticos).
// Garante: exige sessão, respeita o interruptor, usa o token da própria pessoa, aplica os termos bloqueados,
// explica Google desconectado ou revogado e nunca grava nada.
import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const src = (p: string) => new URL(`../src/${p}`, import.meta.url).href;
const A = "00000000-0000-4000-8000-0000000000a1";

class GoogleError extends Error {
  kind: string;
  constructor(kind: string) { super(kind); this.kind = kind; }
}

let session: { supabase: unknown; user: { id: string }; admin: boolean } | null = null;
let tokenFor: string[] = [];
let googleFail: string | null = null;
let blocked: string[] = [];
let writes = 0;
let emails: Record<string, unknown>[] = [];

const supabase = {
  from: (t: string) => {
    assert.ok(t === "profiles" || t === "google_connections", "Compras só lê o perfil (termos bloqueados) e a conta Google conectada");
    return {
      select: () => ({ eq: (_c: string, v: string) => ({ maybeSingle: async () => ({ data: v !== A ? null : t === "profiles" ? { settings: { blocked } } : { google_email: "pessoa@exemplo.test" }, error: null }) }) }),
      insert: () => { writes++; return {}; },
      update: () => { writes++; return {}; },
    };
  },
};

mock.module(src("app/api/google/_auth.ts"), { namedExports: { signedIn: async () => session } });
mock.module(src("lib/google.ts"), {
  namedExports: {
    GoogleError,
    accessToken: async (_db: unknown, userId: string) => { tokenFor.push(userId); if (googleFail) throw new GoogleError(googleFail); return "token-sintetico"; },
    pedidosEmails: async (token: string) => { assert.equal(token, "token-sintetico"); return emails; },
  },
});

const { GET } = await import("../src/app/api/compras/route.ts");

const mail = (subject: string, text = "", extra: Record<string, unknown> = {}) => ({
  id: Math.random().toString(36).slice(2), from: "Loja Exemplo", fromEmail: "pedidos@lojaexemplo.test", subject, text, date: "2026-11-22T10:00:00-03:00", ...extra,
});

beforeEach(() => {
  session = { supabase, user: { id: A }, admin: false };
  tokenFor = []; googleFail = null; blocked = []; writes = 0; delete process.env.COMPRAS_ENABLED;
  emails = [
    mail("Pedido 123456 confirmado", "Previsão de entrega: 28/11"),
    mail("Seu pedido 123456 foi enviado", "Rastreio AB123456789BR"),
    mail("Pedido 999999 confirmado", "Clínica Exemplo, exame agendado"),
  ];
});

test("sem sessão: 401 e não toca no Google", async () => {
  session = null;
  const r = await GET();
  assert.equal(r.status, 401);
  assert.equal(tokenFor.length, 0);
});

test("COMPRAS_ENABLED=0 desliga a rota", async () => {
  process.env.COMPRAS_ENABLED = "0";
  const r = await GET();
  assert.equal(r.status, 404);
  assert.equal(tokenFor.length, 0);
});

test("agrupa os pedidos com o token da própria pessoa e não grava nada", async () => {
  const r = await GET();
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.deepEqual(tokenFor, [A], "o token é sempre o da sessão");
  assert.equal(j.connected, true);
  const p = j.pedidos.find((x: { numero: string }) => x.numero === "123456");
  assert.equal(p.situacao, "enviado");
  assert.equal(p.rastreio, "AB123456789BR");
  assert.equal(p.emails, 2);
  assert.ok(Array.isArray(j.calendario.dias));
  assert.equal(j.conta, "pessoa@exemplo.test", "a conta conectada vai para o link do Gmail");
  assert.equal(writes, 0, "Compras nunca grava");
  assert.equal(r.headers.get("cache-control"), "no-store");
});

test("termo bloqueado tira o e-mail do agrupamento e conta como omitido", async () => {
  blocked = ["clínica"];
  const j = await (await GET()).json();
  assert.equal(j.pedidos.some((x: { numero: string }) => x.numero === "999999"), false);
  assert.equal(j.omitidos, 1);
});

test("Google desconectado vira 200 com connected=false; revogado vira 502 explicado", async () => {
  googleFail = "not_connected";
  let r = await GET();
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { connected: false, error: "not_connected" });
  googleFail = "revoked";
  r = await GET();
  assert.equal(r.status, 502);
  assert.equal((await r.json()).error, "revoked");
});
