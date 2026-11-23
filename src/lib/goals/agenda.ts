// Metas fase 2 · agenda: o SERVIDOR escolhe os dias e horários dos blocos de uma meta ("reserva 3 manhãs por semana"),
// pulando horários que já têm compromisso. Puro (sem rede nem banco): quem consulta a agenda e grava é o resto do app.
// O modelo só diz quantas vezes, em que período e por quanto tempo; nunca escolhe data nem horário.
import { hojeSP } from "../finance/datas.ts";

export const PERIODOS = ["manha", "tarde", "noite"] as const;
export type Periodo = (typeof PERIODOS)[number];
export const PERIODO_NOME: Record<Periodo, string> = { manha: "manhã", tarde: "tarde", noite: "noite" };
/** Janela de cada período, em horas cheias de Brasília: o bloco começa e termina dentro dela. */
export const JANELAS: Record<Periodo, [number, number]> = { manha: [7, 12], tarde: [13, 18], noite: [19, 22] };
export const MAX_BLOCOS = 20;
export const MAX_SEMANAS = 6;

export type Bloco = { inicio: string; fim: string };
export type Ocupado = { start: string; end: string; allDay?: boolean };
export type PlanoAgenda = {
  blocos: Bloco[];
  /** Quantas vezes o dia ideal estava ocupado (ou já passou) e o servidor escolheu outro dia da mesma semana. */
  pulados: number;
  /** Blocos pedidos que não couberam em nenhum dia da semana. */
  faltaram: number;
};

const H = 3_600_000, MIN = 60_000;

/**
 * Semana k = os 7 dias a partir de hoje + 7k. Em cada semana, os dias ideais ficam espalhados (3 vezes → dias 2, 4 e 6 da semana);
 * se o dia ideal não tem horário livre na janela, o servidor tenta o dia livre mais próximo da mesma semana.
 * O horário é o primeiro livre da janela, de 30 em 30 minutos. Compromisso de dia inteiro não bloqueia.
 */
export function planejarAgenda(input: { now: number; vezes: number; semanas: number; periodo: Periodo; duracaoMin: number; ocupados: Ocupado[] }): PlanoAgenda {
  const vezes = Math.min(Math.max(Math.trunc(input.vezes), 1), 7);
  const semanas = Math.min(Math.max(Math.trunc(input.semanas), 1), Math.min(MAX_SEMANAS, Math.floor(MAX_BLOCOS / vezes)));
  const dur = Math.min(Math.max(Math.trunc(input.duracaoMin), 15), 240) * MIN;
  const [h0, h1] = JANELAS[input.periodo];
  const hoje = hojeSP(input.now);
  const meiaNoite = (off: number) => Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia + off) + 3 * H; // 00:00 de Brasília = 03:00 UTC
  const timed = input.ocupados.filter((e) => !e.allDay).map((e) => [Date.parse(e.start), Date.parse(e.end)] as const).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
  const livre = (a: number, b: number) => timed.every(([s, e]) => !(a < e && b > s));
  const minimo = input.now + 30 * MIN;

  /** Primeiro horário livre do dia (offset a partir de hoje), ou null. */
  const slot = (off: number): Bloco | null => {
    const base = meiaNoite(off);
    for (let t = base + h0 * H; t + dur <= base + h1 * H; t += 30 * MIN) {
      if (t >= minimo && livre(t, t + dur)) return { inicio: new Date(t).toISOString(), fim: new Date(t + dur).toISOString() };
    }
    return null;
  };

  const blocos: Bloco[] = [];
  let pulados = 0, faltaram = 0;
  for (let w = 0; w < semanas; w++) {
    const usados = new Set<number>();
    for (let i = 0; i < vezes; i++) {
      const ideal = Math.floor(((i + 0.5) * 7) / vezes);
      // Ordem de tentativa: o dia ideal, depois os outros da semana do mais perto ao mais longe (empate: o mais tarde).
      const ordem = [0, 1, 2, 3, 4, 5, 6].filter((d) => !usados.has(d)).sort((a, b) => Math.abs(a - ideal) - Math.abs(b - ideal) || b - a);
      let achou = false;
      for (const d of ordem) {
        const s = slot(w * 7 + d);
        if (!s) continue;
        usados.add(d);
        if (d !== ideal) pulados++;
        blocos.push(s);
        achou = true;
        break;
      }
      if (!achou) faltaram++;
    }
  }
  blocos.sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
  return { blocos, pulados, faltaram };
}
