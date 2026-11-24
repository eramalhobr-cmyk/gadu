// Monitoramento e alerta de erro: captura do servidor (helper único), alerta por push só para administradores,
// throttle (1 por grupo a cada 6 h, 4 por dia), rede de segurança do tick, retenção e o painel "Saúde do sistema".
// Supabase e push simulados. Sem dado pessoal.
import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const src = (p: string) => new URL(`../src/${p}`, import.meta.url).href;
const ADM = "00000000-0000-4000-8000-0000000000a1";
const MEM = "00000000-0000-4000-8000-0000000000b1";
const BLQ = "00000000-0000-4000-8000-0000000000c1";

type Row = Record<string, unknown>;
const T: Record<string, Row[]> = {};
let dbFalha = false;
let semEstado = false;
let pushOk = true;
let enviados: { subs: { endpoint: string }[]; payload: { title: string; body: string; url?: string; tag?: string } }[] = [];
let session: { user: { id: string }; admin: boolean } | null = null;
let ids = 0;

const PK: Record<string, string[]> = { error_alert_state: ["impressao"], error_alert_dia: ["dia", "vaga"] };

class Q implements PromiseLike<{ data: unknown; count: number | null; error: { code?: string; message: string } | null }> {
  private f: ((r: Row) => boolean)[] = [];
  private mode: "select" | "update" | "delete" = "select";
  private patch: Row = {};
  private head = false;
  private ret = false;
  private single = false;
  private t: string;
  constructor(t: string) { this.t = t; }
  select(_c?: string, o?: { head?: boolean }) { if (this.mode === "select") this.head = !!o?.head; else this.ret = true; return this; }
  update(p: Row) { this.mode = "update"; this.patch = p; return this; }
  del() { this.mode = "delete"; return this; }
  eq(c: string, v: unknown) { this.f.push((r) => r[c] === v); return this; }
  in(c: string, v: unknown[]) { this.f.push((r) => v.includes(r[c])); return this; }
  gte(c: string, v: string) { this.f.push((r) => String(r[c]) >= v); return this; }
  lt(c: string, v: string) { this.f.push((r) => r[c] != null && String(r[c]) < v); return this; }
  is(c: string, v: null) { this.f.push((r) => (r[c] ?? null) === v); return this; }
  neq(c: string, v: unknown) { this.f.push((r) => r[c] !== v); return this; }
  or(expr: string) {
    const conds = expr.split(",").map((p) => { const [c, op, ...rest] = p.split("."); const v = rest.join("."); return (r: Row) => (op === "is" ? (r[c] ?? null) === null : r[c] != null && (op === "lte" ? String(r[c]) <= v : String(r[c]) < v)); });
    this.f.push((r) => conds.some((c) => c(r))); return this;
  }
  order() { return this; }
  limit() { return this; }
  maybeSingle() { this.single = true; return this; }
  then<A, B>(ok?: (v: { data: unknown; count: number | null; error: { code?: string; message: string } | null }) => A | PromiseLike<A>, ko?: (e: unknown) => B | PromiseLike<B>) {
    const falha = dbFalha || (semEstado && this.t.startsWith("error_alert"));
    if (falha) return Promise.resolve({ data: null, count: null, error: { message: "indisponível" } }).then(ok, ko);
    const rows = (T[this.t] ??= []);
    const hit = rows.filter((r) => this.f.every((x) => x(r)));
    if (this.mode === "delete") { T[this.t] = rows.filter((r) => !hit.includes(r)); return Promise.resolve({ data: null, count: hit.length, error: null }).then(ok, ko); }
    if (this.mode === "update") { hit.forEach((r) => Object.assign(r, this.patch)); return Promise.resolve({ data: this.ret ? hit.map((r) => ({ ...r })) : null, count: hit.length, error: null }).then(ok, ko); }
    const data = this.head ? null : this.single ? (hit[0] ? { ...hit[0] } : null) : hit.map((r) => ({ ...r }));
    return Promise.resolve({ data, count: hit.length, error: null }).then(ok, ko);
  }
}

mock.module(src("lib/supabase/admin.ts"), {
  namedExports: {
    supabaseAdmin: () => {
      if (dbFalha) throw new Error("banco fora");
      return {
        from: (t: string) => ({
          select: (c?: string, o?: { head?: boolean }) => new Q(t).select(c, o),
          update: (p: Row) => new Q(t).update(p),
          delete: () => new Q(t).del(),
          insert: async (row: Row) => {
            if (dbFalha || (semEstado && t.startsWith("error_alert"))) return { error: { message: "indisponível" } };
            const rows = (T[t] ??= []);
            const pk = PK[t];
            if (pk && rows.some((r) => pk.every((k) => r[k] === row[k]))) return { error: { code: "23505", message: "duplicate" } };
            rows.push({ id: ++ids, created_at: new Date().toISOString(), ...row });
            return { error: null };
          },
        }),
      };
    },
  },
});
mock.module(src("lib/push.ts"), {
  namedExports: {
    pushConfigured: () => pushOk,
    sendPush: async (subs: { endpoint: string }[], payload: never) => { enviados.push({ subs, payload }); return { sent: subs.length, gone: [] }; },
  },
});
mock.module(src("app/api/google/_auth.ts"), { namedExports: { signedIn: async () => session } });
mock.module(src("app/api/admin/_admin.ts"), { namedExports: { adminOnly: async () => (session?.admin ? session : null) } });

const { capturarErroServidor } = await import(src("lib/telemetria/capturar.ts")) as { capturarErroServidor: (e: unknown, o: { rota: string; userId?: string | null; status?: number }) => Promise<void> };
const { avaliarEAvisar, redeDeSeguranca, retencaoDeErros } = await import(src("lib/telemetria/avisar.ts")) as {
  avaliarEAvisar: (e: unknown, agora?: Date) => Promise<boolean>; redeDeSeguranca: (db?: unknown, agora?: Date) => Promise<number>; retencaoDeErros: (db?: unknown, agora?: Date) => Promise<number>;
};
const { supabaseAdmin } = await import(src("lib/supabase/admin.ts")) as { supabaseAdmin: () => unknown };
const { GET: SAUDE } = await import(src("app/api/admin/saude/route.ts")) as { GET: () => Promise<Response> };
const { impressao } = await import(src("lib/telemetria/sanitize.ts")) as { impressao: (e: unknown) => string };

const ev = (o: Row = {}) => ({ origem: "servidor", rota: "/api/chat", nome: "TypeError", codigo: null, status: 500, local: "src/app/api/chat/route.ts:42", ...o });
const flush = () => new Promise((r) => setTimeout(r, 30));
const agora = new Date("2026-11-23T18:00:00-03:00");
const antes = (min: number) => new Date(agora.getTime() - min * 60_000).toISOString();
const seedErros = (e: Row, n: number, minAtras = 1) => { for (let i = 0; i < n; i++) (T.error_events ??= []).push({ id: ++ids, created_at: antes(minAtras + i * 0.1), user_id: null, origem: e.origem, rota: e.rota, nome: e.nome, status: 500, local_codigo: e.local, versao: null, impressao: impressao(e) }); };

beforeEach(() => {
  for (const k of Object.keys(T)) delete T[k];
  T.members = [{ user_id: ADM, role: "admin", access: "active" }, { user_id: MEM, role: "member", access: "active" }, { user_id: BLQ, role: "admin", access: "blocked" }];
  T.push_subscriptions = [{ id: 1, user_id: ADM, endpoint: "https://push.teste/adm", p256dh: "p", auth: "a" }, { id: 2, user_id: MEM, endpoint: "https://push.teste/mem", p256dh: "p", auth: "a" }, { id: 3, user_id: BLQ, endpoint: "https://push.teste/blq", p256dh: "p", auth: "a" }];
  dbFalha = false; semEstado = false; pushOk = true; enviados = []; session = { user: { id: ADM }, admin: true }; ids = 0;
  delete process.env.TELEMETRIA_ENABLED; process.env.VERCEL_GIT_COMMIT_SHA = "a3b4a791cfc32b5c";
});

test("captura sem sessão grava com user_id nulo, sem mensagem, e nunca lança", async () => {
  const erro = Object.assign(new TypeError("falha com maria@exemplo.com e senha 123"), { code: "E_X" });
  await capturarErroServidor(erro, { rota: "/api/cron/tick?token=segredo", status: 500 });
  await flush();
  const r = T.error_events[0];
  assert.equal(r.user_id, null);
  assert.equal(r.rota, "/api/cron/tick");
  assert.equal(r.nome, "TypeError");
  assert.equal(r.origem, "servidor");
  assert.doesNotMatch(JSON.stringify(r), /maria|senha|segredo/);
});

test("captura com sessão usa o userId; id na rota vira :id; rota de telemetria nunca se registra", async () => {
  await capturarErroServidor(new Error("x"), { rota: "/api/3d/pecas/123456", userId: ADM, status: 502 });
  await capturarErroServidor(new Error("x"), { rota: "/api/telemetria/erro" });
  await flush();
  assert.equal(T.error_events.length, 1);
  assert.equal(T.error_events[0].user_id, ADM);
  assert.equal(T.error_events[0].rota, "/api/3d/pecas/:id");
  assert.equal(T.error_events[0].status, 502);
});

test("captura: banco fora ou tabela ausente não lança nem quebra a rota", async () => {
  dbFalha = true;
  await assert.doesNotReject(capturarErroServidor(new Error("x"), { rota: "/api/chat", userId: ADM }));
  await flush();
  assert.equal(T.error_events, undefined);
});

test("captura: TELEMETRIA_ENABLED=0 não toca no banco nem avisa", async () => {
  process.env.TELEMETRIA_ENABLED = "0";
  await capturarErroServidor(new Error("x"), { rota: "/api/chat", userId: ADM });
  await flush();
  assert.equal(T.error_events, undefined);
  assert.equal(enviados.length, 0);
});

test("grupo novo: um push, só para administrador ativo, com texto curto e sem dado pessoal", async () => {
  await capturarErroServidor(new TypeError("mensagem secreta"), { rota: "/api/chat", userId: ADM });
  await flush();
  assert.equal(enviados.length, 1);
  assert.deepEqual(enviados[0].subs.map((s) => s.endpoint), ["https://push.teste/adm"]);
  const p = enviados[0].payload;
  assert.equal(p.body, "O GaDu teve um erro novo: TypeError em /api/chat (1 vez).");
  assert.equal(p.url, "/app?tab=admin#painel-saude");
  assert.match(p.tag ?? "", /^erro-[0-9a-f]{16}$/);
  assert.doesNotMatch(JSON.stringify(p), /secreta|@|user/i);
  assert.equal(T.error_alert_state.length, 1);
  assert.equal(T.error_alert_state[0].alertas, 1);
  assert.equal(T.error_alert_dia.length, 1);
});

test("mesmo grupo logo depois: gravado, sem novo push", async () => {
  const falha = () => new TypeError("a"); // mesma linha de código = mesma impressão digital
  await capturarErroServidor(falha(), { rota: "/api/chat", userId: ADM });
  await flush();
  await capturarErroServidor(falha(), { rota: "/api/chat", userId: ADM });
  await flush();
  assert.equal(T.error_events.length, 2);
  assert.equal(enviados.length, 1);
});

test("pico: 5 do mesmo grupo em 15 min, com o último aviso há mais de 6 h, avisa uma vez", async () => {
  const e = ev();
  T.error_alert_state = [{ impressao: impressao(e), primeira_vez: antes(3 * 24 * 60), ultima_vez: antes(60), ultimo_alerta: antes(7 * 60), alertas: 1 }];
  seedErros(e, 5, 1);
  assert.equal(await avaliarEAvisar(e, agora), true);
  assert.match(enviados[0].payload.body, /em sequência: TypeError em \/api\/chat \(5 vezes em 15 min\)/);
  // novo pico dentro das 6 h: throttle do grupo
  assert.equal(await avaliarEAvisar(e, new Date(agora.getTime() + 60_000)), false);
  assert.equal(enviados.length, 1);
});

test("poucas ocorrências de um grupo conhecido não avisam", async () => {
  const e = ev();
  T.error_alert_state = [{ impressao: impressao(e), primeira_vez: antes(3 * 24 * 60), ultima_vez: antes(60), ultimo_alerta: antes(7 * 60), alertas: 1 }];
  seedErros(e, 3, 1);
  assert.equal(await avaliarEAvisar(e, agora), false);
  assert.equal(enviados.length, 0);
});

test("grupo que voltou depois de mais de 7 dias é novo de novo", async () => {
  const e = ev();
  T.error_alert_state = [{ impressao: impressao(e), primeira_vez: antes(20 * 24 * 60), ultima_vez: antes(9 * 24 * 60), ultimo_alerta: antes(9 * 24 * 60), alertas: 1 }];
  seedErros(e, 1, 1);
  assert.equal(await avaliarEAvisar(e, agora), true);
  assert.equal(T.error_alert_state[0].alertas, 2);
});

test("grupo que volta com ocorrências simultâneas inaugura a aparição e avisa uma vez", async () => {
  const e = ev();
  T.error_alert_state = [{ impressao: impressao(e), primeira_vez: antes(20 * 24 * 60), ultima_vez: antes(9 * 24 * 60), ultimo_alerta: antes(9 * 24 * 60), alertas: 1 }];
  seedErros(e, 5, 1);
  const results = await Promise.all([avaliarEAvisar(e, agora), avaliarEAvisar(e, agora), redeDeSeguranca(supabaseAdmin(), agora)]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(enviados.length, 1);
  assert.equal(T.error_alert_state[0].alertas, 2);
  assert.equal(T.error_alert_dia.length, 1);
});

test("pico libera aviso quando completam exatamente 6 horas", async () => {
  const e = ev();
  T.error_alert_state = [{ impressao: impressao(e), primeira_vez: antes(3 * 24 * 60), ultima_vez: antes(60), ultimo_alerta: antes(6 * 60), alertas: 1 }];
  seedErros(e, 5);
  assert.equal(await avaliarEAvisar(e, agora), true);
});

test("limite diário: no máximo 4 pushes; os outros erros continuam gravados", async () => {
  for (let i = 0; i < 6; i++) await capturarErroServidor(new Error("x"), { rota: `/api/rota${i}`, userId: ADM });
  await flush();
  assert.equal(T.error_events.length, 6);
  assert.equal(enviados.length, 4);
  assert.equal(T.error_alert_dia.length, 4);
});

test("push desligado: silêncio, sem tomar vaga nem marcar aviso", async () => {
  pushOk = false;
  await capturarErroServidor(new Error("x"), { rota: "/api/chat", userId: ADM });
  await flush();
  assert.equal(T.error_events.length, 1);
  assert.equal(enviados.length, 0);
  assert.equal(T.error_alert_dia ?? undefined, undefined);
});

test("sem administrador com aparelho: silêncio e nenhuma vaga gasta", async () => {
  T.push_subscriptions = [{ id: 2, user_id: MEM, endpoint: "https://push.teste/mem", p256dh: "p", auth: "a" }];
  await capturarErroServidor(new Error("x"), { rota: "/api/chat", userId: ADM });
  await flush();
  assert.equal(enviados.length, 0);
  assert.equal(T.error_alert_dia ?? undefined, undefined);
});

test("migração ainda não aplicada (tabelas de estado ausentes): o erro é gravado e nada é enviado", async () => {
  semEstado = true;
  await capturarErroServidor(new Error("x"), { rota: "/api/chat", userId: ADM });
  await flush();
  assert.equal(T.error_events.length, 1);
  assert.equal(enviados.length, 0);
});

test("rede de segurança do tick: avisa o grupo novo que o aviso imediato perdeu, sem repetir", async () => {
  const e = ev({ rota: "/api/cron/tick" });
  seedErros(e, 1, 5);
  assert.equal(await redeDeSeguranca(supabaseAdmin(), agora), 1);
  assert.equal(enviados.length, 1);
  assert.match(enviados[0].payload.body, /erro novo: TypeError em \/api\/cron\/tick/);
  assert.equal(await redeDeSeguranca(supabaseAdmin(), agora), 0);
  assert.equal(enviados.length, 1);
});

test("rede de segurança: grupo já avisado pelo caminho imediato não duplica", async () => {
  const e = ev();
  seedErros(e, 1, 5);
  T.error_alert_state = [{ impressao: impressao(e), primeira_vez: antes(5), ultima_vez: antes(5), ultimo_alerta: antes(5), alertas: 1 }];
  assert.equal(await redeDeSeguranca(supabaseAdmin(), agora), 0);
});

test("retenção: apaga erros com mais de 30 dias só uma vez por hora (minuto 07)", async () => {
  const velho = new Date(agora.getTime() - 31 * 86_400_000).toISOString();
  T.error_events = [{ id: 1, created_at: velho, impressao: "x".repeat(16) }, { id: 2, created_at: antes(5), impressao: "y".repeat(16) }];
  assert.equal(await retencaoDeErros(supabaseAdmin(), new Date("2026-11-23T18:20:00-03:00")), 0);
  assert.equal(T.error_events.length, 2);
  assert.equal(await retencaoDeErros(supabaseAdmin(), new Date("2026-11-23T18:07:00Z")), 1);
  assert.equal(T.error_events.length, 1);
});

test("painel Saúde: pessoa comum 403; administrador vê números sem user_id; desligado e banco fora avisam", async () => {
  session = { user: { id: MEM }, admin: false };
  assert.equal((await SAUDE()).status, 403);
  session = { user: { id: ADM }, admin: true };
  seedErros(ev(), 2, 5);
  (T.error_events[0] as Row).created_at = new Date().toISOString();
  (T.error_events[1] as Row).created_at = new Date().toISOString();
  (T.error_events[0] as Row).user_id = MEM;
  const j = await (await SAUDE()).json();
  assert.equal(j.ligado, true);
  assert.equal(j.disponivel, true);
  assert.equal(j.total24h, 2);
  assert.equal(j.servidor24h, 2);
  assert.equal(j.porDia.length, 7);
  assert.equal(j.grupos[0].vezes, 2);
  assert.doesNotMatch(JSON.stringify(j), /user_id|b1"|maria|@/);
  process.env.TELEMETRIA_ENABLED = "0";
  assert.equal((await (await SAUDE()).json()).ligado, false);
  delete process.env.TELEMETRIA_ENABLED;
  dbFalha = true;
  const f = await (await SAUDE()).json();
  assert.equal(f.ligado, true);
  assert.equal(f.disponivel, false);
});
