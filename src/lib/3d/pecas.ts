import { z } from "zod";
import { PEDIDO_MAX, SCAD_MAX } from "./limits.ts";

// Peças e versões salvas do 3D Studio (tabelas pecas_3d e pecas_3d_versoes). `strict`: user_id no corpo é recusado.
export const PECAS_LISTA_MAX = 20;
export const VERSOES_MAX = 30;

const Valor = z.union([z.number().finite(), z.boolean(), z.string().max(200)]);
export const Valores = z.record(z.string().min(1).max(60), Valor).refine((v) => Object.keys(v).length <= 60, "Controles demais.");
const Modo = z.enum(["novo", "refinar", "corrigir"]);
const Scad = z.string().trim().min(1, "Faltou o código.").max(SCAD_MAX, "O código está grande demais.");
const Pedido = z.string().trim().max(PEDIDO_MAX);

export const PecaCreate = z.object({ pedido: Pedido.min(1, "Faltou o pedido."), scad: Scad, valores: Valores.optional() }).strict();
export const PecaPatch = z.object({ valores: Valores.optional(), titulo: z.string().trim().min(1).max(120).optional() }).strict()
  .refine((v) => v.valores !== undefined || v.titulo !== undefined, "Nada para mudar.");
export const VersaoCreate = z.object({ modo: Modo, pedido: Pedido.optional(), scad: Scad }).strict();
export const PecaId = z.string().uuid();

/** Título curto da peça a partir do pedido: primeira frase, sem "Um/Uma" no começo, até 60 caracteres. */
export function tituloDe(pedido: string): string {
  const t = pedido.trim().split(/[.\n!?]/)[0]!.replace(/^(um|uma|o|a)\s+/i, "").trim();
  const s = (t || pedido.trim()).slice(0, 60).trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Peça";
}
