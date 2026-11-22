// Testes de interface com login, contra um servidor ligado e um usuário de TESTE isolado (nunca dados reais).
//   E2E_BASE=... E2E_STATE=/caminho/sessao.json npm run test:e2e:auth
//   ou E2E_BASE=... E2E_EMAIL=... E2E_PASSWORD=... (a sessão é criada pelo login de senha do próprio app)
// Faltando variável, a execução FALHA: teste pulado não conta como aprovado.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers.cjs");
const { login } = require("./login.cjs");
const { WIDTHS, PHONE, DESK, page: rawPage, mockChat, fixtures, overflowX, smallTargets } = h;
let BASE, STATE;
before(async () => {
  BASE = h.need("E2E_BASE");
  STATE = h.STATE ?? (process.env.E2E_EMAIL ? await login(BASE, h.need("E2E_EMAIL"), h.need("E2E_PASSWORD")) : h.need("E2E_STATE"));
  await h.launch();
});
after(h.close);
const page = (vp, opts = {}) => rawPage(vp, { ...opts, state: STATE });

describe("app com login", () => {
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

  test("celular sem menu lateral: a conta e os módulos ficam em Mais", async () => {
    const p = await page(PHONE);
    await p.goto(`${BASE}/app?tab=hoje`);
    assert.equal(await p.$(".bar-menu"), null, "sem botão de menu no topo");
    assert.equal(await p.$(".menu-wrap"), null, "sem menu sanfona");
    await p.click(".dock-item >> text=Mais");
    await p.waitForSelector(".more");
    assert.match(p.url(), /tab=modulos/);
    await p.click(".more-tile >> text=Configurações");
    await p.waitForSelector("#g-conta");
    assert.match(p.url(), /tab=ajustes/);
    // Endereços antigos continuam válidos e abrem a mesma tela de Configurações.
    for (const old of ["perfil", "integracoes"]) {
      await p.goto(`${BASE}/app?tab=${old}`);
      await p.waitForSelector("#g-conta");
      assert.equal(await p.textContent(".bar-title h1"), "Configurações");
    }
    await p.context().close();
  });

  test("barra de baixo e tela Mais: só o que funciona, planejados numa linha Em breve", async () => {
    const p = await page(PHONE);
    await p.goto(`${BASE}/app?tab=hoje`);
    const labels = await p.$$eval(".dockbar .dock-item span", (els) => els.map((e) => e.textContent));
    assert.deepEqual(labels, ["Hoje", "Conversa", "Tarefas", "Mais"]);
    assert.ok(await p.$(".dockbar .dock-mic[aria-label='Falar com o GaDu']"), "microfone grande no centro");
    await p.click(".dock-item >> text=Mais");
    await p.waitForSelector(".more");
    const tiles = await p.$$eval(".more-tile", (els) => els.map((e) => e.textContent));
    // Financeiro e Metas a um toque (somem se FINANCE_ENABLED=0 ou GOALS_ENABLED=0 no servidor de teste).
    for (const name of ["Agenda", "Financeiro", "Metas", "Projetos", "Memória", "Agentes", "Conversas anteriores", "Configurações", "Ajuda"]) {
      assert.ok(tiles.some((t) => t.includes(name)), name);
    }
    assert.ok(!tiles.some((t) => /Planejado|Beta/.test(t)), "sem selos técnicos nos blocos");
    await p.click(".more-soon >> text=Casa Inteligente");
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

  test("assistente no celular: abre pelo microfone central, fecha com Voltar e pela alça; histórico é o mesmo da conversa completa", async () => {
    const p = await page(PHONE);
    const calls = await mockChat(p);
    await p.goto(`${BASE}/app?tab=tarefas`);
    await p.click(".dock-mic");
    await p.waitForSelector(".assist.open");
    await p.goBack();
    await p.waitForTimeout(300);
    assert.equal(await p.$(".assist.open"), null, "Voltar fecha o assistente");
    assert.match(p.url(), /tab=tarefas/);
    await p.click(".dock-mic");
    await p.fill("#assist-msg", "olá do painel");
    await p.click(".assist [aria-label=Enviar]");
    await p.waitForSelector(".assist .bub.b >> text=Resposta de teste.");
    assert.equal(calls.n, 1);
    await p.click(".assist [aria-label='Abrir a conversa completa']");
    await p.waitForSelector(".chat-log .bub.u >> text=olá do painel");
    await p.click(".dock-item >> text=Hoje");
    await p.click(".dock-mic");
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
