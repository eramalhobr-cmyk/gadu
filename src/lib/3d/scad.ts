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
5. Parede, nervura, reforço, ponta de gancho, margem entre furo e borda e o TRAÇO do texto em relevo: no mínimo 1,2 mm (bico 0.4), a menos que a pessoa peça mais fino. Nenhuma dimensão acima de 256 mm. Use $fn entre 24 e 96.
6. Sem include, use, import, surface ou qualquer arquivo externo.
7. Peça única, sólida e fechada (sem faces soltas), com no máximo ${SCAD_MAX} caracteres. Todas as partes entram num só union() e se sobrepõem 0,1 a 0,2 mm: nada solto ou flutuando, nenhum triângulo de papel (extrusões e rotate alinhadas ao Y da peça, confira o intervalo de cada eixo). Só caixa e tampa podem ficar separadas, lado a lado na mesa.
8. Eixos: X = largura (ou comprimento), Y = profundidade, Z = altura, de baixo para cima a partir da mesa. "Altura", "alto", "mais alto", "mais baixo" e "mais grosso" SEMPRE mudam o eixo Z. O parâmetro do eixo Y se chama profundidade (nunca altura). "N mm mais alto/baixo" muda o Z TOTAL da peça em N mm: mexa no parâmetro da altura geral (ou no comprimento do apoio inclinado, para o Z subir N mm), nunca só numa aba, ranhura ou relevo.
9. Texto em relevo: text() com font = "Liberation Sans" ou font = "Liberation Sans:style=Bold" (as únicas fontes que existem), com linear_extrude, saindo da face de cima (somado com union) ou gravado nela (difference). Prefira "Liberation Sans:style=Bold", size 9 ou mais (ou offset(delta=0.3)) para o traço passar de 1,2 mm.
10. Código enxuto: até cerca de 120 linhas, comentários curtos, sem blocos repetidos (use for e módulos). Termine sempre a peça inteira.
11. As medidas pedidas aparecem na peça: altura, largura, comprimento e profundidade são medidas EXTERNAS e o parâmetro com esse nome é igual ao tamanho da parte correspondente. Caixa com tampa lado a lado: o corpo tem a altura pedida (não altura − tampa).`;

export type PromptInput = { modo: "novo" | "refinar" | "corrigir"; pedido: string; scad?: string; erro?: string; comImagem?: boolean; causa?: "render" | "qualidade" };

/** Texto livre da pessoa dentro de delimitadores, para o modelo tratá-lo como dado, não como regra. */
const fence = (label: string, text: string) => `<${label}>\n${text.replace(/<\/?[a-z_]+>/gi, " ")}\n</${label}>`;

/** 3D-1b: o que a imagem anexa é (a IA vê a forma; as medidas continuam vindo do código). */
export const IMAGEM_NOTA = "A imagem anexa é o render atual dessa peça no visualizador do GaDu (mesa da Bambu Lab A1 de 256 × 256 mm com grade a cada 32 mm, Z para cima). Use-a para entender a forma e onde está cada parte; as medidas certas são as do código.";

export function buildPrompt(i: PromptInput): string {
  const pedido = i.pedido.slice(0, PEDIDO_MAX);
  if (i.modo === "novo") return `${SCAD_RULES}\n\nPedido da pessoa:\n${fence("pedido", pedido)}\n\nEscreva o código OpenSCAD.`;
  const atual = `Código atual:\n${fence("codigo", (i.scad ?? "").slice(0, SCAD_MAX))}`;
  if (i.modo === "refinar") return `${SCAD_RULES}\n\n${atual}${i.comImagem ? `\n\n${IMAGEM_NOTA}` : ""}\n\nAltere o código conforme este pedido, mantendo os parâmetros que continuam valendo:\n${fence("pedido", pedido)}\n\nDevolva o código completo e atualizado.`;
  if (i.causa === "qualidade") return `${SCAD_RULES}\n\n${atual}\n\nO código renderiza, mas a peça montada falhou nestas conferências (medidas feitas na malha real):\n${fence("erro", (i.erro ?? "").slice(0, 1500))}\n\nPedido original da pessoa: ${fence("pedido", pedido)}\n\nCorrija SÓ esses problemas, mantendo o pedido, os parâmetros e o resto da peça, e devolva o código completo.`;
  return `${SCAD_RULES}\n\n${atual}\n\nO OpenSCAD não conseguiu renderizar esse código. Mensagem de erro:\n${fence("erro", (i.erro ?? "").slice(0, 1500))}\n\nPedido original da pessoa: ${fence("pedido", pedido)}\n\nCorrija o erro e devolva o código completo.`;
}

/** Nova tentativa automática quando a primeira resposta veio cortada ou incompleta. */
export const NOTA_CORTADA = "ATENÇÃO: a tentativa anterior ficou longa demais e foi cortada no meio. Escreva uma versão mais curta e simples (até 80 linhas), sem comentários longos, e termine o código inteiro.";

/** Prompt da nova tentativa: o mesmo pedido, com o aviso de que a resposta anterior não terminou. */
export function buildRetryPrompt(i: PromptInput): string {
  return `${buildPrompt(i)}\n\n${NOTA_CORTADA}`;
}

/**
 * Confere se o código terminou: parênteses, colchetes e chaves fechados (fora de textos e comentários)
 * e a última instrução fechada com ; ou }. Pega o código cortado pelo limite de saída antes de ir à tela.
 */
export function scadIncompleto(code: string): string | null {
  const pilha: string[] = [];
  const par: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  let ultimo = "";
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === "/" && code[i + 1] === "/") { const f = code.indexOf("\n", i); if (f < 0) break; i = f; continue; }
    if (c === "/" && code[i + 1] === "*") { const f = code.indexOf("*/", i + 2); if (f < 0) return "comentário sem fim"; i = f + 1; continue; }
    if (c === '"') {
      let j = i + 1;
      while (j < code.length && code[j] !== '"') j += code[j] === "\\" ? 2 : 1;
      if (j >= code.length) return "texto sem aspas de fechamento";
      i = j; ultimo = '"'; continue;
    }
    if (c === "(" || c === "[" || c === "{") pilha.push(c);
    else if (c === ")" || c === "]" || c === "}") { if (pilha.pop() !== par[c]) return `"${c}" sem abertura`; }
    if (!/\s/.test(c)) ultimo = c;
  }
  if (pilha.length) return `"${pilha[pilha.length - 1]}" sem fechamento`;
  if (ultimo && ultimo !== ";" && ultimo !== "}") return "a última instrução não terminou";
  return null;
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
  if (scadIncompleto(code)) return { ok: false, message: "O código da IA veio incompleto (cortado no meio). Tente de novo com um pedido mais simples." };
  if (!/\b(cube|sphere|cylinder|polyhedron|linear_extrude|rotate_extrude|polygon|text|hull|minkowski)\s*\(/.test(code)) return { ok: false, message: "O código não desenha nenhuma peça." };
  return { ok: true };
}
