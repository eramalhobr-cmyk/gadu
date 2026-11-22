// S-05 (sessões) e S-06 (hierarquia): a rota real de bloqueio com Supabase simulado.
import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const src = (p: string) => new URL(`../src/${p}`, import.meta.url).href;
const ADMIN = "00000000-0000-4000-8000-000000000001";
const MEMBER = "00000000-0000-4000-8000-000000000002";
const OTHER_ADMIN = "00000000-0000-4000-8000-000000000003";
const OWNER_BY_ENV = "00000000-0000-4000-8000-000000000004";
const GONE = "00000000-0000-4000-8000-000000000005";

const members: Record<string, { role: string }> = { [MEMBER]: { role: "member" }, [OTHER_ADMIN]: { role: "admin" }, [OWNER_BY_ENV]: { role: "member" } };
const emails: Record<string, string> = { [MEMBER]: "pessoa@exemplo.com", [OTHER_ADMIN]: "outro@exemplo.com", [OWNER_BY_ENV]: "Dono@Exemplo.com" };
let updates: { row: unknown; id: unknown }[] = [];
let rpcs: { name: string; args: unknown }[] = [];
let revokeFails = false;
let updateFails = false;

mock.module(src("app/api/admin/_admin.ts"), { namedExports: { adminOnly: async () => ({ user: { id: ADMIN }, admin: true, supabase: {} }) } });
mock.module(src("lib/supabase/admin.ts"), {
  namedExports: {
    supabaseAdmin: () => ({
      auth: { admin: { getUserById: async (id: string) => ({ data: { user: emails[id] ? { id, email: emails[id] } : null }, error: null }) } },
      rpc: async (name: string, args: unknown) => { rpcs.push({ name, args }); return { data: 1, error: revokeFails ? { message: "permission denied" } : null }; },
      from: (table: string) => {
        assert.equal(table, "members");
        return {
          select: () => ({ eq: (_c: string, id: string) => ({ maybeSingle: async () => ({ data: members[id] ?? null, error: null }) }) }),
          update: (row: unknown) => ({ eq: async (_c: string, id: unknown) => { updates.push({ row, id }); return { error: updateFails ? { message: "x" } : null }; } }),
        };
      },
    }),
  },
});

process.env.ADMIN_EMAILS = "dono@exemplo.com";
const { PATCH } = await import(src("app/api/admin/people/route.ts")) as { PATCH: (r: Request) => Promise<Response> };
const patch = (body: unknown) => PATCH(new Request("http://localhost/api/admin/people", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));

beforeEach(() => { updates = []; rpcs = []; revokeFails = false; updateFails = false; });

test("bloqueia uma pessoa comum e encerra as sessões dela", async () => {
  const res = await patch({ userId: MEMBER, access: "blocked" });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, sessionsRevoked: true });
  assert.deepEqual(updates, [{ row: { access: "blocked" }, id: MEMBER }]);
  assert.deepEqual(rpcs, [{ name: "server_revoke_user_sessions", args: { p_user: MEMBER } }]);
});

test("falha ao encerrar sessões não desfaz o bloqueio (o acesso já caiu pelo members)", async () => {
  revokeFails = true;
  const res = await patch({ userId: MEMBER, access: "blocked" });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, sessionsRevoked: false });
  assert.equal(updates.length, 1);
});

test("S-06: não altera o próprio acesso", async () => {
  const res = await patch({ userId: ADMIN, access: "blocked" });
  assert.equal(res.status, 400);
  assert.match(((await res.json()) as { message: string }).message, /próprio acesso/);
  assert.equal(updates.length, 0);
  assert.equal(rpcs.length, 0);
});

test("S-06: não bloqueia outro admin", async () => {
  const res = await patch({ userId: OTHER_ADMIN, access: "blocked" });
  assert.equal(res.status, 403);
  assert.match(((await res.json()) as { message: string }).message, /Administradores não podem ser bloqueados/);
  assert.equal(updates.length, 0);
  assert.equal(rpcs.length, 0);
});

test("S-06: não bloqueia e-mail de ADMIN_EMAILS, mesmo com papel de membro e e-mail em outra caixa", async () => {
  const res = await patch({ userId: OWNER_BY_ENV, access: "blocked" });
  assert.equal(res.status, 403);
  assert.equal(updates.length, 0);
});

test("alvo que não existe: recusa sem alterar nada", async () => {
  const res = await patch({ userId: GONE, access: "blocked" });
  assert.equal(res.status, 400);
  assert.equal(updates.length, 0);
});

test("liberar acesso não encerra sessão", async () => {
  const res = await patch({ userId: MEMBER, access: "active" });
  assert.equal(res.status, 200);
  assert.deepEqual(updates, [{ row: { access: "active" }, id: MEMBER }]);
  assert.equal(rpcs.length, 0);
});

test("erro ao gravar o bloqueio: 500 e nenhuma sessão é encerrada", async () => {
  updateFails = true;
  const res = await patch({ userId: MEMBER, access: "blocked" });
  assert.equal(res.status, 500);
  assert.equal(rpcs.length, 0);
});

test("corpo inválido ou com campo extra é recusado", async () => {
  assert.equal((await patch({ userId: "não-é-uuid", access: "blocked" })).status, 400);
  assert.equal((await patch({ userId: MEMBER, access: "blocked", role: "admin" })).status, 400);
  assert.equal(updates.length, 0);
});
