// 3D-1b no Studio: o render vai junto do ajuste (pela tela e pela voz), só quando está pronto, e o visualizador entrega a captura.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const read = (n: string) => readFileSync(new URL(`../src/components/studio3d/${n}`, import.meta.url), "utf8");

test("Studio: imagem só no ajuste com render pronto; o ajuste por voz usa o mesmo pedirIA e espera o render", () => {
  const s = read("Studio3D.tsx");
  assert.match(s, /modo === "refinar" && render\.state === "ok" \? captura\.current\?\.\(\)/);
  assert.match(s, /\.\.\.\(imagem \? \{ imagem \} : \{\}\)/);
  assert.match(s, /<Viewer3D [^>]*captura=\{captura\}/);
  const voz = s.slice(s.indexOf("const texto = ajusteVoz.current"), s.indexOf("const voltar"));
  assert.match(voz, /render\.state === "ok" && mesh/, "a voz espera o render para levar a imagem");
  assert.match(voz, /pedirIA\("refinar", texto\)/, "mesmo caminho do campo de texto");
});

test("Visualizador: captura pequena em JPEG, sem preserveDrawingBuffer", () => {
  const v = read("Viewer3D.tsx");
  assert.match(v, /tamanhoCaptura\(src\.width, src\.height\)/);
  assert.match(v, /toDataURL\("image\/jpeg", 0\.82\)/);
  assert.doesNotMatch(v, /preserveDrawingBuffer\s*:/);
});
