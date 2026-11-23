// Entende, no texto da pessoa, o pedido de "quanto fica líquido um salário de 8 mil" (valor, dependentes, outras deduções e benefícios).
// Só reconhece o pedido: quem calcula é calcularSalario (salario.ts). Puro, sem rede. Se não tiver certeza, devolve null.
import { MAX_BRUTO, MAX_DEPENDENTES, calcularSalario, type Salario } from "./salario.ts";
import { formatBRL } from "./money.ts";

/** `outrasDeducoes` e `beneficios` só aparecem quando a pessoa disse e o valor é válido; na dúvida ficam de fora (0). */
export type PedidoSalario = { bruto: number; dependentes: number; outrasDeducoes?: number; beneficios?: number };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const NUM_EXTENSO: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10 };

/** "8 mil", "8mil", "8,5 mil", "8k", "R$ 8.500,50", "8000". Devolve o 1º valor de salário do texto. */
export function valorDoTexto(texto: string): number | null {
  const t = norm(texto).replace(/ /g, " ");
  const re = /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d+)?)\s*(mil\b|k\b)?/g;
  for (const m of t.matchAll(re)) {
    // número que pertence a "dependentes" não é o salário
    const depois = t.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 14);
    if (/^\s*dependente/.test(depois)) continue;
    let n: number;
    const raw = m[1];
    if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(raw)) n = Number(raw.replace(/\./g, "").replace(",", "."));
    else n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n)) continue;
    if (m[2]) n *= 1000;
    if (n >= 100 && n <= MAX_BRUTO) return Math.round(n * 100) / 100;
  }
  return null;
}

const VAL = String.raw`(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d+)?)\s*(mil\b|k\b|reais\b)?`;
const OUTRAS = String.raw`(?:pensao(?:\s+alimenticia)?|previdencia(?:\s+privada)?|pgbl|outras?\s+deducoes|deducoes)`;
const BENEF = String.raw`(?:beneficios?|vale[\s-]?(?:refeicao|alimentacao)|vr|va)`;

function numeroDe(raw: string, mult: string | undefined): number | null {
  const n = /^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(raw) ? Number(raw.replace(/\./g, "").replace(",", ".")) : Number(raw.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const v = mult === "mil" || mult === "k" ? n * 1000 : n;
  return v > 0 && v <= MAX_BRUTO ? Math.round(v * 100) / 100 : null;
}

/** Valor dito junto de uma palavra-chave ("500 de previdência", "pensão de 500"). Soma se aparecer mais de uma vez; tira o trecho do texto. */
function extra(t: string, chave: string, verbo = ""): { valor: number | null; resto: string } {
  const antes = new RegExp(`(?:${verbo}\\s*)?${VAL}\\s+(?:de\\s+|em\\s+)?${chave}\\b`, "g");
  const depois = new RegExp(`\\b${chave}\\s*(?:de\\s+|:\\s*)?${VAL}`, "g");
  let total = 0, achou = false, resto = t;
  for (const re of [antes, depois]) {
    for (const m of resto.matchAll(re)) { const n = numeroDe(m[1], m[2]); if (n !== null) { total += n; achou = true; } }
    resto = resto.replace(re, " ");
  }
  return { valor: achou ? Math.round(total * 100) / 100 : null, resto };
}

export function dependentesDoTexto(texto: string): number {
  const t = norm(texto);
  if (/\bsem\s+dependentes?\b/.test(t)) return 0;
  const m = t.match(/\b(\d{1,2}|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)\s+(?:filhos?\s+)?dependentes?\b/);
  if (!m) return /\bum\s+dependente\b/.test(t) ? 1 : 0;
  const n = /^\d/.test(m[1]) ? Number(m[1]) : NUM_EXTENSO[m[1]];
  return Number.isInteger(n) && n >= 0 && n <= MAX_DEPENDENTES ? n : 0;
}

/**
 * A mensagem pede o líquido (ou os descontos) de um salário e traz o valor?
 * Exige as três coisas: palavra de salário, palavra de líquido/desconto e um valor. "Quanto fica líquido um salário de 8 mil?" → 8000.
 */
export function pedidoSalario(mensagem: string): PedidoSalario | null {
  const t = norm(mensagem);
  if (t.length > 400) return null;
  const falaSalario = /\b(salario|bruto|holerite|contracheque|clt|folha)\b/.test(t);
  const falaLiquido = /\b(liquido|liquida|descontos?|inss|irrf|imposto de renda|quanto (?:fica|sobra|sobraria|recebo|vou receber|cai))\b/.test(t) || /\bsalario\b.*\bde\s+(?:r\$\s*)?\d/.test(t) && /\b(fica|sobra|recebo)\b/.test(t);
  if (!falaSalario || !falaLiquido) return null;
  // Os valores de outras deduções e de benefícios saem do texto antes de procurar o salário (para um "800 de benefícios" não virar o bruto).
  const o = extra(t, OUTRAS, "(?:descontando|descontar|desconto de|abatendo|deduzindo|com|mais)");
  const b = extra(o.resto, BENEF, "(?:com|mais|ganho|recebo)");
  const bruto = valorDoTexto(b.resto);
  if (bruto === null) return null;
  const dependentes = dependentesDoTexto(mensagem);
  const pedido: PedidoSalario = { bruto, dependentes };
  // Na dúvida, ignora: o campo só entra se o cálculo com ele for válido.
  if (o.valor !== null && calcularSalario(bruto, dependentes, { outrasDeducoes: o.valor })) pedido.outrasDeducoes = o.valor;
  if (b.valor !== null && calcularSalario(bruto, dependentes, { beneficios: b.valor })) pedido.beneficios = b.valor;
  return pedido;
}

/** A pessoa pediu para GUARDAR o líquido ("salva o líquido como meu salário")? Esse pedido segue para o fluxo com confirmação (não é só leitura). */
export function pedeSalvarSalario(mensagem: string): boolean {
  return /\b(salva|salvar|salve|guarda|guardar|grava|gravar|registra|registrar|anota|lanca|lancar|coloca|define|atualiza)\b/.test(norm(mensagem));
}

/** O cálculo do pedido (o mesmo que a tela e o cartão usam). */
export const calcularPedido = (p: PedidoSalario): Salario | null => calcularSalario(p.bruto, p.dependentes, { outrasDeducoes: p.outrasDeducoes, beneficios: p.beneficios });

/**
 * Texto do cálculo para a conversa (cartão, contexto do modelo e fala): todos os números vêm de calcularSalario.
 * Com `estimativas`, soma uma frase com o 13º e as férias + 1/3 (estimativas).
 */
export function resumoSalario(s: Salario, opts: { estimativas?: boolean } = { estimativas: true }): string {
  const ir = s.irrf > 0 ? formatBRL(s.irrf) : s.irrfDispensado ? "R$ 0,00 (imposto de até R$ 10 não é retido)" : "R$ 0,00 (isento)";
  const dep = s.dependentes ? ` com ${s.dependentes} ${s.dependentes === 1 ? "dependente" : "dependentes"}` : "";
  const outras = s.outrasDeducoes > 0 ? `, outras deduções ${formatBRL(s.outrasDeducoes)}` : "";
  let t = `Salário bruto de ${formatBRL(s.bruto)}${dep}: INSS ${formatBRL(s.inss)}, imposto de renda ${ir}${outras}, líquido ${formatBRL(s.liquido)} (${String(s.pctLiquido).replace(".", ",")}% do bruto).`;
  if (s.beneficios > 0) t += ` Com ${formatBRL(s.beneficios)} de benefícios, você recebe ${formatBRL(s.totalRecebido)} no total.`;
  if (opts.estimativas !== false) t += ` Estimativas: 13º líquido de ${formatBRL(s.decimoTerceiro.liquido)} e férias com um terço líquidas de ${formatBRL(s.ferias.liquido)}.`;
  return t;
}

/** Bloco que entra no contexto do modelo quando a pessoa pede o cálculo: ele repete estes números e não calcula nada. */
export function blocoSalario(p: PedidoSalario): string | null {
  const s = calcularPedido(p);
  if (!s) return null;
  return `\n\nCálculo do salário (feito pelo servidor com as tabelas de INSS e IRRF de 2026; use SÓ estes números e não calcule nada por conta própria):\n${resumoSalario(s)}\nDedução do IR usada: ${s.modelo === "simplificado" ? "desconto simplificado" : "deduções legais (INSS e dependentes)"}. Redução da Lei 15.270/2025: ${formatBRL(s.reducao)}.\nResponda com uma frase curta com o líquido e diga que o cartão mostra o passo a passo. Estimativa para empregado CLT. O 13º e as férias são estimativas de pagamento separado.`;
}
