// Tipos do Core Contextual (primeira entrega: "O que merece minha atenção hoje?"). Só leitura, escopo pessoal.
import type { CoreFact } from "../core-context.ts";
import type { ViewId } from "../modules.ts";

export type FactKind = "atrasada" | "tarefa_hoje" | "prioridade" | "lembrete" | "evento" | "email" | "financa";
export type FactTag = "T" | "L" | "A" | "E" | "F";

/** Fato do "atenção hoje": CoreFact (com origem) + etiqueta, tipo, prioridade e tela de origem. */
export type AttentionFact = CoreFact & {
  /** Etiqueta citável, ex.: "T1" (tarefa), "L1" (lembrete), "A1" (agenda), "E1" (e-mail). */
  tag: string;
  kind: FactKind;
  /** Menor = mais urgente. Decide o corte quando passa do limite. */
  rank: number;
  /** Rótulo curto para a interface ("Tarefa atrasada"). */
  label: string;
  /** Tela do app que originou o fato. */
  view: ViewId;
  /** Link externo (e-mail), quando existe. */
  href?: string;
  /** Conteúdo ocultado pela regra de privacidade (termo bloqueado ou dado sensível). */
  omitted: boolean;
};

export type SourceName = "tarefas" | "lembretes" | "agenda" | "email";
export type UnavailableReason = "not_connected" | "scope" | "revoked" | "error";
export type Unavailable = { source: SourceName; reason: UnavailableReason; text: string };

/** Fato ainda sem etiqueta (as fontes não numeram; quem numera é o collect). */
export type RawFact = Omit<AttentionFact, "tag">;
export type SourceResult = { facts: RawFact[]; unavailable?: Unavailable };

export type CoreResult = {
  facts: AttentionFact[];
  unavailable: Unavailable[];
  /** Quantos fatos ficaram de fora pelos limites de volume ("e mais N"). */
  more: number;
};

/** Leitura do Google, injetada (o Core não conhece tokens). Erros trazem `kind`. */
export type GoogleReader = {
  status(): Promise<{ connected: boolean; scopes: string[] }>;
  events(from: Date, to: Date): Promise<import("../google-format.ts").CalEvent[]>;
  inbox(max: number): Promise<import("../google-format.ts").Mail[]>;
};

/** Cliente do Supabase com a SESSÃO da pessoa (RLS). Nunca o cliente com a chave secreta. */
export type SessionDb = { from: (table: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

export type SourceCtx = {
  db: SessionDb;
  userId: string;
  now: Date;
  /** "AAAA-MM-DD" de hoje em Brasília. */
  day: string;
  /** Início de hoje (Brasília) e início de amanhã, em UTC. */
  dayStart: Date;
  dayEnd: Date;
  blocked: string[];
};

export const OMITTED = "(omitido pela regra de privacidade)";
