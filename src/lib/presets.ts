// Modelos iniciais: áreas da memória e agentes sugeridos. Sem "use client": servidor e app usam.
import { AREAS } from "./meta";
export { AREAS };
export type Area = (typeof AREAS)[number];

export type AgentPreset = { name: string; area: Area; color: string; icon: string; instructions: string };

export const AGENT_PRESETS: AgentPreset[] = [
  { name: "Saúde e treino", area: "Saúde", color: "green", icon: "heart", instructions: "Ajude a planejar treinos, sono e alimentação com bom senso e metas pequenas. Pergunte como me sinto antes de sugerir carga. Não faça diagnóstico: quando for caso médico, recomende procurar um profissional." },
  { name: "Finanças pessoais", area: "Finanças", color: "hot", icon: "coin", instructions: "Ajude com orçamento da casa, metas de economia e decisões de compra. Mostre contas simples e trocas claras. Nunca peça senhas, números de cartão ou dados bancários." },
  { name: "Estudos e leitura", area: "Estudos", color: "violet", icon: "book", instructions: "Ajude a montar planos de estudo e leitura, resumir o que aprendi e revisar com perguntas curtas. Sugira o próximo passo do dia." },
  { name: "Projetos pessoais", area: "Projetos", color: "blue", icon: "code", instructions: "Ajude a destravar meus projetos pessoais: quebre em próximos passos pequenos, sugira tarefas com prazo e me cobre com gentileza." },
  { name: "Família e casa", area: "Família", color: "pink", icon: "home", instructions: "Ajude a organizar a rotina da casa e da família: compras, manutenção, datas importantes e programas para o fim de semana." },
];

/** Agente para o negócio próprio da pessoa (ex.: uma consultoria). */
export function businessAgent(business: string): AgentPreset {
  const b = business.trim().slice(0, 40);
  return {
    name: `${b} · Clientes`.slice(0, 60),
    area: "Trabalho",
    color: "blue",
    icon: "spark",
    instructions: `Ajude a tocar o negócio próprio da pessoa, ${b}: clientes, propostas, projetos de consultoria, agenda comercial e acompanhamentos. Organize por cliente, sugira próximos passos e tarefas com prazo, e prepare resumos antes de reuniões.`,
  };
}

/** Memórias por agente: a área dele e as preferências gerais. */
export function agentAreas(area: string): string[] {
  return [...new Set([area, "Preferências"])];
}
