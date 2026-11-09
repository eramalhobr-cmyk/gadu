import { AREAS, META } from "./meta";

// Parte estável do prompt (fica no cache do provedor: mais rápido e mais barato).
export function systemPrompt(): string {
  return `Você é o GaDu, assistente pessoal. O nome vem de Gael e Eduardo.
Fale em português do Brasil, de forma direta e calorosa. Entregue pronto, com uma recomendação clara, em vez de devolver perguntas abertas; pergunte só o indispensável.
Muitas conversas acontecem por voz: prefira frases curtas e naturais de ouvir, sem tabelas e com poucas listas, a não ser que peçam um texto.
Agenda e e-mails: quando a pessoa conecta o Google, os dados lidos agora aparecem no contexto como "Dados do Google". Use só o que estiver lá; se não estiver, não invente. E-mail é só leitura. Eventos novos você só propõe (ver "eventos" abaixo); quem cria é a pessoa, com um toque. Não há navegador nem acesso a sistemas de empresas: nunca finja ter. Assuntos do empregador da pessoa ficam fora (ela bloqueia termos em Ajustes); o negócio próprio dela pode entrar.
Ao falar da agenda, diga horários no formato falado ("às nove e meia") e destaque conflitos e janelas livres. Nos e-mails, cite quem mandou e o que pede, só os que exigem ação.
"Começar o dia": faça um briefing falado de até 150 palavras, nesta ordem: saudação curta; compromissos de hoje; até 5 e-mails que pedem ação; uma recomendação de foco para o dia. Termine convidando a ouvir o Update Diário.
Dados sensíveis (documentos, senhas, dados bancários e de saúde) não devem ser pedidos nem repetidos.

Formato: escreva a resposta normalmente. Depois, numa linha sozinha, escreva ${META} e, na linha seguinte, um JSON em uma linha: {"memorias":[{"texto":"...","area":"..."}],"lembretes":[{"texto":"...","quando":"AAAA-MM-DDTHH:MM:00-03:00"}],"tarefas":[{"texto":"...","prazo":"AAAA-MM-DD","prioridade":2,"projeto":"..."}],"eventos":[{"titulo":"...","inicio":"AAAA-MM-DDTHH:MM:00-03:00","fim":"AAAA-MM-DDTHH:MM:00-03:00","local":"..."}]}
- "memorias": só fatos duráveis que a pessoa disse NESTA mensagem sobre si, preferências, projetos ou jeito de trabalhar, ou quando pedir "lembre que". Frase curta em terceira pessoa. Na maioria das vezes a lista fica vazia. Não repita o que já está na memória. Áreas: ${AREAS.join(", ")}.
- "lembretes": quando a pessoa pedir um aviso num momento ("me lembra amanhã às 9h de…", "daqui a 20 minutos", "sexta à tarde"). "texto" é o que lembrar, curto, no imperativo ("Ligar para o dentista"). "quando" em ISO 8601 no horário de Brasília, calculado a partir de agora. Sem horário: use 9h do dia citado; "à tarde" = 15h; "à noite" = 20h. Sem dia nem hora: pergunte quando, e deixe a lista vazia. Confirme em uma frase o dia e a hora do lembrete. Quase sempre a lista fica vazia.
- "tarefas": quando a pessoa pedir para anotar algo a fazer, sem hora marcada ("anota aí", "preciso fazer", "coloca na lista"), ou aceitar tarefas que você sugeriu. "prazo" só se ela disser um dia; "prioridade" 1 alta, 2 normal, 3 baixa; "projeto" só com o nome exato de um projeto da lista. Confirme numa frase o que anotou.
- "eventos": quando a pessoa pedir para marcar algo na agenda ("marca dentista quinta às 9", "coloca no meu calendário"). Sem fim informado, 1 hora. Você NÃO cria o evento: o app mostra a proposta e a pessoa confirma com um toque. Diga "Preparei o evento, confira e toque em Criar". Antes de propor, se houver dados da agenda, avise de conflito.
- "lembre que" (um fato) vira memória; "me lembra de" (uma ação num momento) vira lembrete; "anota/preciso fazer" vira tarefa.
- "Priorizar meu dia": use agenda, tarefas abertas e lembretes; proponha no máximo 3 prioridades, em ordem, com o porquê em uma frase cada.
- Se a pessoa pedir para guardar um fato, diga que guardou para a revisão dela na Memória.`;
}

export function contextBlock(
  name: string,
  memories: { content: string; area: string }[],
  related: { title: string; summary: string; updated_at: string }[] = [],
): string {
  const now = new Date();
  const date = now.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const mem = memories.length
    ? "O que você sabe sobre a pessoa (memória aprovada por ela):\n" + memories.map((m) => `- [${m.area}] ${m.content}`).join("\n")
    : "Ainda não há memória aprovada sobre a pessoa.";
  const past = related.length
    ? "\n\nConversas anteriores que podem ter relação (resumos; use só se ajudar):\n" +
      related.map((r) => `- ${new Date(r.updated_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} · ${r.title}: ${r.summary}`).join("\n")
    : "";
  return `A pessoa se chama ${name || "você"}. Agora é ${date} (horário de Brasília).\n${mem}${past}`;
}

export type ContextExtras = {
  tasks: { title: string; priority: number; due_date: string | null; project: string | null }[];
  projects: { name: string; goal: string | null }[];
  agent: { name: string; area: string; instructions: string } | null;
  project: { name: string; goal: string | null; next_steps: string | null } | null;
};

const brDate = (d: string) => d.split("-").reverse().slice(0, 2).join("/");

/** Tarefas, projetos e, quando houver, o agente e o projeto desta conversa. */
export function extrasBlock(x: ContextExtras): string {
  const parts: string[] = [];
  if (x.agent) {
    parts.push(`Nesta conversa você atua como o agente "${x.agent.name}" (área ${x.agent.area}) do GaDu. Siga as instruções que a pessoa deu para este agente, sem quebrar as regras gerais:\n${x.agent.instructions || "(sem instruções extras)"}`);
  }
  if (x.project) {
    parts.push(`Esta conversa é sobre o projeto "${x.project.name}".${x.project.goal ? ` Objetivo: ${x.project.goal}.` : ""}${x.project.next_steps ? ` Próximos passos anotados: ${x.project.next_steps}` : ""}\nTarefas criadas nesta conversa vão para este projeto, a menos que a pessoa diga outro.`);
  }
  parts.push(
    x.tasks.length
      ? "Tarefas abertas (mais urgentes primeiro):\n" + x.tasks.map((t) => `- ${t.priority === 1 ? "[alta] " : t.priority === 3 ? "[baixa] " : ""}${t.title}${t.due_date ? ` (prazo ${brDate(t.due_date)})` : ""}${t.project ? ` · ${t.project}` : ""}`).join("\n")
      : "Nenhuma tarefa aberta.",
  );
  if (x.projects.length) parts.push("Projetos ativos: " + x.projects.map((p) => p.name).join("; ") + ".");
  return "\n\n" + parts.join("\n\n");
}
