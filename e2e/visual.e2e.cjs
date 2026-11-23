// Testes visuais do design system v2 (UX-7 · G3). Sem login, sem segredos, sem dependência nova.
//   GADU_DESIGN_PAGE=1 no servidor; E2E_BASE=http://localhost:3100 npm run test:e2e:visual
//   VISUAL_UPDATE=1 regrava as referências em e2e/visual-baseline/ (revise as imagens antes de commitar).
// Compara cada captura com a referência dentro do próprio navegador (canvas), com tolerância para antialiasing.
// As capturas da execução ficam em VISUAL_OUT (padrão /tmp/gadu-visual), com a imagem de diferença quando falha.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const h = require("./helpers.cjs");
let BASE;
const DIR = path.join(__dirname, "visual-baseline");
const OUT = process.env.VISUAL_OUT || "/tmp/gadu-visual";
const LIMITE = Number(process.env.VISUAL_MAX_DIFF || 0.02); // até 2% dos pixels diferentes
before(async () => { BASE = h.need("E2E_BASE"); await h.launch(); fs.mkdirSync(OUT, { recursive: true }); });
after(h.close);

const PARADO = `*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }`;

async function abrir(vp, tema) {
  const p = await h.page(vp, { auth: false });
  await p.context().addCookies([{ name: "gadu_theme", value: tema, url: BASE }]);
  await p.emulateMedia({ reducedMotion: "reduce" });
  const r = await p.goto(`${BASE}/design`, { waitUntil: "networkidle" });
  assert.equal(r.status(), 200, "a vitrine abre (GADU_DESIGN_PAGE=1 no servidor)");
  await p.addStyleTag({ content: PARADO });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  return p;
}

/** Fração de pixels diferentes entre duas PNGs (base64), calculada no navegador; devolve também a imagem de diferença. */
async function comparar(p, a, b) {
  return p.evaluate(async ([a, b]) => {
    const load = (s) => new Promise((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = err; i.src = `data:image/png;base64,${s}`; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    if (ia.width !== ib.width || Math.abs(ia.height - ib.height) > 2) return { frac: 1, motivo: `tamanho ${ia.width}x${ia.height} × ${ib.width}x${ib.height}` };
    const w = ia.width, hh = Math.min(ia.height, ib.height);
    const ctx = (img) => { const c = document.createElement("canvas"); c.width = w; c.height = hh; const x = c.getContext("2d"); x.drawImage(img, 0, 0); return x; };
    const da = ctx(ia).getImageData(0, 0, w, hh).data, db = ctx(ib).getImageData(0, 0, w, hh).data;
    const out = document.createElement("canvas"); out.width = w; out.height = hh; const ox = out.getContext("2d"); const od = ox.createImageData(w, hh);
    let dif = 0;
    for (let i = 0; i < da.length; i += 4) {
      const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
      const bad = d > 48; if (bad) dif++;
      od.data[i] = bad ? 255 : da[i] * 0.3; od.data[i + 1] = bad ? 0 : da[i + 1] * 0.3; od.data[i + 2] = bad ? 80 : da[i + 2] * 0.3; od.data[i + 3] = 255;
    }
    ox.putImageData(od, 0, 0);
    return { frac: dif / (w * hh), diff: out.toDataURL("image/png").split(",")[1] };
  }, [a, b]);
}

/** Contraste WCAG entre dois tokens de cor do tema, lidos do CSS computado. */
async function contrastes(p, pares) {
  return p.evaluate((pares) => {
    const cor = (v) => { const e = document.createElement("i"); e.style.color = `var(${v})`; document.body.append(e); const c = getComputedStyle(e).color; e.remove(); return c.match(/[\d.]+/g).slice(0, 3).map(Number); };
    const lum = ([r, g, b]) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    return pares.map(([a, b, min]) => { const la = lum(cor(a)), lb = lum(cor(b)); const r = (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); return { a, b, min, r: Math.round(r * 100) / 100 }; });
  }, pares);
}

const PARES = [["--ink", "--bg", 7], ["--ink-2", "--bg", 4.5], ["--ink-3", "--bg", 4.5], ["--ink", "--panel", 7], ["--ink-3", "--panel", 4.5],
  ["--hud", "--bg", 3], ["--amb", "--bg", 3], ["--sig-ink", "--sig", 4.5], ["--mic-ink", "--mic-b", 3]];

describe("design system v2 (G3)", () => {
  for (const tema of ["light", "dark"]) {
    test(`contraste dos tokens (${tema})`, async () => {
      const p = await abrir(h.PHONE, tema);
      for (const c of await contrastes(p, PARES)) assert.ok(c.r >= c.min, `${tema}: ${c.a} sobre ${c.b} = ${c.r} (mínimo ${c.min})`);
      await p.context().close();
    });
    for (const [nome, vp] of [["390", h.PHONE], ["1440", h.DESK]]) {
      test(`vitrine ${nome} ${tema}: sem rolagem lateral, alvos de 44 px e igual à referência`, async () => {
        const p = await abrir(vp, tema);
        assert.equal(await h.overflowX(p), 0, "sem rolagem lateral");
        assert.deepEqual(await h.smallTargets(p), [], "alvos de toque de 44 px");
        const png = await p.screenshot({ fullPage: true });
        const arq = `design-${nome}-${tema}.png`;
        fs.writeFileSync(path.join(OUT, arq), png);
        const ref = path.join(DIR, arq);
        if (process.env.VISUAL_UPDATE === "1") { fs.writeFileSync(ref, png); await p.context().close(); return; }
        assert.ok(fs.existsSync(ref), `falta a referência ${arq}; rode com VISUAL_UPDATE=1 e revise a imagem`);
        const r = await comparar(p, fs.readFileSync(ref).toString("base64"), png.toString("base64"));
        if (r.diff) fs.writeFileSync(path.join(OUT, arq.replace(".png", "-diff.png")), Buffer.from(r.diff, "base64"));
        assert.ok(r.frac <= LIMITE, `${arq}: ${(r.frac * 100).toFixed(2)}% diferente (limite ${LIMITE * 100}%)${r.motivo ? `, ${r.motivo}` : ""}; veja ${OUT}`);
        await p.context().close();
      });
    }
  }
});
