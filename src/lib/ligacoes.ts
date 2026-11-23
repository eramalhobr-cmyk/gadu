// Ligações entre módulos (UX-7): quais metas estão ligadas a cada tarefa e a cada projeto, para mostrar no item.
// Só leitura e só dados da sessão (RLS); a ligação em si é feita pela tela da meta ou pela voz (`meta_tarefa`, `meta_projeto`).

export type GoalRef = { id: string; titulo: string; status: string };
export type GoalLink = { goal_id: string; item: number };

/** Junta os vínculos com as metas: item → títulos das metas ativas ou pausadas, em ordem alfabética, sem repetir. */
export function goalsByItem(links: GoalLink[], goals: GoalRef[]): Map<number, string[]> {
  const live = new Map(goals.filter((g) => g.status === "ativa" || g.status === "pausada").map((g) => [g.id, g.titulo.trim()]));
  const out = new Map<number, string[]>();
  for (const l of links) {
    const t = live.get(l.goal_id);
    if (!t) continue;
    const list = out.get(l.item) ?? [];
    if (!list.includes(t)) list.push(t);
    out.set(l.item, list);
  }
  for (const list of out.values()) list.sort((a, b) => a.localeCompare(b, "pt-BR"));
  return out;
}

/** Texto curto do chip: uma meta pelo nome; várias, a primeira e "+N". */
export function goalChip(titles: string[], max = 28): string {
  if (!titles.length) return "";
  const first = titles[0].length > max ? `${titles[0].slice(0, max - 1).trimEnd()}…` : titles[0];
  return titles.length > 1 ? `${first} +${titles.length - 1}` : first;
}

/** As ligações do GaDu, para o mapa do Guia: de onde, para onde, o que significa e o que dizer. */
export type MapLink = { from: string; to: string; what: string; say: string };
export const MAP_LINKS: MapLink[] = [
  { from: "Metas", to: "Projetos", what: "Um projeto pode servir a uma meta; o progresso aparece na meta.", say: "Liga a meta de corrida ao projeto Saúde" },
  { from: "Metas", to: "Tarefas", what: "Tarefas criadas na meta contam para o progresso dela.", say: "Cria a tarefa comprar tênis na meta de corrida" },
  { from: "Metas", to: "Agenda", what: "Horários reservados para a meta entram na sua agenda do Google.", say: "Reserva três horários esta semana para a meta de corrida" },
  { from: "Projetos", to: "Tarefas", what: "Cada tarefa pode pertencer a um projeto.", say: "Anota no projeto reforma: comprar tinta" },
  { from: "Tarefas", to: "Hoje", what: "As atrasadas e as de hoje aparecem no Hoje.", say: "Quais tarefas estão atrasadas?" },
  { from: "Agenda", to: "Hoje", what: "O próximo compromisso fica no topo do Hoje.", say: "Como está minha agenda amanhã?" },
  { from: "Financeiro", to: "Hoje", what: "Contas a vencer e tetos perto do limite avisam no Hoje.", say: "Quanto gastei com restaurante este mês?" },
  { from: "Agentes", to: "Conversa", what: "Cada agente é uma conversa com instruções e ferramentas próprias.", say: "Cria um agente para os estudos" },
  { from: "Memória", to: "Conversa", what: "O que você aprovou em Memória o GaDu usa em toda conversa.", say: "O que você sabe sobre mim?" },
];
