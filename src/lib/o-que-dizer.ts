// "O que posso dizer aqui" (UX-7 · M5): frases de exemplo por tela, todas de ações que já existem
// (tarefas, eventos, gastos, metas, projetos, memórias, agentes, ajustes, navegação). Sem IA e sem custo.
import type { ViewId } from "./modules.ts";

export const SAY_HERE: Partial<Record<ViewId, string[]>> = {
  hoje: ["Como está meu dia?", "O que tenho mais tarde hoje?", "Me lembra às 18h de ligar para a mãe", "Adia a tarefa do relatório para amanhã"],
  conversa: ["Começa uma conversa nova", "Abre a conversa sobre a viagem", "Resume o que falamos", "Desfaz"],
  tarefas: ["Cria a tarefa comprar pão para amanhã", "Conclui a tarefa comprar pão", "Adia a tarefa do relatório para sexta", "Reabre a tarefa do relatório"],
  agenda: ["Marca dentista quinta às 10h", "Muda o dentista para as 11h", "Apaga o evento do dentista", "Como está minha agenda amanhã?"],
  financeiro: ["Gastei 50 reais no mercado", "Quanto gastei este mês?", "Paguei a conta de luz", "Define um teto de 800 reais para mercado"],
  metas: ["Quero correr 50 km este mês", "Corri 5 km hoje", "Como estou nas minhas metas?", "Pausa a meta de leitura"],
  projetos: ["Cria o projeto Reforma da varanda", "Liga a meta de corrida ao projeto Saúde", "Cria a tarefa pintar a parede no projeto Reforma", "Arquiva o projeto antigo"],
  memoria: ["O que você sabe sobre mim?", "Aprova a memória sobre o café", "Esquece que eu moro em Campinas"],
  agentes: ["Cria um agente para os estudos", "Muda as instruções do agente de estudos", "Define um teto de gasto para o agente de estudos", "Mostra o resumo dos agentes"],
  ajustes: ["Muda para o tema escuro", "Aumenta a letra", "Fala mais devagar", "Liga a conversa contínua"],
  perfil: ["Muda para o tema escuro", "Aumenta a letra", "Fala mais devagar"],
  modulos: ["Abre finanças", "Abre as metas", "Mostra o guia", "Abre o modo voz"],
  admin: ["Teve algum erro hoje?", "O que quebrou hoje?", "Mostra a saúde do sistema", "Abre a administração"],
  studio3d: ["Abre minha última peça", "Deixa o suporte 2 mm mais alto", "Arredonda as bordas da minha última peça"],
};

const GERAL = ["Como está meu dia?", "Abre finanças", "Mostra o guia"];

/** Frases desta tela (até 4), com o atalho "Desfaz" e a navegação sempre valendo. */
export function sayHere(view: ViewId): string[] {
  return (SAY_HERE[view] ?? GERAL).slice(0, 4);
}

/** "O que posso dizer aqui?", "o que eu posso falar nesta tela", "comandos de voz"… */
export function parseSayHelp(text: string): boolean {
  const t = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  return /^(gadu )?(o que|oque) (que )?(eu )?(posso|da pra|consigo|devo) (dizer|falar|pedir|fazer)( por voz)?( aqui| nesta tela| nessa tela| agora)?$/.test(t)
    || /^(gadu )?(quais sao os |me mostra os |mostra os )?comandos( de voz)?( daqui| desta tela| aqui)?$/.test(t);
}

/** Frase falada quando a pessoa pergunta por voz. */
export function sayHereSpoken(view: ViewId): string {
  const list = sayHere(view);
  return `Aqui você pode dizer, por exemplo: ${list.slice(0, 3).map((s) => `“${s}”`).join(", ")}.`;
}
