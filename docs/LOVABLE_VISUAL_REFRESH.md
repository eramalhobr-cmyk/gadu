# Protótipo "GADU Visual Refresh" (Lovable): busca e avaliação

Data: 14/11/2026 (Sprint UX/UI v2.2). Só leitura: nada foi alterado no Lovable e nenhum crédito foi usado.

## Busca
| Onde | Resultado |
|---|---|
| Repositório `gadu` (arquivos, histórico, arquivos excluídos, branches remotas) | Nada. Nenhum HTML de protótipo, nenhuma menção a Lovable ou "Visual Refresh". A branch `feat/ux-refresh-shell-home-20261112` já estava toda na `main`. |
| Outros repositórios autorizados | Nenhum relacionado ao GaDu. |
| Google Drive | Nada relacionado. |
| Lovable (espaço de trabalho do dono do projeto) | **Encontrado**: projeto "GADU Visual Refresh", criado em 13/11/2026, não publicado, em TanStack Start. Contém `docs/REFERENCIA_PARA_CLAUDE_CODE.md` e o plano em `.lovable/plan/`. |

Limite: a prévia do Lovable está bloqueada pela rede deste ambiente. A comparação das telas internas foi feita pelo código-fonte (rotas `inicio`, `hoje`, `Shell`, `Assistant`, `ui`) e pela captura oficial da home que o Lovable fornece. Não houve captura navegável das telas internas do protótipo.

## O que o protótipo propõe
1. Hoje com hierarquia: briefing com avatar, cartão "Agora" (próximo compromisso), depois agenda, lembretes, tarefas e insights.
2. Avatar como estado vivo: halo muda de cor (ciano ouvindo, violeta pensando, azul falando).
3. Componentes únicos: Card, Btn, Meter, Empty, PageHead.
4. Memória com fila "Para aprovar" separada.
5. Ajustes com medidores de uso do dia e do mês.
6. Módulos conceito no mesmo visual.
7. Menu lateral que abre pela esquerda no celular, com fundo escurecido; barra de baixo com 5 abas; voz flutuante.

Observações: o protótipo usa **dados fictícios** (finanças, tarefas, agentes "online", insights inventados), um assistente que **simula** respostas, uma busca global e um sino de notificações sem função, e um botão "Anexar" sem ação.

## Classificação
| Ideia | Decisão | Onde ficou |
|---|---|---|
| Cartão "Agora" no topo do Hoje | **Incorporada agora**, com dados reais: só aparece com a agenda conectada; sem compromisso, diz "Agenda livre" | `TodayPage.tsx`, `.now-card` |
| Halo do avatar por estado (ciano, violeta, azul) | **Incorporada agora** no painel do assistente; o orbe da barra já tinha anéis por estado | `Assistant.tsx`, `.assist-ava` |
| Menu pela esquerda com fundo escurecido, fecha ao tocar fora e ao escolher | **Adaptada** à navegação híbrida: a gaveta guarda só conta, plataforma e histórico; módulos ficam na tela Módulos | `GaduApp.tsx`, `.menu-wrap` |
| Cartões de módulo em grade | **Adaptada**: tela Módulos por área, planejados discretos | `ModulesHub` em `ModulePage.tsx` |
| Componentes únicos (Card, Empty, PageHead) | **Já existiam** desde a v2.1 (`Panel`, `EmptyState`, `PageHeader`) | `kit.tsx` |
| Fila "Para aprovar" na Memória | **Já existia** desde a v2.1 | `MemoryPage.tsx` |
| Medidores de uso em Ajustes | **Preservada para evolução**: os números reais já aparecem em Configurações; medidor gráfico fica para a etapa de créditos por pessoa | ROADMAP |
| Busca global (Ctrl K) e sino de notificações | **Preservada para evolução**: só quando houver busca e central de avisos de verdade | ROADMAP |
| Abas "Chat / Voz" no assistente | **Descartada**: cria dois controles de voz; o GaDu usa um microfone por contexto | — |
| Painel Financeiro com gráfico, agentes "online", insights prontos | **Descartada**: dados inventados; o Financeiro é planejado | — |
| Botão "Anexar" sem função | **Descartada** | — |
| Respostas simuladas do assistente | **Descartada**: o GaDu usa só a conversa real | — |
