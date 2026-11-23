// Testes de interface públicos (sem login e sem segredos). Rodam no CI.
//   E2E_BASE=http://localhost:3100 npm run test:e2e:public
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers.cjs");
const { WIDTHS, PHONE, DESK, page, overflowX, smallTargets } = h;
let BASE;
before(async () => { BASE = h.need("E2E_BASE"); await h.launch(); });
after(h.close);

describe("telas públicas", () => {
  test("home mostra os módulos com status real, incluindo Casa e Metas", async () => {
    const p = await page(DESK, { auth: false });
    await p.goto(`${BASE}/`);
    const html = await p.content();
    for (const t of ["Casa Inteligente", "Metas &amp; Conquistas", "Contexto da tela", "Inteligência integrada entre módulos"]) assert.ok(html.includes(t), t);
    assert.equal(await overflowX(p), 0);
    await p.context().close();
  });
  test("app sem login vai para o login", async () => {
    const p = await page(PHONE, { auth: false });
    await p.goto(`${BASE}/app`);
    assert.match(p.url(), /\/login/);
    await p.context().close();
  });
  test("home e login sem rolagem lateral e com alvos de 44 px em 7 larguras", async () => {
    const problems = [];
    for (const w of WIDTHS) {
      const p = await page({ width: w, height: 900 }, { auth: false });
      for (const path of ["/", "/login"]) {
        await p.goto(`${BASE}${path}`);
        await p.waitForTimeout(500);
        const ox = await overflowX(p);
        if (ox > 0) problems.push(`${w}px ${path}: rolagem lateral ${ox}px`);
        const small = await smallTargets(p);
        if (small.length) problems.push(`${w}px ${path}: ${small.join(", ")}`);
      }
      await p.context().close();
    }
    assert.deepEqual(problems, []);
  });
  test("API protegida recusa sem login, antes de qualquer custo", async () => {
    // Pelo próprio navegador (mesma rede e proxy da página), sem sessão.
    const p = await page(PHONE, { auth: false });
    await p.goto(`${BASE}/`);
    const st = await p.evaluate(async () => ({
      chat: (await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "oi" }) })).status,
      usage: (await fetch("/api/usage")).status,
      erro: (await fetch("/api/telemetria/erro", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rota: "/app", nome: "TypeError" }) })).status,
      erros: (await fetch("/api/admin/erros")).status,
    }));
    assert.deepEqual(st, { chat: 401, usage: 401, erro: 401, erros: 401 });
    await p.context().close();
  });
  test("Core: /api/attention (cartão Merece sua atenção) recusa sem login, mesmo com parâmetros", async () => {
    const p = await page(PHONE, { auth: false });
    await p.goto(`${BASE}/`);
    const st = await p.evaluate(async () => ({
      plain: (await fetch("/api/attention")).status,
      limit: (await fetch("/api/attention?limit=3")).status,
      forged: (await fetch("/api/attention?user_id=00000000-0000-0000-0000-000000000001")).status,
    }));
    assert.deepEqual(st, { plain: 401, limit: 401, forged: 401 });
    await p.context().close();
  });
  test("Finanças: as rotas /api/finance/* recusam sem login (401), com qualquer método ou parâmetro", async () => {
    const p = await page(PHONE, { auth: false });
    await p.goto(`${BASE}/`);
    const id = "00000000-0000-4000-8000-000000000001";
    const st = await p.evaluate(async (id) => {
      const call = async (path, method = "GET", body) => (await fetch(path, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined })).status;
      return {
        resumo: await call("/api/finance/resumo?ano=2026&mes=11"),
        itens: await call("/api/finance/itens?ano=2026&mes=11"),
        itensPost: await call("/api/finance/itens", "POST", { tipo: "despesa", nome: "x" }),
        itemPatch: await call(`/api/finance/itens/${id}`, "PATCH", { nome: "y" }),
        itemDelete: await call(`/api/finance/itens/${id}`, "DELETE"),
        itemMes: await call(`/api/finance/itens/${id}/mes`, "PUT", { ano: 2026, mes: 11, pago: true }),
        gastos: await call("/api/finance/gastos?ano=2026&mes=11"),
        gastosPost: await call("/api/finance/gastos", "POST", { ano: 2026, mes: 11, dia: 1, valor: 1, user_id: id }),
        gastoPatch: await call(`/api/finance/gastos/${id}`, "PATCH", { valor: 2 }),
        gastoDelete: await call(`/api/finance/gastos/${id}`, "DELETE"),
        config: await call("/api/finance/config"),
        configPut: await call("/api/finance/config", "PUT", { dia_restante: 5 }),
      };
    }, id);
    assert.deepEqual(Object.values(st), Array(12).fill(401), JSON.stringify(st));
    await p.context().close();
  });
  test("Metas: as rotas /api/goals/* recusam sem login (401), com qualquer método ou parâmetro", async () => {
    const p = await page(PHONE, { auth: false });
    await p.goto(`${BASE}/`);
    const id = "00000000-0000-4000-8000-000000000001";
    const st = await p.evaluate(async (id) => {
      const call = async (path, method = "GET", body) => (await fetch(path, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined })).status;
      return {
        lista: await call("/api/goals"),
        listaStatus: await call("/api/goals?status=ativa"),
        criar: await call("/api/goals", "POST", { titulo: "x", valor_alvo: 5, user_id: id }),
        resumo: await call("/api/goals/resumo"),
        detalhe: await call(`/api/goals/${id}`),
        editar: await call(`/api/goals/${id}`, "PATCH", { titulo: "y" }),
        progresso: await call(`/api/goals/${id}/progresso`, "POST", { valor: 1 }),
        progressoApagar: await call(`/api/goals/${id}/progresso/${id}`, "DELETE"),
        marcoCriar: await call(`/api/goals/${id}/marcos`, "POST", { titulo: "x" }),
        marcoEditar: await call(`/api/goals/${id}/marcos/${id}`, "PATCH", { concluido: true }),
        marcoApagar: await call(`/api/goals/${id}/marcos/${id}`, "DELETE"),
        tarefaVincular: await call(`/api/goals/${id}/tarefas`, "POST", { task_id: 1 }),
        tarefaDesvincular: await call(`/api/goals/${id}/tarefas/1`, "DELETE"),
      };
    }, id);
    assert.deepEqual(Object.values(st), Array(13).fill(401), JSON.stringify(st));
    await p.context().close();
  });
  test("3D Studio: rota da API e tela recusam sem login; o motor isolado tem CSP própria e sem rede", async () => {
    const p = await page(PHONE, { auth: false });
    await p.goto(`${BASE}/`);
    const st = await p.evaluate(async () => {
      const post = (body) => fetch("/api/3d/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      return {
        gerar: (await post({ modo: "novo", pedido: "uma caixa" })).status,
        gerarForjado: (await post({ modo: "novo", pedido: "uma caixa", user_id: "00000000-0000-0000-0000-000000000001" })).status,
        outroMetodo: (await fetch("/api/3d/generate")).status,
        outraRota: (await fetch("/api/3d/qualquer")).status,
      };
    });
    assert.deepEqual(st, { gerar: 401, gerarForjado: 401, outroMetodo: 401, outraRota: 401 }, JSON.stringify(st));
    // A tela 3D sem login manda para o login (com o interruptor desligado ou ligado, ninguém vê nada sem sessão).
    await p.goto(`${BASE}/app/3d`);
    assert.match(p.url(), /\/login/);
    // Motor isolado: CSP própria (sem rede, só WebAssembly deste endereço) e a das páginas sem 'wasm-unsafe-eval'.
    const w = await p.request.get(`${BASE}/vendor/openscad/render-worker.js`);
    assert.equal(w.status(), 200);
    const wcsp = w.headers()["content-security-policy"] ?? "";
    assert.match(wcsp, /connect-src 'none'/);
    assert.match(wcsp, /script-src 'self' 'wasm-unsafe-eval'/);
    const home = await p.request.get(`${BASE}/`);
    assert.doesNotMatch(home.headers()["content-security-policy"] ?? "", /wasm-unsafe-eval/);
    const lic = await p.request.get(`${BASE}/vendor/openscad/LICENSE.txt`);
    assert.equal(lic.status(), 200);
    assert.match(await lic.text(), /GNU GENERAL PUBLIC LICENSE/);
    await p.context().close();
  });
  test("cabeçalhos de segurança: CSP com nonce e sem iframe", async () => {
    const p = await page(PHONE, { auth: false });
    const r = await p.goto(`${BASE}/`);
    const csp = r.headers()["content-security-policy"] ?? "";
    assert.match(csp, /script-src 'self' 'nonce-/);
    assert.match(csp, /frame-ancestors 'none'/);
    await p.context().close();
  });
  test("tema claro na home sem erros de página", async () => {
    const p = await page(DESK, { auth: false });
    await p.context().addCookies([{ name: "gadu_theme", value: "light", url: BASE }]);
    await p.goto(`${BASE}/`);
    assert.equal(await p.getAttribute("html", "data-theme"), "light");
    assert.deepEqual(p.__errors ?? [], []);
    await p.context().close();
  });
});
