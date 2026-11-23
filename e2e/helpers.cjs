// Funções comuns dos testes de interface do GaDu (Playwright).
// Nada aqui chama a IA paga: /api/chat é simulado. Voz é simulada (não substitui o teste no aparelho).
const fs = require("node:fs");
const { chromium } = require("playwright");

/** Exige uma variável de ambiente. Faltando, o teste FALHA (nunca é pulado nem conta como aprovado). */
function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Defina ${name} para rodar estes testes. Sem ela, a execução falha de propósito (teste pulado não conta como aprovado).`);
  return v;
}
const BASE = process.env.E2E_BASE ?? "";
const STATE = process.env.E2E_STATE && fs.existsSync(process.env.E2E_STATE) ? process.env.E2E_STATE : null;
let browser;
async function launch() { browser = await chromium.launch(); return browser; }
async function close() { await browser?.close(); }

const WIDTHS = [360, 390, 412, 768, 1024, 1440, 1920];
const PHONE = { width: 390, height: 844 };
const DESK = { width: 1440, height: 900 };


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
  const ctx = await browser.newContext({ viewport, storageState: opts.auth === false ? undefined : opts.state ?? STATE ?? undefined });
  if (opts.init !== false) await ctx.addInitScript(quietPrefs);
  if (opts.voice) await ctx.addInitScript(fakeVoice(opts.voice));
  const p = await ctx.newPage();
  p.on("pageerror", (e) => { p.__errors = (p.__errors || []).concat(String(e)); });
  // E2E_DEBUG=1: mostra falhas de rede, erros do console e respostas 4xx/5xx (sem corpo nem cabeçalhos, para não vazar sessão).
  if (process.env.E2E_DEBUG === "1") {
    const short = (u) => u.replace(/\?.*$/, "");
    p.on("requestfailed", (r) => console.error(`[debug] falhou ${r.method()} ${short(r.url())}: ${r.failure()?.errorText}`));
    p.on("response", (r) => { if (r.status() >= 400) console.error(`[debug] HTTP ${r.status()} ${r.request().method()} ${short(r.url())}`); });
    p.on("console", (m) => { if (m.type() === "error") console.error(`[debug] console: ${m.text().slice(0, 200)}`); });
    p.on("pageerror", (e) => console.error(`[debug] pageerror: ${String(e).slice(0, 200)}`));
  }
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
/** Fecha o guia de primeiro uso se ele abriu sozinho (pessoa nova). Não faz nada se não abrir em 2 s. */
async function dismissGuide(p) {
  const skip = p.getByRole("button", { name: "Pular o guia" }).first();
  if (await skip.waitFor({ state: "visible", timeout: 2000 }).then(() => true, () => false)) {
    await skip.click();
    await skip.waitFor({ state: "hidden" });
  }
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


module.exports = { need, BASE, STATE, WIDTHS, PHONE, DESK, launch, close, page, mockChat, fixtures, dismissGuide, overflowX, smallTargets };
