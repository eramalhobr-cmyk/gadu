// Percepções do GaDu (insights) com Aceitar/Ignorar. Puro: sem rede nem banco. As percepções são calculadas sem IA em
// insights.ts; aqui ficam o que cada "Aceitar" faz, o filtro do que a pessoa já respondeu hoje e a validação do corpo.
import { z } from "zod";
import type { Insight, InsightKind } from "./insights.ts";

export const TIPOS_PERCEPCAO = ["conflito", "livre", "atrasadas", "email", "cheio"] as const satisfies readonly InsightKind[];
export type Decisao = "aceita" | "ignorada";
export type Resposta = { tipo: string; decisao: string };

/** O que o botão Aceitar faz, por tipo. `null`: só dá para ignorar (aviso informativo). */
export const ACEITAR: Record<InsightKind, { rotulo: string; feito: string } | null> = {
  atrasadas: { rotulo: "Passar para hoje", feito: "Tarefas atrasadas passadas para hoje" },
  email: { rotulo: "Virar tarefa", feito: "Tarefa criada para responder" },
  livre: { rotulo: "Reservar foco", feito: "Foco reservado na agenda" },
  conflito: { rotulo: "Ver na agenda", feito: "Conflito anotado" },
  cheio: null,
};

/** Duração máxima do bloco de foco reservado pela janela livre. */
export const FOCO_MAX_MIN = 120;
export const ATRASADAS_MAX = 20;

/** Tira as percepções que a pessoa já aceitou ou ignorou hoje (uma resposta por tipo por dia). */
export function pendentes(lista: Insight[], respostas: Resposta[]): Insight[] {
  const feitos = new Set(respostas.map((r) => r.tipo));
  return lista.filter((i) => !feitos.has(i.kind));
}

/** Título da tarefa criada a partir de um e-mail parado. */
export function tarefaDoEmail(ref: { from?: string; subject?: string } | undefined, quantos = 1): string {
  if (!ref?.subject) return quantos > 1 ? `Responder ${quantos} e-mails importantes` : "Responder e-mail importante";
  const de = (ref.from ?? "").replace(/<[^>]*>/g, "").replace(/"/g, "").trim();
  return `Responder e-mail: ${ref.subject.trim()}${de ? ` (${de})` : ""}`.slice(0, 200);
}

/** Bloco de foco dentro da janela livre: começa no início (ou agora, se já passou), no máximo FOCO_MAX_MIN. */
export function blocoFoco(ref: { inicio?: string; fim?: string } | undefined, now: number): { start: string; end: string } | null {
  const ini = Date.parse(ref?.inicio ?? ""), fim = Date.parse(ref?.fim ?? "");
  if (!Number.isFinite(ini) || !Number.isFinite(fim)) return null;
  const s = Math.max(ini, Math.ceil(now / 300_000) * 300_000); // próximo múltiplo de 5 min
  const e = Math.min(fim, s + FOCO_MAX_MIN * 60_000);
  if (e - s < 30 * 60_000 || fim - ini > 12 * 3_600_000) return null;
  return { start: new Date(s).toISOString(), end: new Date(e).toISOString() };
}

export const RespostaBody = z.object({
  tipo: z.enum(TIPOS_PERCEPCAO),
  decisao: z.enum(["aceita", "ignorada"]),
  ref: z.object({
    inicio: z.string().datetime({ offset: true }).optional(),
    fim: z.string().datetime({ offset: true }).optional(),
    from: z.string().max(200).optional(),
    subject: z.string().max(300).optional(),
  }).strict().optional(),
}).strict();

/** O que o servidor devolve para o Desfazer de um Aceitar. */
export type Desfazer = { tarefas?: { id: number; due_date: string | null }[]; tarefa_id?: number; evento_id?: string };
