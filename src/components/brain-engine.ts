// @ts-nocheck -- código de desenho em canvas, sem lógica de negócio.
// Cérebro neural do Gadu (portado do protótipo): pontos, conexões e pulsos que reagem ao modo.
import { pointer, type FaceMode } from "./robot-engine";
const ACC = "#5FF0DC", HOT = "#FFB454";
function rgbaFn() { const c = {}; return (hex, a) => { let v = c[hex]; if (!v) { const h = String(hex).replace("#", ""); v = c[hex] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) || 0).join(","); } return "rgba(" + v + "," + Math.max(0, Math.min(1, a)).toFixed(3) + ")"; }; }
export class Brain {
  mode: FaceMode = "idle";
  constructor(canvas, o) { this.c = canvas; this.o = o || {}; this.rgba = rgbaFn(); this.rot = 1.15; this.phase = 0; this.rotN = .5; this.tilt = -.2; this.frac = 0; this.energy = .25; this.pulses = []; this.t = 0; }
  stageFrac() { const s = this.o.stage ? this.o.stage() : 4; return [.34, .56, .8, 1][Math.max(1, Math.min(4, s)) - 1]; }
  build() {
    let seed = 73; const R = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const pts = []; const small = innerWidth < 860; const count = this.o.compact ? 620 : (small ? 2600 : 5200); let guard = 0;
    while (pts.length < count && guard++ < 90000) {
      const u = R() * 2 - 1, th = R() * 6.28318, q = Math.sqrt(1 - u * u); const dx = q * Math.cos(th), dy = u, dz = q * Math.sin(th); let x, y, z, g;
      if (R() < .1) { g = Math.sin(dy * 30); const r = 1 + .05 * g; x = dx * .46 * r; y = -.47 + dy * .21 * r; z = -.6 + dz * .27 * r; if (y > -.3 && z > -.5) continue; }
      else { const s = R() < .5 ? 1 : -1; g = Math.sin(8.5 * dz + 2.4 * Math.sin(6 * dy + s)) * Math.cos(7.5 * dy + 2.6 * Math.sin(5 * dz + dx * 3)); if (g < -.12 && R() > .14) continue; const r = 1 + .1 * g; x = s * .27 + .5 * dx * r * (1 - .14 * dz); y = .62 * dy * r; if (y < 0) y *= .74; z = .92 * dz * r; if (s * x < .028) continue; if (y < -.34 && z < -.25) continue; }
      const dist = Math.sqrt((x - .22) ** 2 + (y - .16) ** 2 + (z - .45) ** 2); pts.push({ x, y, z, g, o: Math.min(1, dist / 1.75 * .72 + R() * .28), n: R() });
    }
    pts.slice().sort((a, b) => a.o - b.o).forEach((p, i) => { p.o = (i + 1) / pts.length; });
    const nodes = pts.slice(0, this.o.compact ? 120 : (small ? 520 : 1000)); const edges = []; nodes.forEach(n => { n.adj = []; });
    const link = (a, b) => { const id = edges.length; edges.push({ a, b }); nodes[a].adj.push({ e: id, to: b }); nodes[b].adj.push({ e: id, to: a }); };
    for (let i = 0; i < nodes.length; i++) { const near = []; for (let j = 0; j < nodes.length; j++) { if (i === j) continue; const a = nodes[i], b = nodes[j]; near.push([(a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2, j]); } near.sort((p, q) => p[0] - q[0]); for (let k = 0; k < 2; k++) if (near[k][1] > i || nodes[near[k][1]].adj.length < 2) link(i, near[k][1]); if (R() < .05) { const pick = near[10 + Math.floor(R() * Math.min(50, near.length - 11))]; if (pick) link(i, pick[1]); } }
    this.pts = pts; this.nodes = nodes; this.edges = edges;
  }
  spawn(hot) { for (let tries = 0; tries < 12; tries++) { const from = Math.floor(Math.random() * this.nodes.length), n = this.nodes[from]; if (n.o > this.frac || !n.adj.length) continue; const hop = n.adj[Math.floor(Math.random() * n.adj.length)]; this.pulses.push({ from, to: hop.to, p: Math.random(), life: 6 + Math.floor(Math.random() * 8), hot, v: .9 + Math.random() * 1.1 }); return; } }
  step(dt) {
    if (!this.pts) this.build();
    const mode = this.mode; const tE = { idle: .25, listening: .55, thinking: 1, speaking: .7 }[mode] ?? .25;
    this.energy += (tE - this.energy) * Math.min(1, dt * 2.4); this.frac += (this.stageFrac() - this.frac) * Math.min(1, dt * 1.8);
    this.t += dt * (.8 + this.energy * 1.1); this.phase += dt * (.14 + this.energy * .34); this.rot = 1.15 + .62 * Math.sin(this.phase); this.rotN = (Math.sin(this.phase) + 1) / 2;
    this.tilt += ((-.2 + pointer.y * -.14) - this.tilt) * Math.min(1, dt * 2);
    const want = this.o.compact ? 5 : Math.round(6 + this.energy * 46);
    for (let i = 0; i < 6 && this.pulses.length < want; i++) this.spawn(mode === "thinking" ? Math.random() < .7 : Math.random() < .1);
    for (let i = this.pulses.length - 1; i >= 0; i--) { const P = this.pulses[i]; P.p += dt * P.v * (1.1 + this.energy * 2.4); if (P.p >= 1) { const n = this.nodes[P.to]; P.life--; if (P.life <= 0 || !n.adj.length || this.pulses.length > want + 8) { this.pulses.splice(i, 1); continue; } const opts = n.adj.filter(h => h.to !== P.from && this.nodes[h.to].o <= this.frac); if (!opts.length) { this.pulses.splice(i, 1); continue; } const h = opts[Math.floor(Math.random() * opts.length)]; P.from = P.to; P.to = h.to; P.p = 0; } }
  }
  draw() {
    if (!this.pts) return; const c = this.c; const box = c.getBoundingClientRect(); if (box.width < 4 || box.height < 4) return;
    const dpr = Math.min(devicePixelRatio || 1, 2), W = Math.round(box.width * dpr), H = Math.round(box.height * dpr); if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const ctx = c.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); const w = box.width, h = box.height; ctx.clearRect(0, 0, w, h);
    const rgba = this.rgba, compact = !!this.o.compact, mode = this.mode;
    const cx = w / 2 + pointer.x * (compact ? 0 : 7), cy = h / 2;
    const S = compact ? Math.min(w, h) * .4 : Math.min(w * .385, h * .42); const E = this.energy, t = this.t;
    const cr = Math.cos(this.rot + pointer.x * .16), sr = Math.sin(this.rot + pointer.x * .16), ct = Math.cos(this.tilt), st = Math.sin(this.tilt);
    const wave = mode === "speaking" ? .035 : (mode === "listening" ? .022 : .004);
    const proj = p => { const L = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z); const m = 1 + wave * Math.sin(L * 9 - t * 7); const X = p.x * m, Y = p.y * m, Z = p.z * m; const x1 = X * cr + Z * sr, z1 = -X * sr + Z * cr; const y2 = Y * ct - z1 * st, z2 = Y * st + z1 * ct; const f = 2.7 / (2.7 - z2); return { x: cx + x1 * f * S, y: cy - y2 * f * S, z: z2, f }; };
    ctx.globalCompositeOperation = "lighter";
    const gl = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * (.92 + E * .34)); const gc = mode === "thinking" ? HOT : ACC;
    gl.addColorStop(0, rgba(gc, .075 + E * .1)); gl.addColorStop(.55, rgba(gc, .03 + E * .03)); gl.addColorStop(1, rgba(gc, 0)); ctx.fillStyle = gl; ctx.fillRect(0, 0, w, h);
    const frac = this.frac; const pn = this.nodes.map(proj); ctx.lineWidth = compact ? .5 : .7;
    for (let pass = 0; pass < 2; pass++) { ctx.strokeStyle = rgba(ACC, pass ? .24 : .06); ctx.beginPath(); for (const e of this.edges) { const a = this.nodes[e.a], b = this.nodes[e.b]; if (a.o > frac || b.o > frac) continue; const A = pn[e.a], B = pn[e.b]; if ((pass === 1) !== ((A.z + B.z) / 2 > 0)) continue; ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); } ctx.stroke(); }
    const scanY = Math.sin(t * .62) * .66; const size = compact ? 1 : Math.max(1.2, S * .0056);
    for (const p of this.pts) { if (p.o > frac) continue; const P = proj(p); const depth = (P.z + 1.05) / 2.1; const edge = Math.min(1, (frac - p.o) * 8); let a = (.2 + Math.pow(depth, 1.4) * .95) * (.45 + .55 * (p.g * .5 + .5)) * edge; a *= .72 + .28 * Math.sin(t * 2.1 + p.n * 40); let col = ACC; if (!compact && Math.abs(p.y - scanY) < .03) { a = Math.min(1, a + .75); col = "#F2FFFC"; } ctx.fillStyle = rgba(col, a); const r = size * P.f * (.75 + p.n * .65); ctx.fillRect(P.x - r / 2, P.y - r / 2, r, r); }
    for (const q of this.pulses) { const A = pn[q.from], B = pn[q.to]; if (!A || !B) continue; const pp = Math.max(0, Math.min(1, q.p)); const x = A.x + (B.x - A.x) * pp, y = A.y + (B.y - A.y) * pp; const col = q.hot ? HOT : "#EFFFFB"; const tx = A.x + (B.x - A.x) * Math.max(0, pp - .5), ty = A.y + (B.y - A.y) * Math.max(0, pp - .5); ctx.strokeStyle = rgba(col, .6); ctx.lineWidth = compact ? .7 : 1.1; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke(); const rg = compact ? 1 : (1.1 + S * .0035); const g = ctx.createRadialGradient(x, y, 0, x, y, rg * 2.4); g.addColorStop(0, rgba(col, .95)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rg * 2.4, 0, 6.2832); ctx.fill(); }
    ctx.globalCompositeOperation = "source-over";
    if (this.o.hud && !compact && w > 360) {
      const bw = Math.min(S * 1.28, w / 2 - 26), bh = S * .94, x0 = cx - bw, x1 = cx + bw, y0 = cy - bh, y1 = cy + bh, L = 18;
      ctx.strokeStyle = rgba(ACC, .42); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, y0 + L); ctx.lineTo(x0, y0); ctx.lineTo(x0 + L, y0); ctx.moveTo(x1 - L, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + L); ctx.moveTo(x1, y1 - L); ctx.lineTo(x1, y1); ctx.lineTo(x1 - L, y1); ctx.moveTo(x0 + L, y1); ctx.lineTo(x0, y1); ctx.lineTo(x0, y1 - L); ctx.stroke();
      const sy = cy - scanY * S; ctx.strokeStyle = rgba(ACC, .2); ctx.setLineDash([2, 6]); ctx.beginPath(); ctx.moveTo(x0 + 8, sy); ctx.lineTo(x1 - 8, sy); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = rgba(ACC, .95); ctx.fillRect(x1 - 3, sy - 5, 3, 10);
      ctx.strokeStyle = rgba(ACC, .3); ctx.beginPath(); for (let i = 0; i <= 20; i++) { const y = y0 + (y1 - y0) * i / 20; ctx.moveTo(x1 + 7, y); ctx.lineTo(x1 + 7 + (i % 5 === 0 ? 10 : 5), y); } ctx.stroke();
      ctx.beginPath(); for (let i = 0; i <= 40; i++) { const x = x0 + (x1 - x0) * i / 40; ctx.moveTo(x, y1 + 7); ctx.lineTo(x, y1 + 7 + (i % 10 === 0 ? 9 : 4)); } ctx.stroke(); ctx.fillStyle = rgba(HOT, .95); ctx.fillRect(x0 + (x1 - x0) * this.rotN - 1.5, y1 + 5, 3, 14);
    }
  }
}
