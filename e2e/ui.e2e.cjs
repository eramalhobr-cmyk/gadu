// Testes de interface (Playwright) do GaDu. Rodam contra um servidor já ligado.
//   E2E_BASE=http://localhost:3000 npm run test:e2e                 → só as telas públicas
//   E2E_BASE=... E2E_STATE=/caminho/sessao.json npm run test:e2e   → também as telas com login
// E2E_STATE é um storageState do Playwright de um usuário de TESTE (nunca dados reais).
// Nada aqui chama a IA paga: /api/chat é simulado. Voz é simulada (não substitui o teste no aparelho).
// Dados de Tarefas e Projetos vêm de fixtures; escritas no banco são bloqueadas nesses testes.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright");

const BASE = process.env.E2E_BASE;
const STATE = process.env.E2E_STATE && fs.existsSync(process.env.E2E_STATE) ? process.env.E2E_STATE : null;
const WIDTHS = [360, 390, 412, 768, 1024, 1440, 1920];
const PHONE = { width: 390, height: 844 };
const DESK = { width: 1440, height: 900 };

let browser;
before(async () => { if (BASE) browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

/** Voz simulada: modo "final" (entende "teste de voz"), "deny" (microfone negado) ou "hang" (nunca termina). */
function fakeVoice(mode) {
  return `(() => {
    window.__rec = { starts: 0, stops: 0 };
    class FakeRec {
      start() {
        window.__rec.starts++;
        const m = ${JSON.stringify(mode)};
        if (m === "deny") setTimeout(() => this.onerror && this.onerror({ error: "not-allowed" }), 50);
        if (m === "final") setTimeout(() => {
          const r = [{ transcript: "teste de voz" }]; r.isFinal = true;
          this.onresult && this.onresult({ resultIndex: 0, results: [r] });
          this.onend && this.onend();
        }, 120);
      }
      stop() { window.__rec.stops++; setTimeout(() => this.onend && this.onend(), 10); }
      abort() { this.stop(); }
    }
    window.SpeechRecognition = FakeRec; window.webkitSpeechRecognition = FakeRec;
  })();`;
}
/** Preferências no aparelho: voz da resposta desligada nos testes (determinístico). */
const quietPrefs = `try { localStorage.setItem("gadu.prefs", JSON.stringify({ voice: false, handsFree: false, voiceURI: "", rate: 1, autoSend: false })); localStorage.setItem("gadu.assist", "0"); } catch {}`;

async function page(viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, storageState: opts.auth === false ? undefined : STATE ?? undefined });
  if (opts.init !== false) await ctx.addInitScript(quietPrefs);
  if (opts.voice) await ctx.addInitScript(fakeVoice(opts.voice));
  const p = await ctx.newPage();
  p.on("pageerror", (e) => { p.__errors = (p.__errors || []).concat(String(e)); });
  return p;
}
/** Chat simulado: conta os pedidos e devolve uma resposta curta, sem IA. */
async function mockChat(p, { delay = 0, text = "Resposta de teste." } = {}) {
  const calls = { n: 0 };
  await p.route("**/api/chat", async (route) => {
    calls.n++;
    if (delay) await new Promise((r) => setTimeout(r, delay));
    const body = [{ t: "start", conversationId: null }, { t: "provider", name: "teste" }, { t: "delta", text }, { t: "done", memories: 0 }].map((x) => JSON.stringify(x)).join("\n") + "\n";
    await route.fulfill({ status: 200, contentType: "application/x-ndjson", body }).catch(() => {});
  });
  return calls;
}
/** Fixtures de Tarefas e Projetos; qualquer escrita no banco é bloqueada. */
async function fixtures(p, { tasks = [], projects = [], tasksStatus = 200 } = {}) {
  await p.route("**/rest/v1/**", async (route) => {
    const req = route.request();
    const url = req.url();
    if (req.method() !== "GET" && req.method() !== "HEAD") return route.abort();
    if (url.includes("/rest/v1/tasks")) return tasksStatus !== 200 ? route.fulfill({ status: tasksStatus, body: "{}" }) : route.fulfill({ status: 200, contentType: "application/json", headers: { "content-range": `0-${tasks.length}/${tasks.length}` }, body: JSON.stringify(tasks) });
    if (url.includes("/rest/v1/projects")) return route.fulfill({ status: 200, contentType: "application/json", headers: { "content-range": `0-${projects.length}/${projects.length}` }, body: JSON.stringify(projects) });
    return route.continue();
  });
}
async function overflowX(p) { return p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); }
/** Alvos de toque visíveis menores que 44 px (links dentro de texto corrido são exceção do WCAG 2.5.8). */
async function smallTargets(p) {
  return p.evaluate(() => [...document.querySelectorAll("button, a, input, select, textarea, [role=switch]")].filter((e) => {
    const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
    if (!r.width || !r.height || r.bottom <= 0 || cs.visibility === "hidden" || e.closest(".sr, [inert], [aria-hidden=true]")) return false;
    if (e.tagName === "A" && e.closest("p, li, small, figcaption")) return false;
    return r.height < 44 || r.width < 44;
  }).map((e) => `${(e.getAttribute("aria-label") || e.textContent || e.className).trim().slice(0, 30)} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`));
}

describe("telas públicas", { skip: !BASE && "defina E2E_BASE" }, () => {
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
});

describe("app com login", { skip: (!BASE || !STATE) && "defina E2E_BASE e E2E_STATE (usuário de teste)" }, () => {
  test("sem rolagem lateral e com alvos de 44 px em 7 larguras", async () => {
    const problems = [];
    for (const w of WIDTHS) {
      const p = await page({ width: w, height: 900 });
      for (const tab of ["hoje", "modulos", "conversa", "tarefas", "ajustes", "casa"]) {
        await p.goto(`${BASE}/app?tab=${tab}`);
        await p.waitForTimeout(1200);
        const ox = await overflowX(p);
        if (ox > 0) problems.push(`${w}px ${tab}: rolagem lateral ${ox}px`);
        const small = await smallTargets(p);
        if (small.length) problems.push(`${w}px ${tab}: ${small.join(", ")}`);
      }
      await p.context().close();
    }
    assert.deepEqual(problems, []);
  });

  test("menu do celular: abre, fecha ao tocar fora, ao escolher, com Esc e com Voltar", async () => {
    const p = await page(PHONE);
    await p.goto(`${BASE}/app?tab=hoje`);
    const open = () => p.evaluate(() => document.querySelector(".menu-wrap")?.classList.contains("open"));
    await p.click(".bar-menu");
    assert.equal(await open(), true);
    await p.mouse.click(380, 400); // fora do painel
    await p.waitForTimeout(350);
    assert.equal(await open(), false, "toque fora fecha");
    await p.click(".bar-menu");
    await p.keyboard.press("Escape");
    assert.equal(await open(), false, "Esc fecha");
    await p.click(".bar-menu");
    await p.waitForTimeout(300);
    await p.goBack();
    await p.waitForTimeout(300);
    assert.equal(await open(), false, "Voltar fecha");
    assert.match(p.url(), /tab=hoje/, "Voltar não sai da tela");
    await p.click(".bar-menu");
    await p.waitForTimeout(300);
    await p.click(".menu-panel >> text=Configurações");
    await p.waitForTimeout(300);
    assert.equal(await open(), false, "escolher fecha");
    assert.match(p.url(), /tab=ajustes/);
    await p.context().close();
  });

  test("barra de baixo e tela Módulos: planejados aparecem discretos e com o selo", async () => {
    const p = await page(PHONE);
    await p.goto(`${BASE}/app?tab=hoje`);
    const labels = await p.$$eval(".dockbar .dock-item span", (els) => els.map((e) => e.textContent));
    assert.deepEqual(labels, ["Hoje", "Conversas", "Tarefas", "Módulos"]);
    await p.click(".dock-item >> text=Módulos");
    await p.waitForSelector(".hub");
    const soon = await p.$$eval(".hub-soon-i", (els) => els.map((e) => e.textContent));
    for (const name of ["Metas & Conquistas", "Financeiro", "Casa Inteligente"]) assert.ok(soon.some((s) => s.includes(name) && s.includes("Planejado")), name);
    await p.click(".hub-soon-i >> text=Casa Inteligente");
    await p.waitForSelector(".mp-hero");
    assert.ok((await p.textContent(".honest")).includes("ainda não existe"));
    await p.context().close();
  });

  test("conteúdo não fica escondido atrás da barra de baixo", async () => {
    const p = await page(PHONE);
    await p.goto(`${BASE}/app?tab=hoje`);
    await p.waitForTimeout(1500);
    const r = await p.evaluate(() => {
      const main = document.querySelector("main.page");
      main.scrollTop = main.scrollHeight;
      const last = [...main.querySelectorAll(".wrap > *")].pop().getBoundingClientRect();
      const dock = document.querySelector(".dockbar").getBoundingClientRect();
      return { last: last.bottom, dock: dock.top };
    });
    assert.ok(r.last <= r.dock + 1, `último bloco (${r.last}) acima da barra (${r.dock})`);
    await p.context().close();
  });

  test("tema claro e escuro alternam", async () => {
    const p = await page(DESK);
    await p.goto(`${BASE}/app?tab=hoje`);
    const before = await p.getAttribute("html", "data-theme");
    await p.click(`.bar-actions [aria-label^="Usar tema"]`);
    const afterT = await p.getAttribute("html", "data-theme");
    assert.notEqual(before, afterT);
    await p.click(`.bar-actions [aria-label^="Usar tema"]`);
    await p.context().close();
  });

  test("assistente no celular: abre pelo orbe, fecha com Voltar e pela alça; histórico é o mesmo da conversa completa", async () => {
    const p = await page(PHONE);
    const calls = await mockChat(p);
    await p.goto(`${BASE}/app?tab=tarefas`);
    await p.click(".dock-orb");
    await p.waitForSelector(".assist.open");
    await p.goBack();
    await p.waitForTimeout(300);
    assert.equal(await p.$(".assist.open"), null, "Voltar fecha o assistente");
    assert.match(p.url(), /tab=tarefas/);
    await p.click(".dock-orb");
    await p.fill("#assist-msg", "olá do painel");
    await p.click(".assist [aria-label=Enviar]");
    await p.waitForSelector(".assist .bub.b >> text=Resposta de teste.");
    assert.equal(calls.n, 1);
    await p.click(".assist [aria-label='Abrir a conversa completa']");
    await p.waitForSelector(".chat-log .bub.u >> text=olá do painel");
    await p.click(".dock-item >> text=Hoje");
    await p.click(".dock-orb");
    await p.click(".assist-grab");
    assert.equal(await p.$(".assist.open"), null, "alça fecha");
    await p.context().close();
  });

  test("voz: microfone negado mostra aviso claro", async () => {
    const p = await page(PHONE, { voice: "deny" });
    await p.goto(`${BASE}/app?tab=conversa`);
    await p.click(".chat-box [aria-label=Falar]");
    await p.waitForSelector("text=O microfone está bloqueado");
    await p.context().close();
  });

  test("voz: envio automático desligado deixa a transcrição no campo para revisar", async () => {
    const p = await page(PHONE, { voice: "final" });
    const calls = await mockChat(p);
    await p.goto(`${BASE}/app?tab=conversa`);
    await p.click(".chat-box [aria-label=Falar]");
    await p.waitForTimeout(600);
    assert.equal(await p.inputValue("#msg"), "teste de voz");
    assert.equal(calls.n, 0, "não enviou sozinho");
    await p.context().close();
  });

  test("voz: escuta para sozinha em até 20 s", async () => {
    const p = await page(PHONE, { voice: "hang" });
    await p.goto(`${BASE}/app?tab=conversa`);
    await p.click(".chat-box [aria-label=Falar]");
    assert.equal(await p.getAttribute(".chat-box .round", "aria-pressed"), "true");
    await p.waitForTimeout(20_800);
    assert.equal(await p.evaluate(() => window.__rec.stops >= 1), true);
    assert.equal(await p.getAttribute(".chat-box .round", "aria-pressed"), "false");
    await p.context().close();
  });

  test("voz: tocar durante a resposta interrompe e não abre o microfone", async () => {
    const p = await page(PHONE, { voice: "hang" });
    await mockChat(p, { delay: 4000 });
    await p.goto(`${BASE}/app?tab=conversa`);
    await p.fill("#msg", "pergunta longa");
    await p.click(".chat-box [aria-label=Enviar]");
    await p.waitForSelector(".chat-box [aria-label='Parar resposta']");
    await p.click(".chat-box [aria-label='Parar resposta']");
    await p.waitForTimeout(300);
    assert.equal(await p.evaluate(() => window.__rec.starts), 0, "microfone não abriu");
    assert.ok(await p.$(".chat-box [aria-label=Falar]"), "voltou ao estado pronto");
    await p.context().close();
  });

  test("voz: trocar de tela com o microfone aberto e sem controle visível para a escuta", async () => {
    const p = await page(PHONE, { voice: "hang" });
    await p.goto(`${BASE}/app?tab=conversa`);
    await p.click(".chat-box [aria-label=Falar]");
    await p.click(".dock-item >> text=Hoje");
    await p.waitForTimeout(200);
    assert.equal(await p.evaluate(() => window.__rec.stops >= 1), true);
    await p.context().close();
  });

  test("configurações: interruptores acessíveis e envio automático desligado por padrão", async () => {
    const p = await page(PHONE);
    await p.goto(`${BASE}/app?tab=ajustes`);
    const n = await p.$$eval("[role=switch]", (els) => els.length);
    assert.ok(n >= 3);
    const auto = p.locator(".switch", { hasText: "Enviar sozinho" });
    assert.equal(await auto.locator("input").isChecked(), false);
    await auto.click();
    assert.equal(await auto.locator("input").isChecked(), true, "a linha inteira é clicável");
    await auto.click();
    await p.context().close();
  });

  test("tarefas e projetos com fixtures, estado vazio e erro", async () => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    let p = await page(PHONE);
    await fixtures(p, {
      tasks: [{ id: 1, title: "Tarefa de teste atrasada", status: "open", priority: 1, due_date: "2020-01-01", project_id: null, done_at: null, link: null, projects: null }, { id: 2, title: "Tarefa de teste de hoje", status: "open", priority: 2, due_date: today, project_id: null, done_at: null, link: null, projects: null }],
      projects: [{ id: 1, name: "Projeto de teste", goal: "Objetivo de teste", next_steps: null, status: "active", color: "sig", tasks: [{ status: "open" }, { status: "done" }] }],
    });
    await p.goto(`${BASE}/app?tab=tarefas`);
    await p.waitForSelector("text=Tarefa de teste atrasada");
    await p.waitForSelector("text=Tarefa de teste de hoje");
    await p.goto(`${BASE}/app?tab=projetos`);
    await p.waitForSelector("text=Projeto de teste");
    await p.context().close();

    p = await page(PHONE);
    await fixtures(p, { tasks: [], projects: [] });
    await p.goto(`${BASE}/app?tab=projetos`);
    await p.waitForSelector("text=Nenhum projeto ainda");
    await p.goto(`${BASE}/app?tab=tarefas`);
    await p.waitForSelector("text=Nenhuma tarefa aberta");
    await p.context().close();

    p = await page(PHONE);
    await fixtures(p, { tasksStatus: 500 });
    await p.goto(`${BASE}/app?tab=tarefas`);
    await p.waitForSelector("text=Não consegui carregar as tarefas.");
    await p.context().close();
  });

  test("computador: menu recolhível e painel do assistente com largura ajustável", async () => {
    const p = await page(DESK);
    await p.goto(`${BASE}/app?tab=hoje`);
    await p.click(".nav-collapse");
    const w = await p.evaluate(() => document.querySelector(".nav").getBoundingClientRect().width);
    assert.ok(w <= 80, `menu recolhido (${w}px)`);
    await p.click(".nav-collapse");
    await p.click(`.bar-actions [aria-label="Abrir o assistente"]`);
    await p.waitForSelector(".assist.open .assist-head");
    const head = await p.evaluate(() => document.querySelector(".assist-head").getBoundingClientRect().top);
    assert.ok(head >= 0, "cabeçalho do painel visível");
    const w1 = await p.evaluate(() => document.querySelector(".assist").getBoundingClientRect().width);
    await p.focus(".assist-resize");
    await p.keyboard.press("ArrowLeft");
    const w2 = await p.evaluate(() => document.querySelector(".assist").getBoundingClientRect().width);
    assert.ok(w2 > w1, `alargou (${w1} → ${w2})`);
    await p.keyboard.press("ArrowRight");
    await p.click(".assist-head [aria-label='Fechar o assistente']");
    await p.context().close();
  });
});
