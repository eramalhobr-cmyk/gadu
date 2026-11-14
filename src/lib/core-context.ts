// Core Contextual: TIPOS da etapa futura (docs/CORE_CONTEXTUAL.md). Sem uso em produção.
// Servem de contrato para a próxima etapa. Hoje o assistente usa só src/lib/assistant-context.ts.
import type { AssistantContext } from "./assistant-context.ts";
import type { ModuleId } from "./modules.ts";

/** Escopo de dados resolvido NO SERVIDOR a partir da sessão e de vínculos no banco. Nunca vem do cliente. */
export type CoreScope =
  | { kind: "pessoal"; userId: string }
  | { kind: "organizacao"; orgId: string; role: "dono" | "admin" | "membro" | "leitor" }
  | { kind: "cliente"; orgId: string; clientId: string };

/** Fato levado ao modelo, sempre com a origem para a resposta poder citar. */
export type CoreFact = {
  module: ModuleId;
  source: { table: string; id: string | number };
  scope: CoreScope["kind"];
  text: string;
};

/** Pedido ao Core: a identidade vem da sessão; a pista de tela só ajuda a priorizar. */
export type CoreRequest = {
  userId: string;
  hint: AssistantContext | null;
  scopes: CoreScope[];
  maxFacts: number;
};

/** Ação proposta pelo modelo: nada executa sem aprovação. */
export type CoreAction = {
  module: ModuleId;
  kind: string;
  scope: CoreScope;
  requires: "pessoa" | "papel";
  status: "proposta" | "aprovada" | "recusada" | "executada";
};

/** Registro de auditoria: quem pediu, o que foi usado e o que foi aprovado. Sem conteúdo sensível. */
export type CoreAudit = {
  at: string;
  userId: string;
  scopes: CoreScope["kind"][];
  sources: CoreFact["source"][];
  actions: Pick<CoreAction, "module" | "kind" | "status">[];
};
