// Botão Voltar do Android entre telas do app. Antes, trocar de tela só substituía o endereço (replaceState): o
// histórico tinha uma entrada só e o Voltar FECHAVA o app em qualquer tela. Agora cada troca de tela cria uma
// entrada; o Voltar volta para a tela anterior (o popstate é tratado em GaduApp, junto com as camadas).

export type TabHistoryLike = {
  readonly state: unknown;
  pushState: (state: unknown, title: string, url: string) => void;
  replaceState: (state: unknown, title: string, url: string) => void;
};

const url = (tab: string) => `/app?tab=${tab}`;

/** Troca de tela. Com camada aberta (assistente, conversas…), só ajusta o endereço: a entrada de cima é da camada,
 * e empilhar outra por cima desalinharia o controle das camadas (src/lib/overlay-history.ts). */
export function navegarTela(h: TabHistoryLike, atual: string | null, nova: string, camadas: number): void {
  if (atual === nova || camadas > 0) h.replaceState(h.state, "", url(nova));
  else h.pushState({ gaduTab: nova }, "", url(nova));
}

/** Abertura do app direto numa tela que não é a inicial (atalho, link, notificação): põe "Hoje" embaixo, para o
 * primeiro Voltar ir para Hoje em vez de fechar o app. Só na primeira carga (recarregar mantém o histórico). */
export function prepararHistorico(h: TabHistoryLike, inicial: string, home = "hoje"): void {
  if (h.state && typeof h.state === "object") return;
  if (inicial === home) { h.replaceState({ gaduTab: home }, "", url(home)); return; }
  h.replaceState({ gaduTab: home }, "", url(home));
  h.pushState({ gaduTab: inicial }, "", url(inicial));
}
