// Malhas sintéticas para os testes (sem dados pessoais).
import type { Mesh } from "./mesh.ts";

/** Caixa [x0,x1]×[y0,y1]×[z0,z1] com 12 triângulos, normais para fora. `invert` vira a malha do avesso. */
export function boxTris(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, invert = false): number[] {
  const v = (x: number, y: number, z: number) => [x, y, z];
  const p = [v(x0, y0, z0), v(x1, y0, z0), v(x1, y1, z0), v(x0, y1, z0), v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1)];
  const quads = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
  const out: number[] = [];
  for (const [a, b, c, d] of quads) {
    const tris = invert ? [[a, c, b], [a, d, c]] : [[a, b, c], [a, c, d]];
    for (const t of tris) for (const i of t) out.push(...p[i]);
  }
  return out;
}
export const box = (w: number, d: number, h: number): Mesh => ({ positions: Float32Array.from(boxTris(0, 0, 0, w, d, h)) });

/** Caixa oca aberta em cima: cubo externo menos o interno, com parede `wall` e fundo `wall`. Malha fechada (sólido em forma de copo). */
export function cup(w: number, d: number, h: number, wall: number): Mesh {
  // Aproximação por 5 paredes sólidas que se encostam só por faces inteiras (sem sobreposição de volume).
  const t: number[] = [];
  const push = (...a: [number, number, number, number, number, number]) => t.push(...boxTris(...a));
  push(0, 0, 0, w, d, wall); // fundo
  push(0, 0, wall, wall, d, h); // esquerda
  push(w - wall, 0, wall, w, d, h); // direita
  push(wall, 0, wall, w - wall, wall, h); // frente
  push(wall, d - wall, wall, w - wall, d, h); // trás
  return { positions: Float32Array.from(t) };
}
