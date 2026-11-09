// O modelo responde normalmente e, ao final, manda um bloco de controle:
// <<<META>>> {"memorias":[{"texto":"...","area":"..."}]}
// Esse bloco nunca aparece para a pessoa.

export const META = "<<<META>>>";
export const AREAS = ["Pessoal", "Preferências", "Saúde", "Finanças", "Estudos", "Família", "Projetos", "Trabalho"] as const;

export type MemoryProposal = { content: string; area: string };

/** Parte visível de um texto em streaming (corta no início do bloco de controle). */
export function visiblePart(text: string): string {
  const i = text.indexOf("<<<");
  return (i >= 0 ? text.slice(0, i) : text).trimEnd();
}

export type ReminderProposal = { text: string; dueAt: string };

/** Lembrete válido: texto curto e data no futuro (até 1 ano). Datas sem fuso são tratadas como horário de Brasília. */
export function validReminder(text: unknown, when: unknown, now = Date.now()): ReminderProposal | null {
  if (typeof text !== "string" || typeof when !== "string") return null;
  const t = text.trim().slice(0, 300);
  const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(when.trim()) ? when.trim() : `${when.trim()}-03:00`;
  const d = new Date(iso);
  if (!t || Number.isNaN(d.getTime())) return null;
  if (d.getTime() < now + 20_000 || d.getTime() > now + 366 * 86_400_000) return null;
  return { text: t, dueAt: d.toISOString() };
}

export type TaskProposal = { title: string; due: string | null; priority: 1 | 2 | 3; project: string | null };

/** Tarefa válida: título curto; prazo AAAA-MM-DD opcional (de hoje até 2 anos); prioridade 1 (alta) a 3 (baixa). */
export function validTask(o: { texto?: unknown; prazo?: unknown; prioridade?: unknown; projeto?: unknown }, now = Date.now()): TaskProposal | null {
  const title = typeof o.texto === "string" ? o.texto.trim().slice(0, 200) : "";
  if (!title) return null;
  let due: string | null = null;
  if (typeof o.prazo === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.prazo)) {
    const t = Date.parse(`${o.prazo}T12:00:00-03:00`);
    if (!Number.isNaN(t) && t > now - 2 * 86_400_000 && t < now + 730 * 86_400_000) due = o.prazo;
  }
  const p = Number(o.prioridade);
  const priority = (p === 1 || p === 3 ? p : 2) as 1 | 2 | 3;
  const project = typeof o.projeto === "string" && o.projeto.trim() ? o.projeto.trim().slice(0, 80) : null;
  return { title, due, priority, project };
}

export type EventProposal = { title: string; start: string; end: string; location: string | null };

function withTz(v: string): string {
  const t = v.trim();
  return /[zZ]|[+-]\d{2}:?\d{2}$/.test(t) ? t : `${t}-03:00`;
}

/** Evento proposto: título, início no futuro (até 1 ano), fim depois do início (padrão: 1 hora). */
export function validEvent(o: { titulo?: unknown; inicio?: unknown; fim?: unknown; local?: unknown }, now = Date.now()): EventProposal | null {
  const title = typeof o.titulo === "string" ? o.titulo.trim().slice(0, 160) : "";
  if (!title || typeof o.inicio !== "string") return null;
  const start = new Date(withTz(o.inicio));
  if (Number.isNaN(start.getTime()) || start.getTime() < now - 3_600_000 || start.getTime() > now + 366 * 86_400_000) return null;
  let end = typeof o.fim === "string" ? new Date(withTz(o.fim)) : new Date(NaN);
  if (Number.isNaN(end.getTime()) || end <= start || end.getTime() - start.getTime() > 24 * 3_600_000) end = new Date(start.getTime() + 3_600_000);
  const location = typeof o.local === "string" && o.local.trim() ? o.local.trim().slice(0, 160) : null;
  return { title, start: start.toISOString(), end: end.toISOString(), location };
}

export function splitMeta(text: string, now = Date.now()): { body: string; memories: MemoryProposal[]; reminders: ReminderProposal[]; tasks: TaskProposal[]; events: EventProposal[] } {
  const i = text.indexOf(META);
  if (i < 0) return { body: visiblePart(text), memories: [], reminders: [], tasks: [], events: [] };
  const body = text.slice(0, i).trim();
  const raw = text.slice(i + META.length);
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return { body, memories: [], reminders: [], tasks: [], events: [] };
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as { memorias?: unknown; lembretes?: unknown; tarefas?: unknown; eventos?: unknown };
    const list = Array.isArray(parsed.memorias) ? parsed.memorias : [];
    const memories = list
      .map((m) => {
        const o = (m ?? {}) as { texto?: unknown; area?: unknown };
        const content = typeof o.texto === "string" ? o.texto.trim().slice(0, 400) : "";
        const area = typeof o.area === "string" && (AREAS as readonly string[]).includes(o.area) ? o.area : "Pessoal";
        return { content, area };
      })
      .filter((m) => m.content.length > 0)
      .slice(0, 4);
    const reminders = (Array.isArray(parsed.lembretes) ? parsed.lembretes : [])
      .map((r) => { const o = (r ?? {}) as { texto?: unknown; quando?: unknown }; return validReminder(o.texto, o.quando, now); })
      .filter((r): r is ReminderProposal => Boolean(r))
      .slice(0, 3);
    const tasks = (Array.isArray(parsed.tarefas) ? parsed.tarefas : [])
      .map((t) => validTask((t ?? {}) as Record<string, unknown>, now))
      .filter((t): t is TaskProposal => Boolean(t))
      .slice(0, 8);
    const events = (Array.isArray(parsed.eventos) ? parsed.eventos : [])
      .map((e) => validEvent((e ?? {}) as Record<string, unknown>, now))
      .filter((e): e is EventProposal => Boolean(e))
      .slice(0, 3);
    return { body, memories, reminders, tasks, events };
  } catch {
    return { body, memories: [], reminders: [], tasks: [], events: [] };
  }
}
