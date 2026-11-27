/**
 * Motor de sinais puro (sem rede, sem relógio). Inspirado no MÉTODO de projetos abertos de pesquisa
 * (virattt/ai-hedge-fund e TauricResearch/TradingAgents): vários "analistas" dão uma nota de -1 a +1
 * e um consolidado decide Compra, Manter ou Venda. Nenhum código desses projetos foi copiado.
 *
 * Só usa preços. Não há dado fundamental confiável e gratuito, então não existe nota de valuation.
 * Estudo automático; não é recomendação de investimento.
 */

/** Série diária em ordem crescente. `datas` em segundos (epoch); `fechamentos` de preferência ajustados. */
export type Serie = { datas: number[]; fechamentos: number[] };
export type SinalId = "compra" | "manter" | "venda" | "sem_dados";
export type AnalistaId = "tendencia" | "momento" | "forca" | "risco";
export type Analista = { id: AnalistaId; nome: string; nota: number | null; frases: string[] };
export type Indicadores = {
  sma50: number | null; sma200: number | null; ema21: number | null; rsi14: number | null;
  macd: number | null; macdSinal: number | null;
  retorno3m: number | null; retorno6m: number | null; retorno12m: number | null;
  forca3m: number | null; forca6m: number | null;
  volatilidade: number | null; quedaMaxima: number | null; distanciaMaxima: number | null;
};
export type Avaliacao = { sinal: SinalId; nota: number | null; confianca: number; analistas: Analista[]; motivos: string[]; indicadores: Indicadores };

export const PESOS: Record<AnalistaId, number> = { tendencia: 0.35, momento: 0.25, forca: 0.25, risco: 0.15 };
export const LIMIAR = 0.25;
/** A avaliação olha no máximo esta janela final. Igual ao vivo e no backtest, para os dois darem o mesmo resultado. */
export const JANELA = 300;
const MES3 = 63, MES6 = 126, MES12 = 252;

const clamp = (v: number, a = -1, b = 1) => Math.min(b, Math.max(a, v));
const sinalDe = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : 0);
const pct = (v: number) => `${Math.round(Math.abs(v) * 100)}%`;

// ---------------------------------------------------------------------------------------------------------------------
// Indicadores

export function sma(v: number[], n: number): (number | null)[] {
  const out: (number | null)[] = [];
  let soma = 0;
  for (let i = 0; i < v.length; i++) {
    soma += v[i];
    if (i >= n) soma -= v[i - n];
    out.push(i >= n - 1 ? soma / n : null);
  }
  return out;
}

/** EMA semeada com a média simples dos n primeiros valores. */
export function ema(v: (number | null)[], n: number): (number | null)[] {
  const out: (number | null)[] = [];
  const k = 2 / (n + 1);
  let atual: number | null = null;
  const semente: number[] = [];
  for (const x of v) {
    if (x === null) { out.push(null); continue; }
    if (atual === null) {
      semente.push(x);
      if (semente.length === n) atual = semente.reduce((a, b) => a + b, 0) / n;
    } else atual = x * k + atual * (1 - k);
    out.push(atual);
  }
  return out;
}

/** RSI de Wilder. */
export function rsi(v: number[], n = 14): (number | null)[] {
  const out: (number | null)[] = v.map(() => null);
  if (v.length <= n) return out;
  let ganho = 0, perda = 0;
  for (let i = 1; i <= n; i++) {
    const d = v[i] - v[i - 1];
    if (d > 0) ganho += d; else perda -= d;
  }
  ganho /= n; perda /= n;
  const calc = () => (perda === 0 ? 100 : 100 - 100 / (1 + ganho / perda));
  out[n] = calc();
  for (let i = n + 1; i < v.length; i++) {
    const d = v[i] - v[i - 1];
    ganho = (ganho * (n - 1) + Math.max(d, 0)) / n;
    perda = (perda * (n - 1) + Math.max(-d, 0)) / n;
    out[i] = calc();
  }
  return out;
}

export function macd(v: number[], rapida = 12, lenta = 26, sinal = 9) {
  const r = ema(v, rapida), l = ema(v, lenta);
  const linha = v.map((_, i) => (r[i] !== null && l[i] !== null ? r[i]! - l[i]! : null));
  const s = ema(linha, sinal);
  return { macd: linha, sinal: s, hist: linha.map((x, i) => (x !== null && s[i] !== null ? x - s[i]! : null)) };
}

/** Retorno dos últimos n pregões (fração). */
export function retorno(v: number[], n: number): number | null {
  if (v.length <= n) return null;
  return v[v.length - 1] / v[v.length - 1 - n] - 1;
}

/** Desvio-padrão dos retornos logarítmicos diários, anualizado (raiz de 252). Pede ao menos 20 retornos. */
export function volatilidadeAnual(v: number[], n = MES12): number | null {
  const ult = v.slice(-(n + 1));
  if (ult.length < 21) return null;
  const r = ult.slice(1).map((x, i) => Math.log(x / ult[i]));
  const media = r.reduce((a, b) => a + b, 0) / r.length;
  const variancia = r.reduce((a, b) => a + (b - media) ** 2, 0) / (r.length - 1);
  return Math.sqrt(variancia) * Math.sqrt(252);
}

/** Maior queda de um pico até um vale (fração ≤ 0). */
export function quedaMaxima(v: number[]): number {
  let pico = -Infinity, pior = 0;
  for (const x of v) {
    pico = Math.max(pico, x);
    pior = Math.min(pior, x / pico - 1);
  }
  return pior;
}

const dia = (t: number) => Math.floor(t / 86_400);

/** Último fechamento do índice no mesmo dia ou antes (nunca depois) da data pedida. */
export function valorAte(indice: Serie, data: number): number | null {
  const alvo = dia(data);
  let lo = 0, hi = indice.datas.length - 1, achado = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (dia(indice.datas[m]) <= alvo) { achado = m; lo = m + 1; } else hi = m - 1;
  }
  return achado >= 0 ? indice.fechamentos[achado] : null;
}

/** Retorno da ação menos o retorno do índice nos mesmos dias (fração). */
export function forcaRelativa(acao: Serie, indice: Serie | null, n: number): number | null {
  if (!indice || acao.fechamentos.length <= n) return null;
  const fim = acao.datas.length - 1, ini = fim - n;
  const iFim = valorAte(indice, acao.datas[fim]), iIni = valorAte(indice, acao.datas[ini]);
  if (iFim === null || iIni === null) return null;
  return (acao.fechamentos[fim] / acao.fechamentos[ini] - 1) - (iFim / iIni - 1);
}

// ---------------------------------------------------------------------------------------------------------------------
// Analistas

export function calcularIndicadores(serie: Serie, indice: Serie | null): Indicadores {
  const c = serie.fechamentos;
  const ult = <T>(a: T[]) => (a.length ? a[a.length - 1] : null);
  const m = macd(c);
  const ano = c.slice(-(MES12 + 1));
  const maximo = ano.length ? Math.max(...ano) : null;
  return {
    sma50: ult(sma(c, 50)), sma200: ult(sma(c, 200)), ema21: ult(ema(c, 21)), rsi14: ult(rsi(c)),
    macd: ult(m.macd), macdSinal: ult(m.sinal),
    retorno3m: retorno(c, MES3), retorno6m: retorno(c, MES6), retorno12m: retorno(c, MES12),
    forca3m: forcaRelativa(serie, indice, MES3), forca6m: forcaRelativa(serie, indice, MES6),
    volatilidade: volatilidadeAnual(c), quedaMaxima: ano.length > 1 ? quedaMaxima(ano) : null,
    distanciaMaxima: maximo && c.length ? c[c.length - 1] / maximo - 1 : null,
  };
}

function tendencia(c: number[]): Analista {
  const base = { id: "tendencia" as const, nome: "Tendência" };
  if (c.length < 220) return { ...base, nota: null, frases: ["Histórico curto para medir a tendência."] };
  const s50 = sma(c, 50), s200 = sma(c, 200);
  const p = c[c.length - 1], m50 = s50.at(-1)!, m200 = s200.at(-1)!, m200Antes = s200.at(-21)!;
  const nota = 0.4 * sinalDe(p - m200) + 0.3 * sinalDe(m50 - m200) + 0.3 * sinalDe(m200 - m200Antes);
  return {
    ...base, nota,
    frases: [
      p >= m200 ? "Preço acima da média de 200 dias." : "Preço abaixo da média de 200 dias.",
      m50 >= m200 ? "Média de 50 dias acima da de 200." : "Média de 50 dias abaixo da de 200.",
      m200 >= m200Antes ? "Média de 200 dias subindo." : "Média de 200 dias caindo.",
    ],
  };
}

function momento(ind: Indicadores): Analista {
  const base = { id: "momento" as const, nome: "Momento" };
  const janelas = [[ind.retorno3m, 0.1], [ind.retorno6m, 0.15], [ind.retorno12m, 0.25]] as const;
  const validos = janelas.filter(([r]) => r !== null) as [number, number][];
  if (validos.length === 0) return { ...base, nota: null, frases: ["Histórico curto para medir o momento."] };
  const media = validos.reduce((s, [r, esc]) => s + Math.tanh(r / esc), 0) / validos.length;
  let nota = 0.6 * media;
  const frases: string[] = [];
  const [rRef, rotulo] = ind.retorno6m !== null ? [ind.retorno6m, "6 meses"] : ind.retorno3m !== null ? [ind.retorno3m, "3 meses"] : [validos[0][0], "o período"];
  frases.push(rRef >= 0 ? `Subiu ${pct(rRef)} em ${rotulo}.` : `Caiu ${pct(rRef)} em ${rotulo}.`);
  if (ind.macd !== null && ind.macdSinal !== null) {
    nota += ind.macd >= ind.macdSinal ? 0.2 : -0.2;
    frases.push(ind.macd >= ind.macdSinal ? "MACD acima da linha de sinal." : "MACD abaixo da linha de sinal.");
  }
  if (ind.rsi14 !== null && ind.rsi14 > 75) { nota -= 0.2; frases.unshift(`RSI ${Math.round(ind.rsi14)}: esticado no curto prazo.`); }
  else if (ind.rsi14 !== null && ind.rsi14 < 25) { nota += 0.2; frases.unshift(`RSI ${Math.round(ind.rsi14)}: muito vendido no curto prazo.`); }
  return { ...base, nota: clamp(nota), frases };
}

function forca(ind: Indicadores, nomeIndice: string): Analista {
  const base = { id: "forca" as const, nome: "Força relativa" };
  const v = [ind.forca3m, ind.forca6m].filter((x): x is number => x !== null);
  if (v.length === 0) return { ...base, nota: null, frases: [`Sem comparação com o ${nomeIndice}.`] };
  const nota = clamp(v.reduce((s, x) => s + Math.tanh(x / 0.1), 0) / v.length);
  const [ref, rotulo] = ind.forca6m !== null ? [ind.forca6m, "6 meses"] : [ind.forca3m!, "3 meses"];
  const pp = Math.round(Math.abs(ref) * 100);
  return { ...base, nota, frases: [ref >= 0 ? `Ganhou do ${nomeIndice} por ${pp} p.p. em ${rotulo}.` : `Perdeu do ${nomeIndice} por ${pp} p.p. em ${rotulo}.`] };
}

function risco(ind: Indicadores): Analista {
  const base = { id: "risco" as const, nome: "Risco" };
  if (ind.volatilidade === null) return { ...base, nota: null, frases: ["Histórico curto para medir o risco."] };
  const vol = ind.volatilidade;
  let nota = vol < 0.25 ? 0.3 : vol < 0.4 ? 0 : vol < 0.6 ? -0.3 : -0.6;
  const frases = [vol < 0.25 ? `Volatilidade baixa: ${pct(vol)} ao ano.` : vol < 0.4 ? `Volatilidade moderada: ${pct(vol)} ao ano.` : `Volatilidade alta: ${pct(vol)} ao ano.`];
  if (ind.distanciaMaxima !== null) {
    if (ind.distanciaMaxima < -0.3) { nota -= 0.3; frases.unshift(`Está ${pct(ind.distanciaMaxima)} abaixo da máxima de 1 ano.`); }
    else if (ind.distanciaMaxima > -0.1) nota += 0.1;
  }
  return { ...base, nota: clamp(nota), frases };
}

/**
 * Avalia o último pregão da série usando só os dados recebidos (nunca o futuro).
 * `indice` pode ter datas posteriores: a força relativa só lê o índice até a data da ação.
 */
export function avaliar(serieCompleta: Serie, indice: Serie | null, nomeIndice = "índice"): Avaliacao {
  const serie = { datas: serieCompleta.datas.slice(-JANELA), fechamentos: serieCompleta.fechamentos.slice(-JANELA) };
  const c = serie.fechamentos;
  const ind = calcularIndicadores(serie, indice);
  const analistas = [tendencia(c), momento(ind), forca(ind, nomeIndice), risco(ind)];
  const validos = analistas.filter((a) => a.nota !== null);
  const semBase = analistas[0].nota === null && analistas[1].nota === null;
  if (semBase || validos.length < 2) {
    return { sinal: "sem_dados", nota: null, confianca: 0, analistas, motivos: ["Histórico curto: sem sinal."], indicadores: ind };
  }
  const pesoTotal = validos.reduce((s, a) => s + PESOS[a.id], 0);
  const nota = clamp(validos.reduce((s, a) => s + PESOS[a.id] * a.nota!, 0) / pesoTotal);
  const sinal: SinalId = nota >= LIMIAR ? "compra" : nota <= -LIMIAR ? "venda" : "manter";
  const concordam = validos.filter((a) => (sinal === "compra" ? a.nota! > 0.1 : sinal === "venda" ? a.nota! < -0.1 : Math.abs(a.nota!) <= 0.35)).length;
  const magnitude = sinal === "manter" ? 1 - Math.abs(nota) / LIMIAR : Math.min(1, Math.abs(nota) / 0.7);
  const cobertura = validos.length / analistas.length;
  // Nunca 100%: é um estudo com dados de preço apenas.
  const confianca = Math.round(Math.min(85, 100 * (0.5 * magnitude + 0.5 * (concordam / validos.length)) * cobertura));
  const motivos = [...validos]
    .sort((a, b) => Math.abs(PESOS[b.id] * b.nota!) - Math.abs(PESOS[a.id] * a.nota!))
    .slice(0, 3)
    .map((a) => a.frases[0]);
  return { sinal, nota: Math.round(nota * 100) / 100, confianca, analistas, motivos, indicadores: ind };
}

export const NOME_SINAL: Record<SinalId, string> = { compra: "Compra", manter: "Manter", venda: "Venda", sem_dados: "Sem sinal" };
