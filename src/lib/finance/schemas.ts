// Validação (zod) das rotas de Finanças. Objetos NÃO são estritos de propósito: chaves desconhecidas (inclusive user_id)
// são descartadas e nunca chegam ao banco; o user_id vem sempre da sessão.
import { z } from "zod";
import { diasNoMes } from "./datas.ts";
import { parseValor } from "./money.ts";

const uuid = z.string().uuid();
const texto = (max: number) => z.string().trim().min(1).max(max);
const valorSchema = z.union([z.number(), z.string()]).transform((v, ctx) => {
  const n = parseValor(v);
  if (n === null) { ctx.addIssue({ code: "custom", message: "valor inválido" }); return z.NEVER; }
  return n;
});
const dia = z.number().int().min(1).max(31);
const ano = z.number().int().min(2000).max(2100);
const mes = z.number().int().min(1).max(12);

export const MesQuery = z.object({ ano: z.coerce.number().int().min(2000).max(2100), mes: z.coerce.number().int().min(1).max(12) });

export const MEIO = z.enum(["debito", "pix", "credito", "reserva"]);
export const ORIGEM = z.enum(["manual", "conversa", "voz", "print", "extrato"]);

export const GastoCreate = z.object({
  ano, mes, dia, valor: valorSchema,
  categoria: texto(40).default("Outros"),
  descricao: z.string().trim().max(200).default(""),
  meio: MEIO.default("debito"),
  origem: ORIGEM.default("manual"),
}).refine((g) => g.dia <= diasNoMes({ ano: g.ano, mes: g.mes }), { message: "dia inexistente neste mês", path: ["dia"] });

export const GastoPatch = z.object({
  ano: ano.optional(), mes: mes.optional(), dia: dia.optional(), valor: valorSchema.optional(),
  categoria: texto(40).optional(), descricao: z.string().trim().max(200).optional(), meio: MEIO.optional(),
}).refine((p) => Object.keys(p).some((k) => (p as Record<string, unknown>)[k] !== undefined), { message: "nada para alterar" });

const ItemBase = {
  tipo: z.enum(["despesa", "receita"]),
  grupo: texto(40),
  nome: texto(80),
  nota: z.string().trim().max(300).nullable(),
  ordem: z.number().int().min(-100000).max(100000),
  dia: dia.nullable(),
  dia_estimado: z.boolean(),
  movivel: z.boolean(),
  nao_caixa: z.boolean(),
  cartao_id: uuid.nullable(),
  segue_id: uuid.nullable(),
};

export const ItemCreate = z.object({
  tipo: ItemBase.tipo,
  nome: ItemBase.nome,
  grupo: ItemBase.grupo.default("Geral"),
  nota: ItemBase.nota.optional(),
  ordem: ItemBase.ordem.default(0),
  dia: ItemBase.dia.optional(),
  dia_estimado: ItemBase.dia_estimado.default(false),
  movivel: ItemBase.movivel.default(false),
  nao_caixa: ItemBase.nao_caixa.default(false),
  cartao_id: ItemBase.cartao_id.optional(),
  segue_id: ItemBase.segue_id.optional(),
  /** Valor do mês de abertura (opcional). */
  inicial: z.object({ ano, mes, valor: valorSchema, escopo: z.enum(["mes", "proximos"]).default("mes") }).optional(),
});

export const ItemPatch = z.object({
  nome: ItemBase.nome.optional(), grupo: ItemBase.grupo.optional(), nota: ItemBase.nota.optional(), ordem: ItemBase.ordem.optional(),
  dia: ItemBase.dia.optional(), dia_estimado: ItemBase.dia_estimado.optional(), movivel: ItemBase.movivel.optional(), nao_caixa: ItemBase.nao_caixa.optional(),
  cartao_id: ItemBase.cartao_id.optional(), segue_id: ItemBase.segue_id.optional(),
}).refine((p) => Object.keys(p).some((k) => (p as Record<string, unknown>)[k] !== undefined), { message: "nada para alterar" });

/** Valor e/ou estado de um item em um mês. `valor: 0` remove o item daquele mês. "proximos" vale do mês até dezembro do mesmo ano (só para o valor). */
export const ItemMesBody = z.object({
  ano, mes,
  valor: z.union([z.literal(0), valorSchema]).optional(),
  pago: z.boolean().optional(),
  via_reserva: z.boolean().optional(),
  nota: z.string().trim().max(300).nullable().optional(),
  escopo: z.enum(["mes", "proximos"]).default("mes"),
}).refine((b) => b.valor !== undefined || b.pago !== undefined || b.via_reserva !== undefined || b.nota !== undefined, { message: "nada para alterar" });

export const ConfigBody = z.object({
  dia_adiantamento: dia.optional(),
  dia_restante: dia.optional(),
  adiantamento_pct: z.number().min(0).max(100).optional(),
  receita_principal_id: uuid.nullable().optional(),
  cartao_principal_id: uuid.nullable().optional(),
}).refine((p) => Object.keys(p).some((k) => (p as Record<string, unknown>)[k] !== undefined), { message: "nada para alterar" });

export const IdParam = uuid;
