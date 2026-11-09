// Dicas da primeira visita a cada parte do app. Ficam marcadas no perfil (valem em qualquer aparelho).
export const TIPS = {
  hoje: {
    title: "Este é o seu dia, num lugar só",
    text: "Toque em Começar o dia para ouvir um resumo da agenda, dos e-mails e das tarefas. O botão redondo no canto de baixo fala com o GaDu de qualquer tela.",
  },
  conversa: {
    title: "Fale como falaria com uma pessoa",
    text: "Experimente: “me lembra amanhã às 9 de ligar para o banco”, “anota aí: comprar presente”, “marca dentista quinta às 10”. Tudo o que o GaDu propõe só vale depois que você aprova.",
  },
  projetos: {
    title: "Tarefas e projetos",
    text: "Em Tarefas fica tudo o que você precisa fazer. Em Projetos, junte objetivo, próximos passos e tarefas. Dentro de um projeto, toque em Conversar sobre o projeto.",
  },
  agentes: {
    title: "Agentes são o GaDu especializado",
    text: "Um para a saúde, outro para as finanças, outro para o seu negócio. Cada um usa só as memórias da sua área. Toque em Adicionar sugeridos para começar.",
  },
  perfil: {
    title: "O que o GaDu sabe e como ele funciona",
    text: "Em Memória você revisa, aprova ou apaga o que o GaDu lembra. Em Ajustes ficam as notificações, a conexão com o Google, a voz e os limites de gasto.",
  },
  voz: {
    title: "Voz em qualquer tela",
    text: "Toque, fale e solte. A resposta aparece aqui mesmo, sem sair da tela. Para ver a conversa inteira, toque em Abrir conversa.",
  },
} as const;
export type TipId = keyof typeof TIPS;
export const TIP_IDS = Object.keys(TIPS) as TipId[];
