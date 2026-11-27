// Consumo de IA por tipo, por mês e por pessoa. Contas puras sobre as linhas reais de usage_events:
// nada inventado. Mês = mês de Brasília (UTC-3, sem horário de verão desde 2019).
import { z } from "zod";

export const TIPOS = ["chat", "summary", "import", "transcribe", "speech"] as const;
export type Tipo = (typeof TIPOS)[number];

export const ROTULO_TIPO: Record<Tipo, string> = {
  chat: "Conversa",
  summary: "Resumo",
  import: "Importação",
  transcribe: "Transcrição",
  speech: "Voz natural",
};

/** Linha de usage_events (só as colunas que a tela usa). Para transcribe, input_tokens = segundos de áudio. */
export type LinhaUso = {
  user_id?: string;
  provider: string;
  model: string;
  kind: string;
  input_tokens: number | string | null;
  output_tokens?: number | string | null;
  cost_usd: number | string | null;
  created_at: string;
};

export type ResumoTipo = {
  tipo: Tipo;
  rotulo: string;
  custo: number;
  /** Quantas vezes: mensagens, resumos, importações, trechos de áudio ou falas. */
  vezes: number;
  /** Só transcrição: segundos de áudio somados. */
  segundos?: number;
};

export type ResumoMotor = { motor: string; provedor: string; custo: number; vezes: number };

export const MesSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "mês no formato AAAA-MM");

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const isTipo = (k: string): k is Tipo => (TIPOS as readonly string[]).includes(k);

/** Mês de Brasília (AAAA-MM) de um instante. */
export function mesDe(agora: Date): string {
  const b = new Date(agora.getTime() - 3 * 3_600_000);
  return `${b.getUTCFullYear()}-${String(b.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Mês anterior ou seguinte (delta em meses). */
export function somarMes(mes: string, delta: number): string {
  const [a, m] = mes.split("-").map(Number);
  const t = a * 12 + (m - 1) + delta;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

/** Início (inclusivo) e fim (exclusivo) do mês de Brasília, em ISO UTC. */
export function intervaloMes(mes: string): { inicio: string; fim: string } {
  const iso = (m: string) => new Date(`${m}-01T00:00:00-03:00`).toISOString();
  return { inicio: iso(mes), fim: iso(somarMes(mes, 1)) };
}

/** Os n meses até `mes`, do mais recente para o mais antigo. */
export function ultimosMeses(mes: string, n: number): string[] {
  return Array.from({ length: Math.max(0, n) }, (_, i) => somarMes(mes, -i));
}

const NOMES_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** "2026-11" → "nov/2026". */
export function rotuloMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return `${NOMES_MES[m - 1] ?? "?"}/${a}`;
}

/** Soma por tipo, na ordem fixa de TIPOS, só com os tipos que aparecem. Tipo desconhecido fica de fora. */
export function porTipo(linhas: LinhaUso[]): ResumoTipo[] {
  const acc = new Map<Tipo, ResumoTipo>();
  for (const l of linhas) {
    if (!isTipo(l.kind)) continue;
    const r = acc.get(l.kind) ?? { tipo: l.kind, rotulo: ROTULO_TIPO[l.kind], custo: 0, vezes: 0, ...(l.kind === "transcribe" ? { segundos: 0 } : {}) };
    r.custo += num(l.cost_usd);
    r.vezes += 1;
    if (l.kind === "transcribe") r.segundos = (r.segundos ?? 0) + num(l.input_tokens);
    acc.set(l.kind, r);
  }
  return TIPOS.filter((t) => acc.has(t)).map((t) => ({ ...acc.get(t)!, custo: arred(acc.get(t)!.custo) }));
}

/** Soma por motor (modelo), do maior gasto para o menor. */
export function porMotor(linhas: LinhaUso[]): ResumoMotor[] {
  const acc = new Map<string, ResumoMotor>();
  for (const l of linhas) {
    const motor = (l.model || "desconhecido").slice(0, 80);
    const k = `${l.provider}|${motor}`;
    const r = acc.get(k) ?? { motor, provedor: l.provider, custo: 0, vezes: 0 };
    r.custo += num(l.cost_usd);
    r.vezes += 1;
    acc.set(k, r);
  }
  return [...acc.values()].map((r) => ({ ...r, custo: arred(r.custo) })).sort((a, b) => b.custo - a.custo || a.motor.localeCompare(b.motor));
}

export const total = (linhas: LinhaUso[]) => arred(linhas.reduce((s, l) => s + num(l.cost_usd), 0));

/** Total por mês (AAAA-MM de Brasília) para a lista de meses pedida; mês sem uso = 0. */
export function porMes(linhas: LinhaUso[], meses: string[]): { mes: string; rotulo: string; custo: number; vezes: number }[] {
  const acc = new Map<string, { custo: number; vezes: number }>(meses.map((m) => [m, { custo: 0, vezes: 0 }]));
  for (const l of linhas) {
    const t = Date.parse(l.created_at);
    if (!Number.isFinite(t)) continue;
    const r = acc.get(mesDe(new Date(t)));
    if (!r) continue;
    r.custo += num(l.cost_usd);
    r.vezes += 1;
  }
  return meses.map((m) => ({ mes: m, rotulo: rotuloMes(m), custo: arred(acc.get(m)!.custo), vezes: acc.get(m)!.vezes }));
}

/** Percentual usado do teto (inteiro). Sem teto conhecido = null; teto zero com gasto = 100. */
export function pctUsado(gasto: number, teto: number | null): number | null {
  if (teto === null || !Number.isFinite(teto) || teto < 0) return null;
  if (teto === 0) return gasto > 0 ? 100 : 0;
  return Math.round((gasto / teto) * 100);
}

export type Pessoa = { id: string; nome: string | null; email: string | null };
export type ConsumoPessoa = {
  id: string;
  nome: string;
  email: string | null;
  custo: number;
  teto: number | null;
  tetoProprio: boolean;
  pct: number | null;
  tipos: ResumoTipo[];
  motores: ResumoMotor[];
};

/**
 * Consumo do mês por pessoa, do maior gasto para o menor. Só nome e e-mail identificam a pessoa.
 * `tetos`: teto por pessoa quando lido do banco; quem não está no mapa recebe `tetoPadrao` (ou null, se desconhecido).
 * Quem gastou sem estar em `pessoas` (conta removida) aparece como "Pessoa removida".
 */
export function porPessoa(
  linhas: LinhaUso[],
  pessoas: Pessoa[],
  tetos: Map<string, { valor: number; proprio: boolean }>,
  tetoPadrao: number | null,
): ConsumoPessoa[] {
  const grupos = new Map<string, LinhaUso[]>();
  for (const p of pessoas) grupos.set(p.id, []);
  for (const l of linhas) {
    if (!l.user_id) continue;
    const g = grupos.get(l.user_id) ?? [];
    g.push(l);
    grupos.set(l.user_id, g);
  }
  const quem = new Map(pessoas.map((p) => [p.id, p]));
  return [...grupos.entries()]
    .map(([id, ls]) => {
      const p = quem.get(id);
      const custo = total(ls);
      const t = tetos.get(id);
      const teto = t ? t.valor : tetoPadrao;
      return {
        id,
        nome: p?.nome?.trim() || p?.email || "Pessoa removida",
        email: p?.email ?? null,
        custo,
        teto,
        tetoProprio: t?.proprio ?? false,
        pct: pctUsado(custo, teto),
        tipos: porTipo(ls),
        motores: porMotor(ls),
      };
    })
    .sort((a, b) => b.custo - a.custo || a.nome.localeCompare(b.nome, "pt-BR"));
}

function arred(n: number) {
  return Math.round(n * 1e6) / 1e6;
}

/** US$ com 2 casas; valores pequenos (abaixo de 1 centavo) com até 4 casas. */
export function usd(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  const peq = v > 0 && v < 0.01;
  return `US$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: peq ? 4 : 2, maximumFractionDigits: peq ? 4 : 2 })}`;
}

/** Segundos de áudio em minutos para a tela: "menos de 1 min", "1 min", "12 min", "1 h 05 min". */
export function minutos(segundos: number): string {
  const s = Number.isFinite(segundos) && segundos > 0 ? segundos : 0;
  if (s === 0) return "0 min";
  if (s < 60) return "menos de 1 min";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
}

/** Quantidade do tipo em palavras curtas. */
export function quantidade(r: ResumoTipo): string {
  if (r.tipo === "transcribe") return `${minutos(r.segundos ?? 0)} de áudio`;
  const n = r.vezes;
  const p = (um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
  switch (r.tipo) {
    case "chat": return p("mensagem", "mensagens");
    case "summary": return p("resumo", "resumos");
    case "import": return p("importação", "importações");
    case "speech": return p("fala", "falas");
  }
}

/** Quanto falta até o teto (nunca negativo). */
export function falta(teto: number | null, gasto: number, reservado = 0): number | null {
  if (teto === null) return null;
  return Math.max(0, arred(teto - gasto - reservado));
}

/**
 * Lê todas as páginas de uma consulta (o PostgREST devolve no máximo 1000 linhas por vez).
 * Para no limite de páginas para não pesar a função; `completo` diz se leu tudo. Erro = null (quem chama decide).
 */
export async function lerPaginado<T>(
  pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  { tamanho = 1000, maxPaginas = 50 } = {},
): Promise<{ linhas: T[]; completo: boolean } | null> {
  const linhas: T[] = [];
  for (let i = 0; i < maxPaginas; i++) {
    const { data, error } = await pagina(i * tamanho, (i + 1) * tamanho - 1);
    if (error) return null;
    const d = data ?? [];
    linhas.push(...d);
    if (d.length < tamanho) return { linhas, completo: true };
  }
  return { linhas, completo: false };
}
