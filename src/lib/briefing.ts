// Texto curto da notificação da manhã (sem IA, grátis). O briefing completo sai ao tocar.
export type BriefEvent = { title: string; start: string; allDay: boolean };

export function briefingText(input: { name: string; events: BriefEvent[] | null; mails: number | null; important: number | null; reminders: number }) {
  const parts: string[] = [];
  if (input.events) {
    const timed = input.events.filter((e) => !e.allDay);
    if (!input.events.length) parts.push("Agenda livre hoje.");
    else {
      const first = timed[0];
      const hm = first ? new Date(first.start).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }) : "";
      const n = input.events.length;
      parts.push(`${n} ${n === 1 ? "compromisso" : "compromissos"} hoje${first ? `, o primeiro às ${hm} (${first.title.slice(0, 40)})` : ""}.`);
    }
  }
  if (input.mails !== null) {
    if (input.important) parts.push(`${input.important} ${input.important === 1 ? "e-mail importante" : "e-mails importantes"} sem ler.`);
    else if (input.mails) parts.push(`${input.mails} ${input.mails === 1 ? "e-mail novo" : "e-mails novos"}.`);
    else parts.push("Caixa de entrada em dia.");
  }
  if (input.reminders) parts.push(`${input.reminders} ${input.reminders === 1 ? "lembrete" : "lembretes"} para hoje.`);
  parts.push("Toque para começar o dia.");
  return { title: `Bom dia${input.name ? `, ${input.name}` : ""}!`, body: parts.join(" ") };
}

/** Agora no horário de Brasília (UTC-3): data "AAAA-MM-DD", minutos do dia e início do dia em UTC. */
export function spNow(now = Date.now()) {
  const sp = new Date(now - 3 * 3_600_000);
  const day = sp.toISOString().slice(0, 10);
  const minutes = sp.getUTCHours() * 60 + sp.getUTCMinutes();
  const start = new Date(Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate(), 3));
  return { day, minutes, start };
}

/** "07:00" → 420. Inválido → padrão 7h. */
export function parseTime(v: unknown): number {
  const m = typeof v === "string" ? /^([01]\d|2[0-3]):([0-5]\d)$/.exec(v) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : 420;
}
