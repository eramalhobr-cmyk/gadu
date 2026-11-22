// Botão Voltar do Android (e gesto de voltar do iPhone) com camadas por cima da tela:
// menu, histórico de conversas, assistente. Cada camada aberta tem exatamente UMA entrada
// no histórico do navegador. Voltar fecha só a camada de cima; fechar pela interface
// (X, toque fora) desfaz a entrada sem fechar mais nada.
//
// Por que existe: com uma entrada só para qualquer quantidade de camadas, abrir o assistente
// e o menu juntos fazia o 1º Voltar fechar o menu e o 2º Voltar sair da tela, porque o
// assistente já estava sem entrada.

export type HistoryLike = {
  readonly state: unknown;
  pushState: (state: unknown, title: string) => void;
  go: (delta: number) => void;
};

export type OverlayHistoryDeps = {
  history: HistoryLike;
  /** Chamado quando a PESSOA voltou: feche a camada de cima (a última da lista). */
  onBack: () => void;
  /** Chamado quando os voltas feitos pelo próprio app terminaram (útil para acertar o endereço). */
  onSettled?: () => void;
};

export class OverlayHistory {
  private entries = 0;
  /** Voltas pedidas pelo app que ainda vão gerar um popstate para ignorar. */
  private pendingPops = 0;
  private wanted = 0;

  private deps: OverlayHistoryDeps;
  constructor(deps: OverlayHistoryDeps) {
    this.deps = deps;
  }

  /** Entradas de overlay que este gerenciador mantém no histórico. */
  get depth(): number {
    return this.entries;
  }

  /** Informe quantas camadas estão abertas agora. Chame sempre que isso mudar. */
  sync(openLayers: number): void {
    this.wanted = Math.max(0, openLayers);
    // Uma volta do app ainda não terminou: mexer no histórico agora corre contra ela. Espera o popstate.
    if (this.pendingPops > 0) return;
    this.apply();
  }

  private apply(): void {
    const h = this.deps.history;
    while (this.entries < this.wanted) {
      h.pushState({ gaduOverlay: this.entries + 1 }, "");
      this.entries++;
    }
    if (this.entries > this.wanted) {
      const diff = this.entries - this.wanted;
      this.entries = this.wanted;
      this.pendingPops = 1; // go(-n) gera um único popstate
      h.go(-diff);
    }
  }

  /** Ligue ao evento "popstate" da janela. */
  handlePopState(): void {
    if (this.pendingPops > 0) {
      this.pendingPops = 0;
      this.apply(); // as camadas podem ter mudado enquanto a volta rodava
      if (this.pendingPops === 0) this.deps.onSettled?.();
      return;
    }
    if (this.entries > 0) {
      // A pessoa usou o Voltar: a entrada de cima já saiu do histórico.
      this.entries--;
      this.wanted = Math.max(0, this.wanted - 1);
      this.deps.onBack();
    } else {
      this.deps.onBack();
    }
  }
}
