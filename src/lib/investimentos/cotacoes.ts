import { z } from "zod";

export const ACOMPANHADOS = [
  { ticker: "LREN3", nome: "Lojas Renner" },
  { ticker: "CEAB3", nome: "C&A Modas" },
  { ticker: "VIVA3", nome: "Vivara" },
] as const;

const positivo = z.number().finite().positive();
const ponto = z.object({
  date: z.number().int().positive().max(4_102_444_800),
  close: positivo,
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
};

export function resumirCotacao(ativo: typeof ACOMPANHADOS[number], dados: z.infer<typeof cotacao>): Papel {
  // Usa fechamentos de pregões anteriores para comparar janelas completas, sem misturar o preço intradiário.
  const dias = new Map<number, number>();
  for (const item of dados.historicalDataPrice ?? []) {
    const p = ponto.safeParse(item);
    if (p.success) dias.set(Math.floor(p.data.date / 86_400), p.data.close);
  }
  const precos = [...dias].sort(([a], [b]) => a - b).map(([, preco]) => preco);
  const periodos = [21, 63, 252].map((sessoes) => {
    const anterior = precos.at(-1 - sessoes);
    return { sessoes, variacao: anterior ? (precos.at(-1)! / anterior - 1) * 100 : null };
  });
  return { ...ativo, preco: dados.regularMarketPrice, horario: dados.regularMarketTime, dia: dados.regularMarketChangePercent ?? null, periodos };
}
