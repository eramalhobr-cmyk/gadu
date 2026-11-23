// Simulador de salário bruto → líquido (empregado CLT, mensal), com as tabelas vigentes em 2026. Puro e determinístico:
// sem banco, sem rede e sem IA. É a ÚNICA fonte dos números: a conversa e a tela chamam esta função, e o modelo nunca calcula.
// Tudo em centavos inteiros; cada imposto é arredondado uma vez, no fim (meio centavo sobe).
//
// FONTES OFICIAIS (conferidas em 23/11/2026):
// - INSS (empregado, doméstico e avulso): Portaria Interministerial MPS/MF nº 13, de 09/01/2026. Tabela de contribuição mensal em
//   https://www.gov.br/inss/pt-br/direitos-e-deveres/inscricao-e-contribuicao/tabela-de-contribuicao-mensal
//   Faixas progressivas (cada alíquota só vale para a parte do salário que cai na faixa); teto do salário de contribuição R$ 8.475,55.
// - IRRF mensal 2026: tabela progressiva da Lei 11.482/2007 (redação da Lei 15.191/2025), dedução por dependente e desconto simplificado, em
//   https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026
// - Redução do imposto: art. 3º-A da Lei 9.250/1995 (incluído pela Lei 15.270/2025), a partir de jan/2026, em
//   https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/L15270.htm
//   Rendimento tributável até R$ 5.000,00: redução até R$ 312,89 (zera o imposto); de R$ 5.000,01 a R$ 7.350,00: R$ 978,62 − 0,133145 × rendimento;
//   acima de R$ 7.350,00: nenhuma. Limitada ao imposto apurado pela tabela progressiva (§ 1º).
// - Dispensa de retenção de imposto de até R$ 10,00: art. 67 da Lei 9.430/1996.
// Estas tabelas mudam: ao atualizar o ano, troque só as constantes abaixo e os testes (src/lib/finance/salario.test.ts).
//
// - Exemplos oficiais de aplicação da Lei 15.270/2025 (usados nos testes, com o INSS dado em cada exemplo):
//   https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/exemplos-de-aplicacao-da-lei-15-270-2025
//
// Entradas: bruto, dependentes, outras deduções (pensão alimentícia, previdência privada: entram na dedução legal do IR e saem do líquido, mas NÃO na
// base do INSS) e benefícios não tributáveis (VR, VA: não mudam INSS nem IR; só somam ao total recebido).
// 13º e férias + 1/3 são ESTIMATIVAS: cada um é tratado como pagamento separado, com INSS (com teto) e IRRF próprios, pela mesma função do mensal.
//
// Limites do simulador (dito na tela): empregado CLT; sem PLR, abono e venda de férias, 13º em parcelas nem pagamento de férias junto com o mensal.

export const SALARIO_ANO = 2026;
export const SALARIO_FONTES = [
  { nome: "INSS: Portaria Interministerial MPS/MF nº 13, de 09/01/2026", url: "https://www.gov.br/inss/pt-br/direitos-e-deveres/inscricao-e-contribuicao/tabela-de-contribuicao-mensal" },
  { nome: "IRRF 2026: tabela mensal da Receita Federal", url: "https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026" },
  { nome: "Redução do IR: Lei 15.270/2025 (art. 3º-A da Lei 9.250/1995)", url: "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/L15270.htm" },
  { nome: "Exemplos oficiais da Receita Federal para a Lei 15.270/2025", url: "https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/exemplos-de-aplicacao-da-lei-15-270-2025" },
] as const;

// Centavos e alíquotas em milésimos (7,5% = 75).
export const INSS_FAIXAS: readonly { ateCentavos: number; milesimos: number }[] = [
  { ateCentavos: 162_100, milesimos: 75 },
  { ateCentavos: 290_284, milesimos: 90 },
  { ateCentavos: 435_427, milesimos: 120 },
  { ateCentavos: 847_555, milesimos: 140 },
];
export const INSS_TETO_CENTAVOS = 847_555;

export const IRRF_FAIXAS: readonly { ateCentavos: number; milesimos: number; deduzirCentavos: number }[] = [
  { ateCentavos: 242_880, milesimos: 0, deduzirCentavos: 0 },
  { ateCentavos: 282_665, milesimos: 75, deduzirCentavos: 18_216 },
  { ateCentavos: 375_105, milesimos: 150, deduzirCentavos: 39_416 },
  { ateCentavos: 466_468, milesimos: 225, deduzirCentavos: 67_549 },
  { ateCentavos: Infinity, milesimos: 275, deduzirCentavos: 90_873 },
];
export const DEPENDENTE_CENTAVOS = 18_959;
export const DESCONTO_SIMPLIFICADO_CENTAVOS = 60_720;
export const REDUCAO_TOTAL_ATE_CENTAVOS = 500_000;
export const REDUCAO_MAXIMA_CENTAVOS = 31_289;
export const REDUCAO_PARCIAL_ATE_CENTAVOS = 735_000;
export const REDUCAO_PARCIAL_BASE_CENTAVOS = 97_862;
/** 0,133145 em milionésimos. */
export const REDUCAO_PARCIAL_COEF_MILIONESIMOS = 133_145;
export const IRRF_NAO_RETIDO_ATE_CENTAVOS = 1_000;

export const MAX_DEPENDENTES = 20;
export const MAX_BRUTO = 10_000_000;

export type FaixaInss = { de: number; ate: number; aliquota: number; base: number; valor: number };
/** Estimativa de um pagamento separado (13º ou férias + 1/3): INSS e IRRF calculados à parte, com o teto do INSS. */
export type Pagamento = { bruto: number; inss: number; irrf: number; outrasDeducoes: number; liquido: number };
export type OpcoesSalario = { outrasDeducoes?: number; beneficios?: number };
export type Salario = {
  bruto: number;
  dependentes: number;
  /** Outras deduções legais do IR (pensão, previdência privada): saem do líquido e entram na dedução legal; não entram na base do INSS. */
  outrasDeducoes: number;
  /** Benefícios não tributáveis (VR, VA): não mudam INSS nem IR. */
  beneficios: number;
  /** Líquido do salário + benefícios. */
  totalRecebido: number;
  /** Estimativa do 13º (uma parcela, pagamento separado) e das férias + 1/3 (bruto × 4/3, pagamento separado). */
  decimoTerceiro: Pagamento;
  ferias: Pagamento;
  inss: number;
  /** Detalhe de cada faixa do INSS que pegou parte do salário. */
  inssFaixas: FaixaInss[];
  /** Modelo de dedução do IR que valeu: o mais vantajoso (maior dedução). */
  modelo: "legal" | "simplificado";
  /** Dedução do modelo legal (INSS + dependentes) e do simplificado, para mostrar a comparação. */
  deducaoLegal: number;
  deducaoSimplificada: number;
  deducaoDependentes: number;
  deducaoOutras: number;
  baseIr: number;
  aliquotaIr: number;
  impostoTabela: number;
  reducao: number;
  /** Imposto de renda retido na fonte (já com a redução e a dispensa de até R$ 10). */
  irrf: number;
  /** Havia imposto, mas de até R$ 10: a lei dispensa a retenção. */
  irrfDispensado: boolean;
  liquido: number;
  /** % do bruto que fica com a pessoa. */
  pctLiquido: number;
};

const reais = (c: number) => c / 100;
/** Divisão inteira arredondada (meio sobe). Só com inteiros não negativos. */
const divRound = (num: number, den: number) => Math.floor((2 * num + den) / (2 * den));

/** Salário bruto em reais (positivo, com no máximo centavos) → centavos inteiros; null se inválido. */
function paraCentavos(v: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0 || v > MAX_BRUTO) return null;
  const c = Math.round(v * 100);
  return c > 0 ? c : null;
}

/** Valor opcional (outras deduções, benefícios): ausente = 0; senão não negativo, até o teto e com no máximo centavos; null se inválido. */
function opcionalCentavos(v: number | undefined): number | null {
  if (v === undefined) return 0;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > MAX_BRUTO) return null;
  const c = Math.round(v * 100);
  return Math.abs(v * 100 - c) < 1e-6 ? c : null;
}

/** INSS progressivo: cada faixa cobra só a parte do salário que cai nela; o teto limita o salário de contribuição. */
function calcularInss(b: number) {
  const contrib = Math.min(b, INSS_TETO_CENTAVOS);
  let inssNum = 0; // em centavos × 1000, para arredondar uma vez só
  let de = 0;
  const faixas: FaixaInss[] = [];
  for (const f of INSS_FAIXAS) {
    if (contrib <= de) break;
    const parte = Math.min(contrib, f.ateCentavos) - de;
    inssNum += parte * f.milesimos;
    faixas.push({ de: reais(de), ate: reais(f.ateCentavos), aliquota: f.milesimos / 10, base: reais(parte), valor: reais(divRound(parte * f.milesimos, 1000)) });
    de = f.ateCentavos;
  }
  return { inss: divRound(inssNum, 1000), faixas };
}

/**
 * IRRF de um pagamento com o INSS já conhecido (centavos). O modelo com a MAIOR dedução vence (legal = INSS + dependentes + outras;
 * simplificado = valor fixo, nunca mais que o rendimento). A redução da Lei 15.270/2025 usa o rendimento tributável, não a base.
 */
function calcularIr(b: number, inss: number, depC: number, outrasC: number) {
  const legal = inss + depC + outrasC;
  const simples = Math.min(DESCONTO_SIMPLIFICADO_CENTAVOS, b);
  const modelo: Salario["modelo"] = simples > legal ? "simplificado" : "legal";
  const baseIr = Math.max(0, b - Math.max(legal, simples));
  const faixa = IRRF_FAIXAS.find((f) => baseIr <= f.ateCentavos)!;
  const impostoTabela = Math.max(0, divRound(baseIr * faixa.milesimos, 1000) - faixa.deduzirCentavos);
  let reducao = 0;
  if (b <= REDUCAO_TOTAL_ATE_CENTAVOS) reducao = Math.min(REDUCAO_MAXIMA_CENTAVOS, impostoTabela);
  else if (b <= REDUCAO_PARCIAL_ATE_CENTAVOS) reducao = Math.min(impostoTabela, Math.max(0, REDUCAO_PARCIAL_BASE_CENTAVOS - divRound(b * REDUCAO_PARCIAL_COEF_MILIONESIMOS, 1_000_000)));
  let irrf = Math.max(0, impostoTabela - reducao);
  const irrfDispensado = irrf > 0 && irrf <= IRRF_NAO_RETIDO_ATE_CENTAVOS;
  if (irrfDispensado) irrf = 0;
  return { modelo, legal, simples, baseIr, aliquotaIr: faixa.milesimos / 10, impostoTabela, reducao, irrf, irrfDispensado };
}

export type IrrfCalculo = { modelo: Salario["modelo"]; deducaoLegal: number; deducaoSimplificada: number; baseIr: number; impostoTabela: number; reducao: number; irrf: number };
/** Só a parte do IR, com o INSS informado (reais). Serve para conferir os exemplos oficiais da Receita, que trazem o INSS dado. null se inválido. */
export function calcularIrrf(bruto: number, inss: number, dependentes = 0, outrasDeducoes = 0): IrrfCalculo | null {
  const b = paraCentavos(bruto), i = opcionalCentavos(inss), o = opcionalCentavos(outrasDeducoes);
  if (b === null || i === null || o === null || !Number.isInteger(dependentes) || dependentes < 0 || dependentes > MAX_DEPENDENTES) return null;
  const r = calcularIr(b, i, dependentes * DEPENDENTE_CENTAVOS, o);
  return { modelo: r.modelo, deducaoLegal: reais(r.legal), deducaoSimplificada: reais(r.simples), baseIr: reais(r.baseIr), impostoTabela: reais(r.impostoTabela), reducao: reais(r.reducao), irrf: reais(r.irrf) };
}

/** Um pagamento separado (mensal, 13º ou férias): INSS com teto e IRRF próprios. */
function pagamento(b: number, depC: number, outrasC: number) {
  const { inss, faixas } = calcularInss(b);
  const ir = calcularIr(b, inss, depC, outrasC);
  return { inss, faixas, ir, liquido: b - inss - ir.irrf - outrasC };
}

const resumoPagamento = (b: number, depC: number, outrasC: number): Pagamento | null => {
  const p = pagamento(b, depC, outrasC);
  return p.liquido < 0 ? null : { bruto: reais(b), inss: reais(p.inss), irrf: reais(p.ir.irrf), outrasDeducoes: reais(outrasC), liquido: reais(p.liquido) };
};

/**
 * Calcula o líquido mensal e as estimativas de 13º e férias + 1/3. Devolve null se o bruto, os dependentes, as outras deduções ou os
 * benefícios forem inválidos (nunca adivinha), ou se as deduções passarem do que sobra do salário.
 */
export function calcularSalario(bruto: number, dependentes = 0, opts: OpcoesSalario = {}): Salario | null {
  const b = paraCentavos(bruto);
  if (b === null) return null;
  if (!Number.isInteger(dependentes) || dependentes < 0 || dependentes > MAX_DEPENDENTES) return null;
  const outrasC = opcionalCentavos(opts.outrasDeducoes);
  const benC = opcionalCentavos(opts.beneficios);
  if (outrasC === null || benC === null) return null;

  const depC = dependentes * DEPENDENTE_CENTAVOS;
  const m = pagamento(b, depC, outrasC);
  if (m.liquido < 0) return null;
  const decimo = resumoPagamento(b, depC, outrasC);
  const ferias = resumoPagamento(divRound(b * 4, 3), depC, outrasC);
  if (!decimo || !ferias) return null;
  const { inss, faixas: inssFaixas, ir } = m;
  return {
    bruto: reais(b), dependentes, outrasDeducoes: reais(outrasC), beneficios: reais(benC), totalRecebido: reais(m.liquido + benC),
    decimoTerceiro: decimo, ferias,
    inss: reais(inss), inssFaixas, modelo: ir.modelo,
    deducaoLegal: reais(ir.legal), deducaoSimplificada: reais(ir.simples), deducaoDependentes: reais(depC), deducaoOutras: reais(outrasC),
    baseIr: reais(ir.baseIr), aliquotaIr: ir.aliquotaIr, impostoTabela: reais(ir.impostoTabela), reducao: reais(ir.reducao),
    irrf: reais(ir.irrf), irrfDispensado: ir.irrfDispensado, liquido: reais(m.liquido), pctLiquido: Math.round((m.liquido / b) * 1000) / 10,
  };
}
