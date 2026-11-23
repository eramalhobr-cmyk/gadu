// Tetos por categoria do dia a dia e totais do ano até hoje. Cálculo determinístico no servidor (centavos inteiros),
// sem banco e sem IA: as rotas, o Core da conversa e a tela usam as mesmas funções.
import { z } from "zod";
import { categoriaConhecida } from "./lancamento.ts";
import { parseValor } from "./money.ts";
import { MESES, type Gasto } from "./types.ts";

export const TETO_ALERTA_PCT = 80;
export type Teto = { id: string; categoria: string; valor: number };
export type NivelTeto = "ok" | "alerta" | "estourou";
export type StatusTeto = Teto & { gasto: number; pct: number; resta: number; nivel: NivelTeto };

const cent = (v: number) => Math.round(v * 100);
const sem = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/** Nome da categoria para o teto: a categoria padrão quando reconhecida ("restaurante" → "Restaurantes"), senão o texto limpo. */
export function nomeCategoria(raw: string): string {
  const t = raw.trim().replace(/\s+/g, " ").slice(0, 40);
  return categoriaConhecida(t) ?? (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
}

export const TetoBody = z.object({
  categoria: z.string().trim().min(1).max(40),
  valor: z.union([z.number(), z.string()]).transform((v, ctx) => {
    const n = parseValor(v);
    if (n === null || n <= 0 || n >= 1e9) { ctx.addIssue({ code: "custom", message: "valor inválido" }); return z.NEVER; }
    return n;
  }),
});

export const nivelDe = (pct: number): NivelTeto => (pct >= 100 ? "estourou" : pct >= TETO_ALERTA_PCT ? "alerta" : "ok");

/** Gasto do mês por categoria (mesma categoria ignorando acento e maiúsculas). */
export function somaPorCategoria(gastos: Pick<Gasto, "categoria" | "valor">[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const g of gastos) m.set(sem(g.categoria), (m.get(sem(g.categoria)) ?? 0) + cent(g.valor));
  return m;
}

/** Situação de cada teto no mês: gasto, % do teto (inteiro, arredondado para baixo), quanto resta e o nível. Maior % primeiro. */
export function statusTetos(tetos: Teto[], gastosDoMes: Pick<Gasto, "categoria" | "valor">[]): StatusTeto[] {
  const soma = somaPorCategoria(gastosDoMes);
  return tetos.map((t) => {
    const g = soma.get(sem(t.categoria)) ?? 0;
    const pct = Math.floor((g * 100) / cent(t.valor));
    return { ...t, gasto: g / 100, pct, resta: Math.max(0, cent(t.valor) - g) / 100, nivel: nivelDe(pct) };
  }).sort((a, b) => b.pct - a.pct || a.categoria.localeCompare(b.categoria));
}

export type Acumulado = {
  ano: number; ateMes: number; total: number; qtd: number;
  porCategoria: { categoria: string; total: number; qtd: number }[];
  porMes: { mes: number; nome: string; total: number }[];
  categoria: string | null;
};

/** Totais do ano até o mês `ateMes` (inclusive). Com `categoria`, só os gastos dela (mesma regra de acento). */
export function acumuladoAno(gastos: Pick<Gasto, "ano" | "mes" | "categoria" | "valor">[], ano: number, ateMes: number, categoria: string | null = null): Acumulado {
  const alvo = categoria ? sem(categoria) : null;
  const doAno = gastos.filter((g) => g.ano === ano && g.mes <= ateMes && (!alvo || sem(g.categoria) === alvo));
  const cats = new Map<string, { categoria: string; total: number; qtd: number }>();
  const meses = Array.from({ length: ateMes }, (_, i) => ({ mes: i + 1, nome: MESES[i]!, total: 0 }));
  let total = 0;
  for (const g of doAno) {
    const c = cent(g.valor);
    total += c;
    const k = sem(g.categoria);
    const e = cats.get(k) ?? { categoria: g.categoria, total: 0, qtd: 0 };
    e.total += c; e.qtd += 1; cats.set(k, e);
    meses[g.mes - 1]!.total += c;
  }
  return {
    ano, ateMes, total: total / 100, qtd: doAno.length, categoria,
    porCategoria: [...cats.values()].map((c) => ({ ...c, total: c.total / 100 })).sort((a, b) => b.total - a.total),
    porMes: meses.map((m) => ({ ...m, total: m.total / 100 })),
  };
}
