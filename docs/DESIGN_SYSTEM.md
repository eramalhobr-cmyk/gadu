# GaDu Design System — diretrizes iniciais
Status: especificação inicial para integração incremental ao PWA, sujeita a inventário e validação no código.

## Identidade aprovada
Nome **GaDu** (G e D maiúsculos). Referência: fundo azul-marinho quase preto, avatar humanoide holográfico de traços digitais (não pele realista), cérebro neural luminoso, arcos HUD ciano e laranja, detalhes violeta. Preservar ícone e linguagem visual existentes, refinando sem descaracterizar.

## Experiência como prioridade
- **Mobile first** com navegação confortável por toque, foco em tarefas frequentes, estados claros e acessibilidade.
- **Desktop próprio**: aproveitar largura e altura disponíveis, grids e painéis multicoluna quando úteis; não apenas ampliar interface móvel.
- **Tablet e tamanhos intermediários**: adaptação fluida sem rolagem horizontal indevida.
- Verificar ao menos 390px, 768px, 1024px e 1440px, além de teclado, foco, contraste, redução de movimento, estados vazios, erro e carregamento.
- Minimizar cliques, complexidade visual e caminhos redundantes; testar fluxos reais.

## Implementação
Inventariar componentes e estilos atuais antes de refatorar. Centralizar tokens semânticos de cor, tipografia, espaçamento, raios, sombras, movimento e breakpoints; criar componentes acessíveis e reutilizáveis. Não inventar valores definitivos antes de auditar a implementação. Documentar componentes e exemplos de uso; migrar telas progressivamente com regressão visual e funcional.

## Cobertura
Hoje, Conversa, Tarefas, Agenda, Finance, Administração e 3D Studio seguem o mesmo sistema, com padrões adequados a cada contexto.
