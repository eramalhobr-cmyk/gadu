import { z } from "zod";
import { cotacao } from "./cotacoes.ts";
import type { Serie } from "./sinais.ts";
import { simboloYahoo, type Mercado } from "./universo.ts";

/**
 * Séries diárias de ~2 anos. Yahoo Finance (sem chave) para tudo; para a B3, se o Yahoo falhar e houver
 * BRAPI_TOKEN, a brapi entra como reserva. O provedor só recebe o símbolo público da lista fixa do servidor:
 * nenhum dado da pessoa sai daqui. Cada chamada tem prazo, não segue redirecionamento e usa o cache do Next.
 */
export type SerieCarregada = Serie & { simbolo: string; fonte: "Yahoo Finance" | "brapi"; preco: number; horario: string; moeda: string };

const PRAZO_MS = 8000;
const REVALIDAR = 900;
const preco = z.number().finite().positive().max(10_000_000);

const yahoo = z.object({
  chart: z.object({
    result: z.array(z.object({
      meta: z.object({
        symbol: z.string(),
        currency: z.string().max(8).nullish(),
        regularMarketPrice: preco.nullish(),
        regularMarketTime: z.number().int().positive().nullish(),
      }),
      timestamp: z.array(z.number().int().positive()).max(1200),
      indicators: z.object({
        quote: z.array(z.object({ close: z.array(z.number().nullable()).max(1200) })).min(1),
        adjclose: z.array(z.object({ adjclose: z.array(z.number().nullable()).max(1200) })).nullish(),
      }),
    })).min(1).nullable(),
  }),
});

/** Monta a série ordenada, sem buracos nem valores inválidos, com um ponto por dia. */
export function montarSerie(datas: number[], valores: (number | null | undefined)[]): Serie {
  const porDia = new Map<number, [number, number]>();
  datas.forEach((t, i) => {
    const v = valores[i];
    if (typeof v === "number" && Number.isFinite(v) && v > 0 && v < 10_000_000) porDia.set(Math.floor(t / 86_400), [t, v]);
  });
  const pontos = [...porDia.values()].sort((a, b) => a[0] - b[0]);
  return { datas: pontos.map((p) => p[0]), fechamentos: pontos.map((p) => p[1]) };
}

export function lerYahoo(json: unknown, simbolo: string): SerieCarregada | null {
  const p = yahoo.safeParse(json);
  const r = p.success ? p.data.chart.result?.[0] : null;
  if (!r || r.meta.symbol.toUpperCase() !== simbolo.toUpperCase()) return null;
  const ajust = r.indicators.adjclose?.[0]?.adjclose;
  const usarAjuste = !!ajust && ajust.length === r.timestamp.length;
  const serie = montarSerie(r.timestamp, usarAjuste ? ajust : r.indicators.quote[0].close);
  if (serie.fechamentos.length < 2) return null;
  const brutos = montarSerie(r.timestamp, r.indicators.quote[0].close).fechamentos;
  const ultimo = r.meta.regularMarketTime ?? serie.datas[serie.datas.length - 1];
  return {
    ...serie, simbolo, fonte: "Yahoo Finance",
    preco: r.meta.regularMarketPrice ?? brutos[brutos.length - 1] ?? serie.fechamentos[serie.fechamentos.length - 1],
    horario: new Date(ultimo * 1000).toISOString(),
    moeda: r.meta.currency ?? "",
  };
}

export async function carregarYahoo(simbolo: string, consultar: typeof fetch = fetch): Promise<SerieCarregada | null> {
  try {
    const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(simbolo)}`);
    url.search = new URLSearchParams({ range: "2y", interval: "1d" }).toString();
    const r = await consultar(url.toString(), {
      // Agente genérico: o Yahoo recusa pedidos sem User-Agent. Nada identifica a pessoa.
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      redirect: "error",
      next: { revalidate: REVALIDAR },
      signal: AbortSignal.timeout(PRAZO_MS),
    });
    if (!r.ok) { void r.body?.cancel().catch(() => {}); return null; }
    return lerYahoo(await r.json(), simbolo);
  } catch {
    return null;
  }
}

const pontoBrapi = z.object({ date: z.number().int().positive(), close: preco, adjustedClose: preco.nullish() });

export async function carregarBrapi(ticker: string, token: string, consultar: typeof fetch = fetch): Promise<SerieCarregada | null> {
  try {
    const signal = AbortSignal.timeout(PRAZO_MS);
    for (const janela of ["2y", "1y"]) {
      const url = new URL(`https://brapi.dev/api/quote/${encodeURIComponent(ticker)}`);
      url.search = new URLSearchParams({ range: janela, interval: "1d" }).toString();
      const r = await consultar(url.toString(), { headers: { Authorization: `Bearer ${token}` }, redirect: "error", next: { revalidate: REVALIDAR }, signal });
      if (!r.ok) {
        void r.body?.cancel().catch(() => {});
        if (r.status === 400) continue; // janela fora do plano
        return null;
      }
      const j = await r.json();
      const c = cotacao.safeParse(Array.isArray(j?.results) ? j.results[0] : null);
      if (!c.success || c.data.symbol !== ticker) return null;
      const pontos = (c.data.historicalDataPrice ?? []).flatMap((x) => { const p = pontoBrapi.safeParse(x); return p.success ? [p.data] : []; });
      const ajustada = pontos.length > 1 && pontos.every((p) => p.adjustedClose != null);
      const serie = montarSerie(pontos.map((p) => p.date), pontos.map((p) => (ajustada ? p.adjustedClose : p.close)));
      if (serie.fechamentos.length < 2) return null;
      return { ...serie, simbolo: ticker, fonte: "brapi", preco: c.data.regularMarketPrice, horario: new Date(c.data.regularMarketTime).toISOString(), moeda: "BRL" };
    }
  } catch {
    return null;
  }
  return null;
}

/** Ação do universo: Yahoo primeiro; B3 cai para a brapi se houver token. */
export async function carregarSerie(a: { ticker: string; mercado: Mercado }, opts: { brapiToken?: string; consultar?: typeof fetch } = {}) {
  const viaYahoo = await carregarYahoo(simboloYahoo(a), opts.consultar);
  if (viaYahoo) return viaYahoo;
  if (a.mercado === "B3" && opts.brapiToken) return carregarBrapi(a.ticker, opts.brapiToken, opts.consultar);
  return null;
}
