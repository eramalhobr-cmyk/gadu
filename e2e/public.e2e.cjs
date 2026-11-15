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
    const p = await page(PHONE, { auth: false });
    const r = await p.request.post(`${BASE}/api/chat`, { data: { message: "oi" } });
    assert.equal(r.status(), 401);
    const u = await p.request.get(`${BASE}/api/usage`);
    assert.equal(u.status(), 401);
    await p.context().close();
  });
  test("cabeçalhos de segurança: CSP com nonce e sem iframe", async () => {
    const p = await page(PHONE, { auth: false });
    const r = await p.request.get(`${BASE}/`);
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
