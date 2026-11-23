// Entende, no texto da pessoa, o pedido de "quanto fica líquido um salário de 8 mil" (valor e dependentes).
// Só reconhece o pedido: quem calcula é calcularSalario (salario.ts). Puro, sem rede. Se não tiver certeza, devolve null.
import { MAX_BRUTO, MAX_DEPENDENTES, calcularSalario, type Salario } from "./salario.ts";
import { formatBRL } from "./money.ts";

export type PedidoSalario = { bruto: number; dependentes: number };

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
  const bruto = valorDoTexto(mensagem);
  if (bruto === null) return null;
  return { bruto, dependentes: dependentesDoTexto(mensagem) };
}

/** Texto do cálculo para a conversa (cartão, contexto do modelo e fala): todos os números vêm de calcularSalario. */
export function resumoSalario(s: Salario): string {
  const ir = s.irrf > 0 ? formatBRL(s.irrf) : s.irrfDispensado ? "R$ 0,00 (imposto de até R$ 10 não é retido)" : "R$ 0,00 (isento)";
  const dep = s.dependentes ? ` com ${s.dependentes} ${s.dependentes === 1 ? "dependente" : "dependentes"}` : "";
  return `Salário bruto de ${formatBRL(s.bruto)}${dep}: INSS ${formatBRL(s.inss)}, imposto de renda ${ir}, líquido ${formatBRL(s.liquido)} (${String(s.pctLiquido).replace(".", ",")}% do bruto).`;
}

/** Bloco que entra no contexto do modelo quando a pessoa pede o cálculo: ele repete estes números e não calcula nada. */
export function blocoSalario(p: PedidoSalario): string | null {
  const s = calcularSalario(p.bruto, p.dependentes);
  if (!s) return null;
  return `\n\nCálculo do salário (feito pelo servidor com as tabelas de INSS e IRRF de 2026; use SÓ estes números e não calcule nada por conta própria):\n${resumoSalario(s)}\nDedução do IR usada: ${s.modelo === "simplificado" ? "desconto simplificado" : "deduções legais (INSS e dependentes)"}. Redução da Lei 15.270/2025: ${formatBRL(s.reducao)}.\nResponda com uma frase curta com o líquido e diga que o cartão mostra o passo a passo. Estimativa para empregado CLT (sem 13º, férias, pensão ou outras deduções).`;
}
