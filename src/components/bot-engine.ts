// @ts-nocheck -- código de desenho em canvas, sem lógica de negócio.
// Robô compacto do Gadu: cabeça em "squircle" com visor de vidro, olhos de LED e boca equalizadora.
// Estados: repouso (respira e pisca), escutando (olhos abertos, ondas), pensando (varredura âmbar), falando (equalizador).
import { pointer, type FaceMode } from "./robot-engine";

const SIG = [95, 240, 220], HOT = [255, 180, 84];
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const col = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

function squircle(ctx, x, y, w, h, r) {
  // Retângulo de cantos contínuos (superelipse aproximada): mais moderno que um círculo ou um quadrado.
  const k = 0.62;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.bezierCurveTo(x + w - r * (1 - k), y, x + w, y + r * (1 - k), x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.bezierCurveTo(x + w, y + h - r * (1 - k), x + w - r * (1 - k), y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.bezierCurveTo(x + r * (1 - k), y + h, x, y + h - r * (1 - k), x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.bezierCurveTo(x, y + r * (1 - k), x + r * (1 - k), y, x + r, y);
  ctx.closePath();
}

export class Bot {
  mode: FaceMode = "idle";
  constructor(canvas, o) {
    this.c = canvas; this.o = o || {}; this.t = 0; this.heat = 0; this.level = 0.15; this.open = 0;
    this.blink = 0; this.blinkT = -1; this.nextBlink = 2.4; this.lx = 0; this.ly = 0; this.tilt = 0;
    this.bars = new Array(9).fill(0.08); this.eyeH = 1;
  }
  step(dt) {
    const m = this.mode; this.t += dt; const t = this.t;
    this.heat += ((m === "thinking" ? 1 : 0) - this.heat) * Math.min(1, dt * 3);
    const lt = m === "speaking" ? 0.85 : m === "listening" ? 0.7 : m === "thinking" ? 0.55 : 0.25;
    this.level += (lt - this.level) * Math.min(1, dt * 4);
    let syll = 0;
    if (m === "speaking") syll = Math.max(0, Math.min(1, 0.5 + 0.3 * Math.sin(t * 12.3) + 0.2 * Math.sin(t * 7.7 + 1) + 0.15 * Math.sin(t * 18.1))) * (Math.sin(t * 1.6) > -0.7 ? 1 : 0.1);
    this.open += ((m === "speaking" ? syll : 0) - this.open) * Math.min(1, dt * 16);
    for (let i = 0; i < this.bars.length; i++) {
      const d = 1 - Math.abs(i - 4) / 5.5;
      let b = 0.08;
      if (m === "speaking") b = (0.25 + 0.75 * Math.abs(Math.sin(t * (7 + i * 0.6) + i * 1.3))) * (0.3 + syll * 0.7) * d;
      else if (m === "listening") b = (0.2 + 0.4 * Math.abs(Math.sin(t * 5 - i * 0.7))) * d;
      else if (m === "thinking") b = 0.12 + 0.5 * Math.max(0, Math.sin(t * 6 - i * 0.9)) * d;
      this.bars[i] += (b - this.bars[i]) * Math.min(1, dt * 14);
    }
    this.nextBlink -= dt;
    if (this.nextBlink <= 0 && m !== "thinking") { this.blinkT = 0; this.nextBlink = 2.6 + Math.random() * 3.4; }
    if (this.blinkT >= 0) { this.blinkT += dt; const p = this.blinkT / 0.16; this.blink = p < 1 ? Math.sin(p * Math.PI) : 0; if (p >= 1) this.blinkT = -1; }
    const tx = m === "thinking" ? Math.sin(t * 2.4) * 0.9 : pointer.x * 0.6 + Math.sin(t * 0.5) * 0.15;
    const ty = m === "thinking" ? -0.35 : pointer.y * 0.4 + (m === "listening" ? -0.1 : 0);
    this.lx += (tx - this.lx) * Math.min(1, dt * 5); this.ly += (ty - this.ly) * Math.min(1, dt * 5);
    const tt = m === "listening" ? 0.06 : m === "thinking" ? Math.sin(t * 0.9) * 0.04 : Math.sin(t * 0.7) * 0.015;
    this.tilt += (tt - this.tilt) * Math.min(1, dt * 3);
    const eh = m === "listening" ? 1.25 : m === "speaking" ? 0.8 : 1;
    this.eyeH += (eh - this.eyeH) * Math.min(1, dt * 8);
  }
  draw() {
    const c = this.c; const box = c.getBoundingClientRect(); if (box.width < 4 || box.height < 4) return;
    const dpr = Math.min(devicePixelRatio || 1, 2), W = Math.round(box.width * dpr), H = Math.round(box.height * dpr);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const ctx = c.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = box.width, h = box.height, t = this.t, m = this.mode;
    ctx.clearRect(0, 0, w, h);
    const sig = mix(SIG, HOT, this.heat);
    const S = Math.min(w * 0.78, h * 0.62); // largura da cabeça
    const hw = S, hh = S * 0.86, cx = w / 2, cy = h * 0.46 + Math.sin(t * 1.4) * S * 0.012;

    // Halo
    const g = ctx.createRadialGradient(cx, cy, S * 0.1, cx, cy, S * 1.1);
    g.addColorStop(0, col(sig, 0.1 + this.level * 0.14)); g.addColorStop(1, col(sig, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    // Ondas ao escutar / falar
    if (m === "listening" || m === "speaking") {
      for (let i = 0; i < 2; i++) {
        let p = (t * (m === "speaking" ? 0.7 : 0.5) + i / 2) % 1; if (m === "listening") p = 1 - p;
        ctx.save(); ctx.translate(cx, cy);
        const s = 1.02 + p * 0.35;
        squircle(ctx, -hw * s / 2, -hh * s / 2, hw * s, hh * s, hw * s * 0.3);
        ctx.strokeStyle = col(sig, (1 - p) * 0.35); ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
      }
    }

    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(this.tilt);

    // Antena curta com LED
    const ay = -hh / 2;
    ctx.strokeStyle = "rgba(160,190,195,.45)"; ctx.lineWidth = Math.max(1, S * 0.025);
    ctx.beginPath(); ctx.moveTo(0, ay); ctx.lineTo(0, ay - S * 0.12); ctx.stroke();
    const pulse = 0.5 + 0.5 * Math.sin(t * (m === "thinking" ? 8 : 2.2));
    ctx.fillStyle = col(sig, 0.55 + pulse * 0.45);
    ctx.shadowColor = col(sig, 0.9); ctx.shadowBlur = S * 0.12;
    ctx.beginPath(); ctx.arc(0, ay - S * 0.14, S * 0.04, 0, 6.2832); ctx.fill();
    ctx.shadowBlur = 0;

    // Laterais (fones)
    for (const sx of [-1, 1]) {
      const ex = sx * (hw / 2 + S * 0.02);
      squircle(ctx, ex - S * 0.05, -S * 0.15, S * 0.1, S * 0.3, S * 0.045);
      ctx.fillStyle = "#0E1A1F"; ctx.fill();
      ctx.fillStyle = col(sig, 0.25 + this.level * 0.6);
      ctx.fillRect(ex - S * 0.008 + sx * S * 0.02, -S * 0.08, S * 0.016, S * 0.16);
    }

    // Cabeça: casca fosca com luz de cima
    squircle(ctx, -hw / 2, -hh / 2, hw, hh, hw * 0.3);
    const shell = ctx.createLinearGradient(0, -hh / 2, 0, hh / 2);
    shell.addColorStop(0, "#2A3B42"); shell.addColorStop(0.45, "#16232A"); shell.addColorStop(1, "#0A1216");
    ctx.fillStyle = shell; ctx.fill();
    ctx.strokeStyle = col(sig, 0.22 + this.level * 0.25); ctx.lineWidth = 1; ctx.stroke();
    // Reflexo superior
    ctx.save(); squircle(ctx, -hw / 2, -hh / 2, hw, hh, hw * 0.3); ctx.clip();
    const sh = ctx.createLinearGradient(0, -hh / 2, 0, -hh / 2 + hh * 0.35);
    sh.addColorStop(0, "rgba(255,255,255,.10)"); sh.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sh; ctx.fillRect(-hw / 2, -hh / 2, hw, hh * 0.35);
    ctx.restore();

    // Visor de vidro
    const vw = hw * 0.8, vh = hh * 0.56, vy = -hh * 0.2;
    squircle(ctx, -vw / 2, vy - vh / 2, vw, vh, vh * 0.42);
    const vg = ctx.createLinearGradient(0, vy - vh / 2, 0, vy + vh / 2);
    vg.addColorStop(0, "#03080A"); vg.addColorStop(1, "#071114");
    ctx.fillStyle = vg; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.06)"; ctx.stroke();

    ctx.save(); squircle(ctx, -vw / 2, vy - vh / 2, vw, vh, vh * 0.42); ctx.clip();
    // Linhas de varredura
    ctx.fillStyle = col(sig, 0.035);
    for (let y = vy - vh / 2; y < vy + vh / 2; y += Math.max(2, S * 0.035)) ctx.fillRect(-vw / 2, y, vw, 1);
    if (m === "thinking") {
      const sx = ((t * 0.9) % 1) * vw * 1.4 - vw * 0.7;
      const sg = ctx.createLinearGradient(sx - vw * 0.2, 0, sx + vw * 0.2, 0);
      sg.addColorStop(0, col(sig, 0)); sg.addColorStop(0.5, col(sig, 0.18)); sg.addColorStop(1, col(sig, 0));
      ctx.fillStyle = sg; ctx.fillRect(-vw / 2, vy - vh / 2, vw, vh);
    }

    // Olhos de LED (pílulas)
    const ex = vw * 0.22, ey = vy - vh * 0.06 + this.ly * vh * 0.08, ew = vw * 0.16;
    const ehBase = vh * 0.4 * this.eyeH * (1 - this.blink * 0.9);
    ctx.shadowColor = col(sig, 0.95); ctx.shadowBlur = S * 0.09;
    ctx.fillStyle = col(sig, 0.95);
    for (const sx of [-1, 1]) {
      const x = sx * ex + this.lx * vw * 0.06;
      if (m === "speaking" && this.blink < 0.2) {
        // Olhos sorrindo: arcos
        ctx.lineWidth = Math.max(2, ew * 0.32); ctx.lineCap = "round"; ctx.strokeStyle = col(sig, 0.95);
        ctx.beginPath(); ctx.arc(x, ey + ew * 0.25, ew * 0.42, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      } else {
        const eh = Math.max(ew * 0.18, ehBase);
        squircle(ctx, x - ew / 2, ey - eh / 2, ew, eh, Math.min(ew, eh) * 0.5);
        ctx.fill();
      }
    }
    ctx.shadowBlur = 0;

    // Boca: equalizador
    const by = vy + vh * 0.3, bw = vw * 0.5, n = this.bars.length, gap = bw / n;
    for (let i = 0; i < n; i++) {
      const bh = Math.max(1.5, this.bars[i] * vh * 0.32);
      const x = -bw / 2 + i * gap + gap * 0.25;
      ctx.fillStyle = col(sig, 0.35 + this.bars[i] * 0.8);
      ctx.fillRect(x, by - bh / 2, gap * 0.5, bh);
    }
    // Brilho do vidro
    const gl = ctx.createLinearGradient(-vw / 2, vy - vh / 2, vw / 2, vy + vh / 2);
    gl.addColorStop(0, "rgba(255,255,255,.07)"); gl.addColorStop(0.35, "rgba(255,255,255,0)");
    ctx.fillStyle = gl; ctx.fillRect(-vw / 2, vy - vh / 2, vw, vh);
    ctx.restore();

    // Queixo: luz de estado
    const cw = hw * 0.22;
    ctx.fillStyle = col(sig, 0.2 + this.level * 0.6);
    squircle(ctx, -cw / 2, hh * 0.3, cw, Math.max(2, S * 0.03), S * 0.015); ctx.fill();
    ctx.restore();

    // Ombros discretos
    if (h > w * 1.05) {
      const sy = cy + hh / 2 + S * 0.12;
      squircle(ctx, cx - hw * 0.55, sy, hw * 1.1, h - sy + S * 0.3, S * 0.22);
      const bg = ctx.createLinearGradient(0, sy, 0, h);
      bg.addColorStop(0, "#14222A"); bg.addColorStop(1, "#05090B");
      ctx.fillStyle = bg; ctx.fill();
      ctx.strokeStyle = col(sig, 0.18); ctx.stroke();
      ctx.fillStyle = col(sig, 0.25 + this.level * 0.5);
      ctx.fillRect(cx - S * 0.12, sy + S * 0.1, S * 0.24, Math.max(1.5, S * 0.02));
    }
  }
}
