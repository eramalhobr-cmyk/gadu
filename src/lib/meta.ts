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

export function splitMeta(text: string): { body: string; memories: MemoryProposal[] } {
  const i = text.indexOf(META);
  if (i < 0) return { body: visiblePart(text), memories: [] };
  const body = text.slice(0, i).trim();
  const raw = text.slice(i + META.length);
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return { body, memories: [] };
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as { memorias?: unknown };
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
    return { body, memories };
  } catch {
    return { body, memories: [] };
  }
}
