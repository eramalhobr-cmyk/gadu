// Texto da agenda e dos e-mails para o modelo, e detecção de intenção. Sem dependências (testável).
export type CalEvent = { title: string; start: string; end: string; allDay: boolean; where?: string; meet: boolean; declined: boolean };
export type Mail = { thread?: string; from: string; subject: string; snippet: string; date: string; important: boolean };
const TZ = "America/Sao_Paulo";


function hm(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}
function dayLabel(iso: string, allDay: boolean): string {
  const d = allDay ? new Date(`${iso}T12:00:00-03:00`) : new Date(iso);
  return d.toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "long", day: "numeric", month: "numeric" });
}

export function formatEvents(list: CalEvent[]): string {
  if (!list.length) return "Agenda: nenhum compromisso no período.";
  const byDay = new Map<string, string[]>();
  for (const e of list) {
    if (e.declined) continue;
    const day = dayLabel(e.start, e.allDay);
    const line = `${e.allDay ? "dia todo" : `${hm(e.start)}–${hm(e.end)}`} ${e.title}${e.meet ? " (online)" : ""}${e.where ? ` · ${e.where}` : ""}`;
    byDay.set(day, [...(byDay.get(day) ?? []), line]);
  }
  return "Agenda:\n" + [...byDay].map(([d, ls]) => `${d}:\n${ls.map((l) => `- ${l}`).join("\n")}`).join("\n");
}

/** E-mails que `hide` reprova (sensíveis ou com termo bloqueado) chegam ao modelo só como "omitido". */
export function formatMails(list: Mail[], hide: (text: string) => boolean = () => false): string {
  if (!list.length) return "E-mails: nenhum e-mail não lido relevante nos últimos 2 dias.";
  return (
    `E-mails não lidos (últimos 2 dias, ${list.length}):\n` +
    list
      .map((m) => {
        const text = `${m.subject} ${m.snippet}`;
        if (hide(`${m.from} ${text}`)) return `- ${m.important ? "[importante] " : ""}(e-mail omitido pela regra de privacidade)`;
        return `- ${m.important ? "[importante] " : ""}De ${m.from}: "${m.subject}" — ${m.snippet}`;
      })
      .join("\n")
  );
}

/** O que buscar no Google a partir da mensagem. */
export function googleIntent(message: string): { agenda: boolean; email: boolean; week: boolean } {
  const t = message.toLowerCase();
  const day = /come[cç]ar o dia|meu dia|bom dia|resumo do dia|briefing/.test(t);
  return {
    agenda: day || /agenda|compromisso|reuni[aã]o|reuni[oõ]es|calend|evento|hor[aá]rio livre|tempo livre|amanh[aã]|semana|ocupad/.test(t),
    email: day || /e-?mails?|gmail|caixa de entrada|inbox|mensagens? (importantes|não lidas|nao lidas)/.test(t),
    week: /semana|pr[oó]ximos dias/.test(t),
  };
}
