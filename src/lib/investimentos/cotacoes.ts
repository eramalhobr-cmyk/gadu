import { z } from "zod";

export const ACOMPANHADOS = [
  { ticker: "LREN3", nome: "Lojas Renner" },
  { ticker: "CEAB3", nome: "C&A Modas" },
  { ticker: "VIVA3", nome: "Vivara" },
] as const;

const positivo = z.number().finite().min(0.00001).max(10_000_000);
const ponto = z.object({
  date: z.number().int().positive().max(4_102_444_800),
  close: positivo,
  adjustedClose: positivo.nullish(),
});
export const cotacao = z.object({
  symbol: z.string(),
  regularMarketPrice: positivo,
  regularMarketTime: z.iso.datetime({ offset: true }),
  regularMarketChangePercent: z.number().finite().nullish(),
  historicalDataPrice: z.array(z.unknown()).max(550).nullish(),
});

export type Papel = {
  ticker: string;
  nome: string;
  preco: number;
  horario: string;
  dia: number | null;
  periodos: { sessoes: number; variacao: number | null }[];
  baseAjustada: boolean;
  perdaMaxima63: number | null;
};

export function resumirCotacao(ativo: typeof ACOMPANHADOS[number], dados: z.infer<typeof cotacao>): Papel {
  // Usa fechamentos de pregões anteriores para comparar janelas completas, sem misturar o preço intradiário.
  const dias = new Map<number, z.infer<typeof ponto>>();
  const diaCotacao = Math.floor(Date.parse(dados.regularMarketTime) / 86_400_000);
  for (const item of dados.historicalDataPrice ?? []) {
    const p = ponto.safeParse(item);
    if (p.success) {
      const dia = Math.floor(p.data.date / 86_400);
      if (dia <= diaCotacao) dias.set(dia, p.data);
    }
  }
  const sessoes = [...dias].sort(([a], [b]) => a - b).slice(-253).map(([, sessao]) => sessao);
  const baseAjustada = sessoes.length > 1 && sessoes.every((p) => p.adjustedClose != null);
  const precos = sessoes.map((p) => baseAjustada ? p.adjustedClose! : p.close);
  const periodos = [21, 63, 252].map((sessoes) => {
    const anterior = precos.at(-1 - sessoes);
    return { sessoes, variacao: anterior ? (precos.at(-1)! / anterior - 1) * 100 : null };
  });
  let perdaMaxima63: number | null = null;
  if (precos.length >= 64) {
    let pico = 0;
    perdaMaxima63 = 0;
    for (const preco of precos.slice(-64)) {
      pico = Math.max(preco, pico);
      perdaMaxima63 = Math.min(perdaMaxima63, (preco / pico - 1) * 100);
    }
  }
  return { ...ativo, baseAjustada, perdaMaxima63, preco: dados.regularMarketPrice, horario: dados.regularMarketTime, dia: dados.regularMarketChangePercent ?? null, periodos };
}
