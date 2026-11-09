// O modelo responde normalmente e, ao final, manda um bloco de controle:
// <<<META>>> {"memorias":[{"texto":"...","area":"..."}]}
// Esse bloco nunca aparece para a pessoa.

export const META = "<<<META>>>";
export const AREAS = ["Preferências", "Projetos", "Agent Office", "Pessoal", "Profissional"] as const;

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

export function splitMeta(text: string, now = Date.now()): { body: string; memories: MemoryProposal[]; reminders: ReminderProposal[] } {
  const i = text.indexOf(META);
  if (i < 0) return { body: visiblePart(text), memories: [], reminders: [] };
  const body = text.slice(0, i).trim();
  const raw = text.slice(i + META.length);
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return { body, memories: [], reminders: [] };
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as { memorias?: unknown; lembretes?: unknown };
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
    return { body, memories, reminders };
  } catch {
    return { body, memories: [], reminders: [] };
  }
}
