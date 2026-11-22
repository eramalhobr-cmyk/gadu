// Dicas da primeira visita a cada parte do app. Ficam marcadas no perfil (valem em qualquer aparelho).
export const TIPS = {
  hoje: {
    title: "Este é o seu dia, num lugar só",
    text: "No topo fica o que importa agora. Toque no microfone, no centro da barra de baixo, para falar com o GaDu de qualquer tela. Em Mais fica todo o resto.",
  },
  conversa: {
    title: "Fale como falaria com uma pessoa",
    text: "Experimente: “me lembra amanhã às 9 de ligar para o banco”, “anota aí: comprar presente”, “marca dentista quinta às 10”. Tudo o que o GaDu propõe só vale depois que você aprova.",
  },
  tarefas: {
    title: "Tudo o que você precisa fazer",
    text: "As tarefas ficam agrupadas: atrasadas, hoje, próximas e sem prazo. Escreva no campo ou diga ao GaDu “anota aí: …”. Tarefas de um projeto aparecem aqui também.",
  },
  projetos: {
    title: "Projetos juntam o que é maior",
    text: "Um projeto tem objetivo, próximos passos e tarefas. Abra um projeto e toque em Conversar para o GaDu ajudar com o contexto dele.",
  },
  agentes: {
    title: "Agentes são o GaDu especializado",
    text: "Um para a saúde, outro para as finanças, outro para o seu negócio. Cada um usa só as memórias da sua área. Toque em Adicionar sugeridos para começar.",
  },
  perfil: {
    title: "O que o GaDu sabe e como ele funciona",
    text: "Em Memória você revisa, aprova ou apaga o que o GaDu lembra. Em Configurações ficam a voz, as notificações, a conexão com o Google e os limites de gasto.",
  },
  voz: {
    title: "Voz em qualquer tela",
    text: "Toque no microfone e fale. O texto aparece no campo para você revisar antes de enviar. Para ver a conversa inteira, toque em Abrir a conversa completa.",
  },
} as const;
export type TipId = keyof typeof TIPS;
export const TIP_IDS = Object.keys(TIPS) as TipId[];
