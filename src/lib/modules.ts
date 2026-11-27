// Arquitetura de módulos do GaDu (UX v2.2). Fonte única para menu, painel, home e assistente.
// Regra: um módulo só aparece como "disponível" quando existe e funciona; o resto mostra o status real.

export type ModuleId = "pessoal" | "lista_compras" | "compras" | "filhos" | "metas" | "financeiro" | "investimentos" | "casa" | "office" | "studio" | "studio3d" | "plataforma";
export type ModuleStatus = "disponivel" | "parcial" | "desenvolvimento" | "planejado";
export type ViewId = "hoje" | "modulos" | "conversa" | "tarefas" | "lembretes" | "agenda" | "projetos" | "lista_compras" | "compras" | "filhos" | "memoria" | "metas" | "financeiro" | "investimentos" | "casa" | "agentes" | "office" | "studio" | "studio3d" | "integracoes" | "ajustes" | "perfil" | "admin";

export type ViewDef = { id: ViewId; label: string; icon: string; adminOnly?: boolean; /** Aparece no topo do menu, fora dos grupos ("Início"). */ home?: boolean; /** Tela de navegação (não aparece nos grupos). */ hub?: boolean; /** Endereço antigo que abre outra tela (ex.: Perfil e Integrações abrem Configurações); não aparece nos menus. */ alias?: boolean };
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
      { id: "modulos", label: "Mais", icon: "grid", hub: true },
      { id: "conversa", label: "Conversa", icon: "chat" },
      { id: "tarefas", label: "Tarefas", icon: "check" },
      { id: "lembretes", label: "Lembretes", icon: "bell" },
      { id: "agenda", label: "Agenda", icon: "calendar" },
      { id: "projetos", label: "Projetos", icon: "folder" },
      { id: "memoria", label: "Memória", icon: "book" },
    ],
    available: ["Conversa por voz e texto", "Agenda e e-mails do Google (leitura)", "Tarefas, projetos e lembretes", "Lembretes com aviso no celular: criar, editar, adiar, concluir e apagar, na tela ou pela conversa", "Memória com a sua aprovação", "Briefing da manhã e revisão da noite"],
    planned: ["Rascunhos de e-mail com aprovação", "Voz natural e conversa contínua"],
    needs: [],
  },
  {
    id: "metas", name: "Metas & Conquistas", tagline: "Objetivos de vida com prazo, ritmo e progresso real, só com registros.", icon: "target", color: "hot", status: "parcial",
    views: [{ id: "metas", label: "Metas", icon: "target" }],
    available: ["Metas por número com alvo, percentual, marcos (checklist) ou tarefas vinculadas", "Progresso só com registros que têm data e origem; sem registro, \"sem registros\"", "Ritmo até o prazo: no ritmo ou atrasada", "Vínculo com as suas tarefas", "Perguntar ao GaDu (\"como estão minhas metas\") e registrar progresso pela conversa, com a sua confirmação", "Resumo das metas que pedem atenção na tela Hoje"],
    planned: ["Conquistas e sequências de acompanhamento", "Recomendações e ajuste de metas pelo GaDu, com a sua aprovação", "Vínculo com projetos e agenda", "Indicadores do Financeiro e de saúde (por conector autorizado)", "Metas compartilhadas só com autorização de cada pessoa"],
    needs: ["Modelo de grupos e membros com RLS (metas compartilhadas)", "Dados de saúde só por conector autorizado (docs/INTEGRACOES_SAUDE.md)", "Módulo Financeiro com mais dados (indicadores)"],
    doc: "docs/METAS_CONQUISTAS.md",
  },
  {
    id: "financeiro", name: "Financeiro", tagline: "Contas do mês e gastos do dia a dia, com o GaDu para perguntar e lançar.", icon: "coin", color: "green", status: "parcial",
    views: [{ id: "financeiro", label: "Financeiro", icon: "coin" }],
    available: ["Contas fixas e receitas por mês, com marcar como pago", "Gastos do dia a dia por categoria e meio de pagamento", "Resumo do mês: receitas, contas, dia a dia e sobra", "Previsão até o próximo recebimento", "Perguntar ao GaDu (\"quanto gastei com mercado\") e lançar gasto pela conversa, com a sua confirmação"],
    planned: ["Lançar por print, PDF de extrato e áudio", "Caixa: saldo dia a dia e veredito", "Teto por categoria e acumulado do ano", "Reserva, quitação de dívida e simulador bruto → líquido"],
    needs: ["Leitura de arquivos com deduplicação (fase 3 da especificação)", "Tabelas de INSS e IRRF versionadas por ano"],
    doc: "docs/FEATURE-FINANCAS.md",
  },
  {
    id: "lista_compras", name: "Lista de compras", tagline: "Anote o que precisa comprar e marque o que já pegou.",
    icon: "check", color: "sig", status: "disponivel",
    views: [{ id: "lista_compras", label: "Lista de compras", icon: "check" }],
    available: ["Adicionar por voz ou texto", "Marcar como comprado, reabrir e remover itens"], planned: [], needs: [],
  },
  {
    id: "compras", name: "Compras", tagline: "Seus pedidos online e quando cada um chega, lidos do seu e-mail.",
    icon: "mail", color: "blue", status: "disponivel",
    views: [{ id: "compras", label: "Compras", icon: "mail" }],
    available: ["Pedidos agrupados por loja e número, lidos do Gmail (só leitura)", "Situação, previsão de entrega e rastreio", "Pergunta por voz: “Quando chega meu pedido?”"], planned: [], needs: [],
  },
  {
    id: "filhos", name: "Agenda de filhos", tagline: "Fins de semana alternados, trocas e feriados, sem confusão.",
    icon: "calendar", color: "hot", status: "disponivel",
    views: [{ id: "filhos", label: "Agenda de filhos", icon: "calendar" }],
    available: ["Fins de semana alternados a partir de uma referência", "Troca pontual e mudança a partir de uma data", "Feriados nacionais colados ao fim de semana", "Pergunta por voz: “O fim de semana que vem é meu?”"], planned: ["Feriados estaduais e municipais", "Férias escolares"], needs: [],
  },
  {
    id: "investimentos", name: "Investimentos", tagline: "Acompanhe cotações e compare a variação das ações.",
    icon: "coin", color: "sig", status: "parcial",
    views: [{ id: "investimentos", label: "Investimentos", icon: "coin" }],
    available: ["Cotações e variação histórica da lista acompanhada"], planned: ["Pesquisa diária com fontes e cenários"], needs: ["Fonte de cotações configurada"],
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
    id: "studio3d", name: "3D Studio", tagline: "Encontrar, organizar e gerar modelos para impressão 3D.", icon: "cube", color: "hot", status: "parcial",
    views: [{ id: "studio3d", label: "3D Studio", icon: "cube" }],
    available: ["Beta: descrever a peça na conversa e receber o modelo OpenSCAD, com STL e 3MF (liga com MODELING_3D_ENABLED=1)", "Peças e versões salvas na conta"],
    planned: ["Busca de modelos gratuitos, respeitando licenças", "Biblioteca de modelos", "Figura a partir de foto (3D-2)", "Modelo de projeto A1 PLA 0.4 do Bambu Studio"],
    needs: ["Modelo de projeto do Bambu Studio enviado pelo Eduardo"],
    doc: "docs/FEATURE-3D.md",
  },
  {
    id: "plataforma", name: "Plataforma", tagline: "Perfil, aparência, conexões, custos e segurança.", icon: "gear", color: "pink", status: "disponivel",
    views: [
      { id: "integracoes", label: "Configurações", icon: "link", alias: true },
      { id: "ajustes", label: "Configurações", icon: "gear" },
      { id: "perfil", label: "Configurações", icon: "user", alias: true },
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
  { id: "vida", name: "Vida pessoal", text: "Metas, dinheiro e casa.", modules: ["metas", "financeiro", "lista_compras", "compras", "filhos", "investimentos", "casa"] },
  { id: "criacao", name: "Agentes e criação", text: "Agentes, sites e aplicações, modelos 3D.", modules: ["office", "studio", "studio3d"] },
  { id: "plataforma", name: "Plataforma", text: "Conta, aparência, conexões e custos.", modules: ["plataforma"] },
];
/** Telas que funcionam, na ordem única dos menus (UX-1): a mesma no celular ("Mais") e no computador (menu lateral).
 * Hoje, Conversa e Tarefas ficam na barra de baixo do celular; o resto, em "Mais". */
export const MAIN_VIEWS: ViewId[] = ["hoje", "conversa", "tarefas", "lembretes", "agenda", "financeiro", "metas", "lista_compras", "compras", "filhos", "investimentos", "projetos", "memoria", "agentes"];
export const DOCK_VIEWS: ViewId[] = ["hoje", "conversa", "tarefas"];
/** Grupos dos menus (UX-7): a mesma divisão na tela Mais do celular e no menu lateral do computador.
 * Cada grupo traz um exemplo do que dizer, porque tudo no GaDu também se faz pela conversa. */
export type NavGroupId = "dia" | "vida" | "criacao";
export type NavGroup = { id: NavGroupId; name: string; hint: string; views: ViewId[] };
export const NAV_GROUPS: NavGroup[] = [
  { id: "dia", name: "Meu dia", hint: "“Como está meu dia?”", views: ["hoje", "conversa", "tarefas", "lembretes", "agenda", "projetos", "memoria"] },
  { id: "vida", name: "Vida", hint: "“Quanto gastei este mês?”", views: ["metas", "financeiro", "lista_compras", "compras", "filhos", "investimentos"] },
  { id: "criacao", name: "Agentes e criação", hint: "“Cria um agente para os estudos”", views: ["agentes"] },
];
/** Grupos com as telas visíveis: tira as escondidas (interruptores) e as de `skip` (ex.: as da barra de baixo, na tela Mais). Grupo vazio sai. */
export function navGroups(hidden: (v: ViewId) => boolean = () => false, skip: ViewId[] = []): NavGroup[] {
  return NAV_GROUPS.map((g) => ({ ...g, views: g.views.filter((v) => !hidden(v) && !skip.includes(v)) }));
}

/** Endereço antigo → tela de verdade (um lugar só para a conta). */
export function canonicalView(view: ViewId): ViewId {
  return view === "perfil" || view === "integracoes" ? "ajustes" : view;
}

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
  return view === "casa" || view === "office" || view === "studio" || view === "studio3d";
}
/** Converte ?tab= em tela. Endereços antigos continuam válidos; admin só para quem pode. */
export function parseView(tab: string | undefined, admin: boolean): ViewId | null {
  if (!tab) return null;
  if (tab === "memorias") return "memoria";
  if (tab === "admin") return admin ? "admin" : "ajustes";
  return (VIEW_IDS as string[]).includes(tab) ? (tab as ViewId) : null;
}
