// Insights do dia, calculados sem IA (grátis e previsíveis). Usados no Hoje, no briefing e no "Começar o dia".
export type InEvent = { title: string; start: string; end: string; allDay: boolean };
export type InTask = { title: string; due_date: string | null; priority: number };
export type InMail = { from: string; subject: string; date: string; important: boolean };
export type Insight = { kind: "conflito" | "livre" | "atrasadas" | "email" | "cheio"; text: string };

const TZ = "America/Sao_Paulo";
const hm = (ms: number) => new Date(ms).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

export function insights(input: { events: InEvent[] | null; tasks: InTask[]; mails: InMail[] | null; now?: number; today?: string }): Insight[] {
  const now = input.now ?? Date.now();
  const today = input.today ?? new Date(now).toLocaleDateString("en-CA", { timeZone: TZ });
  const out: Insight[] = [];

  if (input.events) {
    const timed = input.events.filter((e) => !e.allDay).map((e) => ({ ...e, s: Date.parse(e.start), e: Date.parse(e.end) })).filter((e) => e.e > now).sort((a, b) => a.s - b.s);
    for (let i = 0; i < timed.length - 1; i++) {
      const a = timed[i], b = timed[i + 1];
      if (b.s < a.e) { out.push({ kind: "conflito", text: `Conflito às ${hm(b.s)}: "${a.title}" e "${b.title}".` }); break; }
    }
    if (input.events.length >= 6) out.push({ kind: "cheio", text: `Dia cheio: ${input.events.length} compromissos.` });
    // Maior janela livre entre agora (ou 9h) e 18h, de pelo menos 90 minutos.
    const dayStart = Date.parse(`${today}T09:00:00-03:00`), dayEnd = Date.parse(`${today}T18:00:00-03:00`);
    let cursor = Math.max(now, dayStart), best = { s: 0, e: 0 };
    for (const ev of timed.filter((x) => x.s < dayEnd)) {
      if (ev.s - cursor > best.e - best.s) best = { s: cursor, e: ev.s };
      cursor = Math.max(cursor, ev.e);
    }
    if (dayEnd - cursor > best.e - best.s) best = { s: cursor, e: dayEnd };
    if (best.e - best.s >= 90 * 60_000) out.push({ kind: "livre", text: `Janela livre das ${hm(best.s)} às ${hm(best.e)}: boa hora para foco.` });
  }

  const late = input.tasks.filter((t) => t.due_date && t.due_date < today).sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));
  if (late.length) {
    const days = Math.round((Date.parse(`${today}T12:00:00-03:00`) - Date.parse(`${late[0].due_date}T12:00:00-03:00`)) / 86_400_000);
    out.push({ kind: "atrasadas", text: late.length === 1 ? `Tarefa atrasada há ${days} ${days === 1 ? "dia" : "dias"}: "${late[0].title}".` : `${late.length} tarefas atrasadas; a mais antiga há ${days} dias ("${late[0].title}").` });
  }

  const stale = (input.mails ?? []).filter((m) => m.important && Date.parse(m.date) < now - 20 * 3_600_000);
  if (stale.length) out.push({ kind: "email", text: stale.length === 1 ? `E-mail importante de ${stale[0].from} sem leitura desde ontem: "${stale[0].subject}".` : `${stale.length} e-mails importantes sem leitura desde ontem.` });

  return out.slice(0, 4);
}
