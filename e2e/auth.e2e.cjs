// Testes de interface com login, contra um servidor ligado e um usuário de TESTE isolado (nunca dados reais).
//   E2E_BASE=... E2E_STATE=/caminho/sessao.json npm run test:e2e:auth
//   ou E2E_BASE=... E2E_EMAIL=... E2E_PASSWORD=... (a sessão é criada pelo login de senha do próprio app)
// Faltando variável, a execução FALHA: teste pulado não conta como aprovado.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers.cjs");
const { login } = require("./login.cjs");
const { WIDTHS, PHONE, DESK, page: rawPage, mockChat, fixtures, dismissGuide, overflowX, smallTargets } = h;
let BASE, STATE;
before(async () => {
  BASE = h.need("E2E_BASE");
  STATE = h.STATE ?? (process.env.E2E_EMAIL ? await login(BASE, h.need("E2E_EMAIL"), h.need("E2E_PASSWORD")) : h.need("E2E_STATE"));
  await h.launch();
});
after(h.close);
// O guia de primeiro uso (UX-4) abre sozinho para pessoa nova: os testes o pulam, menos o teste do próprio guia ({ guia: true }).
const page = async (vp, { guia, ...opts } = {}) => {
  const p = await rawPage(vp, { ...opts, state: STATE });
  if (!guia && p.addLocatorHandler) await p.addLocatorHandler(p.getByRole("button", { name: "Pular o guia" }).first(), (b) => b.click());
  return p;
};
/** Tocar e segurar o microfone central abre o painel do assistente para escrever (um toque abre a tela de escuta). */
async function holdMic(p) {
  const b = await p.locator(".dock-mic").boundingBox();
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await p.mouse.down();
  await p.waitForTimeout(800);
  await p.mouse.up();
}

describe("app com login", () => {
  test("sem rolagem lateral e com alvos de 44 px em 7 larguras", async () => {
    const problems = [];
    for (const w of WIDTHS) {
      const p = await page({ width: w, height: 900 });
      for (const tab of ["hoje", "modulos", "conversa", "tarefas", "ajustes", "casa"]) {
        await p.goto(`${BASE}/app?tab=${tab}`);
        await p.waitForTimeout(1200);
        // Pessoa nova vê o guia abrir sozinho: ele também precisa ter alvos de 44 px, e depois é fechado para medir a tela de baixo.
        if (tab === "hoje" && await p.getByRole("dialog").isVisible()) {
          const smallGuide = await smallTargets(p);
          if (smallGuide.length) problems.push(`${w}px guia: ${smallGuide.join(", ")}`);
          await dismissGuide(p);
        }
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

  test("Lista de compras no celular: adiciona, marca, reabre e remove um item", async () => {
    const p = await page(PHONE);
    const item = "Aveia de teste " + Date.now();
    try {
      await p.goto(`${BASE}/app?tab=modulos`);
      await p.getByRole("button", { name: /Lista de compras/ }).click();
      await p.getByLabel("O que você precisa comprar?").fill(item);
      await p.getByRole("button", { name: "Adicionar", exact: true }).click();
      const checkbox = p.getByRole("checkbox", { name: new RegExp(item) });
      await checkbox.waitFor();
      const comprado = p.locator("label").filter({ hasText: item }).getByText("Comprado", { exact: true });
      await checkbox.click();
      await comprado.waitFor();
      await p.reload();
      await checkbox.waitFor();
      assert.ok(await checkbox.isChecked(), "estado salvo na conta");
      await checkbox.click();
      await p.getByText("Item voltou aos pendentes.", { exact: true }).waitFor();
      await checkbox.waitFor();
      assert.ok(!await checkbox.isChecked(), "item voltou aos pendentes");
      assert.equal(await overflowX(p), 0, "sem rolagem lateral no celular");
      await p.getByRole("button", { name: `Remover ${item}` }).click();
      await p.getByText("Item removido.", { exact: true }).waitFor();
      await p.waitForFunction((nome) => !document.querySelector('input[type="checkbox"]') || !Array.from(document.querySelectorAll('label')).some((el) => el.textContent.includes(nome)), item);
    } finally {
      await p.context().close();
    }
  });

  test("Compras no celular: pedidos lidos do e-mail, entrega de hoje e Google desconectado", async () => {
    const p = await page(PHONE);
    try {
      // /api/compras simulado com dados sintéticos: o teste nunca lê e-mail real.
      const hoje = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
      const pedido = (o) => ({ chave: o.numero, loja: "Loja Exemplo", numero: o.numero, situacao: o.situacao, previsao: o.previsao ?? null, rastreio: o.rastreio ?? null, atualizadoEm: new Date().toISOString(), emails: 1, thread: "t" + o.numero, assunto: "Pedido " + o.numero });
      const a = pedido({ numero: "111111", situacao: "enviado", previsao: hoje, rastreio: "AB123456789BR" });
      const b = pedido({ numero: "222222", situacao: "confirmado" });
      let conectado = true;
      await p.route("**/api/compras", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(conectado
        ? { connected: true, hoje, pedidos: [a, b], calendario: { dias: [{ dia: hoje, pedidos: [a] }], semPrevisao: [b] }, omitidos: 1 }
        : { connected: false, error: "not_connected" }) }));
      await p.goto(`${BASE}/app?tab=modulos`);
      await p.getByRole("button", { name: /^Compras/ }).click();
      await p.getByText("Pedido 111111", { exact: false }).first().waitFor();
      assert.match(p.url(), /tab=compras/);
      await p.getByText("Próximas entregas").waitFor();
      await p.getByText("Sem previsão no e-mail").first().waitFor();
      assert.ok(await p.getByRole("button", { name: "Copiar o código de rastreio AB123456789BR" }).isVisible(), "rastreio a um toque");
      await p.getByText("1 e-mail ficou de fora", { exact: false }).waitFor();
      assert.equal(await overflowX(p), 0, "sem rolagem lateral no celular");
      assert.deepEqual(await smallTargets(p), [], "alvos de 44 px");
      conectado = false;
      await p.reload();
      await p.getByRole("link", { name: "Conectar o Google" }).waitFor();
    } finally {
      await p.context().close();
    }
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
    assert.ok(!tiles.filter((t) => !t.startsWith("3D")).some((t) => /Planejado|Beta/.test(t)), "sem selos técnicos nos blocos");
    // UX-7: Mais agrupado por áreas, cada grupo com um exemplo do que dizer.
    const groups = await p.$$eval(".more-group h2", (els) => els.map((e) => e.textContent));
    for (const g of ["Meu dia", "Agentes e criação", "Conta e ajuda"]) assert.ok(groups.includes(g), `grupo ${g}`);
    assert.ok((await p.$$(".more-head p")).length >= 3, "exemplo do que dizer em cada grupo");
    // 3D Studio (Beta): desligado por padrão (MODELING_3D_ENABLED só liga com 1). Sem a variável no servidor de teste, não aparece
    // nem em "Em breve" como bloco; com E2E_3D=1 (servidor com a variável), aparece como "3D" e abre /app/3d.
    const com3d = process.env.E2E_3D === "1";
    assert.equal(tiles.some((t) => t.startsWith("3D")), com3d, "entrada 3D só com o interruptor ligado");
    await p.click(".more-soon >> text=Casa Inteligente");
    await p.waitForSelector(".mp-hero");
    assert.ok((await p.textContent(".honest")).includes("ainda não existe"));
    await p.context().close();
  });

  test("Hoje: até 5 blocos, lista única com Feito/Adiar no item e Desfazer", async () => {
    const p = await page(PHONE);
    await fixtures(p, { tasks: [] });
    const patches = [];
    // Depois de fixtures: este tratador vem primeiro e deixa gravar (PATCH) só a tarefa fictícia.
    await p.route("**/rest/v1/tasks**", async (route) => {
      if (route.request().method() === "PATCH") { patches.push(route.request().postDataJSON()); return route.fulfill({ status: 204, body: "" }); }
      return route.fallback();
    });
    await p.route("**/api/attention**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      enabled: true, more: 0, unavailable: [],
      items: [{ tag: "T1", kind: "atrasada", label: "Tarefa atrasada", text: "Tarefa fictícia de teste", view: "tarefas", omitted: false, ref: { table: "tasks", id: 999999 } }],
    }) }));
    await p.goto(`${BASE}/app?tab=hoje`);
    await p.waitForSelector(".attn-i >> text=Tarefa fictícia de teste");
    const blocks = await p.$$eval(".today2 > section, .today2 > .panel", (els) => els.length);
    assert.ok(blocks <= 6, `blocos no Hoje: ${blocks}`);
    for (const band of ["Agora", "Depois", "Progresso"]) assert.ok(await p.$(`.band-t >> text=${band}`), `faixa ${band} (UX-7)`);
    assert.ok(await p.$(".band-prog .prog-ring"), "progresso do dia");
    for (const gone of ["Módulos do GaDu", "Precisa de atenção", "Recomendações do GaDu"]) assert.equal(await p.$(`text=${gone}`), null, gone);
    assert.ok(await p.$(".talk-big >> text=Falar com o GaDu"), "botão grande de falar");
    await p.click(".attn-i [aria-label^='Feito']");
    await p.waitForSelector(".undo-toast >> text=Desfazer");
    assert.equal(await p.$(".attn-i >> text=Tarefa fictícia de teste"), null, "some da lista");
    await p.getByText("Entre os e-mails recentes consultados", { exact: false }).waitFor();
    await p.click(".undo-toast >> text=Desfazer");
    await p.waitForSelector(".attn-i >> text=Tarefa fictícia de teste");
    assert.equal(patches.length, 2, "gravou e desfez");
    assert.equal(patches[0].status, "done");
    assert.equal(patches[1].status, "open");
    // Lembretes: ficam em "Mais opções" (UX-4); o número abre a lista aqui mesmo.
    await p.click(".more-opts > summary");
    await p.click(".see-i[aria-controls=rem-list]");
    await p.waitForSelector("#rem-list");
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

  test("assistente no celular: abre ao segurar o microfone central, fecha com Voltar e pela alça; histórico é o mesmo da conversa completa", async () => {
    const p = await page(PHONE);
    const calls = await mockChat(p);
    await p.goto(`${BASE}/app?tab=tarefas`);
    await holdMic(p);
    await p.waitForSelector(".assist.open");
    await p.goBack();
    await p.waitForTimeout(300);
    assert.equal(await p.$(".assist.open"), null, "Voltar fecha o assistente");
    assert.match(p.url(), /tab=tarefas/);
    await holdMic(p);
    await p.fill("#assist-msg", "olá do painel");
    await p.click(".assist [aria-label=Enviar]");
    await p.waitForSelector(".assist .bub.b >> text=Resposta de teste.");
    assert.equal(calls.n, 1);
    await p.click(".assist [aria-label='Abrir a conversa completa']");
    await p.waitForSelector(".chat-log .bub.u >> text=olá do painel");
    await p.click(".dock-item >> text=Hoje");
    await holdMic(p);
    await p.click(".assist-grab");
    assert.equal(await p.$(".assist.open"), null, "alça fecha");
    await p.context().close();
  });

  test("voz em um toque: tela de escuta com letra grande, envio sozinho em 3 s e Cancelar", async () => {
    let p = await page(PHONE, { voice: "final" });
    let calls = await mockChat(p);
    await p.goto(`${BASE}/app?tab=tarefas`);
    await p.click(".dock-mic");
    await p.waitForSelector(".listen-status >> text=Enviando em");
    assert.equal(await p.textContent(".listen-text"), "teste de voz");
    await p.waitForSelector(".listen", { state: "detached", timeout: 6000 });
    await p.waitForSelector(".assist.open .bub.b >> text=Resposta de teste.");
    assert.equal(calls.n, 1, "enviou sozinho depois da contagem");
    await p.context().close();

    p = await page(PHONE, { voice: "final" });
    calls = await mockChat(p);
    await p.goto(`${BASE}/app?tab=hoje`);
    await p.click(".talk-big");
    await p.waitForSelector(".listen-status >> text=Enviando em");
    await p.click(".listen-row >> text=Cancelar");
    await p.waitForTimeout(3500);
    assert.equal(calls.n, 0, "Cancelar não envia");
    await p.goBack();
    await p.waitForTimeout(300);
    assert.equal(await p.$(".listen"), null, "Voltar fecha a tela de escuta");
    assert.match(p.url(), /tab=hoje/);
    await p.context().close();
  });

  test("modo voz imersivo (G1): tela cheia, núcleo com anéis e espectro ligado ao nível da voz", async () => {
    const p = await page(PHONE, { voice: "hang" });
    await p.goto(`${BASE}/app?tab=hoje`);
    await p.click(".dock-mic");
    await p.waitForSelector(".listen-wrap.imersivo .vcore");
    assert.equal(await p.$$eval(".vcore .vc-spec line", (l) => l.length), 60, "60 traços no espectro");
    assert.match(await p.$eval(".listen-chip", (e) => e.textContent || ""), /Ouvindo/i);
    const box = await p.$eval(".listen", (e) => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height }; });
    assert.ok(box.w >= 389 && box.h >= 800, `tela cheia (${box.w}x${box.h})`);
    await p.waitForFunction(() => getComputedStyle(document.querySelector(".vcore")).getPropertyValue("--lvl").trim() !== "");
    const lvl = Number(await p.$eval(".vcore", (e) => e.style.getPropertyValue("--lvl")));
    assert.ok(lvl >= 0 && lvl <= 1, `--lvl entre 0 e 1 (${lvl})`);
    await p.keyboard.press("Escape");
    assert.equal(await p.$(".listen"), null);
    await p.context().close();
  });

  test("palco de voz (UX-7): avatar grande na escuta e na Conversa, pequeno ao digitar", async () => {
    let p = await page(PHONE, { voice: "hang" });
    await p.goto(`${BASE}/app?tab=hoje`);
    await p.click(".dock-mic");
    await p.waitForSelector(".listen-ava.on canvas");
    const ava = await p.$eval(".listen-ava", (e) => e.getBoundingClientRect().width);
    assert.ok(ava >= 150, `avatar da escuta com ${ava}px`);
    await p.keyboard.press("Escape");
    await p.click(".dock-item >> text=Conversa");
    await p.waitForSelector(".chat2.stage-big");
    const big = await p.$eval(".chat-ava", (e) => e.getBoundingClientRect().width);
    assert.ok(big >= 110, `avatar da Conversa vazia com ${big}px`);
    await p.focus("#msg");
    await p.waitForTimeout(400);
    const small = await p.$eval(".chat-ava", (e) => e.getBoundingClientRect().width);
    assert.ok(small <= 50, `avatar encolhe ao digitar (${small}px)`);
    await p.context().close();

    p = await page(DESK, { voice: "hang" });
    await p.goto(`${BASE}/app?tab=conversa`);
    await p.waitForSelector(".chat-ava canvas");
    const desk = await p.$eval(".chat-ava", (e) => e.getBoundingClientRect().width);
    assert.ok(desk >= 240, `palco do computador com ${desk}px`);
    await p.context().close();
  });

  test("Guia: Mapa do GaDu mostra as ligações e o que dizer (UX-7)", async () => {
    const p = await page(PHONE);
    await p.goto(`${BASE}/app/guia#mapa`);
    await p.waitForSelector(".gmap-svg");
    const nodes = await p.$$eval(".gmap-svg a", (a) => a.map((e) => e.getAttribute("aria-label")));
    assert.ok(nodes.includes("Abrir Tarefas") && nodes.includes("Abrir Agenda"), `nós do mapa: ${nodes}`);
    const rows = await p.$$eval(".gmap-list li", (l) => l.map((e) => e.textContent));
    assert.ok(rows.length >= 3 && rows.every((t) => t.includes("“")), "cada ligação traz uma frase para dizer");
    assert.ok((await overflowX(p)) <= 0, "mapa sem rolagem lateral");
    await p.context().close();
  });

  test("um microfone só no celular (UX-7 R3): o do campo aparece ao escrever", async () => {
    const p = await page(PHONE, { voice: "hang" });
    await p.goto(`${BASE}/app?tab=conversa`);
    await p.waitForSelector(".dock-mic");
    assert.equal(await p.isVisible(".chat-box [aria-label=Falar]"), false, "sem microfone duplicado em repouso");
    await p.focus("#msg");
    assert.equal(await p.isVisible(".chat-box [aria-label=Falar]"), true, "ditado ao escrever");
    await p.context().close();
    const d = await page(DESK, { voice: "hang" });
    await d.goto(`${BASE}/app?tab=conversa`);
    assert.equal(await d.isVisible(".chat-box [aria-label=Falar]"), true, "no computador o microfone do campo fica");
    await d.context().close();
  });

  test("o que posso dizer aqui (UX-7 M5): frases da tela, pelo botão ou pedindo", async () => {
    const p = await page(PHONE);
    let chats = 0;
    p.on("request", (r) => { if (r.url().includes("/api/chat")) chats++; });
    await p.goto(`${BASE}/app?tab=metas`);
    await p.click(".say-btn");
    await p.waitForSelector(".say-pop >> text=Corri 5 km hoje");
    await p.click(".say-pop >> text=Corri 5 km hoje");
    assert.equal(await p.isVisible(".say-pop"), false, "fecha ao escolher");
    assert.equal(await p.inputValue("#assist-msg"), "Corri 5 km hoje", "a frase vai para o campo do assistente, sem enviar");
    await p.goto(`${BASE}/app?tab=conversa`);
    await p.fill("#msg", "O que posso dizer aqui?");
    await p.click(".chat-form [aria-label=Enviar]");
    await p.waitForSelector(".say-pop >> text=Começa uma conversa nova");
    await p.keyboard.press("Escape");
    assert.equal(await p.isVisible(".say-pop"), false, "Esc fecha");
    assert.equal(chats, 0, "sem chamar o modelo");
    await p.context().close();
  });

  test("navegação por intenção (UX-7 G2): abre e volta sem chamar o modelo", async () => {
    const d = await page(DESK);
    let chats = 0;
    d.on("request", (r) => { if (r.url().includes("/api/chat")) chats++; });
    await d.goto(`${BASE}/app?tab=conversa`);
    await d.fill("#msg", "abre a agenda");
    await d.click(".chat-form [aria-label=Enviar]");
    await d.waitForURL(/tab=agenda/);
    await d.click("[aria-label='Abrir o assistente']");
    await d.fill("#assist-msg", "volta");
    await d.click(".assist-composer [aria-label=Enviar]");
    await d.waitForURL(/tab=conversa/);
    assert.equal(chats, 0, "sem chamar o modelo");
    await d.context().close();
  });

  test("painéis de resumo (G2): “mostra o resumo das tarefas” abre o painel, sem número inventado", async () => {
    const d = await page(DESK);
    let chats = 0;
    d.on("request", (r) => { if (r.url().includes("/api/chat")) chats++; });
    await d.goto(`${BASE}/app?tab=hoje`);
    await d.waitForSelector("#painel .gkpi-row");
    await d.click("[aria-label='Abrir o assistente']");
    await d.fill("#assist-msg", "mostra o resumo das tarefas");
    await d.click(".assist-composer [aria-label=Enviar]");
    await d.waitForURL(/tab=tarefas/);
    await d.waitForSelector("#painel .gkpi-row");
    for (const tab of ["tarefas", "metas", "agentes"]) {
      await d.goto(`${BASE}/app?tab=${tab}`);
      const txt = await d.waitForSelector("#painel", { timeout: 15000 }).then((el) => el.innerText()).catch(() => "");
      if (tab === "tarefas") assert.ok(txt, `${tab}: tem painel`); // metas e agentes só mostram painel quando existe algum registro
      assert.ok(!/NaN|undefined|Infinity/.test(txt), `${tab}: sem NaN/undefined no painel`);
    }
    assert.equal(chats, 0, "sem chamar o modelo");
    await d.context().close();
  });

  test("resumo falado dos painéis (M4): botão Ouvir e “lê o resumo”", async () => {
    const d = await page(DESK);
    let chats = 0;
    d.on("request", (r) => { if (r.url().includes("/api/chat")) chats++; });
    await d.goto(`${BASE}/app?tab=tarefas`);
    await d.waitForSelector("#painel[data-falar]:not([data-falar=''])", { timeout: 15000 });
    await d.evaluate(() => { window.__falas = []; window.speechSynthesis.speak = (u) => { window.__falas.push(u.text); }; });
    await d.click("#painel .pnl-ouvir");
    await d.waitForFunction(() => window.__falas.join(" ").length > 0);
    assert.match(await d.evaluate(() => window.__falas.join(" ")), /tarefa/i, "fala o resumo das tarefas");
    const box = await d.$eval("#painel .pnl-ouvir", (b) => { const r = b.getBoundingClientRect(); return { w: r.width, h: r.height }; });
    assert.ok(box.w >= 44 && box.h >= 44, "botão Ouvir com 44 px");
    assert.equal(chats, 0, "sem chamar o modelo");
    await d.context().close();
  });

  test("paleta Ctrl+K e menu compacto (UX-7 M6), sem chamar o modelo", async () => {
    const d = await page(DESK);
    let chats = 0;
    d.on("request", (r) => { if (r.url().includes("/api/chat")) chats++; });
    await d.goto(`${BASE}/app?tab=hoje`);
    await d.waitForSelector(".pal-btn");
    await d.keyboard.press("Control+k");
    await d.waitForSelector(".pal [role=combobox]");
    await d.keyboard.type("agen");
    await d.keyboard.press("Enter");
    await d.waitForURL(/tab=agenda/);
    assert.equal(await d.$(".pal"), null, "fecha ao executar");
    await d.keyboard.press("Control+k");
    await d.keyboard.type("recolher");
    await d.keyboard.press("Enter");
    await d.waitForSelector(".app.nav-mini");
    await d.click("[aria-label='Abrir o assistente']");
    await d.fill("#assist-msg", "expande o menu");
    await d.click(".assist-composer [aria-label=Enviar]");
    await d.waitForSelector(".app:not(.nav-mini)");
    await d.keyboard.press("Control+k");
    await d.keyboard.press("Escape");
    assert.equal(await d.$(".pal"), null, "Esc fecha");
    assert.equal(chats, 0, "sem chamar o modelo");
    await d.context().close();
  });

  test("“e-mails da vercel não são importantes” cria a regra na Memória, sem chamar o modelo", async () => {
    const d = await page(DESK);
    let chats = 0;
    d.on("request", (r) => { if (r.url().includes("/api/chat")) chats++; });
    await d.goto(`${BASE}/app?tab=hoje`);
    await d.click("[aria-label='Abrir o assistente']");
    await d.waitForSelector("#assist-msg");
    const salvou = d.waitForResponse((r) => r.url().includes("/api/email/nao-importante") && r.request().method() === "POST");
    await d.fill("#assist-msg", "e-mails da vercel não são importantes");
    await d.click(".assist-composer [aria-label=Enviar]");
    assert.equal((await salvou).status(), 200, "a regra foi gravada");
    await d.goto(`${BASE}/app?tab=memoria`);
    await d.waitForFunction(() => document.body.innerText.includes("E-mails de vercel não são importantes"), null, { timeout: 15000 });
    assert.equal(chats, 0, "sem chamar o modelo");
    await d.context().close();
  });

  test("tema JARVIS (G2): barra flutuante, microfone sólido por cima e nada escondido atrás dela", async () => {
    const p = await page(PHONE);
    await p.goto(`${BASE}/app?tab=hoje`);
    await p.waitForSelector(".dock-mic");
    const r = await p.evaluate(() => {
      const mic = document.querySelector(".dock-mic"), bar = document.querySelector(".dockbar");
      const cs = getComputedStyle(mic), bs = getComputedStyle(bar);
      const main = document.querySelector("main.page") || document.querySelector("#conteudo");
      const lineAbove = [...document.querySelectorAll(".dock-item[aria-current]")].map((e) => getComputedStyle(e, "::before").display);
      return { z: cs.zIndex, bg: cs.backgroundImage, border: cs.borderTopWidth, radius: bs.borderTopLeftRadius, micTop: mic.getBoundingClientRect().top, mainBottom: main ? main.getBoundingClientRect().bottom : 0, lineAbove };
    });
    assert.equal(r.z, "3", "microfone por cima da barra e do conteúdo");
    assert.match(r.bg, /linear-gradient/, "microfone preenchido");
    assert.equal(r.border, "0px", "sem traço em volta do microfone");
    assert.equal(r.radius, "30px", "barra flutuante arredondada");
    assert.ok(r.lineAbove.every((d) => d === "none"), "sem traço por cima do item atual");
    assert.ok(r.mainBottom > 0 && r.mainBottom <= r.micTop + 1, `a área rolável termina acima do microfone (${r.mainBottom} ≤ ${r.micTop})`);
    await p.context().close();
  });

  test("voz: microfone negado mostra aviso claro", async () => {
    const p = await page(PHONE, { voice: "deny" });
    await p.goto(`${BASE}/app?tab=conversa`);
    await p.focus("#msg"); // UX-7 R3: no celular o microfone do campo só aparece ao escrever (ditado para revisar)
    await p.click(".chat-box [aria-label=Falar]");
    await p.waitForSelector("text=O microfone está bloqueado");
    await p.context().close();
  });

  test("voz: envio automático desligado deixa a transcrição no campo para revisar", async () => {
    const p = await page(PHONE, { voice: "final" });
    const calls = await mockChat(p);
    await p.goto(`${BASE}/app?tab=conversa`);
    await p.focus("#msg"); // UX-7 R3: no celular o microfone do campo só aparece ao escrever (ditado para revisar)
    await p.click(".chat-box [aria-label=Falar]");
    await p.waitForTimeout(600);
    assert.equal(await p.inputValue("#msg"), "teste de voz");
    assert.equal(calls.n, 0, "não enviou sozinho");
    await p.context().close();
  });

  test("voz: escuta para sozinha em até 20 s", async () => {
    const p = await page(PHONE, { voice: "hang" });
    await p.goto(`${BASE}/app?tab=conversa`);
    await p.focus("#msg"); // UX-7 R3: no celular o microfone do campo só aparece ao escrever (ditado para revisar)
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
    await p.focus("#msg"); // UX-7 R3: no celular o microfone do campo só aparece ao escrever (ditado para revisar)
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
    // UX-7: menu lateral agrupado por áreas, como a tela Mais.
    const navGroups = await p.$$eval(".nav .nav-group-t", (els) => els.map((e) => e.textContent));
    assert.ok(navGroups.includes("Meu dia") && navGroups.includes("Agentes e criação"), `grupos do menu: ${navGroups}`);
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

  test("guia de primeiro uso: 3 passos, pular, Voltar do Android fecha e refazer em Configurações", async () => {
    const p = await page(PHONE, { guia: true });
    await p.goto(`${BASE}/app?tab=ajustes`);
    // Pessoa nova (usuário do CI): o guia abre sozinho no passo 1. Quem já passou por ele (usuário de teste antigo) não vê nada aqui.
    const abriuSozinho = await p.getByRole("dialog").waitFor({ timeout: 4000 }).then(() => true, () => false);
    if (abriuSozinho) {
      assert.match(await p.getByRole("dialog").innerText(), /Passo 1 de 3/);
      await p.getByRole("button", { name: "Pular o guia" }).last().click();
      await p.getByRole("dialog").waitFor({ state: "detached" });
    }
    await p.click("text=Ver o guia de primeiro uso");
    const guia = p.getByRole("dialog");
    await guia.waitFor();
    assert.match(await guia.innerText(), /Passo 1 de 3/);
    await guia.getByRole("button", { name: "Continuar" }).click();
    assert.match(await guia.innerText(), /Passo 2 de 3/);
    await guia.getByRole("button", { name: "Continuar" }).click();
    assert.match(await guia.innerText(), /Passo 3 de 3/);
    // Voltar do Android fecha o guia (uma entrada no histórico).
    await p.goBack();
    await guia.waitFor({ state: "detached" });
    assert.match(p.url(), /\/app/);
    // Pular fecha de novo.
    await p.click("text=Ver o guia de primeiro uso");
    await p.getByRole("button", { name: "Pular o guia" }).last().click();
    await guia.waitFor({ state: "detached" });
    await p.context().close();
  });

  test("3D Studio no celular: Abrir uma peça salva mostra a prévia, o pedido e as versões", async () => {
    // Precisa do interruptor ligado no servidor (scripts/e2e-auth-local.sh define MODELING_3D_ENABLED=1 e E2E_3D=1).
    assert.equal(process.env.E2E_3D, "1", "E2E_3D=1 e MODELING_3D_ENABLED=1 no servidor de teste");
    const p = await page(PHONE);
    await p.goto(`${BASE}/app/3d`);
    const SCAD1 = "lado = 20; // [5:1:50] Lado do cubo (mm)\n$fn = 24;\ncube(lado);";
    const SCAD2 = "lado = 22; // [5:1:50] Lado do cubo (mm)\n$fn = 24;\ncube(lado);";
    const criado = await p.evaluate(async ({ scad, pedido }) => {
      const r = await fetch("/api/3d/pecas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pedido, scad }) });
      const j = await r.json();
      return { ok: r.ok, status: r.status, id: j?.peca?.id, titulo: j?.peca?.titulo };
    }, { scad: SCAD1, pedido: "Um cubo de teste de 20 mm" });
    assert.equal(criado.ok, true, `criar peça: HTTP ${criado.status}`);
    assert.ok(criado.id, "id da peça");
    const versao = await p.evaluate(async ({ id, scad }) => {
      const r = await fetch(`/api/3d/pecas/${id}/versoes`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ modo: "refinar", pedido: "Deixa 2 mm mais alto", scad }) });
      return { ok: r.ok, status: r.status };
    }, { id: criado.id, scad: SCAD2 });
    assert.equal(versao.ok, true, `versão: HTTP ${versao.status}`);

    const aguardarVisivel = (sel) => p.waitForFunction((s) => {
      const el = document.querySelector(s);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.bottom > 40 && r.top < window.innerHeight - 20 && r.width > 0;
    }, sel);

    await p.goto(`${BASE}/app/3d`);
    await p.waitForSelector(".s3d-pecas");
    await p.getByRole("button", { name: `Abrir ${criado.titulo}` }).click();
    await p.waitForSelector("#s3d-peca");
    await p.waitForSelector("#s3d-pedido");
    await p.waitForSelector("#s3d-versoes");
    assert.match(await p.locator("#s3d-pedido").innerText(), /cubo de teste de 20 mm/i);
    assert.match(await p.locator("#s3d-versoes").innerText(), /Versões \(2\)/);
    assert.match(await p.locator("#s3d-versoes").innerText(), /Deixa 2 mm mais alto/);
    await aguardarVisivel("#s3d-peca");

    await p.goto(`${BASE}/app/3d?peca=${criado.id}`);
    await p.waitForSelector("#s3d-peca");
    await p.waitForSelector("#s3d-pedido");
    await p.waitForSelector("#s3d-versoes");
    assert.match(await p.locator("#s3d-pedido").innerText(), /cubo de teste de 20 mm/i);
    assert.match(await p.locator("#s3d-versoes").innerText(), /Versões \(2\)/);
    await aguardarVisivel("#s3d-peca");
    await p.context().close();
  });
});
