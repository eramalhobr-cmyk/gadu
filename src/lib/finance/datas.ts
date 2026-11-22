// Datas de Finanças. O dia é sempre o de Brasília (UTC-3, sem horário de verão), como no resto do app.
import type { YM, YMD } from "./types.ts";

export function hojeSP(now: number = Date.now()): YMD {
  const d = new Date(now - 3 * 3_600_000);
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
}

export const diasNoMes = ({ ano, mes }: YM): number => new Date(Date.UTC(ano, mes, 0)).getUTCDate();

export const proximoMes = ({ ano, mes }: YM): YM => (mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 });

/** Dia de vencimento ajustado ao mês (31 em abril vira 30). */
export const diaNoMes = (ym: YM, dia: number): number => Math.min(Math.max(dia, 1), diasNoMes(ym));

export const ordinal = ({ ano, mes, dia }: YMD): number => Math.floor(Date.UTC(ano, mes - 1, dia) / 86_400_000);

export const isoDia = ({ ano, mes, dia }: YMD): string => `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

/** Data AAAA-MM-DD existente, ou null. */
export function lerData(s: unknown): YMD | null {
  if (typeof s !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (ano < 2000 || ano > 2100 || mes < 1 || mes > 12 || dia < 1 || dia > diasNoMes({ ano, mes })) return null;
  return { ano, mes, dia };
}
