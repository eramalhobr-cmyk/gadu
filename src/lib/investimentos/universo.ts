import { ACOMPANHADOS } from "./cotacoes.ts";

/**
 * Universo fixo do servidor. A pessoa não escolhe símbolos livres: o provedor só recebe estes tickers públicos.
 * "busca" lista os nomes que o detector da conversa aceita; "ambiguo" exige uma palavra de mercado junto
 * (por exemplo "meta" é também a tela Metas, e "vale" aparece em "vale a pena").
 */
export type Mercado = "B3" | "EUA";
export type GrupoId = "acompanhados" | "ia" | "brasil";
export type Ativo = { ticker: string; nome: string; mercado: Mercado; grupo: GrupoId; busca: string[]; ambiguo?: string[] };
export type Referencia = { simbolo: string; nome: string; mercado: Mercado };

export const GRUPOS: { id: GrupoId; nome: string }[] = [
  { id: "acompanhados", nome: "Acompanhados" },
  { id: "ia", nome: "IA (EUA)" },
  { id: "brasil", nome: "Brasil" },
];

export const REFERENCIAS: Record<Mercado, Referencia> = {
  B3: { simbolo: "^BVSP", nome: "Ibovespa", mercado: "B3" },
  EUA: { simbolo: "SPY", nome: "S&P 500 (SPY)", mercado: "EUA" },
};

const BUSCA_ACOMPANHADOS: Record<string, { busca: string[]; ambiguo?: string[] }> = {
  LREN3: { busca: ["lojas renner"], ambiguo: ["renner"] },
  CEAB3: { busca: [], ambiguo: ["c&a", "cea"] },
  VIVA3: { busca: [], ambiguo: ["vivara"] },
};

export const UNIVERSO: readonly Ativo[] = [
  ...ACOMPANHADOS.map((a) => ({ ...a, mercado: "B3" as const, grupo: "acompanhados" as const, ...BUSCA_ACOMPANHADOS[a.ticker] })),
  { ticker: "NVDA", nome: "Nvidia", mercado: "EUA", grupo: "ia", busca: ["nvidia"] },
  { ticker: "MSFT", nome: "Microsoft", mercado: "EUA", grupo: "ia", busca: [], ambiguo: ["microsoft"] },
  { ticker: "GOOGL", nome: "Alphabet (Google)", mercado: "EUA", grupo: "ia", busca: ["alphabet"], ambiguo: ["google"] },
  { ticker: "META", nome: "Meta Platforms", mercado: "EUA", grupo: "ia", busca: ["meta platforms"], ambiguo: ["meta", "facebook"] },
  { ticker: "AMD", nome: "AMD", mercado: "EUA", grupo: "ia", busca: [], ambiguo: ["amd"] },
  { ticker: "AVGO", nome: "Broadcom", mercado: "EUA", grupo: "ia", busca: ["broadcom"] },
  { ticker: "TSM", nome: "TSMC", mercado: "EUA", grupo: "ia", busca: ["tsmc"] },
  { ticker: "AMZN", nome: "Amazon", mercado: "EUA", grupo: "ia", busca: [], ambiguo: ["amazon"] },
  { ticker: "PETR4", nome: "Petrobras", mercado: "B3", grupo: "brasil", busca: ["petrobras", "petrobrás"] },
  { ticker: "VALE3", nome: "Vale", mercado: "B3", grupo: "brasil", busca: [], ambiguo: ["vale"] },
  { ticker: "ITUB4", nome: "Itaú Unibanco", mercado: "B3", grupo: "brasil", busca: ["itau unibanco"], ambiguo: ["itau"] },
  { ticker: "BBAS3", nome: "Banco do Brasil", mercado: "B3", grupo: "brasil", busca: [], ambiguo: ["banco do brasil"] },
  { ticker: "WEGE3", nome: "WEG", mercado: "B3", grupo: "brasil", busca: [], ambiguo: ["weg"] },
  { ticker: "EMBR3", nome: "Embraer", mercado: "B3", grupo: "brasil", busca: ["embraer"] },
  { ticker: "BPAC11", nome: "BTG Pactual", mercado: "B3", grupo: "brasil", busca: ["btg pactual"], ambiguo: ["btg"] },
  { ticker: "SBSP3", nome: "Sabesp", mercado: "B3", grupo: "brasil", busca: [], ambiguo: ["sabesp"] },
  { ticker: "ITSA4", nome: "Itaúsa", mercado: "B3", grupo: "brasil", busca: [], ambiguo: ["itausa"] },
  { ticker: "PRIO3", nome: "PRIO", mercado: "B3", grupo: "brasil", busca: ["petrorio", "petro rio"], ambiguo: ["prio"] },
];

export const ativosDoGrupo = (grupo: GrupoId) => UNIVERSO.filter((a) => a.grupo === grupo);
export const acharAtivo = (ticker: string) => UNIVERSO.find((a) => a.ticker === ticker.toUpperCase());

/** Símbolo no Yahoo Finance: a B3 usa o sufixo .SA. */
export const simboloYahoo = (a: { ticker: string; mercado: Mercado }) => a.mercado === "B3" ? `${a.ticker}.SA` : a.ticker;
export const moedaDe = (m: Mercado) => m === "B3" ? "BRL" : "USD";
