// Malha como "sopa de triângulos": 9 números por triângulo (x, y, z de cada vértice), em mm. Funções puras.
export type Mesh = { positions: Float32Array };
export type Box = { min: [number, number, number]; max: [number, number, number]; size: [number, number, number] };

export const triangleCount = (m: Mesh) => Math.floor(m.positions.length / 9);

export function boundingBox(m: Mesh): Box | null {
  const p = m.positions;
  if (p.length < 9) return null;
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { const v = p[i + k]; if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v; }
  return { min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };
}

/** Lê STL binário ou ASCII. Lança erro se o formato não bater. */
export function parseStl(data: Uint8Array): Mesh {
  if (data.length >= 84) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const n = view.getUint32(80, true);
    if (84 + n * 50 === data.length) {
      const positions = new Float32Array(n * 9);
      for (let t = 0; t < n; t++) {
        const o = 84 + t * 50 + 12;
        for (let k = 0; k < 9; k++) positions[t * 9 + k] = view.getFloat32(o + k * 4, true);
      }
      return { positions };
    }
  }
  const text = new TextDecoder().decode(data);
  if (!/^\s*solid/i.test(text)) throw new Error("Arquivo STL inválido.");
  const nums: number[] = [];
  for (const m of text.matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/gi)) nums.push(Number(m[1]), Number(m[2]), Number(m[3]));
  if (nums.length % 9 !== 0 || nums.some((x) => !Number.isFinite(x))) throw new Error("Arquivo STL inválido.");
  return { positions: Float32Array.from(nums) };
}

/** Centro da mesa da A1 (mm): a peça é posta no meio da mesa, com a base em z = 0. */
export const BED_CENTER: [number, number] = [128, 128];

/** Move a peça para o centro da mesa e apoia o ponto mais baixo em z = 0 (as medidas não mudam). */
export function placeOnBed(m: Mesh): Mesh {
  const box = boundingBox(m);
  if (!box) return m;
  const dx = BED_CENTER[0] - (box.min[0] + box.max[0]) / 2, dy = BED_CENTER[1] - (box.min[1] + box.max[1]) / 2, dz = -box.min[2];
  const positions = new Float32Array(m.positions.length);
  for (let i = 0; i < positions.length; i += 3) { positions[i] = m.positions[i] + dx; positions[i + 1] = m.positions[i + 1] + dy; positions[i + 2] = m.positions[i + 2] + dz; }
  return { positions };
}
