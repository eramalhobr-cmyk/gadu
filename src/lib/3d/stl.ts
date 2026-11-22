import type { Mesh } from "./mesh.ts";

/** STL binário (80 bytes de cabeçalho, contagem, 50 bytes por triângulo), em mm. */
export function encodeBinaryStl(mesh: Mesh, name = "GaDu 3D"): Uint8Array {
  const n = Math.floor(mesh.positions.length / 9);
  const out = new Uint8Array(84 + n * 50);
  const view = new DataView(out.buffer);
  out.set(new TextEncoder().encode(name.slice(0, 79)), 0);
  view.setUint32(80, n, true);
  const p = mesh.positions;
  for (let t = 0; t < n; t++) {
    const b = t * 9;
    const ux = p[b + 3] - p[b], uy = p[b + 4] - p[b + 1], uz = p[b + 5] - p[b + 2];
    const vx = p[b + 6] - p[b], vy = p[b + 7] - p[b + 1], vz = p[b + 8] - p[b + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    const o = 84 + t * 50;
    view.setFloat32(o, nx, true); view.setFloat32(o + 4, ny, true); view.setFloat32(o + 8, nz, true);
    for (let k = 0; k < 9; k++) view.setFloat32(o + 12 + k * 4, p[b + k], true);
  }
  return out;
}
