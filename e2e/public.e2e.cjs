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
    }));
    assert.deepEqual(st, { chat: 401, usage: 401 });
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
