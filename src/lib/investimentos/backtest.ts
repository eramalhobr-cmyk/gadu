import { avaliar, valorAte, type Serie } from "./sinais.ts";

/**
 * Backtest walk-forward, sem olhar o futuro: a decisão do dia i usa só os pregões 0..i
 * e vale para o retorno de i para i+1. Compra entra, Venda sai, Manter mantém a posição.
 * Custo por troca (padrão 0,1%). Compara com comprar e segurar o mesmo papel no mesmo período
 * e mostra quando a regra perde. Método inspirado em microsoft/qlib e AI4Finance/FinRL (sem código deles).
 */
export type ResultadoBacktest = {
  inicio: string; fim: string; pregoes: number;
  retornoRegra: number; retornoSegurar: number; retornoIndice: number | null;
  quedaRegra: number; quedaSegurar: number;
  acerto: number | null; operacoes: number; trocas: number; tempoComprado: number;
  perdeuDaReferencia: boolean;
};

export const CUSTO_PADRAO = 0.001;

/** Primeiro pregão testado: 1 ano de aquecimento se houver, senão o mínimo da tendência (220). */
export const inicioPadrao = (n: number) => (n >= 252 + 60 ? 252 : 220);

/** Posição (0 ou 1) decidida no fechamento de cada pregão testado. Exportada para o teste de "sem futuro". */
export function simularPosicoes(serie: Serie, indice: Serie | null, inicio = inicioPadrao(serie.fechamentos.length)): number[] {
  const pos: number[] = [];
  let atual = 0;
  for (let i = inicio; i < serie.fechamentos.length - 1; i++) {
    const ate = { datas: serie.datas.slice(0, i + 1), fechamentos: serie.fechamentos.slice(0, i + 1) };
    const { sinal } = avaliar(ate, indice);
    if (sinal === "compra") atual = 1;
    else if (sinal === "venda") atual = 0;
    pos.push(atual);
  }
  return pos;
}

const iso = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);

export function backtest(serie: Serie, indice: Serie | null, custo = CUSTO_PADRAO): ResultadoBacktest | null {
  const c = serie.fechamentos;
  const inicio = inicioPadrao(c.length);
  if (c.length - 1 - inicio < 40) return null;
  const pos = simularPosicoes(serie, indice, inicio);

  let regra = 1, segurar = 1 - custo, picoR = 1, picoS = segurar, quedaR = 0, quedaS = 0;
  let anterior = 0, trocas = 0, diasComprado = 0;
  const operacoes: number[] = [];
  let entrada = 0;
  for (let k = 0; k < pos.length; k++) {
    const i = inicio + k;
    if (pos[k] !== anterior) {
      trocas++;
      regra *= 1 - custo;
      if (pos[k] === 1) entrada = regra;
      else operacoes.push(regra / entrada - 1);
      anterior = pos[k];
    }
    const r = c[i + 1] / c[i] - 1;
    regra *= 1 + pos[k] * r;
    segurar *= 1 + r;
    diasComprado += pos[k];
    picoR = Math.max(picoR, regra); quedaR = Math.min(quedaR, regra / picoR - 1);
    picoS = Math.max(picoS, segurar); quedaS = Math.min(quedaS, segurar / picoS - 1);
  }
  if (anterior === 1) operacoes.push(regra / entrada - 1); // operação aberta avaliada no último preço

  let retornoIndice: number | null = null;
  if (indice) {
    const a = valorAte(indice, serie.datas[inicio]), b = valorAte(indice, serie.datas[c.length - 1]);
    if (a && b) retornoIndice = b / a - 1;
  }

  const retornoRegra = regra - 1, retornoSegurar = segurar - 1;
  return {
    inicio: iso(serie.datas[inicio]), fim: iso(serie.datas[c.length - 1]), pregoes: pos.length,
    retornoRegra, retornoSegurar, retornoIndice, quedaRegra: quedaR, quedaSegurar: quedaS,
    acerto: operacoes.length ? operacoes.filter((x) => x > 0).length / operacoes.length : null,
    operacoes: operacoes.length, trocas, tempoComprado: diasComprado / pos.length,
    perdeuDaReferencia: retornoRegra < retornoSegurar,
  };
}
