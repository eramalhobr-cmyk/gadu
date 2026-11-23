// Testes de celular EMULADOS (sem login, sem segredos): perfis Android (Chrome e Samsung Internet) e iPhone (WebKit).
//   E2E_BASE=http://127.0.0.1:3100 npm run test:e2e:mobile
// Emulação NÃO é aparelho de verdade: teclado, voz, push e o botão Voltar físico ficam no docs/CHECKLIST_CELULAR.md.
// Só lê páginas públicas (GET) e registra o service worker no próprio navegador de teste; nada grava em lugar nenhum.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium, webkit, devices } = require("playwright");
const h = require("./helpers.cjs");

let BASE;
const browsers = {};
const ANDROID_CHROME_UA = "Mozilla/5.0 (Linux; Android 16; SM-S938B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";
const SAMSUNG_INTERNET_UA = "Mozilla/5.0 (Linux; Android 16; SM-S938B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/29.0 Chrome/140.0.0.0 Mobile Safari/537.36";

// "Galaxy S26 Ultra" não existe na lista do Playwright: usamos a largura CSS típica da família (412x915, escala 3.5) com o UA do Chrome e do Samsung Internet.
const PROFILES = [
  { name: "Pixel 7 (Chrome)", engine: "chromium", opts: { ...devices["Pixel 7"] } },
  { name: "Galaxy S9+ (Chrome, 320 px)", engine: "chromium", opts: { ...devices["Galaxy S9+"] } },
  { name: "Galaxy 412x915 (Chrome)", engine: "chromium", opts: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 3.5, isMobile: true, hasTouch: true, userAgent: ANDROID_CHROME_UA } },
  { name: "Galaxy 412x915 (Samsung Internet)", engine: "chromium", opts: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 3.5, isMobile: true, hasTouch: true, userAgent: SAMSUNG_INTERNET_UA } },
  { name: "iPhone 14 (WebKit)", engine: "webkit", opts: { ...devices["iPhone 14"] } },
];
const PAGES = ["/", "/login", "/convite/invalido", "/offline", "/privacidade"];

before(async () => {
  BASE = h.need("E2E_BASE");
  browsers.chromium = await chromium.launch();
  browsers.webkit = await webkit.launch();
});
after(async () => { await browsers.chromium?.close(); await browsers.webkit?.close(); });

async function open(profile, extra = {}) {
  const ctx = await browsers[profile.engine].newContext({ ...profile.opts, ...extra });
  // WebKit não isenta localhost da diretiva "upgrade-insecure-requests" da CSP e tentaria carregar CSS e JS por https
  // (que não existe no servidor de teste). Só neste caso, e só em http, tira essa diretiva da resposta da página.
  // Em produção (https) nada é alterado.
  if (profile.engine === "webkit" && BASE.startsWith("http:")) {
    await ctx.route("**/*", async (route) => {
      if (route.request().resourceType() !== "document") return route.continue();
      const res = await route.fetch();
      const headers = { ...res.headers() };
      if (headers["content-security-policy"]) headers["content-security-policy"] = headers["content-security-policy"].replace(/;?\s*upgrade-insecure-requests/, "");
      await route.fulfill({ response: res, headers });
    });
  }
  const p = await ctx.newPage();
  p.__csp = [];
  p.on("console", (m) => { if (/content security policy/i.test(m.text())) p.__csp.push(m.text()); });
  p.on("pageerror", (e) => { p.__errors = (p.__errors || []).concat(String(e)); });
  return p;
}
const pngSize = (b) => (b.toString("latin1", 1, 4) === "PNG" ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : null);

for (const prof of PROFILES) {
  describe(`celular · ${prof.name}`, () => {
    test("páginas públicas: sem rolagem lateral, alvos de toque de 44 px e sem erro de página", async () => {
      const p = await open(prof);
      const problems = [];
      for (const path of PAGES) {
        await p.goto(`${BASE}${path}`);
        await p.waitForTimeout(400);
        const ox = await h.overflowX(p);
        if (ox > 0) problems.push(`${path}: rolagem lateral de ${ox}px`);
        const small = await h.smallTargets(p);
        if (small.length) problems.push(`${path}: alvos pequenos ${small.join(", ")}`);
      }
      assert.deepEqual(problems, []);
      assert.equal(p.__errors, undefined, String(p.__errors));
      await p.context().close();
    });

    test("viewport: largura do aparelho, viewport-fit=cover e zoom NÃO bloqueado", async () => {
      const p = await open(prof);
      await p.goto(`${BASE}/login`);
      const content = await p.locator('meta[name="viewport"]').getAttribute("content");
      const parts = Object.fromEntries(content.split(",").map((x) => x.trim().split("=")));
      assert.equal(parts.width, "device-width");
      assert.equal(parts["initial-scale"], "1");
      assert.equal(parts["viewport-fit"], "cover");
      assert.equal(parts["user-scalable"], undefined, "user-scalable=no bloqueia o zoom (acessibilidade)");
      const max = parts["maximum-scale"];
      assert.ok(max === undefined || Number(max) >= 2, `maximum-scale=${max} limita o zoom`);
      const iw = await p.evaluate(() => window.innerWidth);
      assert.equal(iw, prof.opts.viewport.width, "a página usa a largura do aparelho (sem viewport de 980 px)");
      await p.context().close();
    });

    test("campos de texto com 16 px ou mais (o iPhone não dá zoom ao focar)", async () => {
      const p = await open(prof);
      for (const path of ["/login"]) {
        await p.goto(`${BASE}${path}`);
        const bad = await p.evaluate(() => [...document.querySelectorAll("input:not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea, select")]
          .filter((e) => e.getBoundingClientRect().width > 0 && parseFloat(getComputedStyle(e).fontSize) < 16)
          .map((e) => `${e.tagName} ${e.id || e.name || e.type} ${getComputedStyle(e).fontSize}`));
        assert.deepEqual(bad, [], path);
      }
      await p.context().close();
    });

    test("campo de e-mail do login: teclado certo, sem capitalização nem autocorreção", async () => {
      const p = await open(prof);
      await p.goto(`${BASE}/login`);
      const a = await p.evaluate(() => { const e = document.querySelector("#email"); return e && { type: e.type, im: e.inputMode, ac: e.autocomplete, cap: e.getAttribute("autocapitalize"), eh: e.enterKeyHint }; });
      assert.ok(a, "campo #email existe");
      assert.equal(a.type, "email");
      assert.equal(a.im, "email");
      assert.equal(a.ac, "username");
      assert.equal(a.cap, "none");
      await p.context().close();
    });

    test("barras fixas e rodapés respeitam a área segura (env(safe-area-inset-*)) e usam dvh", async () => {
      const p = await open(prof);
      await p.goto(`${BASE}/`);
      // Lê o CSS publicado pelo servidor (WebKit não deixa ler document.styleSheets de arquivos externos).
      const hrefs = await p.$$eval('link[rel="stylesheet"]', (els) => els.map((e) => e.href));
      assert.ok(hrefs.length > 0, "sem CSS na página");
      let all = "";
      for (const href of hrefs) all += await (await p.request.get(href)).text();
      const css = [...all.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), `${m[1].trim()}{${m[2]}}`]);
      const find = (sel) => css.filter(([s]) => s.split(",").some((x) => x.trim() === sel)).map(([, t]) => t).join("\n");
      // Barras fixas do app autenticado (folha, barra de baixo, assistente) e topo/rodapé da home.
      for (const [sel, side] of [[".dockbar", "bottom"], [".assist", "bottom"], [".sheet", "bottom"], [".lp-top", "top"], [".lp-foot", "bottom"], [".app", "top"]]) {
        assert.match(find(sel), new RegExp(`var\\(--safe-${side[0]}\\)|env\\(safe-area-inset-${side}`), `${sel} sem área segura (${side})`);
      }
      const root = find(":root");
      assert.match(root, /--safe-b:\s*env\(safe-area-inset-bottom/);
      assert.match(find(".app"), /100dvh/, ".app deve usar 100dvh, não 100vh");
      assert.doesNotMatch(css.map(([, t]) => t).join("\n"), /height:\s*100vh/, "100vh esconde barras atrás da barra do navegador");
      await p.context().close();
    });

    test("tema: claro por padrão, theme-color do tema em uso, cor-esquema e sem destaque cinza no toque", async () => {
      const p = await open(prof);
      await p.goto(`${BASE}/login`);
      assert.equal(await p.getAttribute("html", "data-theme"), "light", "claro é o padrão");
      const metas = await p.$$eval('meta[name="theme-color"]', (els) => els.map((e) => e.content));
      assert.deepEqual(metas, ["#f1f5fa"]);
      await p.context().addCookies([{ name: "gadu_theme", value: "dark", url: BASE }]);
      await p.goto(`${BASE}/login`);
      assert.equal(await p.getAttribute("html", "data-theme"), "dark", "a escolha salva vale");
      assert.deepEqual(await p.$$eval('meta[name="theme-color"]', (els) => els.map((e) => e.content)), ["#0a111e"]);
      const tap = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("-webkit-tap-highlight-color"));
      if (prof.engine === "chromium") assert.match(tap, /transparent|rgba\(0, 0, 0, 0\)/);
      const ob = await p.evaluate(() => getComputedStyle(document.body).overscrollBehaviorY);
      assert.equal(ob, "none");
      const ta = await p.evaluate(() => getComputedStyle(document.querySelector("button, a")).touchAction);
      assert.equal(ta, "manipulation");
      await p.context().close();
    });

    test("manifest acessível e válido, com ícones 192, 512 e maskable que existem de verdade", async () => {
      const p = await open(prof);
      await p.goto(`${BASE}/login`);
      const link = await p.locator('link[rel="manifest"]').getAttribute("href");
      assert.equal(link, "/manifest.webmanifest");
      const res = await p.request.get(`${BASE}${link}`);
      assert.equal(res.status(), 200);
      assert.match(res.headers()["content-type"] ?? "", /manifest\+json|application\/json/);
      const m = await res.json();
      for (const k of ["name", "short_name", "id", "start_url", "scope", "background_color", "theme_color", "lang"]) assert.ok(m[k], `manifest.${k}`);
      assert.equal(m.display, "standalone");
      assert.equal(m.scope, "/");
      assert.ok(m.start_url.startsWith(m.scope), "start_url dentro do escopo");
      assert.match(m.theme_color, /^#[0-9a-f]{6}$/i);
      assert.equal(m.background_color, "#f1f5fa", "ícone e abertura do app com fundo claro");
      const sizes = new Set(m.icons.filter((i) => !i.purpose || i.purpose === "any").map((i) => i.sizes));
      assert.ok(sizes.has("192x192") && sizes.has("512x512"), "ícones 192 e 512");
      const mask = m.icons.find((i) => i.purpose === "maskable");
      assert.ok(mask, "ícone maskable");
      for (const i of m.icons) {
        const r = await p.request.get(new URL(i.src, BASE).href);
        assert.equal(r.status(), 200, i.src);
        assert.match(r.headers()["content-type"], /image\/png/, i.src);
        const dim = pngSize(await r.body());
        assert.ok(dim, `${i.src} é PNG`);
        assert.equal(`${dim.w}x${dim.h}`, i.sizes, `${i.src} declara ${i.sizes}`);
      }
      const apple = await p.locator('link[rel="apple-touch-icon"]').getAttribute("href");
      assert.equal((await p.request.get(new URL(apple, BASE).href)).status(), 200, "apple-touch-icon");
      assert.equal(await p.locator('meta[name="mobile-web-app-capable"], meta[name="apple-mobile-web-app-capable"]').count() > 0, true, "meta de app instalado (Android/iOS)");
      assert.deepEqual(p.__csp, [], "CSP bloqueou algo");
      await p.context().close();
    });

    test("service worker: registra com escopo / e a CSP permite; sem internet mostra a tela offline", async () => {
      const p = await open(prof);
      await p.goto(`${BASE}/login`);
      const reg = await p.evaluate(async () => {
        const r = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        return { scope: r.scope };
      });
      assert.equal(reg.scope, `${new URL(BASE).origin}/`);
      const sw = await p.request.get(`${BASE}/sw.js`);
      assert.match(sw.headers()["content-type"], /javascript/);
      assert.match(sw.headers()["cache-control"], /no-cache|max-age=0/, "sw.js nunca fica preso em cache");
      // A tela offline já está guardada no aparelho (pré-cache feito na instalação do service worker).
      const cached = await p.evaluate(async () => { const r = await caches.match("/offline"); return r ? await r.text() : ""; });
      assert.match(cached, /sem internet/i, "/offline guardada no cache");
      // Navegação sem internet. LIMITAÇÃO CONHECIDA do Playwright WebKit: context.setOffline(true) corta a rede antes do
      // service worker, então nem um recurso já guardado no cache dele é entregue (diagnóstico em docs/TESTES_E2E.md).
      // No WebKit a navegação offline NÃO é verificada aqui: vale a checagem do cache acima + conferir no iPhone real
      // (docs/CHECKLIST_CELULAR.md). Chromium verifica de verdade.
      if (prof.engine === "webkit") {
        console.log("# WebKit: navegação offline não verificável via setOffline; conferir no iPhone (docs/CHECKLIST_CELULAR.md)");
      } else {
        await p.evaluate(() => (navigator.serviceWorker.controller ? 1 : new Promise((r) => navigator.serviceWorker.addEventListener("controllerchange", r))));
        await p.context().setOffline(true);
        await p.goto(`${BASE}/login?off=1`).catch(() => {});
        const text = await p.locator("body").innerText();
        assert.match(text, /sem internet/i, "tela offline amigável");
        await p.context().setOffline(false);
      }
      assert.deepEqual(p.__csp, [], "CSP bloqueou algo");
      await p.context().close();
    });
  });
}

describe("celular · instalável (Chrome DevTools Protocol)", () => {
  for (const prof of PROFILES.filter((x) => x.engine === "chromium")) {
    test(`${prof.name}: Page.getInstallabilityErrors devolve vazio`, async () => {
      const p = await open(prof);
      await p.goto(`${BASE}/login`);
      await p.evaluate(async () => { await navigator.serviceWorker.register("/sw.js"); await navigator.serviceWorker.ready; });
      await p.reload();
      const cdp = await p.context().newCDPSession(p);
      await cdp.send("Page.enable");
      let errors = [];
      for (let i = 0; i < 10; i++) { // a checagem roda assíncrona depois do carregamento
        errors = (await cdp.send("Page.getInstallabilityErrors")).installabilityErrors;
        if (!errors.length) break;
        await p.waitForTimeout(500);
      }
      assert.deepEqual(errors, [], JSON.stringify(errors));
      const mf = await cdp.send("Page.getAppManifest");
      assert.equal(mf.errors.filter((e) => e.critical).length, 0, JSON.stringify(mf.errors));
      assert.deepEqual(mf.errors.map((e) => e.message), [], "o manifest não gera nem avisos");
      await p.context().close();
    });
  }
});
