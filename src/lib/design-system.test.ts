// Design System, etapa 2 (UX-5): sem estilo inline estático nos componentes e sem regra repetida em v2.css.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

// Fica de fora: o 3D (outra frente) e geometria calculada (Agenda, canvas, anel de progresso).
const LIBERADOS = new Set(["AgendaView.tsx", "RobotFace.tsx", "ui.tsx"]);

test("componentes só usam style={{…}} para valores dinâmicos (variável --c, medidas calculadas)", () => {
  const dir = join(root, "src/components");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".tsx") && !LIBERADOS.has(x))) {
    const src = read(`src/components/${f}`);
    for (const m of src.matchAll(/style=\{\{([^}]*)\}\}/g)) {
      const body = m[1];
      const dinamico = body.includes("--") || body.includes("`") || body.includes("?");
      assert.ok(dinamico, `${f}: estilo inline estático (${body.trim()}); use uma classe de v2-pages.css`);
    }
  }
});

test("v2.css não repete o mesmo seletor no nível de cima (junte as regras)", () => {
  const lines = read("src/app/v2.css").split("\n");
  let depth = 0;
  const seen = new Map<string, number>();
  const nested = new Set<string>();
  const top: [string, number][] = [];
  lines.forEach((l, i) => {
    const m = l.match(/^(\.[^{]+?)\s*\{.*\}\s*$/);
    if (depth === 0 && m) top.push([m[1].trim(), i + 1]);
    if (depth > 0) for (const p of l.matchAll(/(\.[^{}]+?)\s*\{/g)) nested.add(p[1].trim());
    depth = Math.max(0, depth + (l.match(/\{/g)?.length ?? 0) - (l.match(/\}/g)?.length ?? 0));
  });
  const repetidos: string[] = [];
  for (const [sel, n] of top) {
    if (nested.has(sel) || sel === ".sheet") continue; // também aparece dentro de @media: a ordem da cascata importa
    if (seen.has(sel)) repetidos.push(`${sel} (linhas ${seen.get(sel)} e ${n})`);
    else seen.set(sel, n);
  }
  assert.deepEqual(repetidos, []);
});
