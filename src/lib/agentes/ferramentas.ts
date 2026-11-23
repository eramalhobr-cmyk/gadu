// Agentes com ferramentas permitidas e teto de gasto próprios. Puro: sem rede nem banco.
// Ferramenta = o que o agente pode LER no contexto e PROPOR como ação. O padrão (todas) mantém o comportamento de antes.
// O teto do agente é uma checagem a mais, antes da reserva do orçamento: o teto do mês da pessoa e o global continuam valendo.
import type { AcaoProposta } from "../acoes.ts";

export const FERRAMENTAS = ["agenda", "email", "tarefas", "lembretes", "financas", "metas", "memoria", "acoes"] as const;
export type Ferramenta = (typeof FERRAMENTAS)[number];
export const FERRAMENTA_NOME: Record<Ferramenta, string> = {
  agenda: "Agenda", email: "E-mails", tarefas: "Tarefas e projetos", lembretes: "Lembretes", financas: "Finanças", metas: "Metas", memoria: "Memória", acoes: "Propor ações",
};
export const TETO_MAX_USD = 100;

export type AgenteLimites = { id: number; nome: string; ferramentas: Ferramenta[]; teto: number | null };

/** Lista do banco → só ferramentas conhecidas, sem repetir. Vazia ou inválida = nenhuma. */
export function ferramentasDe(v: unknown): Ferramenta[] {
  if (!Array.isArray(v)) return [...FERRAMENTAS];
  return FERRAMENTAS.filter((f) => v.includes(f));
}

/** Sem agente, tudo vale. Com agente, só as ferramentas dele. */
export const pode = (ag: AgenteLimites | null, f: Ferramenta) => !ag || ag.ferramentas.includes(f);

/** Que ferramenta cada ação precisa (além de "acoes", que liga ou desliga todas as propostas do agente). null = navegação, sempre vale. */
export function ferramentaDaAcao(tipo: AcaoProposta["tipo"]): Ferramenta | null {
  if (tipo.startsWith("meta_")) return tipo === "meta_agenda" ? "agenda" : "metas";
  if (tipo.startsWith("tarefa_") || tipo.startsWith("projeto_")) return "tarefas";
  if (tipo.startsWith("lembrete_")) return "lembretes";
  if (tipo.startsWith("evento_")) return "agenda";
  if (tipo.startsWith("memoria_")) return "memoria";
  if (tipo.startsWith("conta_") || tipo.startsWith("gasto_") || tipo === "receita_principal" || tipo === "teto_definir" || tipo === "salario_simular") return "financas";
  if (tipo === "nova_conversa" || tipo === "conversa_abrir" || tipo === "guia" || tipo === "navegar" || tipo === "peca3d_abrir") return null;
  return "acoes"; // agente_criar/editar, ajuste, percepcao: só com "Propor ações"
}

/** Ações que o agente pode propor: sem "acoes", só navegação; com "acoes", as que têm a ferramenta. */
export function acoesPermitidas<T extends { tipo: AcaoProposta["tipo"] }>(ag: AgenteLimites | null, lista: T[]): T[] {
  if (!ag) return lista;
  return lista.filter((a) => {
    const f = ferramentaDaAcao(a.tipo);
    if (f === null) return true;
    return ag.ferramentas.includes("acoes") && ag.ferramentas.includes(f);
  });
}

/** Linha para o modelo saber o que o agente não pode usar (o servidor também filtra; isto só evita propostas perdidas). */
export function avisoFerramentas(ag: AgenteLimites | null): string {
  if (!ag) return "";
  const fora = FERRAMENTAS.filter((f) => !ag.ferramentas.includes(f));
  if (!fora.length) return "";
  return `\n\nFerramentas do agente ${ag.nome}: NÃO use nem proponha nada de ${fora.map((f) => FERRAMENTA_NOME[f]).join(", ")}. Se a pessoa pedir, diga que este agente não tem essa ferramenta e que dá para liberar em Agentes.`;
}

/** Mês atual em Brasília, como o banco guarda (dia 1). */
export function mesSP(now = Date.now()): string {
  return new Date(now - 3 * 3_600_000).toISOString().slice(0, 8) + "01";
}

/** O teto do agente foi atingido? (sem teto próprio, nunca) */
export const tetoAtingido = (ag: AgenteLimites | null, gastoMes: number) => Boolean(ag && ag.teto !== null && gastoMes >= ag.teto);
