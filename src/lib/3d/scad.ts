import { PEDIDO_MAX, SCAD_MAX } from "./limits.ts";

// Montagem do prompt, extração e validação do código OpenSCAD devolvido pela IA. Funções puras.
// O código só roda no worker do navegador; aqui só conferimos o texto antes de mostrá-lo.

export const SCAD_RULES = `Você escreve código OpenSCAD paramétrico para peças imprimíveis em 3D na Bambu Lab A1 (PLA, bico 0.4 mm, volume 256 x 256 x 256 mm).
Regras obrigatórias:
1. Responda SÓ com o código OpenSCAD, sem explicação e sem cercas de markdown.
2. Unidades em milímetros. A peça fica sobre o plano z = 0, com uma face plana embaixo, para imprimir sem suporte quando possível.
3. No topo do arquivo, um parâmetro por linha, no formato do Customizer, SEM código antes deles:
   largura = 70; // [30:1:200] Largura da base (mm)
   arredondar = true; // [true] Bordas arredondadas
   Todo número ajustável tem [mínimo:passo:máximo] e um rótulo curto em português. Nomes em português, sem acentos.
4. Depois dos parâmetros: módulos e a peça. Comentários em português.
5. Parede mínima de 1,2 mm. Nenhuma dimensão acima de 256 mm. Use $fn entre 24 e 96.
6. Sem include, use, import, surface ou qualquer arquivo externo. Sem texto() com fontes especiais.
7. Peça única, sólida e fechada (sem faces soltas), com no máximo ${SCAD_MAX} caracteres.`;

export type PromptInput = { modo: "novo" | "refinar" | "corrigir"; pedido: string; scad?: string; erro?: string };

/** Texto livre da pessoa dentro de delimitadores, para o modelo tratá-lo como dado, não como regra. */
const fence = (label: string, text: string) => `<${label}>\n${text.replace(/<\/?[a-z_]+>/gi, " ")}\n</${label}>`;

export function buildPrompt(i: PromptInput): string {
  const pedido = i.pedido.slice(0, PEDIDO_MAX);
  if (i.modo === "novo") return `${SCAD_RULES}\n\nPedido da pessoa:\n${fence("pedido", pedido)}\n\nEscreva o código OpenSCAD.`;
  const atual = `Código atual:\n${fence("codigo", (i.scad ?? "").slice(0, SCAD_MAX))}`;
  if (i.modo === "refinar") return `${SCAD_RULES}\n\n${atual}\n\nAltere o código conforme este pedido, mantendo os parâmetros que continuam valendo:\n${fence("pedido", pedido)}\n\nDevolva o código completo e atualizado.`;
  return `${SCAD_RULES}\n\n${atual}\n\nO OpenSCAD não conseguiu renderizar esse código. Mensagem de erro:\n${fence("erro", (i.erro ?? "").slice(0, 1500))}\n\nPedido original da pessoa: ${fence("pedido", pedido)}\n\nCorrija o erro e devolva o código completo.`;
}

/** Tira cercas de markdown e texto em volta, devolvendo só o código. */
export function extractScad(text: string): string {
  const fenced = /```(?:openscad|scad|c|cpp)?\s*\n([\s\S]*?)```/i.exec(text);
  return (fenced ? fenced[1] : text.replace(/^```\w*\s*\n?/, "").replace(/```\s*$/, "")).trim();
}

export type ScadCheck = { ok: true } | { ok: false; message: string };

const FORBIDDEN = /\b(include|use|import|surface|import_stl|import_off|import_dxf)\b\s*(<|\()/;

/** Confere o código antes de entregar à tela: tamanho, arquivos externos, $fn exagerado e se há algo para desenhar. */
export function validateScad(code: string): ScadCheck {
  if (!code.trim()) return { ok: false, message: "A IA não devolveu código." };
  if (code.length > SCAD_MAX) return { ok: false, message: "O código ficou grande demais. Peça uma peça mais simples." };
  if (FORBIDDEN.test(code)) return { ok: false, message: "O código tentou usar arquivos externos, o que não é permitido." };
  for (const m of code.matchAll(/\$fn\s*=\s*(\d+)/g)) if (Number(m[1]) > 360) return { ok: false, message: "O código pede detalhe demais ($fn acima de 360) e ficaria pesado." };
  if (!/\b(cube|sphere|cylinder|polyhedron|linear_extrude|rotate_extrude|polygon|text|hull|minkowski)\s*\(/.test(code)) return { ok: false, message: "O código não desenha nenhuma peça." };
  return { ok: true };
}
