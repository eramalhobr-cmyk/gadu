import { z } from "zod";
import { ERRO_MAX, PEDIDO_MAX, SCAD_MAX } from "./limits.ts";
import { IMAGEM_DATAURL_MAX } from "./render-imagem.ts";

// Corpo de POST /api/3d/generate. `strict`: campo desconhecido (inclusive user_id ou custo) é recusado.
// novo: peça nova. refinar: ajuste sobre o código atual. corrigir: o OpenSCAD deu erro; a IA conserta.
export const GenerateBody = z.object({
  modo: z.enum(["novo", "refinar", "corrigir"]),
  pedido: z.string().trim().min(1, "Descreva a peça.").max(PEDIDO_MAX, `O pedido pode ter até ${PEDIDO_MAX} caracteres.`),
  scad: z.string().max(SCAD_MAX, "O código atual está grande demais.").optional(),
  erro: z.string().max(ERRO_MAX).optional(),
  // corrigir: "render" (padrão) = o OpenSCAD deu erro; "qualidade" = a peça montou, mas as checagens (partes soltas, parede, medidas) falharam.
  causa: z.enum(["render", "qualidade"]).optional(),
  // 3D-1b: render atual da peça (só no ajuste). O conteúdo é conferido na rota (lerImagem).
  imagem: z.string().max(IMAGEM_DATAURL_MAX, "A imagem da peça está grande demais.").optional(),
}).strict().superRefine((v, ctx) => {
  if (v.imagem !== undefined && v.modo !== "refinar") ctx.addIssue({ code: "custom", path: ["imagem"], message: "A imagem só vai junto de um ajuste." });
  if (v.modo !== "novo" && !v.scad?.trim()) ctx.addIssue({ code: "custom", path: ["scad"], message: "Faltou o código atual." });
  if (v.causa !== undefined && v.modo !== "corrigir") ctx.addIssue({ code: "custom", path: ["causa"], message: "A causa só vale na correção." });
  if (v.modo === "corrigir" && !v.erro?.trim()) ctx.addIssue({ code: "custom", path: ["erro"], message: "Faltou a mensagem de erro." });
});
export type GenerateInput = z.infer<typeof GenerateBody>;
