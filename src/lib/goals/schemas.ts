// Validação (zod) das rotas de Metas. Objetos NÃO são estritos de propósito: chaves desconhecidas (inclusive user_id)
// são descartadas e nunca chegam ao banco; o user_id vem sempre da sessão.
import { z } from "zod";
import { lerData } from "../finance/datas.ts";
import { parseNumero } from "./numero.ts";
import { CATEGORIAS, MEDICOES, STATUS } from "./types.ts";

const texto = (max: number) => z.string().trim().min(1).max(max);
const num = z.union([z.number(), z.string()]).transform((v, ctx) => {
  const n = parseNumero(v);
  if (n === null) { ctx.addIssue({ code: "custom", message: "número inválido" }); return z.NEVER; }
  return n;
});
const data = z.string().refine((s) => lerData(s) !== null, { message: "data inválida" });

export const IdParam = z.string().uuid();
export const TaskIdParam = z.coerce.number().int().min(1).max(9_007_199_254_740_991);

export const GoalCreate = z.object({
  titulo: texto(120),
  descricao: z.string().trim().max(600).nullable().optional(),
  categoria: z.enum(CATEGORIAS).default("desenvolvimento"),
  categoria_nome: z.string().trim().max(40).nullable().optional(),
  medicao: z.enum(MEDICOES).default("numerica"),
  unidade: z.string().trim().max(20).nullable().optional(),
  agregacao: z.enum(["soma", "ultimo"]).default("soma"),
  valor_inicial: num.default(0),
  valor_alvo: num.nullable().optional(),
  inicio: data.optional(),
  prazo: data.nullable().optional(),
  marcos: z.array(texto(120)).max(20).optional(),
}).transform((g, ctx) => {
  // Normaliza o que só vale para um tipo de medição (o banco também confere).
  const numerica = g.medicao === "numerica";
  const percentual = g.medicao === "percentual";
  const out = {
    ...g,
    categoria_nome: g.categoria === "personalizada" ? (g.categoria_nome || null) : null,
    unidade: numerica ? (g.unidade || null) : null,
    agregacao: percentual ? ("ultimo" as const) : g.agregacao,
    valor_inicial: percentual ? 0 : g.valor_inicial,
    valor_alvo: percentual ? 100 : numerica ? (g.valor_alvo ?? null) : null,
    marcos: g.medicao === "marcos" ? g.marcos : undefined,
  };
  if (numerica && (out.valor_alvo === null || out.valor_alvo === out.valor_inicial)) ctx.addIssue({ code: "custom", message: "informe um alvo diferente do valor inicial", path: ["valor_alvo"] });
  if (g.categoria === "personalizada" && !out.categoria_nome) ctx.addIssue({ code: "custom", message: "dê um nome à categoria", path: ["categoria_nome"] });
  if (out.prazo && out.inicio && out.prazo < out.inicio) ctx.addIssue({ code: "custom", message: "o prazo é antes do início", path: ["prazo"] });
  return out;
});

/** Edição: o tipo de medição, o valor inicial e a agregação não mudam (mudariam o sentido dos registros já feitos). */
export const GoalPatch = z.object({
  titulo: texto(120).optional(),
  descricao: z.string().trim().max(600).nullable().optional(),
  categoria: z.enum(CATEGORIAS).optional(),
  categoria_nome: z.string().trim().max(40).nullable().optional(),
  unidade: z.string().trim().max(20).nullable().optional(),
  valor_alvo: num.optional(),
  prazo: data.nullable().optional(),
  status: z.enum(STATUS).optional(),
}).refine((p) => Object.keys(p).some((k) => (p as Record<string, unknown>)[k] !== undefined), { message: "nada para alterar" });

export const ProgressoCreate = z.object({
  valor: num,
  data: data.optional(),
  origem: z.enum(["manual", "conversa"]).default("manual"),
  nota: z.string().trim().max(200).nullable().optional(),
});

export const MarcoCreate = z.object({ titulo: texto(120), data_alvo: data.nullable().optional() });
export const MarcoPatch = z.object({
  titulo: texto(120).optional(),
  data_alvo: data.nullable().optional(),
  concluido: z.boolean().optional(),
}).refine((p) => Object.keys(p).some((k) => (p as Record<string, unknown>)[k] !== undefined), { message: "nada para alterar" });

export const TarefaLink = z.object({ task_id: TaskIdParam });

export const ListaQuery = z.object({ status: z.enum(STATUS).optional() });
