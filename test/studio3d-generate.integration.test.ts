// POST /api/3d/generate com Supabase e IA simulados (dados fictícios).
// Garante: 401 sem sessão (antes de qualquer custo), interruptor desligado = 404, zod e limites de tamanho, mesmo pipeline de custo
// do chat (limites → reserva só pelo servidor com o id da SESSÃO → cota diária → IA → liquidação pelo custo real), fail closed.
import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import { PEDIDO_MAX, SCAD_MAX } from "../src/lib/3d/limits.ts";

type Rpc = { data: unknown; error: unknown };
const src = (p: string) => new URL(`../src/${p}`, import.meta.url).href;
const RID = "3f2b1c9e-8d7a-4b6c-9e5f-1a2b3c4d5e6f";
const UID = "user-teste-3d";

let session: string | null = UID;
let rpcs: Record<string, (a?: Record<string, unknown>) => Promise<Rpc>> = {};
let calls: { name: string; args?: Record<string, unknown>; client: "user" | "admin" }[] = [];
let order: string[] = [];
let aiCalls: { prompt: string; maxTokens?: number; skip: string[]; image?: { mediaType: string; data: string } }[] = [];
let aiMode: "ok" | "throw" | "timeout" = "ok";
/** Respostas em sequência (texto e se veio cortada); vazio = usa aiText. */
let aiSeq: { text: string; cortada?: boolean }[] = [];
let aiOpts: Record<string, unknown>[] = [];
let aiText = "largura = 70; // [30:1:200] Largura\ncube([largura, 10, 5]);";
let profileSettings: unknown = {};
let inserts: unknown[] = [];

const ok = (data: unknown) => async () => ({ data, error: null });
const err = async () => ({ data: null, error: { message: "indisponível" } });
const healthy = () => ({
  month_spend_by_provider: ok([]),
  server_reserve_ai_budget: ok({ allowed: true, reservation_id: RID, amount: 0.05 }),
  consume_daily_quota: ok({ allowed: true, used: 1, limit: 150 }),
  server_settle_ai_budget: ok({ ok: true }),
  server_release_ai_budget: ok({ ok: true }),
});
const called = (n: string) => calls.filter((c) => c.name === n);

const rec = (client: "user" | "admin") => (name: string, args?: Record<string, unknown>) => { calls.push({ name, args, client }); order.push(name); return (rpcs[name] ?? err)(args); };
mock.module(src("lib/supabase/server.ts"), {
  namedExports: {
    supabaseServer: async () => ({
      auth: { getUser: async () => ({ data: { user: session ? { id: session, email: "teste@exemplo.com" } : null } }) },
      rpc: rec("user"),
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { settings: profileSettings }, error: null }) }) }) }),
    }),
  },
});
mock.module(src("lib/supabase/admin.ts"), {
  namedExports: { supabaseAdmin: () => ({ rpc: rec("admin"), from: () => ({ insert: async (row: unknown) => { inserts.push(row); return { error: null }; } }) }) },
});
mock.module(src("lib/access.ts"), { namedExports: { accessOf: async () => ({ ok: true, admin: false }) } });
mock.module(src("lib/llm/complete.ts"), {
  namedExports: {
    complete: async (prompt: string, o: { maxTokens?: number; skip?: Set<string>; image?: { mediaType: string; data: string } } = {}) => {
      order.push("ia"); aiCalls.push({ prompt, maxTokens: o.maxTokens, skip: [...(o.skip ?? [])], image: o.image }); aiOpts.push(o as Record<string, unknown>);
      if (aiMode === "throw") throw new Error("provedor fora");
      if (aiMode === "timeout") { const e = new Error("Request timed out."); e.name = "APIConnectionTimeoutError"; throw e; }
      const next = aiSeq.shift();
      return { text: next?.text ?? aiText, provider: "anthropic", model: "claude-haiku-5-5", input: 900, output: 400, cost: 0.00029, cortada: next?.cortada ?? false };
    },
    isTimeout: (e: unknown) => /timed? ?out/i.test(String((e as Error)?.message ?? "")),
  },
});
mock.module("next/server", { namedExports: { NextResponse: { json: (b: unknown, init?: ResponseInit) => Response.json(b, init) } } });

const { POST } = await import(src("app/api/3d/generate/route.ts"));
const post = async (body: unknown) => {
  const res: Response = await POST(new Request("http://localhost/api/3d/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
  return { status: res.status, json: (await res.json()) as Record<string, any> };
};
const NOVO = { modo: "novo", pedido: "um suporte de celular com 70 mm de largura" };

beforeEach(() => {
  session = UID; rpcs = healthy(); calls = []; order = []; aiCalls = []; aiMode = "ok"; aiSeq = []; aiOpts = []; inserts = []; profileSettings = {};
  aiText = "largura = 70; // [30:1:200] Largura\ncube([largura, 10, 5]);";
  process.env.MODELING_3D_ENABLED = "1";
});

test("sem sessão: 401 antes de qualquer consulta, reserva ou IA", async () => {
  session = null;
  const r = await post(NOVO);
  assert.equal(r.status, 401);
  assert.equal(calls.length, 0);
  assert.equal(aiCalls.length, 0);
});

test("interruptor desligado (ausente, 0 ou qualquer valor que não seja 1): 404, sem custo", async () => {
  for (const v of [undefined, "0", "true", ""]) {
    if (v === undefined) delete process.env.MODELING_3D_ENABLED; else process.env.MODELING_3D_ENABLED = v;
    const r = await post(NOVO);
    assert.equal(r.status, 404, String(v));
    assert.equal(r.json.error, "disabled");
  }
  assert.equal(calls.length, 0);
  assert.equal(aiCalls.length, 0);
});

test("caminho feliz: limites → reserva → cota → IA → liquidação, nessa ordem", async () => {
  const r = await post(NOVO);
  assert.equal(r.status, 200);
  assert.match(r.json.scad, /cube\(\[largura/);
  assert.deepEqual(order, ["month_spend_by_provider", "server_reserve_ai_budget", "consume_daily_quota", "ia", "server_settle_ai_budget"]);
  assert.equal(aiCalls.length, 1);
  assert.equal(aiCalls[0].maxTokens, 6000);
  assert.match(aiCalls[0].prompt, /Bambu Lab A1/);
  assert.match(aiCalls[0].prompt, /suporte de celular/);
  assert.equal(called("server_release_ai_budget").length, 0);
});

test("S-01: reserva e liquidação só pelo cliente do servidor, com o id da SESSÃO e o custo real", async () => {
  const r = await post(NOVO);
  assert.equal(r.status, 200);
  const rs = called("server_reserve_ai_budget")[0], st = called("server_settle_ai_budget")[0];
  assert.equal(rs.client, "admin"); assert.equal(st.client, "admin");
  assert.equal(rs.args!.p_user, UID); assert.equal(st.args!.p_user, UID);
  assert.ok((rs.args!.p_estimate_usd as number) > 0);
  assert.equal(st.args!.p_reservation, RID);
  assert.equal(st.args!.p_cost_usd, 0.00029, "custo real da IA, não o do cliente");
  assert.equal(st.args!.p_input_tokens, 900);
  assert.equal(st.args!.p_output_tokens, 400);
});

test("corpo com user_id ou custo é recusado (zod estrito), sem custo", async () => {
  const r = await post({ ...NOVO, user_id: "outra-pessoa", custo: 0 });
  assert.equal(r.status, 400);
  assert.equal(calls.length, 0);
});

test("limite de tamanho: pedido e código atual grandes demais, e modos sem os campos exigidos", async () => {
  for (const body of [
    { modo: "novo", pedido: "x".repeat(PEDIDO_MAX + 1) },
    { modo: "refinar", pedido: "mais alto", scad: "c".repeat(SCAD_MAX + 1) },
    { modo: "refinar", pedido: "mais alto" },
    { modo: "corrigir", pedido: "x", scad: "cube(1);" },
    { modo: "novo", pedido: "" },
    null,
  ]) {
    const r = await post(body);
    assert.equal(r.status, 400, JSON.stringify(body)?.slice(0, 60));
  }
  assert.equal(calls.length, 0);
  assert.equal(aiCalls.length, 0);
});

test("código devolvido grande demais ou com arquivo externo: 422, mas o custo real é liquidado", async () => {
  aiText = "cube(1); // " + "x".repeat(SCAD_MAX);
  assert.equal((await post(NOVO)).status, 422);
  assert.equal(called("server_settle_ai_budget").length, 1);
  calls = []; aiText = "include </etc/passwd>\ncube(1);";
  assert.equal((await post(NOVO)).status, 422);
  assert.equal(called("server_settle_ai_budget").length, 1);
  assert.equal(called("server_release_ai_budget").length, 0);
});

test("resposta com cerca de markdown vem só com o código", async () => {
  aiText = "```openscad\ncube([10, 10, 10]);\n```";
  const r = await post(NOVO);
  assert.equal(r.json.scad, "cube([10, 10, 10]);");
});

test("refinar e corrigir mandam o código atual e o erro para a IA", async () => {
  await post({ modo: "refinar", pedido: "2 mm mais alto", scad: "altura = 10; // [1:1:50]\ncube(altura);" });
  assert.match(aiCalls[0].prompt, /cube\(altura\)/);
  assert.match(aiCalls[0].prompt, /2 mm mais alto/);
  await post({ modo: "corrigir", pedido: "caixa", scad: "cube(", erro: "ERROR: Parser error" });
  assert.match(aiCalls[1].prompt, /ERROR: Parser error/);
});

test("fail closed: sem verificar os limites por motor, a IA não é chamada nem há reserva", async () => {
  rpcs.month_spend_by_provider = err;
  const r = await post(NOVO);
  assert.equal(r.status, 503);
  assert.equal(aiCalls.length, 0);
  assert.equal(called("server_reserve_ai_budget").length, 0);
});

test("fail closed: reserva indisponível → 503; teto mensal → 402; ambos sem IA e sem cota consumida", async () => {
  rpcs.server_reserve_ai_budget = err;
  assert.equal((await post(NOVO)).status, 503);
  rpcs.server_reserve_ai_budget = ok({ allowed: false, reason: "monthly", spent: 20, limit: 20 });
  const r = await post(NOVO);
  assert.equal(r.status, 402);
  assert.match(r.json.message, /não usam IA/);
  assert.equal(aiCalls.length, 0);
  assert.equal(called("consume_daily_quota").length, 0);
});

test("fail closed: cota diária indisponível ou estourada → sem IA e a reserva é liberada", async () => {
  rpcs.consume_daily_quota = err;
  assert.equal((await post(NOVO)).status, 503);
  assert.equal(called("server_release_ai_budget").length, 1);
  rpcs.consume_daily_quota = ok({ allowed: false, used: 150, limit: 150 });
  const r = await post(NOVO);
  assert.equal(r.status, 429);
  assert.equal(called("server_release_ai_budget").length, 2);
  assert.equal(aiCalls.length, 0);
  assert.equal(called("server_settle_ai_budget").length, 0);
});

test("resposta inesperada do banco na reserva também bloqueia", async () => {
  rpcs.server_reserve_ai_budget = ok({ allowed: true, reservation_id: "nao-e-uuid", amount: 1 });
  assert.equal((await post(NOVO)).status, 503);
  assert.equal(aiCalls.length, 0);
});

test("IA fora do ar: 502, reserva liberada, nada liquidado", async () => {
  aiMode = "throw";
  const r = await post(NOVO);
  assert.equal(r.status, 502);
  assert.equal(called("server_release_ai_budget").length, 1);
  assert.equal(called("server_settle_ai_budget").length, 0);
});

test("liquidação falhou: o consumo é gravado direto e a reserva é liberada (custo nunca se perde)", async () => {
  rpcs.server_settle_ai_budget = err;
  const r = await post(NOVO);
  assert.equal(r.status, 200);
  assert.equal(inserts.length, 1);
  assert.equal((inserts[0] as { cost_usd: number }).cost_usd, 0.00029);
  assert.equal(called("server_release_ai_budget").length, 1);
});

test("privacidade: dado sensível ou termo bloqueado não vai para a IA nem gasta orçamento", async () => {
  let r = await post({ modo: "novo", pedido: "suporte com meu CPF 123.456.789-09 gravado" });
  assert.equal(r.status, 422);
  profileSettings = { blocked: ["empresa-x"] };
  r = await post({ modo: "novo", pedido: "peça para a Empresa-X" });
  assert.equal(r.status, 422);
  assert.equal(aiCalls.length, 0);
  assert.equal(called("server_reserve_ai_budget").length, 0);
});

test("motor acima do limite mensal de Ajustes é pulado", async () => {
  rpcs.month_spend_by_provider = ok([{ provider: "anthropic", cost_usd: 9 }]);
  await post(NOVO);
  assert.deepEqual(aiCalls[0].skip, ["anthropic"]);
});

// ---- 3D-1b: render da peça junto do ajuste ----
const JPEG = "data:image/jpeg;base64," + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2000, 7)]).toString("base64");
const PNG_FALSO = "data:image/png;base64," + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2000, 7)]).toString("base64");
const REFINAR = { modo: "refinar", pedido: "2 mm mais alto", scad: "largura = 70; // [30:1:200] Largura\ncube([largura, 10, 5]);" };

test("3D-1b: ajuste com o render vai à IA com a imagem e a nota; mesma ordem de custo; reserva conta a imagem", async () => {
  const sem = await post(REFINAR);
  assert.equal(sem.status, 200);
  const estSem = called("server_reserve_ai_budget")[0].args!.p_estimate_usd as number;
  assert.equal(aiCalls[0].image, undefined, "sem imagem, só o código");
  assert.doesNotMatch(aiCalls[0].prompt, /imagem anexa/);
  calls = []; order = []; aiCalls = [];
  const com = await post({ ...REFINAR, imagem: JPEG });
  assert.equal(com.status, 200);
  assert.deepEqual(order, ["month_spend_by_provider", "server_reserve_ai_budget", "consume_daily_quota", "ia", "server_settle_ai_budget"]);
  assert.equal(aiCalls[0].image?.mediaType, "image/jpeg");
  assert.match(aiCalls[0].prompt, /imagem anexa é o render atual/);
  const estCom = called("server_reserve_ai_budget")[0].args!.p_estimate_usd as number;
  assert.ok(estCom > estSem, "a reserva inclui os tokens da imagem");
});

test("3D-1b: imagem inválida, grande demais ou fora do ajuste é recusada antes de qualquer custo", async () => {
  for (const body of [
    { ...REFINAR, imagem: PNG_FALSO },
    { ...REFINAR, imagem: "data:image/gif;base64,R0lGODlhAQABAAAAACw=" },
    { ...REFINAR, imagem: "data:image/jpeg;base64," + "A".repeat(500_000) },
    { ...NOVO, imagem: JPEG },
  ]) {
    const r = await post(body);
    assert.equal(r.status, 400, JSON.stringify(body).slice(0, 60));
  }
  assert.equal(calls.length, 0, "nada de limites, reserva ou cota");
  assert.equal(aiCalls.length, 0);
});

test("3D-1b: com a cota do dia esgotada, o ajuste com imagem não chama a IA e libera a reserva", async () => {
  rpcs.consume_daily_quota = ok({ allowed: false, used: 150, limit: 150 });
  const r = await post({ ...REFINAR, imagem: JPEG });
  assert.equal(r.status, 429);
  assert.equal(aiCalls.length, 0);
  assert.equal(called("server_release_ai_budget").length, 1);
});

// ---- Referência 3D (23/11): código cortado, tempo esgotado, prazo e eixos ----
const CORTADO = "largura = 80; // [30:1:200] Largura\ndifference() {\n  cube([largura, 60, 40]);\n  translate([2, 2, 2]) cube([";

test("código cortado pelo limite de saída: UMA nova tentativa automática, mais curta; as duas chamadas são cobradas", async () => {
  aiSeq = [{ text: CORTADO, cortada: true }, { text: "largura = 80; // [30:1:200] Largura\ncube([largura, 60, 40]);" }];
  const r = await post(NOVO);
  assert.equal(r.status, 200);
  assert.match(r.json.scad, /cube\(\[largura, 60, 40\]\);/);
  assert.equal(aiCalls.length, 2);
  assert.match(aiCalls[1].prompt, /foi cortada no meio/);
  assert.equal(called("server_settle_ai_budget").length, 1, "a primeira liquida a reserva");
  assert.equal(inserts.length, 1, "a segunda grava o consumo direto");
  assert.equal(called("server_release_ai_budget").length, 0);
});

test("código incompleto mesmo sem aviso de corte também tenta de novo; se a segunda falhar, 422 com mensagem clara", async () => {
  aiSeq = [{ text: CORTADO }, { text: CORTADO, cortada: true }];
  const r = await post(NOVO);
  assert.equal(r.status, 422);
  assert.match(r.json.message, /incompleto/);
  assert.equal(aiCalls.length, 2, "nunca mais de uma nova tentativa");
});

test("código completo: sem nova tentativa", async () => {
  await post(NOVO);
  assert.equal(aiCalls.length, 1);
});

test("tempo esgotado na IA: 504 com mensagem de tempo, reserva liberada", async () => {
  aiMode = "timeout";
  const r = await post(NOVO);
  assert.equal(r.status, 504);
  assert.equal(r.json.error, "ai_timeout");
  assert.match(r.json.message, /demorou demais/);
  assert.equal(called("server_release_ai_budget").length, 1);
});

test("chamada da IA: sem raciocínio interno, sem novas tentativas do SDK, com prazo abaixo do maxDuration", async () => {
  const antes = Date.now();
  await post(NOVO);
  const o = aiOpts[0];
  assert.equal(o.semRaciocinio, true);
  assert.equal(o.maxRetries, 0);
  assert.ok((o.timeoutMs as number) <= 60_000);
  assert.ok((o.deadline as number) > antes && (o.deadline as number) <= antes + 120_000);
});

test("reserva cobre a nova tentativa (o dobro da estimativa de uma chamada)", async () => {
  const { estimateMaxCost } = await import(src("lib/pricing.ts"));
  const { serverConfig } = await import(src("lib/config.ts"));
  await post(NOVO);
  const est = called("server_reserve_ai_budget")[0].args!.p_estimate_usd as number;
  const uma = estimateMaxCost(serverConfig().cheapModel, aiCalls[0].prompt.length, 6000);
  assert.ok(est >= 1.9 * uma, `${est} vs ${uma}`);
});

test("prompt: altura é sempre o eixo Z e texto só com Liberation Sans", async () => {
  await post(REFINAR);
  assert.match(aiCalls[0].prompt, /Z = altura/);
  assert.match(aiCalls[0].prompt, /"mais alto".*SEMPRE mudam o eixo Z/);
  assert.match(aiCalls[0].prompt, /Liberation Sans/);
});
