// Contrato de contexto do Assistente Universal.
// O app informa em que módulo e tela a pessoa está; o servidor valida e usa só para orientar a resposta.
//
// Limites deste contrato (decisão oficial):
// - O contexto é um RÓTULO (módulo e tela). Ele nunca carrega dados nem identifica organização ou cliente.
// - Os dados continuam vindo só do que a própria pessoa pode ler (RLS por user_id).
// - Cruzar informações entre módulos, organizações ou clientes depende da arquitetura de isolamento e da
//   auditoria de segurança do Agent Office. Até lá, `scopes` é sempre ["pessoal"].
import { z } from "zod";
import { MODULES, moduleOf, viewDef, VIEW_IDS, type ModuleId, type ViewId } from "./modules.ts";

export type AssistantScope = "pessoal";
export type AssistantContext = { module: ModuleId; view: ViewId };

const MODULE_IDS = MODULES.map((m) => m.id) as [ModuleId, ...ModuleId[]];
export const AssistantContextSchema = z
  .object({ module: z.enum(MODULE_IDS), view: z.enum(VIEW_IDS as [ViewId, ...ViewId[]]) })
  .strict()
  // A tela precisa pertencer ao módulo informado: evita rótulos incoerentes.
  .refine((c) => moduleOf(c.view).id === c.module);

export function contextOf(view: ViewId): AssistantContext {
  return { module: moduleOf(view).id, view };
}

/** Escopos de dados que o assistente pode usar neste contexto. Hoje, sempre só os dados pessoais de quem pergunta. */
export function scopesFor(_ctx: AssistantContext): AssistantScope[] {
  return ["pessoal"];
}

/** Linha curta para o modelo saber onde a pessoa está. Só texto fixo do app, nada digitado pela pessoa. */
export function contextLine(ctx: AssistantContext): string {
  const m = moduleOf(ctx.view);
  const v = viewDef(ctx.view);
  const status = m.status === "planejado" ? " Este módulo ainda está planejado: não existe no app e não tem dados. Se perguntarem, diga isso com clareza."
    : m.status === "parcial" ? " Este módulo está parcial: só os agentes existem." : "";
  return `\n\nTela atual da pessoa no app: módulo ${m.name}, tela ${v.label}.${status}`;
}

export function contextLabel(ctx: AssistantContext): string {
  return `${moduleOf(ctx.view).name} › ${viewDef(ctx.view).label}`;
}
