// Tela de Lembretes: regras puras (sem banco, rede nem React), para a tela, as rotas e os testes.
// Horário sempre de Brasília (UTC−3, sem horário de verão desde 2019), como no resto do app.

export const LEMBRETE_TEXTO_MAX = 300;
/** Evento da janela: a tela recarrega quando um lembrete muda por outro caminho (cartão da conversa, Desfazer). */
export const LEMBRETES_ATUALIZADOS = "gadu:lembretes-atualizados";
export const LEMBRETE_COLS = "id, text, due_at, status, sent_at";
/** Quantos dias os avisados e concluídos ficam na lista "Recentes". */
export const RECENTES_DIAS = 7;
/** Folga mínima para um horário novo contar como futuro. */
export const FOLGA_MS = 30_000;

export type LembreteStatus = "pending" | "sent" | "done" | "cancelled";
export type Lembrete = { id: number; text: string; due_at: string; status: LembreteStatus; sent_at: string | null };
export type Grupos = { proximos: Lembrete[]; atrasados: Lembrete[]; recentes: Lembrete[] };

const TZ = "America/Sao_Paulo";
const OFFSET = "-03:00";
const DIA_MS = 86_400_000;

/** Texto do lembrete: sem espaços sobrando, de 1 a 300 letras. Inválido: null. */
export function textoLembrete(v: unknown): string | null {
  if (typeof v !== "string" || v.includes("\0")) return null;
  const t = v.trim().replace(/\s+/g, " ");
  return t && t.length <= LEMBRETE_TEXTO_MAX ? t : null;
}

/**
 * "2026-11-28T09:00" (campo de data e hora, lido como Brasília) ou ISO com fuso ("…-03:00", "…Z") → ISO em UTC.
 * Data que não existe (31/02) ou formato estranho: null.
 */
export function lerQuando(v: unknown): string | null {
  if (typeof v !== "string" || v.length > 40) return null;
  const local = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(v);
  if (local) {
    const [, a, m, d, h, mi, s = "00"] = local;
    const t = Date.parse(`${a}-${m}-${d}T${h}:${mi}:${s}${OFFSET}`);
    if (Number.isNaN(t)) return null;
    // Confere se a data existe de verdade (o Date "conserta" 31/02 para 03/03).
    if (paraCampo(new Date(t).toISOString()) !== `${a}-${m}-${d}T${h}:${mi}`) return null;
    return new Date(t).toISOString();
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/.test(v)) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** ISO → valor do campo de data e hora em Brasília ("2026-11-28T09:00"). */
export function paraCampo(iso: string): string {
  return new Date(Date.parse(iso) - 3 * 3_600_000).toISOString().slice(0, 16);
}

/** Sugestão para um lembrete novo: a próxima hora cheia (pelo menos 15 minutos à frente), em Brasília. */
export function sugestaoQuando(now = Date.now()): string {
  const hora = 3_600_000;
  const t = Math.ceil((now + 15 * 60_000) / hora) * hora;
  return paraCampo(new Date(t).toISOString());
}

/** O horário é futuro (com a folga de 30 s) e até 2 anos à frente? */
export function horarioFuturo(iso: string, now = Date.now()): boolean {
  const t = Date.parse(iso);
  return Number.isFinite(t) && t >= now + FOLGA_MS && t <= now + 731 * DIA_MS;
}

/**
 * Separa a lista da tela:
 * - próximos: esperando a hora (mais cedo primeiro);
 * - atrasados: a hora passou e o aviso ainda não saiu;
 * - recentes: avisados ou concluídos nos últimos 7 dias (mais novo primeiro). Apagados (cancelados) não aparecem.
 */
export function agruparLembretes(rows: Lembrete[], now = Date.now()): Grupos {
  const g: Grupos = { proximos: [], atrasados: [], recentes: [] };
  const desde = now - RECENTES_DIAS * DIA_MS;
  for (const r of rows) {
    const t = Date.parse(r.due_at);
    if (!Number.isFinite(t)) continue;
    if (r.status === "pending") (t >= now ? g.proximos : g.atrasados).push(r);
    else if ((r.status === "sent" || r.status === "done") && t >= desde) g.recentes.push(r);
  }
  const asc = (a: Lembrete, b: Lembrete) => Date.parse(a.due_at) - Date.parse(b.due_at) || a.id - b.id;
  g.proximos.sort(asc);
  g.atrasados.sort(asc);
  g.recentes.sort((a, b) => asc(b, a));
  return g;
}

const dia = (t: number) => new Date(t).toLocaleDateString("en-CA", { timeZone: TZ });
const hm = (t: number) => new Date(t).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

/** "hoje 14:00", "amanhã 09:00", "ontem 18:30", "sex 14/11 09:00" (Brasília). */
export function quandoTexto(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const k = dia(t);
  if (k === dia(now)) return `hoje ${hm(t)}`;
  if (k === dia(now + DIA_MS)) return `amanhã ${hm(t)}`;
  if (k === dia(now - DIA_MS)) return `ontem ${hm(t)}`;
  const d = new Date(t).toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "").replace(",", "");
  return `${d} ${hm(t)}`;
}

/** Linha de situação embaixo do texto. */
export function situacaoTexto(r: Lembrete, now = Date.now()): string {
  const q = quandoTexto(r.due_at, now);
  if (r.status === "done") return `Concluído · ${q}`;
  if (r.status === "sent") return `Avisado · ${q}`;
  if (r.status === "pending" && Date.parse(r.due_at) < now) return `Atrasado · ${q}`;
  return q;
}

/** "1 lembrete", "3 lembretes". */
export const contagem = (n: number) => `${n} ${n === 1 ? "lembrete" : "lembretes"}`;
