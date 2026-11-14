// Arquitetura de módulos do GaDu (UX v2.2). Fonte única para menu, painel, home e assistente.
// Regra: um módulo só aparece como "disponível" quando existe e funciona; o resto mostra o status real.

export type ModuleId = "pessoal" | "metas" | "financeiro" | "casa" | "office" | "studio" | "studio3d" | "plataforma";
export type ModuleStatus = "disponivel" | "parcial" | "desenvolvimento" | "planejado";
export type ViewId = "hoje" | "modulos" | "conversa" | "tarefas" | "agenda" | "projetos" | "memoria" | "metas" | "financeiro" | "casa" | "agentes" | "office" | "studio" | "studio3d" | "integracoes" | "ajustes" | "perfil" | "admin";

export type ViewDef = { id: ViewId; label: string; icon: string; adminOnly?: boolean; /** Aparece no topo do menu, fora dos grupos ("Início"). */ home?: boolean; /** Tela de navegação (não aparece nos grupos). */ hub?: boolean };
export type ModuleDef = {
  id: ModuleId;
  name: string;
  tagline: string;
  icon: string;
  color: string;
  status: ModuleStatus;
  views: ViewDef[];
  /** O que já funciona hoje (só o que existe de verdade). */
  available: string[];
  /** O que está no plano e ainda não existe. */
  planned: string[];
  /** Do que o módulo depende para sair do plano. */
  needs: string[];
  /** Nome de identidade, quando existe (ex.: "GaDu Casa"). */
  brand?: string;
  /** Documento técnico do módulo. */
  doc?: string;
};

export const STATUS_LABEL: Record<ModuleStatus, string> = { disponivel: "Disponível", parcial: "Beta", desenvolvimento: "Em desenvolvimento", planejado: "Planejado" };

export const MODULES: ModuleDef[] = [
  {
    id: "pessoal", name: "Pessoal", tagline: "Seu dia, sua agenda, suas tarefas e a sua memória.", icon: "sun", color: "sig", status: "disponivel",
    views: [
      { id: "hoje", label: "Hoje", icon: "sun", home: true },
      { id: "modulos", label: "Módulos", icon: "grid", hub: true },
      { id: "conversa", label: "Conversas", icon: "chat" },
      { id: "tarefas", label: "Tarefas", icon: "check" },
      { id: "agenda", label: "Agenda", icon: "calendar" },
      { id: "projetos", label: "Projetos", icon: "folder" },
      { id: "memoria", label: "Memórias", icon: "book" },
    ],
    available: ["Conversa por voz e texto", "Agenda e e-mails do Google (leitura)", "Tarefas, projetos e lembretes", "Memória com a sua aprovação", "Briefing da manhã e revisão da noite"],
    planned: ["Rascunhos de e-mail com aprovação", "Voz natural e conversa contínua"],
    needs: [],
  },
  {
    id: "metas", name: "Metas & Conquistas", tagline: "Objetivos de vida transformados em planos, com acompanhamento.", icon: "target", color: "hot", status: "planejado",
    views: [{ id: "metas", label: "Metas & Conquistas", icon: "target" }],
    available: [],
    planned: ["Metas financeiras, familiares, profissionais, de saúde, estudo e desenvolvimento pessoal", "Marcos, indicadores, prazo e progresso real", "Plano executável: metas ligadas a tarefas, projetos e agenda", "O GaDu avisa atrasos e propõe ajustes", "Metas compartilhadas só com autorização de cada pessoa"],
    needs: ["Especificação do módulo (docs/METAS_CONQUISTAS.md)", "Tabelas próprias, isoladas por pessoa", "Core Contextual para ligar metas a outros módulos", "Dados de saúde só por conector autorizado (docs/INTEGRACOES_SAUDE.md)"],
    doc: "docs/METAS_CONQUISTAS.md",
  },
  {
    id: "financeiro", name: "Financeiro", tagline: "Controle do mês pela conversa: lançar, classificar e prever o caixa.", icon: "coin", color: "green", status: "planejado",
    views: [{ id: "financeiro", label: "Financeiro", icon: "coin" }],
    available: [],
    planned: ["Contas, cartões e gastos do dia a dia", "Lançar por voz, texto, print ou extrato", "Previsão de caixa e teto por categoria", "Plano, reserva e simulador"],
    needs: ["Especificação em revisão", "Tabelas próprias, isoladas por pessoa"],
  },
  {
    id: "casa", name: "Casa Inteligente", brand: "GaDu Casa", tagline: "Sua casa conectada, por voz e texto, com segurança.", icon: "home", color: "blue", status: "planejado",
    views: [{ id: "casa", label: "Casa Inteligente", icon: "home" }],
    available: [],
    planned: ["Residências e ambientes", "Luzes, tomadas, climatização e outros dispositivos", "Cenas, rotinas e automação por horário ou condição", "Estado dos dispositivos e histórico de comandos", "Controle por voz e texto pelo GaDu"],
    needs: ["Pesquisa de integrações: Home Assistant, Tuya e Smart Life, Alexa (docs/CASA_INTELIGENTE.md)", "Credenciais só no servidor, cifradas", "Confirmação para ações sensíveis; regras próprias para fechaduras, alarmes e portões", "Tabelas por residência, com acesso por pessoa ou grupo autorizado"],
    doc: "docs/CASA_INTELIGENTE.md",
  },
  {
    id: "office", name: "Agent Office", tagline: "Agentes especializados trabalhando para você, com aprovação.", icon: "agents", color: "violet", status: "parcial",
    views: [
      { id: "agentes", label: "Agentes", icon: "agents" },
      { id: "office", label: "Equipes e delegações", icon: "grid" },
    ],
    available: ["Agentes por área, com instruções e memória própria", "Conversar com um agente"],
    planned: ["Espaços Pessoal e Trabalho", "Organizações e clientes, com isolamento rigoroso", "Delegação entre agentes e caixa de aprovações", "Teto de gasto por agente"],
    needs: ["Arquitetura de isolamento por organização e cliente", "Auditoria de segurança"],
  },
  {
    id: "studio", name: "Agent Office Studio", tagline: "Agentes que criam sites, aplicações web e PWAs.", icon: "code", color: "blue", status: "planejado",
    views: [{ id: "studio", label: "Agent Office Studio", icon: "code" }],
    available: [],
    planned: ["Criação de sites e páginas", "Aplicações web e PWAs", "Revisão e publicação com a sua aprovação"],
    needs: ["Agent Office", "Ambiente isolado para executar código", "Sem aplicativos nativos Android/iOS nesta fase"],
  },
  {
    id: "studio3d", name: "3D Studio", tagline: "Encontrar, organizar e gerar modelos para impressão 3D.", icon: "cube", color: "hot", status: "planejado",
    views: [{ id: "studio3d", label: "3D Studio", icon: "cube" }],
    available: [],
    planned: ["Busca de modelos gratuitos, respeitando licenças", "Biblioteca de modelos", "Geração de modelos realmente imprimíveis", "Exportação para o fatiador"],
    needs: ["Especificação do módulo"],
  },
  {
    id: "plataforma", name: "Plataforma", tagline: "Perfil, aparência, conexões, custos e segurança.", icon: "gear", color: "pink", status: "disponivel",
    views: [
      { id: "integracoes", label: "Integrações", icon: "link" },
      { id: "ajustes", label: "Configurações", icon: "gear" },
      { id: "perfil", label: "Perfil", icon: "user" },
      { id: "admin", label: "Administração", icon: "lock", adminOnly: true },
    ],
    available: ["Perfil e aparência (tema claro e escuro)", "Conexões (Google) e notificações", "Gasto de IA, teto e reservas", "Privacidade: termos bloqueados"],
    planned: ["Créditos e consumo por pessoa", "Alertas de erro"],
    needs: [],
  },
];

/** Áreas do produto: organizam a tela Módulos e o menu, sem lista enorme. */
export type AreaDef = { id: string; name: string; text: string; modules: ModuleId[] };
export const AREAS: AreaDef[] = [
  { id: "produtividade", name: "Produtividade pessoal", text: "Seu dia, conversas, tarefas, agenda, projetos e memória.", modules: ["pessoal"] },
  { id: "vida", name: "Vida pessoal", text: "Metas, dinheiro e casa.", modules: ["metas", "financeiro", "casa"] },
  { id: "criacao", name: "Agentes e criação", text: "Agentes, sites e aplicações, modelos 3D.", modules: ["office", "studio", "studio3d"] },
  { id: "plataforma", name: "Plataforma", text: "Conta, aparência, conexões e custos.", modules: ["plataforma"] },
];
export function moduleById(id: ModuleId): ModuleDef {
  return MODULES.find((m) => m.id === id) ?? MODULES[0];
}

export const VIEW_IDS: ViewId[] = MODULES.flatMap((m) => m.views.map((v) => v.id));

export function moduleOf(view: ViewId): ModuleDef {
  return MODULES.find((m) => m.views.some((v) => v.id === view)) ?? MODULES[0];
}
export function viewDef(view: ViewId): ViewDef {
  return moduleOf(view).views.find((v) => v.id === view) ?? MODULES[0].views[0];
}
/** Telas que só descrevem um módulo (planejado ou parcial); não têm dados nem ações. */
export function isOverview(view: ViewId): boolean {
  return view === "metas" || view === "financeiro" || view === "casa" || view === "office" || view === "studio" || view === "studio3d";
}
/** Converte ?tab= em tela. Endereços antigos continuam válidos; admin só para quem pode. */
export function parseView(tab: string | undefined, admin: boolean): ViewId | null {
  if (!tab) return null;
  if (tab === "memorias") return "memoria";
  if (tab === "admin") return admin ? "admin" : "ajustes";
  return (VIEW_IDS as string[]).includes(tab) ? (tab as ViewId) : null;
}
