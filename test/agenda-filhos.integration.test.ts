// Agenda de filhos: rotas com Supabase simulado em memória (só dados sintéticos).
// Garante: exige sessão, respeita o interruptor, sempre filtra pela pessoa da sessão, normaliza datas para o sábado,
// pede a referência antes do ajuste, devolve o valor anterior (Desfazer) e não mexe nos dados de outra pessoa.
import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const src = (p: string) => new URL(`../src/${p}`, import.meta.url).href;
const A = "00000000-0000-4000-8000-0000000000a1";
const B = "00000000-0000-4000-8000-0000000000b1";

type Row = Record<string, unknown>;
let tables: Record<string, Row[]> = {};
let semFiltroUser = 0;
let seq = 0;

/** Query builder mínimo: select/insert/update/delete com eq, order, limit, maybeSingle e single. */
function from(t: string) {
  let op: "select" | "insert" | "update" | "delete" = "select";
  let payload: Row = {};
  const filtros: [string, unknown][] = [];
  const rows = () => (tables[t] ??= []);
  const match = (r: Row) => filtros.every(([c, v]) => r[c] === v);
  const run = () => {
    if (op !== "insert" && !filtros.some(([c]) => c === "user_id")) semFiltroUser++;
    if (op === "insert") { const r = { id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`, ...payload }; rows().push(r); return [r]; }
    const hit = rows().filter(match);
    if (op === "update") hit.forEach((r) => Object.assign(r, payload));
    if (op === "delete") tables[t] = rows().filter((r) => !match(r));
    return hit;
  };
  const q = {
    select: () => q,
    insert: (p: Row) => { op = "insert"; payload = p; return q; },
    update: (p: Row) => { op = "update"; payload = p; return q; },
    delete: () => { op = "delete"; return q; },
    eq: (c: string, v: unknown) => { filtros.push([c, v]); return q; },
    order: () => q,
    limit: () => q,
    maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
    single: async () => ({ data: run()[0] ?? null, error: null }),
    then: (ok: (v: { data: Row[]; error: null }) => unknown) => Promise.resolve({ data: run(), error: null }).then(ok),
  };
  return q;
}

let session: { supabase: unknown; user: { id: string }; admin: boolean } | null = null;
mock.module(src("app/api/google/_auth.ts"), { namedExports: { signedIn: async () => session } });

const raiz = await import("../src/app/api/agenda-filhos/route.ts");
const ajustes = await import("../src/app/api/agenda-filhos/ajustes/route.ts");
const umAjuste = await import("../src/app/api/agenda-filhos/ajustes/[id]/route.ts");

const req = (url: string, method = "GET", body?: unknown) => new Request(`http://t${url}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

beforeEach(() => {
  tables = { filhos_agenda_config: [], filhos_agenda_ajustes: [] };
  semFiltroUser = 0;
  session = { supabase: { from }, user: { id: A }, admin: false };
  delete process.env.AGENDA_FILHOS_ENABLED;
});

test("sem sessão: 401; interruptor desligado: 404", async () => {
  session = null;
  assert.equal((await raiz.GET(req("/api/agenda-filhos"))).status, 401);
  session = { supabase: { from }, user: { id: A }, admin: false };
  process.env.AGENDA_FILHOS_ENABLED = "0";
  assert.equal((await raiz.GET(req("/api/agenda-filhos"))).status, 404);
  assert.equal((await ajustes.POST(req("/api/agenda-filhos/ajustes", "POST", { tipo: "troca", data: "2026-12-05", comigo: true }))).status, 404);
});

test("sem configuração: vazio; ajuste antes da referência é recusado com explicação", async () => {
  const j = await (await raiz.GET(req("/api/agenda-filhos"))).json();
  assert.equal(j.config, null);
  const r = await ajustes.POST(req("/api/agenda-filhos/ajustes", "POST", { tipo: "troca", data: "2026-12-05", comigo: true }));
  assert.equal(r.status, 409);
  assert.match((await r.json()).message, /referência/);
});

test("referência vira o sábado do fim de semana, é da pessoa da sessão e o cálculo vem pronto", async () => {
  const r = await raiz.PUT(req("/api/agenda-filhos", "PUT", { ancora: "2026-11-29", inicio: "sexta", fim: "domingo", feriadoSegue: true }));
  assert.equal(r.status, 201);
  assert.equal((await r.json()).config.ancora, "2026-11-28", "domingo vira o sábado do mesmo fim de semana");
  assert.equal(tables.filhos_agenda_config[0].user_id, A);
  const j = await (await raiz.GET(req("/api/agenda-filhos?desde=2026-11-24&semanas=2&consulta=2026-12-05"))).json();
  assert.deepEqual(j.fins.map((f: { sabado: string; comigo: boolean }) => [f.sabado, f.comigo]), [["2026-11-28", true], ["2026-12-05", false]]);
  assert.equal(j.consulta.comigo, false);
  // Mudar de novo atualiza a mesma linha.
  await raiz.PUT(req("/api/agenda-filhos", "PUT", { ancora: "2026-12-05", inicio: "sabado", fim: "segunda", feriadoSegue: false }));
  assert.equal(tables.filhos_agenda_config.length, 1);
  assert.equal(semFiltroUser, 0, "toda leitura e escrita filtra por user_id");
});

test("troca: cria, depois muda devolvendo o anterior; apagar só apaga o da pessoa", async () => {
  await raiz.PUT(req("/api/agenda-filhos", "PUT", { ancora: "2026-11-28", inicio: "sexta", fim: "domingo", feriadoSegue: true }));
  let r = await ajustes.POST(req("/api/agenda-filhos/ajustes", "POST", { tipo: "troca", data: "2026-12-04", comigo: true }));
  assert.equal(r.status, 201);
  let j = await r.json();
  assert.equal(j.ajuste.data, "2026-12-05", "sexta vira o sábado");
  assert.equal(j.anterior, null);
  r = await ajustes.POST(req("/api/agenda-filhos/ajustes", "POST", { tipo: "troca", data: "2026-12-05", comigo: false }));
  j = await r.json();
  assert.equal(j.anterior, true, "o Desfazer sabe o valor de antes");
  assert.equal(tables.filhos_agenda_ajustes.length, 1);
  // Ajuste de outra pessoa com o mesmo id não é apagado.
  tables.filhos_agenda_ajustes.push({ id: "00000000-0000-4000-8000-0000000000ff", user_id: B, tipo: "troca", data: "2026-12-05", comigo: true });
  await umAjuste.DELETE(req("/x", "DELETE"), { params: Promise.resolve({ id: "00000000-0000-4000-8000-0000000000ff" }) });
  assert.equal(tables.filhos_agenda_ajustes.filter((x) => x.user_id === B).length, 1);
  await umAjuste.DELETE(req("/x", "DELETE"), { params: Promise.resolve({ id: j.ajuste.id }) });
  assert.equal(tables.filhos_agenda_ajustes.filter((x) => x.user_id === A).length, 0);
  assert.equal(semFiltroUser, 0);
});

test("zod recusa campos a mais, data impossível e user_id no corpo", async () => {
  assert.equal((await raiz.PUT(req("/api/agenda-filhos", "PUT", { ancora: "2026-02-31", inicio: "sexta", fim: "domingo", feriadoSegue: true }))).status, 400);
  assert.equal((await raiz.PUT(req("/api/agenda-filhos", "PUT", { ancora: "2026-11-28", inicio: "sexta", fim: "domingo", feriadoSegue: true, user_id: B }))).status, 400);
  assert.equal((await ajustes.POST(req("/api/agenda-filhos/ajustes", "POST", { tipo: "outro", data: "2026-12-05", comigo: true }))).status, 400);
  assert.equal((await raiz.GET(req("/api/agenda-filhos?semanas=999"))).status, 400);
  assert.equal(tables.filhos_agenda_config.length, 0);
});
