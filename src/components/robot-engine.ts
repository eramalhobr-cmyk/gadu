// @ts-nocheck -- código de desenho em canvas, sem lógica de negócio.
// Rosto humanoide do GaDu: reage aos modos repouso, escutando, pensando e falando.
export type FaceMode = "idle" | "listening" | "thinking" | "speaking";
const ACC = "#5FF0DC", HOT = "#FFB454";
export const pointer = { x: 0, y: 0 };
function rgbaFn() { const c = {}; return (hex, a) => { let v = c[hex]; if (!v) { const h = String(hex).replace("#", ""); v = c[hex] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) || 0).join(","); } return "rgba(" + v + "," + Math.max(0, Math.min(1, a)).toFixed(3) + ")"; }; }
export class Robot {
  mode: FaceMode = "idle";
  constructor(canvas, o) { this.mode = "idle"; this.c = canvas; this.o = o || {}; this.rgba = rgbaFn(); this.t = 1; this.open = 0; this.level = .1; this.heat = 0; this.blink = 0; this.nextBlink = 2.2; this.blinkT = -1; this.yaw = 0; this.pitch = 0; this.bars = new Array(21).fill(.05); this.look = 0; }
  step(dt) {
    const mode = this.mode; this.t += dt; const t = this.t; let syll = 0;
    if (mode === "speaking") { const ph = Math.sin(t * 1.7) > -.72 ? 1 : .05; syll = Math.max(0, Math.min(1, .5 + .32 * Math.sin(t * 12.7) + .22 * Math.sin(t * 7.1 + 1) + .16 * Math.sin(t * 19.3))) * ph; }
    this.open += ((mode === "speaking" ? .1 + syll * .9 : 0) - this.open) * Math.min(1, dt * (mode === "speaking" ? 18 : 6));
    const lt = mode === "speaking" ? .35 + syll * .65 : (mode === "listening" ? .55 : (mode === "thinking" ? .45 : .15));
    this.level += (lt - this.level) * Math.min(1, dt * 6);
    this.heat += ((mode === "thinking" ? 1 : 0) - this.heat) * Math.min(1, dt * 3);
    this.nextBlink -= dt; if (this.nextBlink <= 0) { this.blinkT = 0; this.nextBlink = 3 + Math.random() * 3.5; }
    if (this.blinkT >= 0) { this.blinkT += dt; const p = this.blinkT / .2; this.blink = p < 1 ? Math.sin(p * Math.PI) : 0; if (p >= 1) this.blinkT = -1; }
    const ty = (this.o.compact ? 0 : pointer.x * .38) + Math.sin(t * .45) * .07 + (mode === "thinking" ? Math.sin(t * .9) * .12 : 0);
    const tp = (this.o.compact ? 0 : pointer.y * .16) + Math.sin(t * .6) * .025 + (mode === "listening" ? .05 : 0);
    this.yaw += (ty - this.yaw) * Math.min(1, dt * 2.5); this.pitch += (tp - this.pitch) * Math.min(1, dt * 2.5);
    this.look += ((mode === "thinking" ? Math.sin(t * 2.2) * .6 : pointer.x * .5) - this.look) * Math.min(1, dt * 5);
    for (let i = 0; i < this.bars.length; i++) { const d = 1 - Math.abs(i - 10) / 12; let b = .04; if (mode === "speaking") b = (.3 + .7 * Math.abs(Math.sin(t * (6 + i * .41) + i * 1.7))) * syll * d; else if (mode === "listening") b = (.15 + .35 * Math.abs(Math.sin(t * 4 - i * .5))) * d; this.bars[i] += (b - this.bars[i]) * Math.min(1, dt * 18); }
  }
  draw() {
    const c = this.c; const box = c.getBoundingClientRect(); if (box.width < 4 || box.height < 4) return;
    const dpr = Math.min(devicePixelRatio || 1, 2), Wd = Math.round(box.width * dpr), Hd = Math.round(box.height * dpr); if (c.width !== Wd || c.height !== Hd) { c.width = Wd; c.height = Hd; }
    const ctx = c.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); const w = box.width, h = box.height; ctx.clearRect(0, 0, w, h);
    const rgba = this.rgba, compact = !!this.o.compact || w < 150, mode = this.mode, t = this.t;
    const sig = this.heat > .5 ? HOT : ACC;
    const R = Math.min(w * .3, h * .3), cx = w / 2, cy = h * .45;
    const cyw = Math.cos(this.yaw), syw = Math.sin(this.yaw), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const proj = (x, y, z) => { const x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw; const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp; const f = 3.2 / (3.2 - z2); return [cx + x1 * f * R, cy + y2 * f * R, z2]; };
    const wAt = y => { if (y < 0) { const s = y / 1.22; return Math.sqrt(Math.max(0, 1 - s * s)); } const s = y / 1.12; return Math.sqrt(Math.max(0, 1 - s * s)) * (1 - .3 * s * s); };
    const surf = (u, y, lift) => { const r = wAt(y) * (1 + (lift || 0)); return proj(r * Math.sin(u), y, r * Math.cos(u) * .92); };
    // fundo e ondas
    ctx.globalCompositeOperation = "lighter";
    const gl = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 2.6); gl.addColorStop(0, rgba(sig, .07 + this.level * .1)); gl.addColorStop(.5, rgba(sig, .02)); gl.addColorStop(1, rgba(sig, 0)); ctx.fillStyle = gl; ctx.fillRect(0, 0, w, h);
    { const count = compact ? 2 : 5, speed = mode === "speaking" ? .55 : (mode === "listening" ? .4 : (mode === "thinking" ? .22 : .08));
      for (let i = 0; i < count; i++) { let p = ((t * speed) + i / count) % 1; if (mode === "listening") p = 1 - p; const s = 1.25 + p * .9; const al = Math.pow(1 - p, 1.6) * (mode === "idle" ? .08 : .16 + this.level * .45);
        ctx.beginPath(); ctx.ellipse(cx, cy, R * s, R * 1.2 * s, 0, 0, 6.2832); ctx.strokeStyle = rgba(sig, al); ctx.lineWidth = compact ? .6 : 1; ctx.setLineDash(i % 2 && !compact ? [3, 8] : []); ctx.lineDashOffset = -t * 16; ctx.stroke(); }
      ctx.setLineDash([]); }
    ctx.globalCompositeOperation = "source-over";
    // pescoço
    const nk = [[-.34, 1.02], [.34, 1.02], [.3, 1.5], [-.3, 1.5]].map(([x, y]) => proj(x, y, -.15));
    ctx.beginPath(); nk.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath();
    const ng = ctx.createLinearGradient(nk[0][0], 0, nk[1][0], 0); ng.addColorStop(0, "#0B1418"); ng.addColorStop(.5, "#16242A"); ng.addColorStop(1, "#0B1418"); ctx.fillStyle = ng; ctx.fill();
    ctx.strokeStyle = rgba(ACC, .22); ctx.lineWidth = 1; ctx.stroke();
    if (!compact) for (let k = 1; k < 4; k++) { const y = 1.05 + k * .11; const a = proj(-.33 + k * .012, y, -.15), b = proj(.33 - k * .012, y, -.15); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.strokeStyle = rgba(ACC, .16 + (k === 2 ? this.level * .4 : 0)); ctx.stroke(); }
    // silhueta da cabeça
    const ys = []; for (let i = 0; i <= 44; i++) ys.push(-1.22 + 2.34 * i / 44);
    const L = [], Rr = [];
    for (const y of ys) { let mn = null, mx = null; for (let k = 0; k < 28; k++) { const q = surf(k / 28 * 6.2832, y); if (!mn || q[0] < mn[0]) mn = q; if (!mx || q[0] > mx[0]) mx = q; } L.push(mn); Rr.push(mx); }
    const head = () => { ctx.beginPath(); Rr.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); for (let i = L.length - 1; i >= 0; i--) ctx.lineTo(L[i][0], L[i][1]); ctx.closePath(); };
    head();
    const lx = cx - R * .45 - this.yaw * R * .6, ly = cy - R * .75;
    const hg = ctx.createRadialGradient(lx, ly, R * .05, cx, cy, R * 1.45); hg.addColorStop(0, "#3A4E56"); hg.addColorStop(.35, "#1A2A30"); hg.addColorStop(.8, "#0A1216"); hg.addColorStop(1, "#05090B"); ctx.fillStyle = hg; ctx.fill();
    ctx.save(); head(); ctx.clip();
    // brilho especular e malha
    const spec = ctx.createRadialGradient(lx, ly, 0, lx, ly, R * .7); spec.addColorStop(0, "rgba(255,255,255,.16)"); spec.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = spec; ctx.fillRect(0, 0, w, h);
    if (!compact) {
      ctx.lineWidth = .7;
      for (let j = 1; j < 9; j++) { const y = -1.22 + 2.34 * j / 9; ctx.beginPath(); let on = false; for (let k = 0; k <= 40; k++) { const q = surf(-1.6 + 3.2 * k / 40, y); if (q[2] > 0) { on ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); on = true; } else on = false; } ctx.strokeStyle = rgba(ACC, .07); ctx.stroke(); }
      for (let k = -4; k <= 4; k++) { const u = k * .3; ctx.beginPath(); let on = false; for (let j = 0; j <= 30; j++) { const q = surf(u, -1.2 + 2.3 * j / 30); if (q[2] > 0) { on ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); on = true; } else on = false; } ctx.strokeStyle = rgba(ACC, k === 0 ? .2 : .06); ctx.stroke(); }
      // costuras dos painéis
      ctx.strokeStyle = rgba(ACC, .28); ctx.lineWidth = 1;
      ctx.beginPath(); for (let k = 0; k <= 24; k++) { const q = surf(-1.25 + 2.5 * k / 24, -.62 + Math.pow((k - 12) / 12, 2) * .1); k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); } ctx.stroke();
      ctx.beginPath(); for (let k = 0; k <= 24; k++) { const q = surf(-.95 + 1.9 * k / 24, .78 - Math.pow((k - 12) / 12, 2) * .14); k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); } ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = rgba(ACC, .45); ctx.lineWidth = compact ? .8 : 1.2; head(); ctx.stroke();
    // orelhas (módulos)
    for (const side of [-1, 1]) {
      const q = surf(side * 1.5, -.12, .04); if (q[2] < -.55) continue;
      const vis = Math.max(.25, Math.min(1, (q[2] + .6) * 1.2)), rr = R * .2 * (compact ? 1 : 1);
      const sx = Math.max(.3, Math.abs(Math.cos(this.yaw + side * 1.5 - side * Math.PI / 2)));
      ctx.save(); ctx.translate(q[0], q[1]); ctx.scale(Math.max(.35, 1 - Math.abs(side * Math.PI / 2 - this.yaw) * 0 + 0) * .55 + .1 * sx, 1);
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, 6.2832); ctx.fillStyle = "#0B1418"; ctx.fill(); ctx.strokeStyle = rgba(ACC, .4 * vis); ctx.lineWidth = 1.2; ctx.stroke();
      ctx.globalCompositeOperation = "lighter";
      ctx.beginPath(); ctx.arc(0, 0, rr * .62, t * (1 + this.heat * 3), t * (1 + this.heat * 3) + 4.2); ctx.strokeStyle = rgba(sig, (.45 + this.level * .5) * vis); ctx.lineWidth = compact ? 1 : 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, rr * .22, 0, 6.2832); ctx.fillStyle = rgba(sig, (.5 + this.level * .5) * vis); ctx.fill();
      ctx.restore(); ctx.globalCompositeOperation = "source-over";
    }
    // visor
    const vTop = -.3, vBot = .1, vU = 1.08;
    const vis = () => { ctx.beginPath(); for (let k = 0; k <= 30; k++) { const u = -vU + 2 * vU * k / 30; const q = surf(u, vTop + Math.pow(u / vU, 2) * .1, .01); k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); } for (let k = 30; k >= 0; k--) { const u = -vU + 2 * vU * k / 30; const q = surf(u, vBot - Math.pow(u / vU, 4) * .06, .01); ctx.lineTo(q[0], q[1]); } ctx.closePath(); };
    vis(); const vc = surf(0, -.1); const vg = ctx.createLinearGradient(0, vc[1] - R * .3, 0, vc[1] + R * .25); vg.addColorStop(0, "#02060A"); vg.addColorStop(.5, "#061016"); vg.addColorStop(1, "#010305"); ctx.fillStyle = vg; ctx.fill();
    ctx.strokeStyle = rgba(sig, .55); ctx.lineWidth = compact ? .8 : 1.2; ctx.stroke();
    ctx.save(); vis(); ctx.clip(); ctx.globalCompositeOperation = "lighter";
    const sh = ctx.createLinearGradient(vc[0] - R, vc[1] - R * .3, vc[0] + R, vc[1] + R * .2); sh.addColorStop(0, "rgba(255,255,255,0)"); sh.addColorStop(.42, "rgba(255,255,255,0)"); sh.addColorStop(.5, "rgba(255,255,255,.07)"); sh.addColorStop(.58, "rgba(255,255,255,0)"); ctx.fillStyle = sh; ctx.fillRect(0, 0, w, h);
    // olhos
    const eyeOpen = Math.max(.08, 1 - this.blink) * (mode === "listening" ? 1.15 : (mode === "thinking" ? .6 : 1));
    for (const side of [-1, 1]) {
      const q = surf(side * .4 + this.look * .06, -.1, .02); if (q[2] < 0) continue;
      const ew = R * .3 * (.55 + .45 * Math.max(0, q[2])), eh = R * .085 * eyeOpen;
      const eg = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], ew * 1.3); eg.addColorStop(0, rgba(sig, .55 + this.level * .3)); eg.addColorStop(1, rgba(sig, 0)); ctx.fillStyle = eg; ctx.fillRect(q[0] - ew * 1.4, q[1] - ew, ew * 2.8, ew * 2);
      ctx.beginPath(); ctx.ellipse(q[0], q[1], ew / 2, Math.max(.8, eh), 0, 0, 6.2832); ctx.fillStyle = rgba(sig, .95); ctx.fill();
      ctx.beginPath(); ctx.ellipse(q[0] + this.look * ew * .18, q[1], ew * .14, Math.max(.6, eh * .7), 0, 0, 6.2832); ctx.fillStyle = "rgba(242,255,252,.95)"; ctx.fill();
    }
    if (this.heat > .3) { const u = Math.sin(t * 3) * vU * .9; const q = surf(u, -.1, .02); ctx.fillStyle = rgba(HOT, .8 * this.heat); ctx.fillRect(q[0] - 1.5, q[1] - R * .1, 3, R * .2); }
    ctx.restore();
    // boca: barra de luz com a onda de voz
    const mL = surf(-.36, .55, .02), mR = surf(.36, .55, .02), mC = surf(0, .55, .02);
    ctx.globalCompositeOperation = "lighter";
    const nb = compact ? 9 : 21;
    if (this.open > .05 || mode === "listening") {
      for (let i = 0; i < nb; i++) { const f = (i + .5) / nb, x = mL[0] + (mR[0] - mL[0]) * f, y = mL[1] + (mR[1] - mL[1]) * f, v = this.bars[Math.floor(i * 21 / nb)] || 0; const half = Math.max(.8, R * .16 * Math.min(1, v + this.open * .15)); const bw = Math.max(1, Math.abs(mR[0] - mL[0]) / nb * .5); ctx.fillStyle = rgba(v > .6 ? "#F2FFFC" : sig, .55 + v * .45); ctx.fillRect(x - bw / 2, y - half, bw, half * 2); }
    } else { ctx.beginPath(); ctx.moveTo(mL[0], mL[1]); ctx.quadraticCurveTo(mC[0], mC[1] + R * .015, mR[0], mR[1]); ctx.strokeStyle = rgba(sig, .65); ctx.lineWidth = compact ? 1 : 2; ctx.stroke(); }
    const mg = ctx.createRadialGradient(mC[0], mC[1], 0, mC[0], mC[1], R * .45); mg.addColorStop(0, rgba(sig, .12 + this.level * .15)); mg.addColorStop(1, rgba(sig, 0)); ctx.fillStyle = mg; ctx.fillRect(mC[0] - R * .5, mC[1] - R * .3, R, R * .6);
    // led da testa
    const fl = surf(0, -.82, .02); if (fl[2] > 0) { ctx.beginPath(); ctx.arc(fl[0], fl[1], Math.max(1.2, R * .025), 0, 6.2832); ctx.fillStyle = rgba(sig, .5 + .5 * Math.abs(Math.sin(t * (mode === "thinking" ? 6 : 1.5)))); ctx.fill(); }
    ctx.globalCompositeOperation = "source-over";
  }
}
