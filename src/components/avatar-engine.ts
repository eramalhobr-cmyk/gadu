// @ts-nocheck -- código de desenho em canvas, sem lógica de negócio.
// Camada animada por cima do avatar do GaDu (imagem). Coordenadas relativas ao quadrado da imagem (0..1).
// Reage aos modos: repouso, escutando (fones), pensando (cérebro âmbar), falando (ondas da boca e olhos).
import type { FaceMode } from "./robot-engine";

const CY = [95, 240, 220], OR = [255, 170, 60], WH = [235, 255, 252];
const col = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
const P = {
  brain: { x: 0.5, y: 0.172, rx: 0.185, ry: 0.082 },
  eyes: [{ x: 0.418, y: 0.372 }, { x: 0.588, y: 0.37 }],
  ears: [{ x: 0.3, y: 0.415 }, { x: 0.722, y: 0.405 }],
  mouth: { x: 0.5, y: 0.528 },
  hud: { x: 0.5, y: 0.41 },
  base: { x: 0.5, y: 0.862, rx: 0.36, ry: 0.058 },
};

export class AvatarFx {
  mode: FaceMode = "idle";
  constructor(canvas, o) {
    this.c = canvas; this.o = o || {}; this.t = 0; this.level = 0.3; this.heat = 0; this.talk = 0;
    let seed = 11; const R = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    this.nodes = [];
    while (this.nodes.length < 34) {
      const a = R() * Math.PI * 2, r = Math.sqrt(R());
      const x = P.brain.x + Math.cos(a) * r * P.brain.rx, y = P.brain.y + Math.sin(a) * r * P.brain.ry;
      if (Math.abs(x - 0.5) < 0.012) continue; // fenda entre os hemisférios
      this.nodes.push({ x, y, ph: R() * 6.28, sp: 0.6 + R() * 1.6, warm: R() < 0.45 });
    }
    this.pulses = [];
    this.R = R;
  }
  step(dt) {
    const m = this.mode; this.t += dt; const t = this.t;
    const lt = m === "speaking" ? 0.9 : m === "listening" ? 0.75 : m === "thinking" ? 0.85 : 0.3;
    this.level += (lt - this.level) * Math.min(1, dt * 3);
    this.heat += ((m === "thinking" ? 1 : 0) - this.heat) * Math.min(1, dt * 3);
    const syl = m === "speaking" ? Math.max(0, 0.5 + 0.3 * Math.sin(t * 12.4) + 0.22 * Math.sin(t * 7.1 + 1)) * (Math.sin(t * 1.6) > -0.7 ? 1 : 0.1) : 0;
    this.talk += (syl - this.talk) * Math.min(1, dt * 14);
    const want = m === "thinking" ? 10 : m === "idle" ? 2 : 5;
    if (this.pulses.length < want && Math.random() < dt * (m === "thinking" ? 14 : 4)) {
      const a = this.nodes[Math.floor(Math.random() * this.nodes.length)];
      let b = a, best = 9;
      for (const n of this.nodes) { const d = Math.hypot(n.x - a.x, n.y - a.y); if (n !== a && d < best && Math.random() < 0.5) { best = d; b = n; } }
      this.pulses.push({ a, b, p: 0, warm: m === "thinking" || Math.random() < 0.4 });
    }
    for (let i = this.pulses.length - 1; i >= 0; i--) { this.pulses[i].p += dt * (1.2 + this.level * 1.5); if (this.pulses[i].p >= 1) this.pulses.splice(i, 1); }
  }
  draw() {
    const c = this.c; const box = c.getBoundingClientRect(); if (box.width < 4 || box.height < 4) return;
    const dpr = Math.min(devicePixelRatio || 1, 2), W = Math.round(box.width * dpr), H = Math.round(box.height * dpr);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const ctx = c.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = box.width, h = box.height; ctx.clearRect(0, 0, w, h);
    const S = Math.min(w, h), ox = (w - S) / 2, oy = (h - S) / 2;
    const X = (u) => ox + u * S, Y = (v) => oy + v * S;
    const t = this.t, m = this.mode, L = this.level, heat = this.heat;
    ctx.globalCompositeOperation = "lighter";

    // HUD: arcos girando ao redor da cabeça
    const rings = [[0.405, 0.35, 0.5, CY], [0.44, -0.22, 0.9, OR], [0.465, 0.12, 0.35, CY]];
    for (const [r, sp, len, cc] of rings) {
      const base = t * sp * (0.6 + L);
      for (let k = 0; k < 2; k++) {
        const a0 = base + k * Math.PI;
        ctx.beginPath(); ctx.arc(X(P.hud.x), Y(P.hud.y), r * S, a0, a0 + len);
        ctx.strokeStyle = col(cc, 0.25 + L * 0.35); ctx.lineWidth = Math.max(1, S * 0.006); ctx.lineCap = "round"; ctx.stroke();
      }
    }

    // Cérebro: sinapses que piscam e pulsos entre elas (âmbar quando pensa)
    const glowR = S * 0.24;
    const bg = ctx.createRadialGradient(X(P.brain.x), Y(P.brain.y), 0, X(P.brain.x), Y(P.brain.y), glowR);
    bg.addColorStop(0, col(heat > 0.3 ? OR : CY, 0.06 + L * 0.1 + heat * 0.1)); bg.addColorStop(1, col(CY, 0));
    ctx.fillStyle = bg; ctx.fillRect(X(P.brain.x) - glowR, Y(P.brain.y) - glowR, glowR * 2, glowR * 2);
    for (const n of this.nodes) {
      const k = 0.5 + 0.5 * Math.sin(t * n.sp * (1 + L) + n.ph);
      const a = (0.15 + k * 0.6) * (0.5 + L * 0.7);
      const r = S * (0.003 + k * 0.004);
      const cc = n.warm || heat > 0.5 ? OR : CY;
      const g = ctx.createRadialGradient(X(n.x), Y(n.y), 0, X(n.x), Y(n.y), r * 4);
      g.addColorStop(0, col(WH, a)); g.addColorStop(0.3, col(cc, a * 0.8)); g.addColorStop(1, col(cc, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(n.x), Y(n.y), r * 4, 0, 6.2832); ctx.fill();
    }
    for (const q of this.pulses) {
      const x = q.a.x + (q.b.x - q.a.x) * q.p, y = q.a.y + (q.b.y - q.a.y) * q.p;
      ctx.beginPath(); ctx.moveTo(X(q.a.x), Y(q.a.y)); ctx.lineTo(X(x), Y(y));
      ctx.strokeStyle = col(q.warm ? OR : CY, 0.5 * (1 - q.p)); ctx.lineWidth = Math.max(1, S * 0.0025); ctx.stroke();
      ctx.fillStyle = col(WH, 0.9 * (1 - q.p * 0.5)); ctx.beginPath(); ctx.arc(X(x), Y(y), S * 0.004, 0, 6.2832); ctx.fill();
    }

    // Olhos: brilho que respira (mais forte ao falar)
    for (const e of P.eyes) {
      const a = 0.12 + L * 0.25 + this.talk * 0.25 + 0.05 * Math.sin(t * 3);
      const g = ctx.createRadialGradient(X(e.x), Y(e.y), 0, X(e.x), Y(e.y), S * 0.045);
      g.addColorStop(0, col(WH, a)); g.addColorStop(0.35, col(CY, a * 0.7)); g.addColorStop(1, col(CY, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(e.x), Y(e.y), S * 0.045, 0, 6.2832); ctx.fill();
    }

    // Fones: ondas quando escuta, brilho suave no resto
    P.ears.forEach((e, i) => {
      const cc = i ? CY : OR;
      const g = ctx.createRadialGradient(X(e.x), Y(e.y), 0, X(e.x), Y(e.y), S * 0.07);
      g.addColorStop(0, col(cc, 0.08 + L * 0.18)); g.addColorStop(1, col(cc, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(e.x), Y(e.y), S * 0.07, 0, 6.2832); ctx.fill();
      if (m === "listening") {
        for (let k = 0; k < 3; k++) {
          const p = ((t * 0.9) + k / 3) % 1, dir = i ? 1 : -1;
          ctx.beginPath(); ctx.arc(X(e.x), Y(e.y), S * (0.055 + p * 0.09), dir > 0 ? -1.1 : Math.PI - 1.1 + 0.0, dir > 0 ? 1.1 : Math.PI + 1.1);
          ctx.strokeStyle = col(cc, (1 - p) * 0.6); ctx.lineWidth = Math.max(1, S * 0.004); ctx.stroke();
        }
      }
    });

    // Boca: ondas de voz ao falar
    if (this.talk > 0.02) {
      for (let k = 0; k < 3; k++) {
        const p = ((t * 1.1) + k / 3) % 1;
        ctx.beginPath(); ctx.ellipse(X(P.mouth.x), Y(P.mouth.y), S * (0.04 + p * 0.16), S * (0.015 + p * 0.05), 0, 0.12 * Math.PI, 0.88 * Math.PI);
        ctx.strokeStyle = col(CY, (1 - p) * 0.55 * this.talk); ctx.lineWidth = Math.max(1, S * 0.004); ctx.stroke();
      }
    }

    // Linha central: luz que sobe do pedestal até o cérebro
    const sp = (t * (0.25 + L * 0.35)) % 1;
    const ly = Y(P.base.y - sp * (P.base.y - 0.06));
    const lg = ctx.createRadialGradient(X(0.5), ly, 0, X(0.5), ly, S * 0.03);
    lg.addColorStop(0, col(WH, 0.55 * (0.4 + L))); lg.addColorStop(1, col(CY, 0));
    ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(X(0.5), ly, S * 0.03, 0, 6.2832); ctx.fill();

    // Pedestal: elipses girando e ondas saindo do centro
    ctx.setLineDash([S * 0.02, S * 0.025]); ctx.lineDashOffset = -t * S * 0.05 * (0.5 + L);
    ctx.beginPath(); ctx.ellipse(X(P.base.x), Y(P.base.y), P.base.rx * S * 0.8, P.base.ry * S * 0.8, 0, 0, 6.2832);
    ctx.strokeStyle = col(CY, 0.25 + L * 0.3); ctx.lineWidth = Math.max(1, S * 0.004); ctx.stroke();
    ctx.setLineDash([]);
    for (let k = 0; k < 2; k++) {
      const p = ((t * (0.35 + L * 0.4)) + k / 2) % 1;
      ctx.beginPath(); ctx.ellipse(X(P.base.x), Y(P.base.y), P.base.rx * S * (0.2 + p), P.base.ry * S * (0.2 + p), 0, 0, 6.2832);
      ctx.strokeStyle = col(k ? OR : CY, (1 - p) * (0.15 + L * 0.3)); ctx.lineWidth = Math.max(1, S * 0.003); ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }
}
