import { backtest, type ResultadoBacktest } from "./backtest.ts";
import { carregarSerie, carregarYahoo, type SerieCarregada } from "./series.ts";
import { avaliar, sma, type Analista, type Indicadores, type Serie, type SinalId } from "./sinais.ts";
import { ativosDoGrupo, moedaDe, REFERENCIAS, type Ativo, type GrupoId, type Mercado } from "./universo.ts";

export const SEM_FUNDAMENTOS = "Sem dados fundamentais: o estudo usa só preços.";
export const AVISO = "Estudo automático com dados públicos. Não é recomendação de investimento.";

export type SinalAcao = {
  ticker: string; nome: string; mercado: Mercado; moeda: string; fonte: string;
  preco: number; horario: string; variacaoDia: number | null;
  sinal: SinalId; nota: number | null; confianca: number; motivos: string[];
  analistas: Pick<Analista, "id" | "nome" | "nota" | "frases">[];
  indicadores: Indicadores;
  grafico: { precos: number[]; sma200: (number | null)[] };
  backtest: ResultadoBacktest | null;
};
export type RespostaSinais = {
  grupo: GrupoId | null; aviso: string; fundamentos: string;
  referencias: { simbolo: string; nome: string; disponivel: boolean }[];
  itens: SinalAcao[]; indisponiveis: string[];
};

const PONTOS_GRAFICO = 60;
const r4 = (v: number) => Math.round(v * 10_000) / 10_000;

/** Último ano reduzido a ~60 pontos, com a SMA200 nas mesmas posições. */
export function dadosGrafico(serie: Serie) {
  const c = serie.fechamentos;
  const media = sma(c, 200);
  const ini = Math.max(0, c.length - 252);
  const passo = Math.max(1, Math.ceil((c.length - ini) / PONTOS_GRAFICO));
  const idx: number[] = [];
  for (let i = c.length - 1; i >= ini; i -= passo) idx.unshift(i);
  return { precos: idx.map((i) => r4(c[i])), sma200: idx.map((i) => (media[i] === null ? null : r4(media[i]!))) };
}

export function analisarSerie(ativo: Pick<Ativo, "ticker" | "nome" | "mercado">, serie: SerieCarregada, indice: Serie | null): SinalAcao {
  const ref = REFERENCIAS[ativo.mercado];
  const av = avaliar(serie, indice, ref.nome);
  const c = serie.fechamentos;
  return {
    ticker: ativo.ticker, nome: ativo.nome, mercado: ativo.mercado, moeda: serie.moeda || moedaDe(ativo.mercado), fonte: serie.fonte,
    preco: serie.preco, horario: serie.horario,
    variacaoDia: c.length > 1 ? c[c.length - 1] / c[c.length - 2] - 1 : null,
    sinal: av.sinal, nota: av.nota, confianca: av.confianca, motivos: av.motivos,
    analistas: av.analistas, indicadores: av.indicadores,
    grafico: dadosGrafico(serie),
    backtest: backtest(serie, indice),
  };
}

/** Carrega e analisa uma lista de ativos do universo. Busca o índice de cada mercado uma vez só. */
export async function carregarSinais(ativos: readonly Ativo[], opts: { brapiToken?: string; consultar?: typeof fetch } = {}): Promise<Omit<RespostaSinais, "grupo">> {
  const mercados = [...new Set(ativos.map((a) => a.mercado))];
  const indices = new Map<Mercado, SerieCarregada | null>();
  const [series] = await Promise.all([
    Promise.all(ativos.map((a) => carregarSerie(a, opts))),
    Promise.all(mercados.map(async (m) => indices.set(m, await carregarYahoo(REFERENCIAS[m].simbolo, opts.consultar)))),
  ]);
  const itens: SinalAcao[] = [];
  const indisponiveis: string[] = [];
  ativos.forEach((a, i) => {
    const s = series[i];
    if (s) itens.push(analisarSerie(a, s, indices.get(a.mercado) ?? null));
    else indisponiveis.push(a.ticker);
  });
  return {
    aviso: AVISO, fundamentos: SEM_FUNDAMENTOS, itens, indisponiveis,
    referencias: mercados.map((m) => ({ simbolo: REFERENCIAS[m].simbolo, nome: REFERENCIAS[m].nome, disponivel: !!indices.get(m) })),
  };
}

export async function carregarGrupo(grupo: GrupoId, opts: { brapiToken?: string; consultar?: typeof fetch } = {}): Promise<RespostaSinais> {
  return { grupo, ...(await carregarSinais(ativosDoGrupo(grupo), opts)) };
}
