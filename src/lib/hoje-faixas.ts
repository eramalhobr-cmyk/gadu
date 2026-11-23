// Hoje em três faixas (UX-7 · M3): Agora, Depois e Progresso. Funções puras, sem IA.
const TZ = "America/Sao_Paulo";
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });

export type LaterItem = { kind: "evento" | "lembrete"; at: string; title: string };
type EvIn = { title: string; start: string; end: string; allDay: boolean };
type RemIn = { text: string; due_at: string; status: string };

/** O que ainda vem hoje (Brasília), depois do "Agora": compromissos com hora e lembretes pendentes, em ordem. */
export function laterToday(events: EvIn[], rems: RemIn[], now: Date, skipStart?: string, max = 4): LaterItem[] {
  const today = dayKey(now);
  const evs = events
    .filter((e) => !e.allDay && e.start !== skipStart && new Date(e.start) > now && dayKey(new Date(e.start)) === today)
    .map((e): LaterItem => ({ kind: "evento", at: e.start, title: e.title }));
  const rs = rems
    .filter((r) => r.status === "pending" && new Date(r.due_at) > now && dayKey(new Date(r.due_at)) === today)
    .map((r): LaterItem => ({ kind: "lembrete", at: r.due_at, title: r.text }));
  return [...evs, ...rs].sort((a, b) => a.at.localeCompare(b.at)).slice(0, max);
}

/** Início do dia de hoje em Brasília, em ISO (para contar o que foi concluído hoje). */
export function startOfTodayIso(now: Date): string {
  return new Date(`${dayKey(now)}T00:00:00-03:00`).toISOString();
}

/** Fração do dia feita: concluídas / (concluídas + abertas para hoje). null quando não há nada. */
export function dayProgress(done: number, open: number): number | null {
  const total = done + open;
  return total === 0 ? null : Math.round((done / total) * 100);
}

/** Frase curta da faixa Progresso. */
export function progressText(done: number, open: number): string {
  if (done === 0 && open === 0) return "Nada marcado para hoje. Dia leve.";
  if (open === 0) return `Tudo feito: ${done} ${done === 1 ? "tarefa concluída" : "tarefas concluídas"} hoje.`;
  if (done === 0) return `${open} ${open === 1 ? "tarefa" : "tarefas"} para hoje. Que tal começar pela primeira?`;
  return `${done} de ${done + open} tarefas de hoje feitas.`;
}
