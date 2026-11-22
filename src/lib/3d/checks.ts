import { A1_VOLUME_MM, PAREDE_MIN_MM } from "./limits.ts";
import { boundingBox, triangleCount, type Mesh } from "./mesh.ts";
import type { Param, ParamValues } from "./params.ts";

// Verificações de imprimibilidade para a Bambu Lab A1. Funções puras, sem DOM, testadas em unidade.
// Tamanho, malha fechada e base plana são medidas exatas da malha. A parede mínima é uma ESTIMATIVA
// (raios amostrados dentro da peça), e o balanço é só um aviso: nenhum dos dois substitui o fatiador.

export type Status = "ok" | "aviso" | "erro";
export type Check = { id: "tamanho" | "malha" | "base" | "parede" | "balanco"; titulo: string; status: Status; mensagem: string; sugestao?: string; estimativa?: boolean };
export type Report = { checks: Check[]; ok: boolean; avisos: number; erros: number };

const f1 = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 0 });

// --- Tamanho ---
export function checkSize(mesh: Mesh): Check {
  const box = boundingBox(mesh);
  const titulo = "Cabe na mesa da A1";
  if (!box) return { id: "tamanho", titulo, status: "erro", mensagem: "A peça está vazia." , sugestao: "Peça para o GaDu desenhar algo."};
  const [x, y, z] = box.size;
  const dims = `${f1(x)} × ${f1(y)} × ${f1(z)} mm`;
  const over = (["largura", "profundidade", "altura"] as const).map((n, i) => ({ n, v: box.size[i] })).filter((d) => d.v > A1_VOLUME_MM + 1e-6);
  if (over.length) return { id: "tamanho", titulo, status: "erro", mensagem: `A peça mede ${dims} e passa dos ${A1_VOLUME_MM} mm da A1 (${over.map((o) => o.n).join(", ")}).`, sugestao: "Diminua as medidas, ou divida a peça em partes." };
  return { id: "tamanho", titulo, status: "ok", mensagem: `${dims}. Cabe no volume de ${A1_VOLUME_MM} × ${A1_VOLUME_MM} × ${A1_VOLUME_MM} mm.` };
}

// --- Malha fechada (manifold) ---
const SNAP = 1e4; // vértices a menos de 0,0001 mm são o mesmo ponto
export type EdgeStats = { open: number; nonManifold: number; flipped: number; degenerate: number; edges: number };

export function edgeStats(mesh: Mesh): EdgeStats {
  const p = mesh.positions;
  const ids = new Map<string, number>();
  const id = (i: number) => {
    const k = `${Math.round(p[i] * SNAP)},${Math.round(p[i + 1] * SNAP)},${Math.round(p[i + 2] * SNAP)}`;
    let v = ids.get(k);
    if (v === undefined) { v = ids.size; ids.set(k, v); }
    return v;
  };
  // por aresta (menor,maior): quantas vezes aparece em cada sentido
  const edges = new Map<string, [number, number]>();
  let degenerate = 0;
  const n = triangleCount(mesh);
  for (let t = 0; t < n; t++) {
    const a = id(t * 9), b = id(t * 9 + 3), c = id(t * 9 + 6);
    if (a === b || b === c || a === c) { degenerate++; continue; }
    for (const [u, v] of [[a, b], [b, c], [c, a]] as const) {
      const lo = Math.min(u, v), hi = Math.max(u, v);
      const key = `${lo}_${hi}`;
      const e = edges.get(key) ?? [0, 0];
      e[u < v ? 0 : 1]++;
      edges.set(key, e);
    }
  }
  let open = 0, nonManifold = 0, flipped = 0;
  for (const [fw, bw] of edges.values()) {
    if (fw + bw === 1) open++;
    else if (fw + bw !== 2) nonManifold++;
    else if (fw === 2 || bw === 2) flipped++;
  }
  return { open, nonManifold, flipped, degenerate, edges: edges.size };
}

export function checkManifold(mesh: Mesh): Check {
  const titulo = "Malha fechada";
  if (triangleCount(mesh) === 0) return { id: "malha", titulo, status: "erro", mensagem: "Não há triângulos na peça." };
  const s = edgeStats(mesh);
  if (s.open === 0 && s.nonManifold === 0 && s.flipped === 0) return { id: "malha", titulo, status: "ok", mensagem: "Todas as arestas são compartilhadas por exatamente 2 faces." };
  const partes: string[] = [];
  if (s.open) partes.push(`${s.open} aresta(s) aberta(s)`);
  if (s.nonManifold) partes.push(`${s.nonManifold} aresta(s) com mais de 2 faces`);
  if (s.flipped) partes.push(`${s.flipped} aresta(s) com face invertida`);
  return { id: "malha", titulo, status: "erro", mensagem: `A malha não está fechada: ${partes.join(", ")}.`, sugestao: "Evite partes que só se tocam numa linha ou ponto e formas de espessura zero. Peça ao GaDu para unir as peças com uma pequena sobreposição." };
}

// --- Base plana ---
export const BASE_MIN_MM2 = 100; // 1 cm²
export const BASE_MIN_FRACAO = 0.1; // ou 10% da área da pegada (caixa X × Y)

export function contactArea(mesh: Mesh, tolMm = 0.01): number {
  const box = boundingBox(mesh);
  if (!box) return 0;
  const p = mesh.positions, zmin = box.min[2];
  let area = 0;
  for (let t = 0; t < triangleCount(mesh); t++) {
    const b = t * 9;
    if (Math.abs(p[b + 2] - zmin) > tolMm || Math.abs(p[b + 5] - zmin) > tolMm || Math.abs(p[b + 8] - zmin) > tolMm) continue;
    const cross = (p[b + 3] - p[b]) * (p[b + 7] - p[b + 1]) - (p[b + 4] - p[b + 1]) * (p[b + 6] - p[b]);
    // normal para baixo: o produto vetorial em z é negativo
    if (cross < 0) area += -cross / 2;
  }
  return area;
}

export function checkBase(mesh: Mesh): Check {
  const titulo = "Base plana";
  const box = boundingBox(mesh);
  if (!box) return { id: "base", titulo, status: "erro", mensagem: "A peça está vazia." };
  const area = contactArea(mesh);
  const footprint = box.size[0] * box.size[1];
  const minimo = Math.min(BASE_MIN_MM2, footprint * BASE_MIN_FRACAO);
  if (area >= minimo && area > 0) return { id: "base", titulo, status: "ok", mensagem: `Área de contato com a mesa: ${f1(area / 100)} cm².` };
  return { id: "base", titulo, status: "aviso", mensagem: area > 0 ? `A área de contato com a mesa é pequena (${f1(area / 100)} cm²).` : "Não há face plana embaixo da peça.", sugestao: "Deixe uma face plana no chão (z = 0), ou apoie a peça numa base mais larga. Sem base a peça pode soltar da mesa durante a impressão." };
}

// --- Parede mínima (estimativa) ---
type Tri = { ax: number; ay: number; az: number; e1x: number; e1y: number; e1z: number; e2x: number; e2y: number; e2z: number };

function rayHit(o: [number, number, number], d: [number, number, number], t: Tri): number | null {
  const px = d[1] * t.e2z - d[2] * t.e2y, py = d[2] * t.e2x - d[0] * t.e2z, pz = d[0] * t.e2y - d[1] * t.e2x;
  const det = t.e1x * px + t.e1y * py + t.e1z * pz;
  if (Math.abs(det) < 1e-12) return null;
  const inv = 1 / det;
  const sx = o[0] - t.ax, sy = o[1] - t.ay, sz = o[2] - t.az;
  const u = (sx * px + sy * py + sz * pz) * inv;
  if (u < 0 || u > 1) return null;
  const qx = sy * t.e1z - sz * t.e1y, qy = sz * t.e1x - sx * t.e1z, qz = sx * t.e1y - sy * t.e1x;
  const v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv;
  if (v < 0 || u + v > 1) return null;
  const dist = (t.e2x * qx + t.e2y * qy + t.e2z * qz) * inv;
  return dist > 1e-4 ? dist : null;
}

/**
 * Espessura mínima ESTIMADA: de pontos amostrados nas faces, um raio entra na peça (contra a normal) e a distância
 * até a primeira face do outro lado é a espessura local. Pega o menor valor. Não vê paredes finas entre as amostras.
 * `maxSamples` limita o custo em malhas grandes. Devolve null se não houver como medir.
 */
export function estimateMinWall(mesh: Mesh, maxSamples = 400): number | null {
  const n = triangleCount(mesh);
  if (n === 0) return null;
  const p = mesh.positions;
  const tris: Tri[] = new Array(n);
  for (let t = 0; t < n; t++) {
    const b = t * 9;
    tris[t] = { ax: p[b], ay: p[b + 1], az: p[b + 2], e1x: p[b + 3] - p[b], e1y: p[b + 4] - p[b + 1], e1z: p[b + 5] - p[b + 2], e2x: p[b + 6] - p[b], e2y: p[b + 7] - p[b + 1], e2z: p[b + 8] - p[b + 2] };
  }
  const budget = Math.max(40, Math.min(maxSamples, Math.floor(8_000_000 / n)));
  const stride = Math.max(1, Math.floor(n / budget));
  let min = Infinity;
  for (let t = 0; t < n; t += stride) {
    const a = tris[t];
    const nx = a.e1y * a.e2z - a.e1z * a.e2y, ny = a.e1z * a.e2x - a.e1x * a.e2z, nz = a.e1x * a.e2y - a.e1y * a.e2x;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-9) continue;
    const d: [number, number, number] = [-nx / len, -ny / len, -nz / len];
    // centro do triângulo, empurrado um pouco para dentro
    const o: [number, number, number] = [a.ax + (a.e1x + a.e2x) / 3 + d[0] * 1e-3, a.ay + (a.e1y + a.e2y) / 3 + d[1] * 1e-3, a.az + (a.e1z + a.e2z) / 3 + d[2] * 1e-3];
    let best = Infinity;
    for (let k = 0; k < n; k++) { if (k === t) continue; const h = rayHit(o, d, tris[k]); if (h !== null && h < best) best = h; }
    if (best < min) min = best + 1e-3;
  }
  return Number.isFinite(min) ? min : null;
}

const WALL_NAME = /(parede|espessura|wall|thick)/i;

/** Parâmetros declarados cujo nome indica parede/espessura e que estão abaixo do mínimo. */
export function declaredWallIssues(params: Param[], values: ParamValues): string[] {
  const out: string[] = [];
  for (const p of params) {
    if (p.kind !== "number" || !WALL_NAME.test(p.name)) continue;
    const v = values[p.name];
    const val = typeof v === "number" ? v : p.value;
    if (val < PAREDE_MIN_MM) out.push(`${p.label || p.name} está em ${f1(val)} mm`);
  }
  return out;
}

export function checkWall(mesh: Mesh, params: Param[] = [], values: ParamValues = {}): Check {
  const titulo = "Paredes de 1,2 mm ou mais";
  const decl = declaredWallIssues(params, values);
  const est = estimateMinWall(mesh);
  const sug = "Aumente a espessura da parede para pelo menos 1,2 mm (3 linhas do bico de 0,4 mm).";
  if (decl.length) return { id: "parede", titulo, status: "aviso", estimativa: true, mensagem: `Parede fina demais: ${decl.join("; ")}.`, sugestao: sug };
  if (est === null) return { id: "parede", titulo, status: "aviso", estimativa: true, mensagem: "Não consegui estimar a espessura das paredes.", sugestao: "Confira no Bambu Studio." };
  if (est < PAREDE_MIN_MM) return { id: "parede", titulo, status: "aviso", estimativa: true, mensagem: `Estimativa: há parede de cerca de ${f1(est)} mm, abaixo de ${f1(PAREDE_MIN_MM)} mm.`, sugestao: sug };
  return { id: "parede", titulo, status: "ok", estimativa: true, mensagem: `Estimativa: a parte mais fina mede cerca de ${f1(est)} mm. É uma estimativa por amostragem; o Bambu Studio mostra o resultado final.` };
}

// --- Balanço (aviso) ---
export const OVERHANG_DEG = 45;

/** Fração da área das faces (fora da base) que inclinam mais de 45° para fora, a partir da vertical para baixo. */
export function overhangFraction(mesh: Mesh): number {
  const box = boundingBox(mesh);
  if (!box) return 0;
  const p = mesh.positions, zmin = box.min[2];
  const limit = -Math.cos((OVERHANG_DEG * Math.PI) / 180); // nz abaixo disso pede suporte
  let total = 0, over = 0;
  for (let t = 0; t < triangleCount(mesh); t++) {
    const b = t * 9;
    const ux = p[b + 3] - p[b], uy = p[b + 4] - p[b + 1], uz = p[b + 5] - p[b + 2];
    const vx = p[b + 6] - p[b], vy = p[b + 7] - p[b + 1], vz = p[b + 8] - p[b + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-12) continue;
    const area = len / 2;
    total += area;
    const onBed = Math.max(Math.abs(p[b + 2] - zmin), Math.abs(p[b + 5] - zmin), Math.abs(p[b + 8] - zmin)) <= 0.01;
    if (!onBed && nz / len < limit) over += area;
  }
  return total > 0 ? over / total : 0;
}

export function checkOverhang(mesh: Mesh): Check {
  const titulo = "Balanços (suporte)";
  const frac = overhangFraction(mesh);
  if (frac < 0.03) return { id: "balanco", titulo, status: "ok", mensagem: "Quase nada passa de 45° no ar." };
  return { id: "balanco", titulo, status: "aviso", mensagem: `Cerca de ${Math.round(frac * 100)}% da superfície passa de ${OVERHANG_DEG}° e pode pedir suporte.`, sugestao: "Gire a peça no fatiador, use chanfros de 45° no lugar de beiras retas, ou aceite o suporte automático." };
}

export function analyze(mesh: Mesh, params: Param[] = [], values: ParamValues = {}): Report {
  const checks = [checkSize(mesh), checkManifold(mesh), checkBase(mesh), checkWall(mesh, params, values), checkOverhang(mesh)];
  const erros = checks.filter((c) => c.status === "erro").length;
  const avisos = checks.filter((c) => c.status === "aviso").length;
  return { checks, ok: erros === 0, avisos, erros };
}
