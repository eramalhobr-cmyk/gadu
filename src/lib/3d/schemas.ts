import { z } from "zod";
import { ERRO_MAX, PEDIDO_MAX, SCAD_MAX } from "./limits.ts";

// Corpo de POST /api/3d/generate. `strict`: campo desconhecido (inclusive user_id ou custo) é recusado.
// novo: peça nova. refinar: ajuste sobre o código atual. corrigir: o OpenSCAD deu erro; a IA conserta.
export const GenerateBody = z.object({
  modo: z.enum(["novo", "refinar", "corrigir"]),
  pedido: z.string().trim().min(1, "Descreva a peça.").max(PEDIDO_MAX, `O pedido pode ter até ${PEDIDO_MAX} caracteres.`),
  scad: z.string().max(SCAD_MAX, "O código atual está grande demais.").optional(),
  erro: z.string().max(ERRO_MAX).optional(),
}).strict().superRefine((v, ctx) => {
  if (v.modo !== "novo" && !v.scad?.trim()) ctx.addIssue({ code: "custom", path: ["scad"], message: "Faltou o código atual." });
  if (v.modo === "corrigir" && !v.erro?.trim()) ctx.addIssue({ code: "custom", path: ["erro"], message: "Faltou a mensagem de erro." });
});
export type GenerateInput = z.infer<typeof GenerateBody>;
