// Importação de memórias vindas de outras IAs (Claude, ChatGPT, Gemini) ou de anotações.
// Sem IA: transforma listas (uma linha por item, marcadores ou JSON) em memórias candidatas.

export const IMPORT_MAX_CHARS = 30_000;
export const IMPORT_MAX_ITEMS = 120;

/** Texto que a pessoa cola na outra IA para exportar o que ela sabe. */
export const EXPORT_PROMPT =
  "Liste tudo o que você sabe sobre mim: preferências, rotina, projetos, pessoas próximas, jeito de trabalhar e objetivos. " +
  "Uma informação por linha, frases curtas, em português. Não inclua senhas, documentos, dados bancários nem de saúde. " +
  "Não inclua nada sobre a empresa onde trabalho.";

const KEYS = ["content", "memory", "text", "texto", "value", "fact"];

function fromJson(text: string): string[] | null {
  const t = text.trim();
  if (!/^[[{]/.test(t)) return null;
  try {
    const out: string[] = [];
    const walk = (v: unknown, depth: number) => {
      if (depth > 4 || out.length > IMPORT_MAX_ITEMS * 2) return;
      if (typeof v === "string") out.push(v);
      else if (Array.isArray(v)) v.forEach((x) => walk(x, depth + 1));
      else if (v && typeof v === "object") {
        const o = v as Record<string, unknown>;
        const k = KEYS.find((key) => typeof o[key] === "string");
        if (k) out.push(o[k] as string);
        else Object.values(o).forEach((x) => walk(x, depth + 1));
      }
    };
    walk(JSON.parse(t), 0);
    return out;
  } catch {
    return null;
  }
}

/** Limpa um item: tira marcadores, numeração, aspas e espaços. */
export function cleanItem(s: string): string {
  return s
    .replace(/^\s*(?:[-*•·–—>]|\d{1,3}[.)]|\[[ x]\])\s*/i, "")
    .replace(/^["“']|["”']$/g, "")
    .replace(/\*\*|__|`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lista candidatos únicos (sem diferenciar maiúsculas), de 8 a 400 caracteres. Títulos são ignorados. */
export function parseImport(text: string): string[] {
  const raw = fromJson(text) ?? text.split(/\r?\n/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    if (/^\s*#/.test(r)) continue;
    const c = cleanItem(r);
    if (c.length < 8 || c.length > 400 || /:$/.test(c)) continue;
    const key = c.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
    if (out.length >= IMPORT_MAX_ITEMS) break;
  }
  return out;
}

/** Texto livre (ex.: uma conversa exportada) não tem cara de lista: pede extração com IA. */
export function looksLikeList(text: string): boolean {
  if (fromJson(text)) return true;
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return false;
  const long = lines.filter((l) => l.length > 400).length;
  return long / lines.length < 0.2;
}
