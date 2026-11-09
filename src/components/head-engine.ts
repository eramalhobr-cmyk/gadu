// @ts-nocheck -- código de desenho em canvas, sem lógica de negócio.
// Humanoide do GaDu: busto de frente, crânio translúcido (o cérebro aparece por cima, em outra camada),
// olhos de luz, anéis nas orelhas e pedestal holográfico. Reage a repouso, escutando, pensando e falando.
import type { FaceMode } from "./robot-engine";

const SIG = [95, 240, 220], HOT = [255, 180, 84], VIO = [182, 156, 255];
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const col = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

export class Head {
  mode: FaceMode = "idle";
  constructor(canvas, o) {
    this.c = canvas; this.o = o || {}; this.t = 0; this.heat = 0; this.level = 0.2; this.talk = 0;
    this.blink = 0; this.blinkT = -1; this.nextBlink = 2.5; this.look = 0;
  }
  step(dt) {
    const m = this.mode; this.t += dt; const t = this.t;
    this.heat += ((m === "thinking" ? 1 : 0) - this.heat) * Math.min(1, dt * 3);
    const lt = m === "speaking" ? 0.9 : m === "listening" ? 0.75 : m === "thinking" ? 0.6 : 0.3;
    this.level += (lt - this.level) * Math.min(1, dt * 4);
    const syl = m === "speaking" ? Math.max(0, 0.5 + 0.3 * Math.sin(t * 12.1) + 0.2 * Math.sin(t * 7.3 + 1)) * (Math.sin(t * 1.7) > -0.7 ? 1 : 0.1) : 0;
    this.talk += (syl - this.talk) * Math.min(1, dt * 16);
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) { this.blinkT = 0; this.nextBlink = 2.8 + Math.random() * 3.5; }
    if (this.blinkT >= 0) { this.blinkT += dt; const p = this.blinkT / 0.16; this.blink = p < 1 ? Math.sin(p * Math.PI) : 0; if (p >= 1) this.blinkT = -1; }
    this.look += ((m === "thinking" ? Math.sin(t * 2) * 0.6 : 0) - this.look) * Math.min(1, dt * 4);
  }
  /** Contorno da cabeça (frente): crânio, têmporas, maçãs, mandíbula e queixo. */
  headPath(ctx, cx, cy, S) {
    const w = S * 0.27, top = cy - S * 0.44, brow = cy - S * 0.06, cheek = cy + S * 0.06, jaw = cy + S * 0.2, chin = cy + S * 0.29;
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.bezierCurveTo(cx + w * 0.62, top, cx + w * 1.02, top + S * 0.12, cx + w, brow - S * 0.05);
    ctx.bezierCurveTo(cx + w * 0.99, brow + S * 0.04, cx + w * 0.93, cheek - S * 0.02, cx + w * 0.88, cheek);
    ctx.bezierCurveTo(cx + w * 0.84, jaw - S * 0.04, cx + w * 0.62, jaw + S * 0.02, cx + w * 0.3, chin - S * 0.02);
    ctx.quadraticCurveTo(cx, chin + S * 0.01, cx - w * 0.3, chin - S * 0.02);
    ctx.bezierCurveTo(cx - w * 0.62, jaw + S * 0.02, cx - w * 0.84, jaw - S * 0.04, cx - w * 0.88, cheek);
    ctx.bezierCurveTo(cx - w * 0.93, cheek - S * 0.02, cx - w * 0.99, brow + S * 0.04, cx - w, brow - S * 0.05);
    ctx.bezierCurveTo(cx - w * 1.02, top + S * 0.12, cx - w * 0.62, top, cx, top);
    ctx.closePath();
  }
  draw() {
    const c = this.c; const box = c.getBoundingClientRect(); if (box.width < 4 || box.height < 4) return;
    const dpr = Math.min(devicePixelRatio || 1, 2), W = Math.round(box.width * dpr), H = Math.round(box.height * dpr);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const ctx = c.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = box.width, h = box.height, t = this.t, m = this.mode;
    ctx.clearRect(0, 0, w, h);
    const sig = mix(SIG, HOT, this.heat);
    const S = Math.min(w * 0.95, h * 1.05);
    const cx = w / 2, cy = h * 0.47 + Math.sin(t * 1.2) * S * 0.004;

    // Pedestal holográfico
    const py = cy + S * 0.47;
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) {
      const r = S * (0.3 + i * 0.09), a = (0.22 - i * 0.06) * (0.6 + this.level * 0.6);
      ctx.beginPath(); ctx.ellipse(cx, py, r, r * 0.16, 0, 0, Math.PI * 2);
      ctx.strokeStyle = col(sig, a); ctx.lineWidth = i === 0 ? 2 : 1; ctx.setLineDash(i === 1 ? [4, 6] : []); ctx.lineDashOffset = -t * 20; ctx.stroke();
    }
    ctx.setLineDash([]);
    const beam = ctx.createLinearGradient(0, py, 0, cy - S * 0.1);
    beam.addColorStop(0, col(sig, 0.16 * this.level)); beam.addColorStop(1, col(sig, 0));
    ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(cx - S * 0.3, py); ctx.lineTo(cx + S * 0.3, py); ctx.lineTo(cx + S * 0.18, cy - S * 0.1); ctx.lineTo(cx - S * 0.18, cy - S * 0.1); ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    // Ombros e pescoço
    ctx.beginPath();
    ctx.moveTo(cx - S * 0.09, cy + S * 0.24);
    ctx.lineTo(cx - S * 0.1, cy + S * 0.33);
    ctx.bezierCurveTo(cx - S * 0.2, cy + S * 0.35, cx - S * 0.38, cy + S * 0.37, cx - S * 0.44, py - S * 0.01);
    ctx.lineTo(cx + S * 0.44, py - S * 0.01);
    ctx.bezierCurveTo(cx + S * 0.38, cy + S * 0.37, cx + S * 0.2, cy + S * 0.35, cx + S * 0.1, cy + S * 0.33);
    ctx.lineTo(cx + S * 0.09, cy + S * 0.24);
    ctx.closePath();
    const body = ctx.createLinearGradient(0, cy + S * 0.2, 0, py);
    body.addColorStop(0, "rgba(20,38,46,.95)"); body.addColorStop(1, "rgba(6,12,15,.6)");
    ctx.fillStyle = body; ctx.fill();
    ctx.strokeStyle = col(sig, 0.35); ctx.lineWidth = 1; ctx.stroke();
    // linhas do traje
    ctx.strokeStyle = col(sig, 0.18 + this.level * 0.2);
    ctx.beginPath(); ctx.moveTo(cx - S * 0.1, cy + S * 0.33); ctx.lineTo(cx - S * 0.03, py - S * 0.02); ctx.moveTo(cx + S * 0.1, cy + S * 0.33); ctx.lineTo(cx + S * 0.03, py - S * 0.02); ctx.stroke();

    // Cabeça translúcida
    this.headPath(ctx, cx, cy, S);
    const skin = ctx.createLinearGradient(cx - S * 0.3, cy - S * 0.4, cx + S * 0.3, cy + S * 0.3);
    skin.addColorStop(0, "rgba(40,70,82,.55)"); skin.addColorStop(0.5, "rgba(14,28,34,.62)"); skin.addColorStop(1, "rgba(6,12,16,.8)");
    ctx.fillStyle = skin; ctx.fill();
    ctx.save(); this.headPath(ctx, cx, cy, S); ctx.clip();
    // brilho de vidro no crânio
    const glass = ctx.createRadialGradient(cx - S * 0.08, cy - S * 0.3, S * 0.02, cx, cy - S * 0.2, S * 0.32);
    glass.addColorStop(0, "rgba(255,255,255,.10)"); glass.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glass; ctx.fillRect(cx - S, cy - S, S * 2, S * 2);
    // contornos (malha) do rosto
    ctx.strokeStyle = col(sig, 0.08 + this.level * 0.06); ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.ellipse(cx + i * S * 0.002, cy - S * 0.05, Math.abs(i) * S * 0.07 + 0.5, S * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
    }
    for (let k = 0; k < 4; k++) { const y = cy + S * (0.02 + k * 0.06); ctx.beginPath(); ctx.ellipse(cx, y, S * 0.26, S * 0.02, 0, 0, Math.PI); ctx.stroke(); }
    // varredura
    const scan = cy - S * 0.44 + ((t * 0.25) % 1) * S * 0.75;
    const sg = ctx.createLinearGradient(0, scan - S * 0.03, 0, scan + S * 0.03);
    sg.addColorStop(0, col(sig, 0)); sg.addColorStop(0.5, col(sig, 0.1 + this.level * 0.1)); sg.addColorStop(1, col(sig, 0));
    ctx.fillStyle = sg; ctx.fillRect(cx - S * 0.3, scan - S * 0.03, S * 0.6, S * 0.06);
    ctx.restore();
    // borda luminosa
    this.headPath(ctx, cx, cy, S);
    ctx.shadowColor = col(sig, 0.8); ctx.shadowBlur = S * 0.03;
    ctx.strokeStyle = col(sig, 0.55 + this.level * 0.35); ctx.lineWidth = 1.6; ctx.stroke();
    ctx.shadowBlur = 0;

    // Orelhas: anéis (fones) que pulsam ao escutar
    for (const sx of [-1, 1]) {
      const ex = cx + sx * S * 0.262, ey = cy - S * 0.02;
      ctx.beginPath(); ctx.ellipse(ex, ey, S * 0.035, S * 0.07, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(8,16,20,.9)"; ctx.fill();
      ctx.strokeStyle = col(sx < 0 ? sig : mix(sig, HOT, 0.6), 0.7 + this.level * 0.3); ctx.lineWidth = 2; ctx.stroke();
      if (m === "listening") {
        for (let i = 0; i < 2; i++) {
          const p = ((t * 0.9) + i / 2) % 1;
          ctx.beginPath(); ctx.ellipse(ex + sx * S * 0.02 * p, ey, S * (0.05 + p * 0.08), S * (0.09 + p * 0.1), 0, -Math.PI / 2 * sx - Math.PI / 2, Math.PI / 2 * sx - Math.PI / 2 + Math.PI, sx < 0);
          ctx.strokeStyle = col(sig, (1 - p) * 0.5); ctx.lineWidth = 1.2; ctx.stroke();
        }
      }
    }

    // Olhos de luz
    const eyeY = cy + S * 0.015, eyeX = S * 0.1, ew = S * 0.07, eh = Math.max(1.5, S * 0.016 * (1 - this.blink * 0.9));
    ctx.shadowColor = col(sig, 1); ctx.shadowBlur = S * 0.04;
    ctx.fillStyle = col(mix(sig, [255, 255, 255], 0.35), 0.75 + this.level * 0.25);
    for (const sx of [-1, 1]) {
      const x = cx + sx * eyeX + this.look * S * 0.012;
      ctx.beginPath(); ctx.ellipse(x, eyeY, ew / 2, eh, sx * -0.08, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Boca: linha que vira onda ao falar
    const my = cy + S * 0.17, mw = S * 0.09;
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const x = cx - mw / 2 + (mw * i) / 24, k = Math.sin((i / 24) * Math.PI);
      const y = my + Math.sin(i * 1.3 + t * 18) * this.talk * S * 0.012 * k;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = col(sig, 0.4 + this.talk * 0.6); ctx.lineWidth = 1.4; ctx.stroke();
    if (m === "speaking") {
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 2; i++) {
        const p = ((t * 0.8) + i / 2) % 1;
        ctx.beginPath(); ctx.ellipse(cx, my, S * (0.08 + p * 0.25), S * (0.03 + p * 0.1), 0, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.strokeStyle = col(VIO, (1 - p) * 0.35 * this.talk); ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    }
  }
}
