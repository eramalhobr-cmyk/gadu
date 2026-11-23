// Painéis de resumo (tema JARVIS): contas puras para os gráficos. Só dados reais: sem registro, sem número.
export type Ponto = { label: string; value: number };

/** 0 a 100, arredondado e limitado; null quando não há base (nunca "0%" inventado). */
export function pctDe(parte: number, total: number): number | null {
  if (!Number.isFinite(parte) || !Number.isFinite(total) || total <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((parte / total) * 100)));
}

/** Altura relativa de cada barra (0 a 100) pelo maior valor; tudo zero = sem gráfico. */
export function escala(pontos: Ponto[]): number[] | null {
  const max = Math.max(0, ...pontos.map((p) => p.value));
  if (max <= 0) return null;
  return pontos.map((p) => Math.round((Math.max(0, p.value) / max) * 100));
}

/** Pontos de uma linha (sparkline) num quadro w×h, com 2 px de margem. */
export function linha(valores: number[], w = 120, h = 32): string {
  if (valores.length < 2) return "";
  const max = Math.max(...valores), min = Math.min(...valores), amp = max - min || 1;
  return valores.map((v, i) => `${Math.round((i / (valores.length - 1)) * (w - 4) + 2)},${Math.round(h - 2 - ((v - min) / amp) * (h - 4))}`).join(" ");
}

/** Texto para leitores de tela e para a voz: "jan 120, fev 340…; maior: fev". */
export function descreve(pontos: Ponto[], fmt: (n: number) => string): string {
  if (!pontos.length) return "Sem dados.";
  const maior = pontos.reduce((a, b) => (b.value > a.value ? b : a));
  return `${pontos.map((p) => `${p.label}: ${fmt(p.value)}`).join("; ")}. Maior: ${maior.label}.`;
}

/** Tarefas: abertas, atrasadas (prazo antes de hoje), para hoje e feitas por dia nos últimos 7 dias (fuso de São Paulo). */
export function resumoTarefas(abertas: { due_date: string | null }[], feitas: { done_at: string | null }[], hoje: string, dias = 7) {
  const atrasadas = abertas.filter((t) => t.due_date && t.due_date < hoje).length;
  const paraHoje = abertas.filter((t) => t.due_date === hoje).length;
  const dia = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const base = new Date(`${hoje}T12:00:00-03:00`);
  const serie: Ponto[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(base.getTime() - i * 86_400_000);
    const k = d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const label = i === 0 ? "hoje" : d.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" }).replace(".", "");
    serie.push({ label, value: feitas.filter((f) => f.done_at && dia(f.done_at) === k).length });
  }
  const feitasHoje = serie[serie.length - 1]?.value ?? 0;
  return { abertas: abertas.length, atrasadas, paraHoje, feitasHoje, feitas7: serie.reduce((a, p) => a + p.value, 0), serie };
}
