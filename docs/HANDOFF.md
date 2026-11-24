# GaDu · Diário de bordo entre IAs

Este é o caderno de passagem de bastão entre as IAs que programam o GaDu (Claude Code, Codex, Cursor/Grok Bot e outras). Regras em [AGENTS.md](../AGENTS.md).

**Como usar**
- **Ao começar:**
  1. leia a última entrada, a seção "Em andamento" e a lista "A revisar por outra IA";
  2. revise os itens abertos que vieram de **outra** IA;
  3. marque cada item revisado com a data e o resultado.
- **Ao terminar** (ou se a sessão for interrompida), escreva uma entrada nova **no topo** do diário com:
  - data e hora de Brasília;
  - IA;
  - o que fez;
  - PRs;
  - o que ficou pela metade;
  - próximo passo.
- Horários sempre no fuso de Brasília (UTC-3).

## Em andamento (atualize ao começar e ao terminar)
| Frente | IA | Branch | Situação |
|---|---|---|---|
| Ciclo de novembro: Lista de compras, Compras e Agenda de filhos | Claude Code (e Codex na Lista) | — | **Tudo publicado** (#123, #124, #126, #127, #128). Falta: validação no aparelho (Voltar do Android, App do Gmail, Agenda por voz com a IA real) e Compras com Gmail real |
| Ciclo UX (UX-1 a UX-4) e Tudo por voz | Cursor (Grok Bot) e Claude Code | — | **UX-4 (PRs #52 a #55) e UX-5 (PRs #58 a #60) publicados em 23/11 pelo Claude Code**; UX-1 a UX-3 e Tudo por voz **publicados** (PRs #34, #35, #36, #38, #39, #42 em 22/11; lacunas da matriz fechadas em 23/11 pelos PRs #47 a #50). Próximo: validar com a IA real e no aparelho, lacunas que restam na seção 11 e UX-6 |
| Financeiro: simulador de salário | Claude Code | `feat/financas-simulador-bruto-liquido` (worktree `/workspace/gadu-simulador`) | básico **publicado** em 23/11 (PR #63). Ampliação (outras deduções, benefícios, 13º, férias, voz sem modelo) **publicada** em 23/11 às 19:09 (PR #116, merge `ed9a20f`, CI verde, deploy conferido). Falta tela em aparelho e a frase por voz com pessoa logada |
| Metas fase 2 (projetos e agenda) | Claude Code e Cursor | — | **publicada** em 23/11: #85 migração (aplicada 13:11), #86 projetos (13:29), #87 agenda (13:43). Falta validar com Google real e no aparelho. Antes: migração `20261123170001` **aplicada** (Cursor, 23/11). Etapa 2a (projetos: tela, rotas, `meta_projeto`, Core) em PR; etapa 2b (agenda: `meta_agenda`) em seguida |
| Revisão cruzada (Cursor → Claude Code) e segurança S-05/S-08 | Claude Code e Cursor | `fix/s05-escrita-por-acesso` | revisão (#72), auditoria (#73) e S-08 desenho (#75) **publicados**; S-05 (#74) **aprovado pelo Eduardo às 11:17** (bloqueado pode apagar os próprios dados) e **aplicado em produção às 11:31** pelo Cursor |
| Observabilidade (8a) e e2e com login no CI (8b) | Claude Code | `feat/telemetria-erros` | **Migração `20261123110001_telemetria_erros.sql` APLICADA** pelo Cursor via MCP em 23/11 ~10:57 (conferido: `error_events` com RLS e 1 política). O código (rota `/api/telemetria/erro`, página no Admin, alerta) pode seguir. **8b (e2e com login no CI): PR #77**, 17/17 |
| UX-7 · visual, navegação e palco de voz (proposta aprovada 23/11 14:06) | Cursor (Grok Bot) | `feat/ux7-*` no worktree `/workspace/gadu-ux` | Em andamento: palco de voz (PR 1). Depois: Mais/menu por áreas, ligações e mapa, Hoje em três faixas, resto dos 17 itens. Arquivos: `ListenSheet`, `Assistant`, `GaduApp` (só o necessário), `ModulePage`, `TodayPage`, `src/app/ux7.css`. **Não mexe** em agentes (limites), privacidade (dado sensível) nem percepções |
| Monitoramento e alerta de erro (P1) | Cursor (Grok Bot) e Claude Code | `feat/monitoramento-alerta-erro` no worktree `/workspace/gadu-erros` | Código pronto para revisão e PR: captura no servidor (API, IA, 3D, cron), alerta por push com throttle, painel Saúde do sistema, voz. Migração aditiva `20261123200001` **ainda não aplicada**. Sem `TELEMETRIA_TOKEN`. |
| 3D-1 (conversa → OpenSCAD) | Cursor (Grok Bot) e Claude Code | `fix/3d-qualidade-ajustes` | **publicado** (PR #40) e ligado em produção em 23/11. PR #114 (18:26) corrigiu prazo, código cortado, eixo Z e fontes. 2ª rodada 18:28–18:33: 10/10 geraram; restaram qualidade (altura da aba, caixa 28 vs 40, L com parede 0 mm, traço de texto fino) e o toque em **Abrir** no celular (18:35). Correções desta branch (ver entrada 18:50). Falta: nova rodada com IA real no navegador, WebKit/iPhone |

## A revisar por outra IA
Marque `[x]` quando revisar e anote quem revisou, a data e o resultado.
- [ ] **Agenda de filhos** (Claude Code, PR #126, 24/11/2026): (a) regra de alternância e de mudança permanente em `src/lib/filhos/agenda.ts` (`comigoNo`); (b) feriados móveis (Páscoa) e a regra do feriado colado; (c) RLS e S-05 da migração `20261124020001`; (d) Desfazer das ações (`ActionCard`: ajuste novo apaga, ajuste existente volta o valor anterior).
- [ ] **Compras** (Claude Code, PR #124, publicado em 23/11/2026): (a) heurísticas de `src/lib/compras/pedidos.ts` (número, situação, previsão, rastreio, loja) contra e-mails reais; (b) `/api/compras` só com o token da sessão e termos bloqueados; (c) o bloco do `/api/chat` só carrega com pergunta sobre pedidos.
- [x] **Simulador de salário, ampliação** (Claude Code, branch `feat/financas-simulador-bruto-liquido`, 23/11/2026): **Revisado por Cursor (Grok Bot) em 23/11/2026 às 18:50.** (a) Constantes de 2026 conferidas de novo nas fontes oficiais (INSS: Portaria MPS/MF nº 13/2026; IRRF e redução: Receita/Lei 15.270); exemplos 2 a 5 da Receita passam com o INSS dado via `calcularIrrf`. Outras deduções fora da base do INSS e na cesta legal, benefícios só no total recebido. (b) Curto-circuito depois de privacidade e teto do agente, antes de reserva e cota; `FINANCE_ENABLED=0` e pedido de salvar seguem para o modelo; nada é gravado na leitura. (c) Bloco local no `send()` mostra o cartão e fala o resumo, sem `/api/chat`. (d) Tela em aparelho e temas no dispositivo seguem pendentes. **Decisão:** repetir dependentes e outras deduções no 13º e nas férias é aceitável como estimativa (está dito na tela); pensão costuma incidir também nesses pagamentos.
- [x] **3D-1, 3D Studio Beta** (Claude Code, branch `feat/3d-1-openscad`, 4 commits `feat(3d)`): (a) `src/app/api/3d/generate/route.ts`: ordem limites → reserva → cota → IA → liquidação, fail closed, e que nenhum valor de custo ou `user_id` vem do cliente; (b) CSP: `src/lib/3d/csp.ts` e `next.config.ts` (CSP própria em `/vendor/openscad/*`) e a exclusão de `vendor/` no matcher de `src/proxy.ts`; confirmar que as páginas não ganharam `wasm-unsafe-eval`; (c) licença GPL do `public/vendor/openscad/openscad.js` (componente separado; ver README ao lado); (d) heurísticas de `src/lib/3d/checks.ts` (parede por raios é estimativa); (e) abrir `/app/3d` com `MODELING_3D_ENABLED=1` no aparelho (Chrome Android e Safari: o worker module e o WebGL não foram testados em WebKit); (f) o e2e com login (`E2E_3D=1`) foi escrito sem rodar. **Revisado por Claude Code em 23/11/2026:** só a parte de segurança e custo (a, b). (a) `/api/3d/generate`: sessão → interruptor → zod `.strict()` (user_id e custo no corpo são recusados) → privacidade → limites por motor → reserva (id da sessão) → cota → IA → liquidação, com `release` no `finally`; fail closed. (b) CSP própria só em `/vendor/openscad/*`, matcher do proxy exclui `vendor/`, páginas sem `wasm-unsafe-eval`. Nenhum problema real. (c) a (e) e (f) seguem abertos.
- [x] **PR #22, segurança P1** (Claude Code): orçamento só no servidor, etapa 2 da cota, limite de tentativas no login. Conferir se as rotas novas não aceitam valor de custo vindo do cliente. **Revisado por Cursor (Grok Bot) em 23/11/2026:** chat, importação de memórias e 3D passam por cota e orçamento no servidor, sem custo vindo do cliente; o cron exige `CRON_SECRET` com comparação em tempo constante. **Achado real:** `/api/search` chamava os embeddings pagos sem nenhum limite. Corrigido no PR `fix/revisao-antigos-busca`: limite de 60 buscas por 10 min por pessoa (hash do id), fail closed (a tela segue com a busca por texto).
- [x] **PR #24, Core "atenção hoje"** (Claude Code): conferir a deduplicação entre fontes e o interruptor `CORE_MVP`. **Revisado por Cursor (Grok Bot) em 23/11/2026:** cada fonte lê só o `user_id` da sessão e emite cada linha uma vez (tarefa atrasada, de hoje ou prioridade alta é um único fato); não há junção entre fontes diferentes (tarefa e e-mail parecidos aparecem os dois, o que é aceitável); `CORE_MVP=0` esconde o cartão e desliga a fonte no chat. Sem bug.
- [x] **PR #26, Financeiro base** (Claude Code): migração, RLS e isolamento entre pessoas; conferir os arredondamentos de valores e o interruptor `FINANCE_ENABLED`. **Revisado por Cursor (Grok Bot) em 23/11/2026:** as contas são em centavos (`toCents` com `Math.round`); com valores de 2 casas (os schemas só aceitam isso) o arredondamento é exato; `FINANCE_ENABLED=0` desliga rotas e ações. Sem bug.
- [x] **PR #28/#29, celular** (Claude Code): o Voltar do Android com uma entrada por camada. A navegação offline no WebKit é limitação do Playwright, então conferir num iPhone de verdade. **Revisado por Cursor (Grok Bot) em 23/11/2026:** no código, cada camada (painel, folha, escuta, confirmação, guia) ocupa uma entrada no histórico e o e2e mobile cobre o Voltar (44/44 no CI). Falta só o iPhone de verdade (pendência humana).
- [x] **PR #30, Metas** (Claude Code): migração `metas_base`, cálculo de ritmo e interruptor `GOALS_ENABLED`. **Revisado por Cursor (Grok Bot) em 23/11/2026:** `calcularProgresso`/`calcularRitmo` cobrem metas que diminuem (82 → 75 kg), prazo vencido, sem prazo, pausada/arquivada, e a tolerância de 5 pontos; datas em dias de Brasília (sem horário de verão). Sem bug.
- [x] **PR #32, plano** (Cursor/Grok Bot): conferir se as fases 3D-0 a 3D-3 e o ciclo UX-1 a UX-6 no ROADMAP batem com o pedido do Eduardo. **Revisado por Claude Code em 23/11/2026:** ROADMAP, `docs/FEATURE-3D.md` e a ordem combinada batem (3D-0 feito, 3D-1 publicado, 3D-2 e 3D-3 depois; UX-1 a UX-6 com os itens certos). Achado só de texto: o cabeçalho de `docs/FEATURE-3D.md` ainda diz "não publicado" (o 3D-1 está no ar desde 22/11); não editei por ser arquivo da frente 3D. Sem bug.
- [x] **PR #34, UX-1 navegação** (Cursor/Grok Bot): microfone central (toque fala, segurar abre o painel), tela Mais, fim do menu sanfona, Configurações unificada (`?tab=perfil` e `?tab=integracoes` rolam até a parte certa). Conferir o Voltar do Android no aparelho. **Revisado por Claude Code em 23/11/2026:** no código, o Voltar do Android segue a pilha do `OverlayHistory` (confirmação, escuta, gaveta, assistente, depois a aba da URL) e `?tab=` é refeito em `onSettled`; o e2e mobile cobre. Sem bug. Aparelho segue pendente.
- [x] **PR #35, UX-2 Hoje** (Cursor/Grok Bot): `toActionItem` em `src/lib/core/format.ts` (só `tasks`/`reminders` ganham `ref`); Feito/Adiar/Desfazer gravam pelo cliente com RLS em `AttentionCard.tsx`. Conferir com dados reais; "Virar tarefa" de e-mail saiu do Hoje. **Revisado por Claude Code em 23/11/2026:** a fonte do Core só devolve tarefa aberta com prazo até hoje (ou prioridade alta sem prazo) e lembrete `pending`; "Adiar para amanhã" nunca adianta uma data e "Desfazer" volta ao estado certo (lembrete `pending` não foi enviado pelo cron). Escritas pelo cliente com RLS e `ref` só numérico de `tasks`/`reminders`. Sem bug.
- [x] **PR #36, UX-3 voz** (Cursor/Grok Bot): `ListenSheet.tsx` e a contagem de 3 s; `voiceSheetRef` no `onText` do reconhecedor em `GaduApp.tsx`. Conferir no Chrome Android e no Samsung Internet se o fim da fala dispara a contagem e se o microfone sempre fecha. **Revisado por Claude Code em 23/11/2026:** a contagem de 3 s é um `setInterval` limpo ao desmontar, o Voltar fecha a escuta e para o reconhecedor, e `voiceSheetRef` só desvia a fala final. Sem bug no código. Chrome Android e Samsung Internet seguem pendentes (aparelho).
- [x] **PR #38, texto grande** (Cursor/Grok Bot): `src/lib/text-size.ts`, cookie `gadu_texto` lido em `src/app/layout.tsx`; todas as fontes em `calc(Npx * var(--ts, 1))`. Conferir no aparelho, com "Maior", se nada corta ou sobrepõe (barra de baixo, cartões, Financeiro). **Revisado por Claude Code em 23/11/2026:** `parseTextSize` só aceita 100/115/130, cookie lido no servidor, sem segredo. Sem bug encontrado. Conferir no aparelho segue pendente.
- [x] **PR #39, confirmações faladas** (Cursor/Grok Bot): máquina de estados em `GaduApp.tsx` (`confirmQ`, `listenConfirm`, `answerConfirm`, ramos `confirmListenRef` no reconhecedor), `parseAnswer` em `src/lib/voice-confirm.ts` ("não, foi 60 reais" = mudar), `Speaker.maxChars`. Conferir no Chrome Android e no Samsung Internet se o microfone abre depois da pergunta e sempre fecha. **Revisado por Claude Code em 23/11/2026:** achei 2 bugs, corrigidos no PR `fix/revisao-23-11`: (1) `parseAnswer` tratava "claro que não" e "sim, espera" como "sim" e gravava; agora a frase com negação ou pausa pergunta de novo; (2) "muda para…" num item já criado pelo servidor (lembrete) só descartava o cartão e o lembrete antigo ficava, duplicando; agora desfaz. Voltar do Android conferido no código (confirmação = 1 camada, `OverlayHistory`) e no e2e mobile. Aparelho segue pendente.
- [x] **PR #42, Tudo por voz** (Cursor/Grok Bot): (a) `src/lib/acoes-resolver.ts`: toda consulta com `.eq("user_id")` e cliente da sessão, `matchByName` devolve nada quando há empate; (b) `ActionCard.tsx` (`runAction`): `meta_tarefa` cancela a tarefa se o vínculo falhar; `conta_paga` usa `PUT /api/finance/itens/:id/mes`; (c) o estado dos cartões em `GaduApp` (`cards`, `cardOp`); (d) testar com a IA real se ela usa `acoes` nas frases comuns ("cria uma meta de…", "paguei a luz", "aumenta a letra"). **Revisado por Claude Code em 23/11/2026:** (a) `acoes-resolver.ts`: toda consulta com cliente da sessão e `.eq("user_id")`, empate devolve nada; (b) `runAction` só grava depois do toque ou do "sim", ids vêm do servidor e a RLS vale; `meta_tarefa` cancela se o vínculo falhar; `conta_paga` usa a rota do Financeiro. Sem bug real. (d) testar com a IA real segue pendente.
- [x] **PR #44, UX-4 alvos de 48 px** (Cursor/Grok Bot): bloco no fim de `src/app/ux.css` (`--touch: 48px` até 1023 px ou em tela de toque). Conferir no aparelho se nada ficou apertado. **Revisado por Claude Code em 23/11/2026:** só CSS, e2e público e mobile passaram nesta revisão. Conferir no aparelho segue pendente.
- [ ] **PR A, tarefas e lembretes por voz** (Claude Code): conferir com a IA real se ela usa `tarefa_editar` e `lembrete_adiar` nas frases comuns ("adia o remédio para amanhã às 9", "muda a prioridade do boleto para alta") e se "adiar" um lembrete já avisado volta a disparar o push.
- [ ] **PR B, finanças e agenda por voz** (Claude Code): (a) `src/app/api/calendar/[id]/route.ts` e `updateEvent`/`deleteEvent` em `src/lib/google.ts`: conferir que só usam o token da própria pessoa e o escopo `calendar.events`, e testar com um evento de verdade (editar e apagar) no Google; (b) `findGasto` em `src/lib/acoes-resolver.ts`: a regra "se o nome cabe em mais de um gasto, não escolhe" é de propósito, por ser apagar; (c) testar com a IA real as frases "apaga o gasto de 50 no mercado" e "muda a reunião para as 15h".
- [ ] **PR C, metas e projetos por voz** (Claude Code): conferir a decisão de "arquivar projeto" = status `done` (um status "arquivado" pede migração e aprovação do Eduardo) e testar com a IA real "pausa a meta de correr" e "muda o alvo para 60".
- [ ] **PR D, memória, nova conversa e navegação** (Claude Code): (a) em `GaduApp.tsx`, o ramo `ev.t === "acoes"` chama `setTab(destino)` na hora e `cardOp` chama `newConversation()` ao confirmar `nova_conversa`: conferir no navegador que a tela abre, o microfone fecha e o Voltar do Android continua certo; (b) `memoria_esquecer` apaga a linha (a tela de Memória também apaga): confirmar que a confirmação explícita basta; (c) a IA real precisa usar as palavras da lista de memória para achar o fato.
- [ ] **PR #52, UX-4 linguagem** (Claude Code): em Hoje, "Ver tudo" (e a lista de lembretes) ficou dentro de "Mais opções": conferir se fica fácil de achar com uma pessoa não digital; o selo "Beta" do 3D em Mais não foi tocado (frente 3D).
- [ ] **PR #53, UX-4 Desfazer** (Claude Code): (a) `capture()` em `ActionCard.tsx` guarda o estado antes de gravar: conferir com Supabase real e login que o Desfazer dos cartões da conversa volta ao estado certo (tarefa adiada ou editada, lembrete adiado, conta paga, gasto e evento criados); (b) gasto apagado e depois desfeito volta com **novo id**; (c) "desfaz" falado (`parseUndoCommand`, `GaduApp.tsx` em `send`) é um comando local, não uma ação do bloco "acoes": se preferirem como ação da IA, é outro PR.
- [ ] **PR #54, UX-4 erros** (Claude Code): `failChat` e `lastFailRef` em `GaduApp.tsx`: no aparelho, conferir que o erro falado não atropela a fala da resposta, que "tenta de novo" reenvia a última mensagem e que o modo conversa continua certo depois do erro. As frases novas estão em `src/lib/errors.ts`.
- [ ] **PR #55, UX-4 primeiro uso** (Claude Code): (a) `closeGuide` e `saveName` em `GaduApp.tsx` gravam `profiles.settings.onboarding` e `display_name` pela sessão (RLS): conferir com login real; (b) fala e microfone do guia no Chrome Android e no Samsung Internet (a fala do passo 1 pode ficar bloqueada até o primeiro toque: há "Ouvir de novo"); (c) o Voltar do Android fecha o guia (uma camada no `OverlayHistory`): conferir no aparelho; (d) ação nova `guia` ("me mostra o guia de novo") com a IA real; (e) o teste novo do guia em `e2e/auth.e2e.cjs` foi escrito sem rodar.
- [ ] **PR #58, UX-5 padrão de módulo** (Claude Code): (a) Lembretes não tem tela própria (é um painel em Hoje › Mais opções › Ver tudo); (b) o "Falar com o GaDu" dos vazios vem do `GaduApp` por `TalkProvider` (`dockTalk`): conferir no aparelho que abre a tela de escuta e o Voltar do Android; (c) as frases de exemplo ("Cria um projeto reforma da varanda", "Gastei 45 no mercado no pix"…) precisam funcionar com a IA real; (d) o botão do topo de Financeiro ("Lançar gasto") troca para a aba Dia a dia e foca o valor.
- [ ] **PR #59, UX-5 cartão único** (Claude Code): `ConfirmCard`/`CardFrame` em `src/components/ConfirmCard.tsx`. Conferir com login: apagar projeto, agente, conta e gasto, arquivar meta, apagar conversa (o cartão aparece no lugar da linha na gaveta) e desconectar o Google; e que a tela de escuta mostra o cartão da ação sem apertar em tela pequena. Memória (Descartar, Esquecer) segue com um toque só, de propósito.
- [ ] **PR #60, UX-5 Design System etapa 2** (Claude Code): `.fs-14`, `.fs-15` e `.fs-22` agora acompanham "Texto maior": conferir no aparelho com "Maior". A comparação de estilos computados (0 diferenças em 15.277 elementos) não cobre estados que só existem com login (gaveta, folhas abertas). O botão Voltar de Metas passou a ter o desenho de Projetos e Agenda.
- [ ] **Simulador de salário** (Claude Code, branch `feat/financas-simulador`): (a) conferir as tabelas de 2026 em `src/lib/finance/salario.ts` contra as fontes oficiais (INSS, Receita, Lei 15.270/2025) e a regra do imposto de até R$ 10 (art. 67 da Lei 9.430/1996; o desconto simplificado "substitui as deduções legais" pela maior); (b) o arredondamento (uma vez no fim; a soma das linhas por faixa pode diferir 1 centavo do total); (c) em `acoes-resolver.ts`, `salario_simular` só lê `fin_*` da própria pessoa e `salvar` usa só `receita_principal_id` dela; (d) em `chat/route.ts`, o cartão usa valor e dependentes ditos pela pessoa; (e) testar com a IA real "quanto fica líquido um salário de 8 mil?" e "guarda esse líquido como meu salário do mês"; (f) conferir no aparelho a aba "Salário" a 390 px e com "Texto maior".
- [x] **Tudo por voz do Cursor em 23/11** (PRs #67, #68, #69 e #70): no aparelho, conferir a troca de voz e a velocidade; com login real, "abre a conversa sobre…" acha a conversa certa e abre o histórico dela. **Revisado por Claude Code em 23/11/2026:** (#67) velocidade limitada a 0,7–1,6 e `voz_trocar` só gira entre vozes `pt`. (#68) `conversa_abrir` só lê `conversations` com `.eq("user_id")` e respeita termos bloqueados; abrir não grava. (#69) `registro_apagar` só acha registro da meta da própria pessoa e a rota apaga com RLS. (#70) `conta_criar` e `receita_principal` passam pelas rotas do Financeiro (zod, RLS, receita tem de ser da pessoa e do tipo certo). Sem bug nesses quatro. **Aparelho e IA real seguem pendentes.**
- [x] **PR #65, limite de custo na busca** (Cursor/Grok Bot): **Revisado por Claude Code em 23/11/2026:** **achado real:** o balde `search_user` não está na lista do `CHECK` de `private.rate_limits` (migração `20261122120001`), então cada chamada falhava no banco e, por ser fail closed, a busca por significado ficava **sempre desligada** em produção (o teste mockava o banco e não pegou). Corrigido no PR `fix/revisao-cursor-busca-balde` (usa o balde permitido `verify_email` com chave própria; teste novo lê o `CHECK` da migração). Um balde dedicado fica para uma migração futura.
- [x] **e2e com login** (`e2e/auth.e2e.cjs`): **rodado em 23/11/2026 pelo Claude Code** no CI contra Supabase local (workflow `e2e-auth.yml`): 17 de 17 depois de corrigir CSP, guia, link Pular (44 px) e o teste de Hoje. Ver docs/TESTES_E2E.md.
- [ ] **Agentes por voz** (Claude Code, branch `feat/voz-agentes`): testar com a IA real "cria um agente de treino" e "muda as instruções do Mentor para…"; as instruções que o modelo escreve entram no prompt das conversas daquele agente, por isso o cartão as mostra inteiras na tela e a confirmação é obrigatória (conferir se o texto do cartão não corta demais em 390 px).
- [ ] **Telemetria de erros** (Claude Code): (a) `src/lib/telemetria/sanitize.ts` não deixa passar mensagem nem e-mail; (b) `servidor.ts` lê o usuário do cookie no `onRequestError`: conferir em produção que grava (precisa pessoa logada e erro real); (c) `/api/cron/telemetria-resumo` fica sob `/api/cron` para escapar do proxy, protegida por `TELEMETRIA_TOKEN`; (d) Admin › Erros recentes no celular.
- [ ] **PR do e2e com login no CI** (Claude Code): conferir (a) `src/lib/csp-connect.ts` e `src/proxy.ts`: `http`/`ws` só para loopback, produção inalterada; (b) `scripts/e2e-auth-local.sh`: nenhum segredo, senha aleatória mascarada; (c) a versão da CLI do Supabase está em `latest` no workflow (fixar se ficar instável).
- [x] **S-05** (Claude Code, `fix/s05-escrita-por-acesso`): (a) migração `20261123150001` restritiva só para `authenticated`, `SELECT` intacto; (b) **conferido pelo Cursor em 23/11 pelo MCP**: nenhuma política em conflito, `can_write()` testada com usuários de teste numa transação desfeita; (c) **decisão do Eduardo: DELETE continua permitido** para quem está bloqueado; (d) **aplicada às 11:31**; contas ativas inserem, alteram e apagam normalmente (verificado numa transação desfeita). Falta: validar no aparelho com uma pessoa de teste bloqueada.
- [ ] **Metas fase 2, projetos** (Claude Code, `feat/metas-fase2-projetos`): (a) `loadProjetos` em `src/lib/goals/load.ts` e as rotas `projetos` (sessão + `.eq("user_id")`, chave composta no banco); (b) testar com a IA real "liga a meta de corrida ao projeto Saúde" e "desliga…" e o Desfazer no cartão; (c) tela da meta a 390 px.
- [ ] **Validação com login no aparelho** de tudo o que foi publicado em 22/11 (pendência humana, com o Eduardo).

## Diário (mais recente no topo)

### 24/11/2026 07:07 · Claude Code, publicação
- Publicados: #126 (Agenda de filhos), #127 (Voltar do Android, Gmail na conta certa, cartão do Hoje) e #128 (Agenda e outras lacunas por voz). CI verde em todos; deploys de produção prontos.
- **Pendente (humano):** conferir no Android real o Voltar, o "App do Gmail", o cartão do Hoje e a configuração da Agenda por voz.

### 24/11/2026 06:58 · Claude Code, Tudo por voz (Agenda de filhos, agentes, termos)
- Eduardo: a Agenda de filhos não deixava configurar por voz; pediu revisão geral para tudo da tela funcionar por voz, incluindo vários fins de semana seguidos fora da regra.
- Branch `feat/voz-config` (sobre `fix/android-voltar-gmail`, PR #127): ações `filhos_configurar`, `filhos_mudanca_remover`, `agente_apagar`, `termo_bloquear`/`termo_desbloquear`; trocas de um pedido num cartão só; calendário dos sábados no bloco do chat.
- **Revisar (outra IA):** frases reais com a IA (o modelo precisa escolher as datas do calendário do bloco); no aparelho, confirmação falada do cartão com várias trocas.

### 24/11/2026 06:36 · Claude Code, Android: Voltar e links do Gmail
- Eduardo relatou: Voltar do Android fechava o app; "Abrir e-mail" ia para o Gmail do navegador e não achava o e-mail. Correção em `fix/android-voltar-gmail` (ver CHANGELOG). Sem migração.
- **Revisar (outra IA):** `navegarTela` com camadas abertas (só troca o endereço para não desalinhar `OverlayHistory`); no aparelho, Voltar do sistema e o botão "App do Gmail".

### 24/11/2026 06:17 · Claude Code, Agenda de filhos
- Eduardo aprovou a mudança no banco. PR #126: migração `20261124020001` (2 tabelas, RLS, S-05; **aplicada em produção** em 24/11 ~06:20), cálculo puro em `src/lib/filhos/agenda.ts`, rotas `/api/agenda-filhos`, tela, ações de voz com Desfazer, bloco do chat, testes (unitários, integração, SQL, e2e a 390 px).
- **Decisões:** feriados só nacionais; feriado colado = dia antes do início ou depois do fim do fim de semana; dia de semana sem feriado colado fica "sem regra"; nada das crianças é guardado além das datas.
- **Próximo:** merge com CI verde, conferir no ar.

### 23/11/2026 22:55 · Claude Code, Lista de compras e Compras publicadas
- **#123 (Lista de compras)** e **#124 (Compras)** integrados (merges `0f46085` e `a2d6897`); deploy de produção pronto; a página inicial de produção mostra os dois módulos.
- O `e2e-public` do #123 tinha sido cancelado por tempo; usei o do #124 (verde), que roda sobre o código do #123 inteiro.
- **Revisar (outra IA):** heurísticas de `src/lib/compras/pedidos.ts` com e-mails reais de lojas; Lista e Compras a 390 px no aparelho.
- **Próximo:** Agenda de filhos (desenho e migração esperam aprovação do Eduardo); validações no aparelho (humanas).

### 23/11/2026 22:45 · Claude Code, ciclo de novembro (Lista de compras, Saúde, Compras)
- **Publicado:** #117 (Saúde do sistema) e #122. Migração da Lista de compras **aplicada em produção** (~22:28; RLS, 6 políticas, S-05, anon sem acesso).
- **#123 (Lista, Codex):** apliquei o padrão S-05 (restritivas separadas), entrada na suíte de isolamento e contagens do `85_s05`. CI: verify, database, e2e-auth verdes; o `e2e-public` foi **cancelado por tempo** baixando pacotes do Ubuntu (antes de rodar teste). Não consegui re-executar daqui (403). O PR de Compras contém o #123 inteiro e roda o mesmo e2e público.
- **Compras (`feat/compras-pedidos`):** tela, rota, bloco do chat e navegação por voz prontos; testes locais verdes. Sem migração. `COMPRAS_ENABLED=0` desliga.
- **Próximo:** merge do #123 com CI verde, depois o PR de Compras; conferir em produção. Agenda de filhos espera aprovação de migração.

### 23/11/2026 21:38 · Codex, revisão da Saúde do sistema (PR #117)
- Atualizei a branch com a `main` em `cb8638d`, preservando a triagem de e-mails e os comandos locais de Saúde.
- Corrigi a corrida de avisos quando um grupo volta depois de sete dias. O retorno preserva o último alerta e a liberação das seis horas vale no instante exato. Acrescentei regressões para a concorrência com o cron e o limite.
- Typecheck e integração passaram localmente no Node 22. O CI anterior do PR passou, incluindo banco e e2e com login. A nova revisão precisa do CI atualizado.
- Migração `20261123200001_alerta_erros.sql` permanece igual à do PR. Produção pendente de aprovação explícita da migração e acesso ao projeto correto. Depois de aplicar, conferir as duas tabelas com RLS e grants restritos, integrar com CI verde e validar Administração e push com sessão de administrador.

### 23/11/2026 19:35 · Claude Code + Cursor (Grok Bot), e-mails automáticos fora de "Merece sua atenção" (PR #115)
- Branch `fix/emails-atencao-memoria`. Causa: a triagem de e-mail não lia as memórias aprovadas. Novo `src/lib/email-regras.ts` (regras das memórias, classificação crítico/importante/normal/baixa, "isso não é importante"), aplicado no Core, `/api/today`, cron do briefing, chat e percepções. Rota `POST /api/email/nao-importante`, botão "Não é importante" no `AttentionCard` e comando local no `GaduApp`. Corrigido o limite das memórias no chat (80 mais novas). Sem migração.
- **Testado:** typecheck, `npm test`, build. **Não testado:** e2e com login (novo teste em `e2e/auth.e2e.cjs`), Google real, aparelho.
- **A revisar por outra IA:** os padrões de `regrasDeMemorias` (texto livre em português: conferir com memórias reais), e a regra "manter vence silenciar".
- **Revisão do Cursor (Grok Bot), 18:45:** diff lido; typecheck e `npm test` (419/419 e 250/250) repetidos; a memória real nº 61 ("e-mails de deploy da Vercel... falhas de CI continuam relevantes") silencia "Failed production deployment" da Vercel e mantém "Run failed" do GitHub. Ajuste: confirmação falada quando o pedido vem por voz.
- **Lista velha:** não há cache de API (`no-store`; o service worker ignora `/api`). O cartão agora refaz a lista ao voltar para o app (`visibilitychange`) e o service worker foi para `gadu-v7`. Conflitos com #116 e #118 resolvidos mantendo as entradas das duas frentes.
- **Próximo passo:** merge com CI verde, conferir o deploy e conferir em produção que o e-mail da Vercel sumiu da lista.

### 23/11/2026 19:12 · Cursor (Grok Bot) e Claude Code, 3D: qualidade da 2ª rodada e Abrir no celular
- Branch `fix/3d-qualidade-ajustes` (rebase em `origin/main` após os PRs #116 e #118). 2ª rodada (18:28–18:33, 10/10 geradas): o suporte só subiu 1,8 mm (aba 14→16); a caixa 80×60×40 tinha slider 40 e malha 28 (`altura - altura_tampa`); o L tinha reforço deslocado e parede ~0 mm (checagem de malha passava); gancho, chaveiro e placa avisavam parede 0,5–0,9 mm (traço do texto / ponta). Eduardo (18:35): tocar **Abrir** em Suas peças no celular parecia não fazer nada — a prévia carregava abaixo da lista, sem rolar até ela.
- **Feito:** regras mais claras no prompt (Z total, medidas externas, union com sobreposição, traço de texto ≥ 1,2 mm); checagens `partes` e `medidas`; correção automática **uma vez** depois de montar (`qualidade.ts`, `causa: "qualidade"`); Abrir e `?peca=` rolam até `#s3d-peca`; pedido e versões visíveis; e2e a 390 px; voz “abre a peça do chaveiro” (`buscaPeca3d`).
- **Testado:** unitários novos (checagens, qualidade, prompt, voz); `npm run test:unit` 429/429 e `tsc` ok depois do rebase. e2e auth escrito (CI com `MODELING_3D_ENABLED=1` e `E2E_3D=1`); não rodado aqui (precisa Docker).
- **A revisar por outra IA:** a regra dos 2 corpos na mesa (caixa e tampa) vs peça única; o retry automático não pode entrar em laço (já zera `pendente` na correção).
- **Próximo passo:** CI verde, merge, e uma 3ª rodada das 10 no navegador com a IA real.

### 23/11/2026 19:10 · Cursor (Grok Bot), publicação do simulador de salário ampliado
- **Feito por (IA):** Claude Code (código); Cursor (Grok Bot) (revisão, merge e conferência no ar).
- **Publicado:** PR #116, merge `ed9a20f`, 23/11/2026 às 19:09 (Brasília). CI verde (verify, e2e-public, database, e2e com login). Deploy de produção da Vercel concluído. Conferido: `/api/health` 200, `/api/finance/resumo` 401 sem sessão, CSS de produção com `.sal-diga`.
- **PRs:** #116.
- **Falta:** conferir a tela no aparelho e dizer “quanto fica líquido um salário de 12 mil?” com pessoa logada.

### 23/11/2026 · 18:52 · Cursor (Grok Bot) e Claude Code, monitoramento e alerta de erro
- **Fez:** entrega P1 aprovada pelo Eduardo (~18:30). O Claude Code escreveu o grosso do código no worktree `/workspace/gadu-erros` (branch `feat/monitoramento-alerta-erro`) e parou às 18:47 no limite de 5 h da sessão; o Cursor revisou, apertou o parser de voz, completou a documentação e os testes.
  - Helper `capturarErroServidor` ligado ao `onRequestError` e aos `catch` de `/api/chat`, `/api/3d/generate`, `/api/cron/tick` e `/api/cron/telemetria-resumo`.
  - Alerta por push aos administradores ativos (grupo novo ou pico), com throttle persistido (1 por grupo / 6 h, 4 por dia em Brasília) e rede de segurança no `tick`. Não depende de `TELEMETRIA_TOKEN`.
  - Painel **Saúde do sistema** na Administração (dados reais, estilo JARVIS) e voz (“teve algum erro hoje?”, “o que quebrou?”, “abre a saúde do sistema”).
  - Privacidade: sanitização que já existia + detector `isSensitive` (PR #94). Nunca grava mensagem, e-mail, token ou corpo.
  - Migração aditiva `20261123200001_alerta_erros.sql` (`user_id` opcional em `error_events`; `error_alert_state` e `error_alert_dia`, só `service_role`). **Ainda não aplicada em produção.**
- **Testes (máquina local):** `typecheck`; `test:unit` 427/427; `test:integration` 274/274; `npm run build`; `bash scripts/test-db.sh` (inclui `81_alerta_erros.test.sql`).
- **PRs:** #117.
- **Ficou pela metade:** aplicar a migração pelo MCP; validar o push no aparelho; `TELEMETRIA_TOKEN` no fim do roadmap.
- **A revisar por outra IA:** o throttle atômico (`error_alert_state` + `error_alert_dia`), o gancho mínimo no `GaduApp.tsx` e se o painel Saúde está claro a 390 px.
- **Próximo passo:** testes, PR, CI verde, aplicar a migração e publicar.

### 23/11/2026 18:50 · Cursor (Grok Bot), revisão do simulador de salário ampliado
- **Feito por (IA):** Claude Code (código, 5 commits locais); Cursor (Grok Bot) (revisão, testes de novo e PR).
- **Revisão:** conferi o cálculo (tabelas 2026, exemplos oficiais da Receita, 13º/férias, outras deduções e benefícios), o curto-circuito sem IA no cliente e no `/api/chat`, o parser e a tela. Corrigi no CHANGELOG a contagem de commits (eram 5, não 4). Typecheck, unit 420/420, integration 257/257 e build passaram de novo.
- **PRs:** a abrir nesta sessão.
- **Falta:** merge com CI verde, tela no aparelho, frase por voz com pessoa logada.

### 23/11/2026 18:44 · Claude Code, simulador de salário: ampliação (pedido do Eduardo às 18:30)
- **Feito por (IA):** Claude Code; revisão e PR pelo Cursor/Grok Bot. Branch `feat/financas-simulador-bruto-liquido` (worktree `/workspace/gadu-simulador`), commits locais, **sem push, sem PR, sem merge**. Sem migração.
- **Feito:** (1) `salario.ts`: `calcularSalario(bruto, dependentes?, { outrasDeducoes?, beneficios? })`, `calcularIrrf` (IR com INSS dado), 13º e férias + 1/3 (`decimoTerceiro`, `ferias`), `totalRecebido`; (2) `salario-texto.ts`: parser com dependentes, outras deduções e benefícios, `pedeSalvarSalario`, `calcularPedido`, `resumoSalario` com 13º e férias; (3) voz sem custo: bloco local no `send()` do `GaduApp` e curto-circuito no `/api/chat`; (4) `salario_simular` aceita `outrasDeducoes` e `beneficios`; (5) `SalarioSimulador.tsx` com painel HUD, `Stack` (ganhou o parâmetro opcional `fmt` em `charts.tsx`), Ouvir, estimativas e quatro fontes; CSS só em `v2-pages.css`; (6) docs do simulador.
- **Testes:** typecheck, unit (420), integration (257) e build passaram. Os testes de integração antigos do simulador mudaram: a frase de leitura agora NÃO chama o modelo; o custo (limites → reserva → cota → IA) é testado com um pedido de salvar.
- **Falta:** PR e revisão; e2e; tela em aparelho; frase por voz com pessoa logada. Não mexi em 3D, créditos, alerta de erro, importação nem ciclo UX.

### 23/11/2026 18:07 · Cursor (Grok Bot), 3D: correções da rodada de referência com IA real
- **Feito por (IA):** Cursor (Grok Bot). Rodada das 10 peças (17:48–18:00, no navegador pelo Eduardo/bot): 8 de 10 geradas, 6 renderizaram de primeira e 8 depois da correção automática; todas as renderizadas passaram nas verificações da A1; 7 de 8 ajustes no eixo certo; relevo de texto sumiu em 2. Custo registrado: **US$ 0,0200** (16 chamadas `claude-haiku-5-5`; as 2 que falharam não foram registradas).
- **Causas:** (1) suporte e gancho: a função passava de `maxDuration = 60` (Anthropic 30 s + nova tentativa + gateway) e a Vercel cortava sem JSON, daí a mensagem genérica; (2) caixa e suporte de parede: saída parou no limite de 6000 tokens (raciocínio interno gastava quase tudo; só ~2000 caracteres de código) e o código chegou cortado; (3) chaveiro: o modelo chamou o eixo Y de "altura"; (4) texto: o OpenSCAD WASM não tem fontes, `text()` saía vazio sem erro (conferido: chaveiro 3 → 4 mm e placa 4 → 5,2 mm com as fontes, nos códigos salvos da rodada).
- **Correções (branch `fix/3d-referencia`):** `complete()` com `semRaciocinio` (`thinking: disabled`, volta ao padrão se o motor recusar), `timeoutMs`, `maxRetries`, `deadline` e `cortada` (stop_reason `max_tokens`); rota com `maxDuration = 120`, prazo próprio de 105 s, 55 s por motor, sem novas tentativas do SDK, 504 `ai_timeout` com mensagem clara; `scadIncompleto()` (delimitadores e última instrução) no `validateScad` e **uma** nova tentativa automática mais curta quando o código vem cortado (reserva dobrada; a 2ª chamada grava o consumo direto); regras 8 a 10 do prompt (altura = Z, texto só com Liberation Sans, código enxuto); fontes Liberation Sans (OFL) em `public/vendor/openscad/fonts.js`, carregadas pelo worker só quando há `text()`, e erro claro se a fonte pedida não existir; Studio3D: "Nova peça" limpa o pedido, o ajuste e o erro, a prévia volta à vista depois de gerar/ajustar, mensagens com o código do erro (504/5xx). O harness `scripts/3d-referencia/` (pedidos + `conferir.ts`) entra junto.
- **Voz:** o ajuste por voz usa o mesmo `pedirIA`, então recebe as mesmas correções.
- **Falta:** rodar de novo as 10 peças no navegador para medir o "depois"; logs da Vercel das falhas não lidos (o conector da Vercel não tem acesso ao time).

### 23/11/2026 18:10 · Cursor (Grok Bot), G1 voz imersiva

### 23/11/2026 17:45 · Cursor (Grok Bot), G3 design system v2
- Publicados: #110 (17:34), #111 M4 (17:35), #112 G1 (17:39). G3: vitrine `/design` (404 em produção, `GADU_DESIGN_PAGE=1` no CI) e `e2e/visual.e2e.cjs` no job `e2e-public` com referências em `e2e/visual-baseline/` geradas nesta máquina; se o runner renderizar fonte diferente, trocar pelas capturas do artefato `gadu-visual`.
- **Próximo:** G4 (logo) espera o arquivo.

### 23/11/2026 17:38 · Cursor (Grok Bot), G1 voz imersiva
- `VoiceCore.tsx` (anéis SVG + espectro; `useNivel` escreve `--lvl` por quadro a partir do `voiceLevel`), `nivel-visual.ts`, `voz-imersiva.css`; `ListenSheet` com `.listen-wrap.imersivo` (mantém `.listen-ava` para os e2e antigos). "Modo voz" em `send()` antes do "lê o resumo". Empilhado sobre o M4.
- **Próximo:** G3 (design system v2 com testes visuais).

### 23/11/2026 17:28 · Cursor (Grok Bot), M4 resumo falado
- Botão "Ouvir" nos painéis (evento `gadu:falar`, o GaduApp fala com o `Speaker`), "lê o resumo" (`parseLerResumo`, antes da navegação em `send()`) e resumo por voz que espera `#painel[data-falar]` (até 3 s). Empilhado sobre o PR do gasto do mês.
- **Próximos:** G1 (voz imersiva), G3.

### 23/11/2026 17:20 · Cursor (Grok Bot), gasto do mês no Hoje
- PR #108 publicado às 17:14 (CHANGELOG corrigido). Hoje ganhou "Gasto no mês" (contas pagas + dia a dia, de quanto está previsto) no resumo do dia, só com o Financeiro ligado; sem resposta, o indicador some.
- **Próximos:** M4, G1, G3.

### 23/11/2026 17:22 · Cursor (Grok Bot), plano do Spotify (só plano)
- Pedido do Eduardo (17:15): plano, sem código. Está em `docs/PLANO-SPOTIFY.md`: Development Mode com Premium do dono e até 5 usuários na allowlist, PKCE no servidor, Spotify Connect como caminho principal no S26 Ultra e link do episódio como reserva, tokens criptografados em `spotify_connections` (RLS, gravação só pelo servidor), voz, ~18 h em 5 PRs, riscos.
- **Espera o Eduardo:** Premium, app criado no painel do Spotify (redirect URIs do plano) e o Client ID; aprovação da migração aditiva e da chave `SPOTIFY_TOKEN_KEY`.

### 23/11/2026 17:05 · Cursor (Grok Bot), painéis de resumo
- Tema JARVIS publicado (PR #107, merge às 17:03). Painéis de resumo com gráficos leves em Hoje, Finanças, Metas, Tarefas e Agentes (`charts.tsx`, `paineis.css`, `painel.ts`), só dados reais; voz "mostra meu resumo de finanças" (`nav-intent.ts`, `painel: true`, rola até `#painel`). Classes com prefixo próprio (`gkpi`, `gring`, `pnl-*`) porque `.kpi`, `.ring` e `.dash` já existiam no CSS antigo.
- **Próximos:** M4, G1 (voz imersiva com anéis reagindo à voz), G3 (design system v2 com testes visuais).

### 23/11/2026 16:46 · Cursor (Grok Bot), tema JARVIS (G2)
- Eduardo escolheu a G2 JARVIS às 16:33 (claro padrão, escuro opção, barra flutuante da E com microfone sólido por cima, sem traço acima do microfone). Branch `feat/jarvis-tema`: `src/app/jarvis.css` (importado depois de `ux7.css` no `layout.tsx`), cores do `theme-color`/manifest em `theme.ts` e `manifest.webmanifest`, `DESIGN.md` atualizado.
- **Próximos:** painéis de resumo e gráficos (só dados reais), M4, G1 (voz imersiva no estilo JARVIS com anéis reagindo à voz) e G3 (design system v2 com testes visuais).
- **A revisar por outra IA:** contraste do ciano `#007f99` em fundos claros translúcidos e o custo do `backdrop-filter` em aparelhos fracos.

### 23/11/2026 16:19 · Cursor (Grok Bot), UX-7 M6: paleta Ctrl+K e menu compacto por voz
- Branch `feat/ux7-m6-ctrlk`. `src/lib/paleta.ts` (itens, filtro, `parseMenuCommand`, `isPaletaKey`), `src/components/CommandPalette.tsx`, botão `.pal-btn` no topo e atalho global no `GaduApp.tsx`, CSS em `ux7.css`. CHANGELOG: #104 marcado como publicado.
- **Pausado por decisão do Eduardo (16:13):** M4, G1 e G3 esperam a escolha da direção visual (A a G2, em `/workspace/gadu-review/visual-direcoes`). Sem Claude Code.
- **A revisar por outra IA:** acessibilidade da paleta (combobox/listbox com `aria-activedescendant`) e o conflito de Ctrl+K com atalhos do navegador.

### 23/11/2026 15:43 · Cursor (Grok Bot), UX-7 M5: "o que posso dizer aqui"
- Branch `feat/ux7-o-que-dizer`. `src/lib/o-que-dizer.ts` (frases por tela, `parseSayHelp`, frase falada), `src/components/SayHere.tsx`, botão `.say-btn` no topo do `GaduApp.tsx` e atalho local em `send()` (como "desfaz"), CSS em `ux7.css`. Frase escolhida só vai ao campo.
- Changelog: #97, #99, #101 e #102 marcados como publicados.
- **A revisar por outra IA:** se as frases de exemplo de cada tela continuam batendo com as ações quando o prompt mudar (`acoes.ts`).

### 23/11/2026 15:46 · Cursor (Grok Bot), UX-7 G2: navegação por intenção
- Branch `feat/ux7-navegar-intencao`. `src/lib/nav-intent.ts` (`parseNavIntent`, `pushTab`, `navSpoken`) e atalho local em `send()` do `GaduApp.tsx`, antes de chamar o modelo; pilha de telas em `tabStackRef`. Sem migração.
- **A revisar por outra IA:** o regex de `parseNavIntent` (não pode pegar pedidos de conteúdo) e a pilha do "volta" junto com o Voltar do Android (`OverlayHistory`).
- **Não feito:** nenhuma direção visual (A, B, C) nem ícones novos, à espera da escolha do Eduardo. Sem Claude Code.

### 23/11/2026 15:15 · Cursor (Grok Bot), UX-7 R6/M1: DESIGN.md e guias de design revisados
- **Feito:** `DESIGN.md`; `docs/design/` com 4 textos de terceiros (licença, commit fixado, SHA-256, revisão registrada); crítica de Hoje, Conversa e Mais. Recusados: skill Impeccable (scripts/hooks) e skill `web-design-guidelines` (curl).
- **Regra para todas as IAs:** não instalar skills de design; consultar `DESIGN.md` e `docs/design/`.
- **Próximo passo:** M5 ("o que posso dizer aqui"), M6 (Ctrl+K), M4, G1 a G3. A direção visual espera a escolha do Eduardo.

### 23/11/2026 15:05 · Cursor (Grok Bot), 3D-1b: render junto do ajuste
- Aprovado pelo Eduardo às 15:01. `src/lib/3d/render-imagem.ts` (conferência e tamanho), `complete()` aceita `image`, rota `/api/3d/generate` com `imagem` só no `refinar`, captura no `Viewer3D.tsx`, `Studio3D.tsx` manda a imagem (campo e voz). Custo extra ≈ US$ 0,00004 por ajuste.
- **A revisar por outra IA:** a captura no `Viewer3D.tsx` (desenha e lê no mesmo quadro) e o efeito da voz no `Studio3D.tsx`.
- **Não feito:** as 10 peças de referência com IA real (esperam o OK de gasto do Eduardo). Sem Claude Code (decisão das 14:39).

### 23/11/2026 15:12 · Cursor (Grok Bot), UX-7 R7: motores de rosto antigos apagados
- **Feito:** só o avatar oficial fica (`Avatar` em `RobotFace.tsx` + `avatar-engine.ts`); `robot-engine.ts` guarda só o tipo `FaceMode` (o nome do arquivo ficou para não mexer nos imports de quem usa o tipo).
- **Próximo passo:** R6/M1 (skills de design pela regra de segurança).

### 23/11/2026 15:08 · Cursor (Grok Bot), UX-7 R3: um microfone só no celular
- **Feito:** classe `idle` no botão do campo e regra em `ux7.css` (abaixo de 1024 px some em repouso, volta ao focar o campo ou como "Parar"). e2e de voz do campo focam o campo antes; teste novo do R3.
- **Proposta visual (B):** 3 direções simuladas em `/workspace/gadu-review/visual-direcoes/` (A Aurora de vidro, B Neon orbital, C Calma clara), **esperando a escolha do Eduardo**; nada implementado.
- **Próximo passo:** R7 (motores de rosto sem uso), R6/M1 (skills de design pela regra de segurança).

### 23/11/2026 14:59 · Cursor (Grok Bot), tema claro por padrão (pedido do Eduardo, 14:47)
- **Feito:** `parseTheme` com claro por padrão; `nav` e `chat-stage` sem `on-dark`; `theme-color` e status bar por tema no layout; ícones claros, manifest e `sw.js` (`gadu-v6`); Configurações com Claro primeiro; exemplos de voz do tema no prompt de ações.
- **A revisar por outra IA:** quem criar tela nova não deve usar `on-dark` em superfícies grandes (só no disco do avatar). Ícone definitivo espera o logo novo (G4).
- **Próximo passo:** proposta visual (B) com 2 ou 3 direções em `/workspace/gadu-review/visual-direcoes/`, sem implementar até o Eduardo escolher; depois R3, R6/M1, R7.

### 23/11/2026 14:55 · Cursor (Grok Bot), UX-7 PR 4: Hoje em três faixas
- **Publicado antes deste PR:** #93 palco de voz (14:32, `d88bfcf`), #95 Mais e menu por áreas (14:37, `26c83f2`), #96 ligações e Mapa do GaDu (14:42, `b9632e7`); CI verde nos quatro jobs e deploy da Vercel conferido no ar. CHANGELOG corrigido para "publicado".
- **Feito:** `TodayPage` em três faixas (Agora, Depois, Progresso) com `src/lib/hoje-faixas.ts` e testes; e2e do Hoje ampliado. Sem migração.
- **Pedido do Eduardo (14:39):** tudo de UX feito pelo Cursor, sem abrir o Claude Code.
- **Próximo passo:** R3 (um microfone só no celular), R6/M1 (skills de design pela regra de segurança), R7 (motores de rosto sem uso).

### 23/11/2026 14:50 · Cursor (Grok Bot), sobras do 3D: ajustar peça por voz
- **Decisão do Eduardo (14:39):** não lançar mais o Claude Code no GaDu, nem depois de a cota renovar (ele precisa dele para outro trabalho). Todo o trabalho restante do GaDu fica com o Cursor.
- `peca3d_ajustar` (acoes, resolvedor, cartão, pergunta falada) + `src/lib/3d/ajuste-voz.ts` + leitura única no `Studio3D.tsx`. Não mexe em `GaduApp.tsx` (frente de UX): a navegação sai do `ActionCard.tsx`.
- **A revisar por outra IA:** o efeito do ajuste no `Studio3D.tsx` (roda uma vez, depois que a peça certa abriu).
- **Próximo nas sobras do 3D:** imagem do render para o modelo (3D-1b) e as 10 peças de referência com IA real (precisa do Eduardo autorizar o gasto). 3MF "A1 PLA 0.4" espera o projeto do Eduardo.

### 23/11/2026 14:35 · Cursor (Grok Bot), dado sensível brasileiro (fila, item 3)
- `privacy.ts` passa a detectar o dado (CPF/CNPJ com DV, Luhn, agência e conta, Pix, senha com valor, tokens) no lugar das palavras-chave. Saúde fica por palavra. Usado em todo lugar que já chamava `isSensitive` (chat, Core, memórias, lembretes, tarefas, eventos, gastos, Google).
- **Decisão a registrar:** é uma regra menos restritiva para conversa comum ("como troco minha senha?" agora passa); o dado em si continua bloqueado. CPF formatado bloqueia mesmo com DV errado.
- **A revisar por outra IA:** os regex de agência/conta e de senha em `src/lib/privacy.ts`.
- **Fila 1–3 concluída.** Depois: sobras do 3D e o token da telemetria (manual do Eduardo).

### 23/11/2026 14:30 · Cursor (Grok Bot), UX-7 PR 3: ligações visíveis e Mapa do GaDu
- **Feito:** selo da meta em tarefas e projetos ligados (`src/lib/ligacoes.ts`, `src/components/links.tsx`, só leitura de `goal_tasks`/`goal_projects`/`goals` com RLS, só com `GOALS_ENABLED`); seção "Mapa do GaDu" no Guia (`src/components/GaduMap.tsx`), com nós que abrem as telas e frases das ações de voz que já existem. Sem migração, sem rota nova.
- **A revisar por outra IA:** se a frente de Metas (Claude Code) mudar nomes de ação ou frases, atualizar `MAP_LINKS` em `src/lib/ligacoes.ts`.
- **Próximo passo:** M3, Hoje em três faixas.

### 23/11/2026 14:28 · Cursor (Grok Bot), UX-7 PR 2: Mais e menu por áreas
- **Feito:** `NAV_GROUPS` em `src/lib/modules.ts` (Meu dia, Vida, Agentes e criação), usado na tela Mais e no menu lateral; grupo "Conta e ajuda" em Mais; exemplo do que dizer por grupo; números (metas, projetos, memórias); 3D no menu do computador com o interruptor ligado; 3D Studio "parcial" no catálogo.
- **A revisar por outra IA:** o catálogo do 3D em `modules.ts` (frente do Claude Code): status "parcial" e textos de disponível/planejado.
- **Próximo passo:** PR 3, ligações visíveis e mapa do GaDu no Guia.

### 23/11/2026 14:20 · Cursor (Grok Bot), UX-7 PR 1: palco de voz
- **Pedido do Eduardo (14:06):** aplicar a proposta visual inteira (17 itens) em PRs pequenos. Ordem: palco de voz, Mais/menu por áreas, ligações e mapa, Hoje em três faixas, o resto.
- **Feito:** avatar grande na tela de escuta (tela cheia no celular), na Conversa do celular (até 190 px vazia ou em voz, encolhe ao digitar), no computador (340/420 px) e no painel do assistente (136/168 px ao ouvir, pensar e falar). Nível real da voz: `src/lib/voice-level.ts` (testado), `src/lib/mic-meter.ts` (computador, só com permissão já dada, nada gravado), trechos reconhecidos e `onboundary` da fala. CSS do ciclo em `src/app/ux7.css`.
- **A revisar por outra IA:** `mic-meter.ts` (abre um segundo `getUserMedia` junto do reconhecimento só fora do celular; conferir no Safari do Mac); o seletor `:has(#msg:focus)` em `ux7.css`.
- **Próximo passo:** PR 2, Mais e menu agrupados por áreas.

### 23/11/2026 14:20 · Cursor (Grok Bot), agentes com ferramentas e teto (fila, item 2)
- Migração `agentes_ferramentas_teto` (PR #91): merge às 14:15, **aplicada** via MCP às 14:16 (versão `20261123171612`) e conferida (RLS, só leitura da dona em `agent_uso`, função só do servidor). `agent_uso` não tem escrita pelo cliente, então não precisa das restritivas S-05.
- App: teto do agente antes de `reserveBudget` (`limitesDoAgente` no `/api/chat`), gating de contexto e de ações por ferramenta, `server_add_agent_usage` depois da liquidação; tela Agentes e voz `agente_editar` (`liberar`, `bloquear`, `teto`).
- **Decisão a registrar:** o teto do agente é mole (pode passar um pouco com mensagens simultâneas). "Atenção hoje" só entra para agente com agenda, e-mail, tarefas e lembretes.
- **A revisar por outra IA:** `limitesDoAgente` e `somarUsoAgente` em `src/app/api/chat/route.ts`, `src/lib/agentes/ferramentas.ts`.
- **Próximo:** item 3, dado sensível brasileiro (CPF, conta, Pix) no lugar de palavras-chave.

### 23/11/2026 14:30 · Cursor (Grok Bot), percepções com Aceitar/Ignorar (fila, item 1)
- **Migração (PR #89):** `20261123180001_insight_respostas` (aditiva: uma tabela; guarda só dia, tipo e decisão, nenhum conteúdo; RLS, 4 políticas de dono, restritivas S-05). Testes `30_isolamento` e `85_s05` (24 tabelas, 48 políticas). **Aplicada** pelo Cursor via MCP às 14:00 (versão `20261123170034`; RLS, 4 + 2 políticas, `anon` sem acesso).
- **Código (`feat/percepcoes-app`):** `src/lib/percepcoes.ts` (o que cada Aceitar faz, filtro do que já foi respondido); `POST /api/insights` (Aceitar: atrasadas → passam para hoje, até 20; e-mail importante parado → tarefa "Responder e-mail: assunto (remetente)"; janela livre → "Foco" de até 2 h no Google; conflito → anota e abre a Agenda; dia cheio → só ignora) e `POST /api/insights/desfazer` (volta só o que o Aceitar fez, só nas linhas da sessão, e apaga a resposta de hoje). Tela Hoje: painel "O GaDu percebeu" com Aceitar/Ignorar e Desfazer. `/api/today`, o chat e o briefing deixam de mostrar o que a pessoa já respondeu hoje.
- **Voz:** `percepcao` ("passa as atrasadas para hoje", "ignora o aviso do e-mail", "reserva o foco na janela livre"): o servidor recalcula as percepções de hoje (mesma regra, só dados da sessão) e mostra o cartão; o modelo não escolhe texto nem horário.
- **A revisar por outra IA:** `src/app/api/insights/**` (Desfazer de tarefa de outra pessoa é ignorado pelo `eq("user_id")`; evento só apaga pelo id devolvido), `PercepcoesCard.tsx`.
### 23/11/2026 13:50 · Cursor (Grok Bot), fila nova e token da telemetria
- **Decisão do Eduardo (13:44):** o `TELEMETRIA_TOKEN` (Vercel + segredo do GitHub) foi para o **fim do roadmap**, como passo manual dele ("Fim do roadmap · passos manuais do Eduardo" no ROADMAP). Não é pendência das IAs.
- Conferido às 13:47: migração `metas_fase2` aplicada (versão `20261123161155`), `goal_projects` e `goal_events` com RLS, 4 políticas de dono + 2 restritivas S-05 cada, `anon` sem acesso; deploy da `main` (`bf513d5`, PR #87) `success`.
- **Fila, nesta ordem:** (1) percepções no briefing (atrasos, conflitos de agenda, e-mails sem resposta) com Aceitar/Ignorar, também por voz; (2) agentes com ferramentas permitidas e teto de gasto próprios; (3) detecção de dado sensível brasileiro (CPF, conta, Pix) no lugar de palavras-chave. Depois: sobras do 3D e o token da telemetria. **Não começar sem o Eduardo:** voz paga (ElevenLabs) e S-08.

### 23/11/2026 13:45 · Cursor (Grok Bot) sobre o rascunho do Claude Code, Metas fase 2: agenda da meta
- **Migração `20261123170001_metas_fase2` (PR #85): aplicada** pelo Cursor via MCP às 13:11 (versão `20261123161155`); conferido: `goal_projects` e `goal_events` com RLS, 4 políticas de dono + 2 restritivas S-05 em cada (46 restritivas no total), `anon` sem acesso, `projects_id_user_unique` criada.
- Projetos ligados à meta: PR #86 (Claude Code), publicado às 13:29.
- O Claude Code atingiu o limite de uso às ~13:35 (volta às 15:20) com a parte da agenda pronta mas sem commit. O Cursor levou o rascunho para o branch `feat/metas-agenda`, revisou, conferiu os testes e documentou.
- **Agenda da meta:** `meta_agenda` ("reserva 3 manhãs por semana para a meta de corrida"): o SERVIDOR escolhe dias e horários (`src/lib/goals/agenda.ts`, pula compromissos, nunca no passado, até 20 blocos em até 6 semanas); o cartão mostra os horários e só depois do "sim" cria os eventos no Google (`POST /api/goals/:id/agenda`, título vem da meta; se um falhar, desfaz os já criados). "Feito · Desfazer" libera os blocos. Tela da meta: painel "Agenda da meta" com Liberar (`DELETE /api/goals/:id/agenda/:eventId`, só evento reservado pelo GaDu para meta da própria pessoa). Reservar **não conta como progresso**. Sem escopo OAuth novo.
- **A revisar por outra IA:** `src/app/api/goals/[id]/agenda/**` (Google + banco, desfazer parcial), `planejarAgenda` (fuso de Brasília).

### 23/11/2026 13:20 · Claude Code, Metas fase 2 (tarefa 11), etapa 2a: projetos
- Branch `feat/metas-fase2-projetos` (sem migração nova): rotas `POST /api/goals/:id/projetos` e `DELETE /api/goals/:id/projetos/:projectId`; `GET /api/goals/:id` devolve `projetos` e `projetosDisponiveis`; painel "Projetos ligados" na tela da meta; ação `meta_projeto` ("liga a meta de corrida ao projeto Saúde", `desligar:true` para tirar) com cartão, pergunta falada e **Desfazer** (UX-4); o Core cita "projetos ligados: …" na linha da meta (nome com termo bloqueado vira "omitido pela regra de privacidade"). Leitura de vínculos que falha nunca inventa vínculo (aviso no chat; Core segue sem a informação).
- Testes: unitários (validação, cartão, pergunta), integração das rotas (A x B, duplicado 409, `GOALS_ENABLED=0` 404, sem sessão 401) e do `/api/chat` (só itens de A, nada gravado antes de confirmar, interruptor, termo bloqueado), e2e público (15 rotas 401).
- **Próximo:** etapa 2b, `meta_agenda` (blocos de agenda; o servidor escolhe os dias e pula conflitos).
- **A revisar por outra IA:** `PanelProjetos` no celular (390 px) e a ação com a IA real ("liga a meta de corrida ao projeto Saúde").

### 23/11/2026 13:10 · Claude Code, Metas fase 2 (tarefa 11), etapa 1: migração
- **Migração aditiva `supabase/migrations/20261123170001_metas_fase2.sql`** (PR `feat/metas-fase2-migracao`, só migração, testes e docs): `goal_projects` (meta ↔ projeto, chaves compostas com `user_id`; `projects` ganha só `unique (id, user_id)`) e `goal_events` (bloco de agenda: id do evento no Google, título e horário). RLS `(select auth.uid())`, 4 políticas por tabela, `*_ativo_insert/update` com `can_write()` do S-05. Rollback no topo do arquivo.
- **Testes:** `bash scripts/test-db.sh` verde: `30_isolamento` (as 2 tabelas na suíte), `70_metas` (A x B, vínculos cruzados, CHECKs, cascatas), `85_s05` atualizado (46 políticas ativo em 23 tabelas, ativa grava 65 de 69, bloqueada 0 de 46 e apaga 22 de 23, rollback volta a 48).
- **Decisões (registradas em docs/METAS_CONQUISTAS.md):** nenhum escopo OAuth novo (o `calendar.events` já cria, edita e apaga); **evento NÃO conta como progresso** (a especificação só aceita progresso com origem de registro; mudar isso é decisão do Eduardo).
- **Migração `20261123170001_metas_fase2.sql`: APLICADA em produção** pelo Cursor via MCP (versão 20261123161155; conferido: `goal_projects` e `goal_events` com RLS, 4 políticas de dono + 2 restritivas S-05 cada, 46 restritivas no total, anon sem acesso, `projects_id_user_unique`). Texto original da época:  O Cursor aplica pelo MCP (só aditiva; conferir `goal_projects` e `goal_events` com RLS e 4 políticas + 2 restritivas cada, e a restrição `projects_id_user_unique`) e registra em PROJECT_STATUS. **Parei aqui.** Retomo com o código: ações `meta_projeto` ("liga a meta de corrida ao projeto Saúde") e `meta_agenda` ("reserva 3 manhãs por semana para a meta", sem escopo novo, com checagem de conflito na agenda), cartões, Desfazer, fatos do Core, tela e testes de voz (regra 8.1).

### 23/11/2026 13:05 · Cursor (Grok Bot), Desfazer nos agentes por voz
- Revisão do #82 (Claude Code): sem problema de segurança; faltava "Feito · Desfazer" (UX-4). Feito no branch `fix/agentes-desfazer`: `agente_novo` desfaz apagando o agente criado (o id volta da gravação), `agente_editar` guarda os campos antes e restaura. Sem migração.

### 23/11/2026 12:15 · Cursor (Grok Bot), Finanças: teto por categoria e acumulado do ano (tarefa 10)
- **Migração (PR #81):** `20261123160001_fin_tetos` (só aditiva: tabela nova `fin_tetos`, um teto por categoria por pessoa, 4 políticas de dono e as restritivas `fin_tetos_ativo_insert/update` do S-05). Testes `30_isolamento`, `60_financas` e `85_s05` atualizados.
- **Código (branch `feat/fin-tetos-app`):** `src/lib/finance/tetos.ts` (alerta a partir de 80%, estourou a partir de 100%, somas em centavos, acumulado do ano até o mês atual); rotas `GET/PUT/DELETE /api/finance/tetos` (PUT troca e devolve o anterior para o Desfazer) e `GET /api/finance/ano` (somado no servidor, sem tabela nova, ano futuro recusado); aba "Tetos e ano" no Financeiro; tela Hoje avisa os tetos que passaram de 80%.
- **Voz:** `teto_definir` ("põe um teto de 800 reais para restaurante", "tira o teto de lazer"), cartão com confirmação e Desfazer. Perguntas "quanto gastei com mercado este ano?" e "quanto gastei em 2026?" trazem os fatos "Acumulado do ano" e "Teto da categoria" para o chat, sem IA extra. Corrigido: "quanto gastei em 2026" não vira mais lançamento de gasto.
- **Testes:** unitários (tetos, ações, cartão, resolvedor, Core com isolamento A x B) e integração `test/finance-tetos.integration.test.ts` (401, `FINANCE_ENABLED=0`, troca/anterior, DELETE 404, B não vê nem apaga o teto de A, acumulado só da sessão).
- **A revisar por outra IA:** `src/app/api/finance/tetos/route.ts`, `src/lib/core/finance.ts` (fatos de teto/ano), regex `ANO` em `src/lib/core/plan.ts`.
- **Próximo:** Metas fase 2 (Claude Code, tarefa 11); voz de agentes (Claude Code, em andamento).

### 23/11/2026 11:30 · Cursor (Grok Bot), S-05 aprovado e aplicado
- O Eduardo aprovou o PR #74 às 11:17 com uma mudança: bloqueado **pode apagar** os próprios dados. Removidas as políticas `*_ativo_delete`; teste `85_s05_escrita_por_acesso` (renomeado do 80, que já era da telemetria) ajustado: bloqueado não insere nem altera (0 de 40), apaga em 19 de 20 tabelas (profiles não tem delete por desenho), não apaga de outra pessoa.
- Incluídas `pecas_3d` e `pecas_3d_versoes`. Migração renomeada para `20261123150001` (precisa vir depois de `pecas_3d`).
- Conferência em produção antes de aplicar: 0 políticas restritivas, 0 nomes em conflito, `private.is_blocked` igual ao do teste, gatilhos só de `updated_at`/vínculo, 0 lembretes com conversa alheia, 2 pessoas ativas; ensaio em transação desfeita (ativa grava, bloqueada 42501, nada sobrou).
- **Aplicada em produção às 11:31** (versão `20261123143149` no Supabase). Depois: 42 políticas restritivas, 0 de delete; as duas contas ativas (admin e membro) inserem, alteram e apagam normalmente (verificado numa transação desfeita, nada ficou).
- **Rollback** no cabeçalho da migração (só derruba políticas e a função; nenhum dado muda).

### 23/11/2026 12:10– · Claude Code, tarefa 9 (Tudo por voz: agentes)
- Matriz seção 11: só restava criar/editar agentes (o Cursor já tinha feito velocidade/voz, conversa anterior, apagar registro de meta, conta e receita principal). Feitas `agente_criar` e `agente_editar`. Sobrou `agente_apagar` (registrado na matriz como lacuna).

### 23/11/2026 11:35– · Claude Code, tarefa 8 concluída (telemetria de erros e e2e com login)
- **8b:** PR #77, merge `c2e4263` às 11:32, CI verde. e2e com login no CI contra Supabase local (17/17); corrigiu CSP, link Pular (44 px) e testes.
- **8a código:** rota, captura servidor/navegador, Admin › Erros recentes, resumo e alerta diário (docs/OBSERVABILIDADE.md). **Passo do Eduardo:** criar `TELEMETRIA_TOKEN` (Vercel + segredo do GitHub) para o alerta; sem isso o alerta só avisa que está desligado.
- **A revisar por outra IA:** ver o item "Telemetria de erros" na lista.
- **Próximo:** tarefa 9 (lacunas do Tudo por voz).

### 23/11/2026 11:05 · Cursor (Grok Bot), 3D: salvar peças e versões (pedido do Eduardo às 10:54)
- **Por quê:** o Eduardo testou o 3D em produção; gera bem, mas o histórico sumia ao fechar e abrir o GaDu.
- **Migrações aplicadas pelo Cursor via MCP (só aditivas, conferidas com RLS):** `20261123110001_telemetria_erros` (do Claude Code, PR #76) e `20261123140001_pecas_3d` (PR #78: `pecas_3d` e `pecas_3d_versoes`, 4 políticas cada, versão presa à peça por chave composta).
- **Código (PR deste branch `feat/3d-pecas-app`):** rotas `/api/3d/pecas` (GET lista 20, POST cria com a 1ª versão), `/api/3d/pecas/:id` (GET com 30 versões, PATCH medidas/título, DELETE), `/api/3d/pecas/:id/versoes` (POST, guarda as 30 mais recentes); a tela 3D salva sozinha cada resposta da IA e as medidas dos controles, mostra "Suas peças" (abrir, apagar, nova peça) e abre `/app/3d?peca=ultima|<id>`. Voz: `peca3d_abrir` ("abre a minha última peça", "abre o suporte no 3D"), cartão com confirmação.
- **Atenção S-05 (#74, rascunho):** as tabelas novas `pecas_3d`, `pecas_3d_versoes` (e `error_events`, que já não tem escrita do cliente) precisam entrar na lista de políticas restritivas antes do merge do S-05.
- **A revisar por outra IA:** `src/app/api/3d/pecas/**` (sessão, `.eq("user_id")`), `Studio3D.tsx` (salvar/abrir, debounce das medidas).
- **Próximo:** voltar à fila: observabilidade 8a (migração já aplicada), e2e com login (#77), voz de agentes, tetos e acumulado em Finanças, Metas fase 2.

### 23/11/2026 10:47– · Claude Code, tarefa 8a (migração da telemetria de erros)
- **Migração aditiva `supabase/migrations/20261123110001_telemetria_erros.sql`:** tabela `public.error_events` (origem servidor/cliente, rota sem query string, nome e código do erro, status HTTP, local `arquivo:linha`, versão do deploy, impressão digital em hash). **Sem texto de mensagem, e-mail, IP ou corpo** (o banco recusa rota com `?`, `#` ou espaço e não há coluna para isso). RLS: leitura só de administrador ativo (`members.role = 'admin'` e `access = 'active'`, com `(select auth.uid())`); escrita só por `service_role`; `authenticated` e `anon` sem insert, update ou delete. `user_id` com `on delete cascade`. Rollback: `drop table public.error_events;`.
- **Testes:** `supabase/tests/80_telemetria.test.sql` (admin lê, membro e admin bloqueado não, ninguém grava pelo cliente, CHECKs de privacidade, cascata) e a tabela entrou em `30_isolamento` (o caso de "A lê as próprias linhas" espera 0 para esta tabela, por ser só do administrador). `bash scripts/test-db.sh`: todos passaram.
- **(Aplicada pelo Cursor em 23/11 ~10:57, ver entrada das 11:05.)** Migração `20261123110001_telemetria_erros.sql`. Na época, nada foi aplicado no Supabase de produção. O Cursor aplica pelo MCP e registra em PROJECT_STATUS; depois retomo a 8a (rota `/api/telemetria/erro` com zod e limite de taxa, captura no servidor e no cliente, página no Admin, alerta gratuito). A 8b (e2e com login no CI) e a tarefa 9 não dependem da tabela e seguem.

### 23/11/2026 · 10:23– · Claude Code, revisão cruzada (tarefa 6) e segurança S-05/S-08 (tarefa 7)
- **Revisão (tarefa 6) concluída:** revisei #32, #34, #35, #36, #65, #67, #68, #69 e #70 (resultado em cada item acima). **1 bug real:** o limite de custo da busca (#65) usava um balde fora do `CHECK` do banco, então a busca por significado ficava sempre desligada. **PR #72**, merge `0088ca1` às 10:32, CI verde (verify, e2e-public, database), status do commit `success`, `/login` 200. Unit 303, integração 196, build. Os testes do #65 mockavam o banco: por isso não pegaram.
- **7a auditoria:** `docs/SECURITY_AUDIT_2026-11-23.md` (este PR de docs). Medido no banco local: pessoa bloqueada ainda grava em 18 tabelas; `reminders.conversation_id` aceita conversa de outra pessoa.
- **Não verificado:** nada em produção (sem acesso ao Supabase); não conferi o banco de produção contra as migrações (precisa do MCP do Cursor); aparelho e IA real seguem pendentes.
- **7b S-05 (RASCUNHO, sem merge):** PR da branch `fix/s05-escrita-por-acesso` com a migração `20261123150001_s05_escrita_por_acesso.sql` (`public.can_write()` + políticas restritivas de insert/update/delete em 18 tabelas + conversa própria em `reminders`), teste `supabase/tests/85_s05_escrita_por_acesso.test.sql` e rollback documentado e testado. `scripts/test-db.sh` passou inteiro (ativa grava 50 de 54 comandos; bloqueada 0; sem a migração a mesma bloqueada grava 50). **PRECISA DO OK DO EDUARDO** para mergear e aplicar. **NÃO está aplicada em produção.**
- **Próximo:** 7c (`docs/ORGANIZACOES.md`).

### 23/11/2026 10:20 · Cursor (Grok Bot), 3D ligado em produção
- O Eduardo ligou `MODELING_3D_ENABLED=1` na Vercel (produção) por volta das 09:37 e fez o redeploy; o 3D Studio (Beta) está no ar e ele confirmou que funcionou. Nenhum código do 3D mudou. Novas fases do 3D (3D-1b/3D-2) ficam para depois das outras frentes do roadmap.
- **Próximo:** Claude Code revisa os PRs do Cursor (#32, #34, #35, #36, #65, #67 a #70), depois segurança S-05/S-08, observabilidade e e2e com login no CI, voz para agentes, tetos e acumulado do ano em Finanças, Metas fase 2.

### 23/11/2026 10:15 · Cursor (Grok Bot), Tudo por voz: criar conta e receita principal
- **Feito:** ações `conta_criar` (cartão `conta_nova`, `POST /api/finance/itens`, Desfazer apaga o item) e `receita_principal` (acha a receita da pessoa, `PUT /api/finance/config`, Desfazer volta a anterior). Branch `feat/voz-conta-criar`.
- **A revisar por outra IA:** `ActionCard.tsx` (capture/execute de `conta_nova` e `receita_principal`), `acoes-resolver.ts` (`.eq("user_id")` na busca da receita).
- **Lacunas de voz que restam:** criar/editar agentes (TAREFA 9 do Claude Code).

### 23/11/2026 · 09:31–10:00 · Cursor (Grok Bot), troca de IA por cota
- **Troca:** a cota de 5 horas do Claude Code acabou às 09:31 (volta às 10:20). Segui como Cursor na revisão cruzada, que também precisa de outra IA para os PRs do Claude Code.
- **Revisei** #22 e #26 (marcados acima). Achado real no #22: busca por significado sem limite de custo; corrigido com testes (`test/search-limit.integration.test.ts`).
- **Também fiz (worktree `/workspace/gadu-cursor`, para não colidir com o Claude Code):** velocidade da fala e trocar a voz (PR #67, merge `e233bcf` às 09:50) abrir conversa anterior (PR #68, merge `e38a5c3` às 09:56) e apagar registro de progresso de meta (`meta_registro_apagar`). O Claude Code não deve refazer esses três itens da TAREFA 9.
- **Próximo:** o Claude Code retoma às 10:20 com a revisão dos PRs do Cursor (#32, #34, #35, #36) e dos restantes (#24, #28/#29, #30), depois segurança S-05/S-08.

### 23/11/2026 · 08:52–09:10 · Claude Code, Financeiro: simulador de salário (branch `feat/financas-simulador`)
- **Feito e publicado (PR #63, merge `e7c3d5d` às 09:07, CI verde: verify, e2e-public e database; status do commit `success`; `/login` 200 e `/api/finance/resumo` 401 sem sessão no ar):** `src/lib/finance/salario.ts` (INSS progressivo com teto, IRRF com dependentes, desconto simplificado quando mais vantajoso, redução da Lei 15.270/2025, imposto até R$ 10 não retido), com as fontes oficiais no código e em `docs/FEATURE-FINANCAS.md`; aba "Salário" no Financeiro (`SalarioSimulador.tsx`); pela conversa, `salario_simular` + `pedidoSalario` (o servidor calcula e injeta no contexto; o cartão é só de informação; `salvar` pede confirmação, grava na receita principal do mês e tem Desfazer). Sem migração, sem rota nova.
- **Verificado de fato:** typecheck, unit 294, integração 188, build, `scripts/test-db.sh`, e2e público e mobile contra `next start` na porta 3100 (servidor derrubado depois), capturas 40 a 43 a 390 e 1440 px. Os 16 casos de referência do teste foram calculados à parte em Decimal (Python), e o INSS máximo de R$ 988,09 bate com o publicado.
- **Fontes conferidas na hora:** INSS (gov.br/inss: faixas, Portaria nº 13/2026, teto), Receita (tabela mensal, dependente R$ 189,59, simplificado R$ 607,20), Planalto (art. 3º-A, Lei 15.270/2025). **A regra do "imposto até R$ 10 não é retido" não aparece na página da Receita**: a base é o art. 67 da Lei 9.430/1996 (conferido só por buscas, não no texto da lei).
- **Decisões:** (1) cartão do cálculo é só informação, sem botões e fora da confirmação falada (nada a gravar); (2) o valor e os dependentes do cartão vêm do que a pessoa disse, não do modelo; (3) salvar usa a receita principal já existente em `fin_config`: sem ela, só mostra o cálculo (criar receita/configurar continua lacuna na matriz); (4) a tela calcula no navegador com a mesma função pura (sem rota nova); (5) não revisei os itens abertos de outras IAs nesta sessão (a tarefa era só esta).
- **Não verificado:** a IA real (se respeita "não calcule" e usa `salario_simular` nas frases comuns), login no Supabase real, aparelho, a fala do resultado (quem fala ouve a frase do modelo; o cartão só aparece na tela).
- **Próximo passo:** validar com pessoa logada e com a IA real; teto por categoria e acumulado do ano.

### 23/11/2026 · 07:52–08:48 · Claude Code, UX-5 (PRs A a C)
- **Feito e publicado (três PRs pequenos, em sequência, merge antes do próximo):**
  - **PR #58** `feat/ux5-padrao-modulo`, merge `a70152a` às 08:03: padrão único de tela de módulo (título e frase, **uma** ação principal, resumo, lista, vazio com frase de exemplo e "Falar com o GaDu") em Tarefas, Projetos, Metas, Financeiro, Memória, Agentes e no painel Lembretes. Kit: `ModuleScreen`, `PrimaryAction`, `Summary`, `EmptyState` com `phrase`, `TalkProvider`.
  - **PR #59** `feat/ux5-cartao-unico`, merge `8f637ac` às 08:13: `ConfirmCard` e `CardFrame` como cartão único (conversa, tela de escuta e os "apagar, arquivar, desconectar" das telas); saem os botões "Confirmar: …" e os painéis de perigo soltos.
  - **PR #60** `feat/ux5-design-system-2`, merge `a211d40` às 08:44: 67 estilos inline estáticos viraram utilitários com tokens, `Field` e `BackButton`, 38 regras repetidas juntadas em `v2.css` e `globals.css`, `docs/DESIGN_SYSTEM.md` 2.3.
- **Registro:** publicado pelo PR de docs #61 (merge `07db500`, 08:48, CI rodado à mão: verify, e2e-public e database verdes).
- **Verificado de fato (em cada PR):** typecheck, unit (276, depois 278), integração 181, build, e2e público 10/10 e mobile 44/44 contra `next start`; CI verde (verify, e2e-public, database) e status do commit `success`; `/login` 200 no ar. No PR C, comparei os estilos computados de 15.277 elementos (14 telas × 5 larguras) da `main` e da branch: 0 diferenças. Ela pegou dois erros meus antes do PR (uma cor que perdia para `.row-i .s`; uma regra juntada que quebrava a barra lateral entre 1024 e 1279 px), e o e2e mobile pegou `.sheet`, que ficou fora da junção. Capturas a 412 × 915 e 1440 com dados fictícios em `/workspace/gadu-review/ux-after/` (30 a 90); scripts em `/workspace/gadu-review/` (`shoot-ux5.cjs`, `shoot-ux5b.cjs`, `check-confirm5.cjs`, `cs-dump.cjs`, `cs-diff.cjs`). `scripts/test-db.sh` não rodou (sem mudança de banco; o job `database` do CI passou).
- **Não verificado:** nada com login no Supabase real e nada no aparelho (voz, Voltar do Android, texto maior).
- **Decisões:** (1) Lembretes ganhou o padrão no painel de Hoje; uma tela própria pede mexer em `modules.ts` (fora do combinado). (2) "Perguntar ao GaDu" saiu do topo de Metas e Financeiro: o convite do vazio e o microfone central cobrem; no detalhe da meta o botão segue. (3) Memória (Descartar, Esquecer) continua com um toque só. (4) Nenhuma função nova que grave: a regra 8.1 não se aplica; a matriz da seção 11 ganhou só a nota do convite de falar. (5) Não toquei no 3D, em `modules.ts`, em banco nem em auth. (6) Não revisei os itens abertos de outras IAs (a tarefa era só o UX-5).
- **Ficou pela metade:** juntar as regras que se repetem entre `globals.css` e `v2.css`; `Field` nos formulários de várias linhas; tela própria de Lembretes; validar o padrão no aparelho (UX-6).
- **Próximo passo:** UX-6 com o Eduardo e uma pessoa não digital; rodar o e2e com login; lacunas da seção 11.

### 23/11/2026 · 06:47–07:33 · Claude Code, UX-4 (PRs A a D)
- **Feito e publicado (quatro PRs pequenos, em sequência, merge antes do próximo):**
  - **PR #52** `feat/ux4-linguagem`, merge `ed64dc0` às 06:57: sem "Beta", "Pessoal", "Agent Office" e "Plataforma" no topo das telas; bolha do GaDu só com "GaDu" e sem etiquetas [T1]/[M1] no texto (ficam em "Fontes"); Hoje com 1 ação principal e "Mais opções" recolhido; versão do app em "Detalhes".
  - **PR #53** `feat/ux4-desfazer`, merge `850f01b` às 07:09: aviso único "Feito · Desfazer" (`UndoToast`, `src/lib/undo.ts`, 8 s) em tarefas, lembretes, Revisão do dia, Financeiro, Metas, Memória e cartões da conversa; "desfaz" falado ou escrito.
  - **PR #54** `feat/ux4-erros`, merge `a79578f` às 07:18: catálogo `src/lib/errors.ts`, "Sem internet. Sua mensagem ficou guardada." com **Tentar de novo**, erro falado quando a pessoa usa voz, "tenta de novo" por voz.
  - **PR #55** `feat/ux4-primeiro-uso`, merge `36a41fb` às 07:29: guia de primeiro uso em 3 passos (nome; microfone e voz; Google), falado, com Pular, Voltar do Android e refazer em Configurações e por voz (`guia` no bloco "acoes"). Preferência em `profiles.settings.onboarding` (sem migração).
- **Registro da publicação:** este diário e a matriz foram publicados pelo PR de docs #56 (merge `f21e5d6`, 07:33, CI rodado à mão: verify, e2e-public e database verdes).
- **Verificado de fato (em cada PR):** typecheck, unit (até 273), integração (até 181), build, e2e público 10/10 e mobile 44/44 contra `next start`; CI verde (verify, e2e-public, database) e deploy da Vercel `success`; `/login` 200 depois de cada merge. Capturas a 412 × 915 com dados fictícios em `/workspace/gadu-review/ux-after/` (20 a 32). `scripts/test-db.sh` não rodou (sem mudança de banco; o job `database` do CI passou).
- **Não verificado:** nada com login no Supabase real e nada no aparelho (voz, microfone, gravação do nome e da marca do guia, Desfazer dos cartões da conversa). O teste novo do guia em `e2e/auth.e2e.cjs` foi escrito sem rodar.
- **Decisões:** (1) "desfaz" e "tenta de novo" são comandos locais (sem IA, sem custo), não ações do bloco "acoes"; só `guia` é ação nova. (2) Apagar memória, gasto ou evento pela conversa não ganhou Desfazer (o cartão já pede o "sim"). (3) O selo "Beta" da entrada 3D em Mais não foi tocado (frente 3D). (4) Não revisei os itens abertos de outras IAs nesta sessão (a tarefa era só o UX-4).
- **Próximo passo:** validar no aparelho com o Eduardo (UX-6), rodar o e2e com login, e então UX-5 (consistência entre módulos).

### 23/11/2026 · Claude Code, "Tudo por voz": lacunas (PRs A a D)
- **PR A (`feat/voz-tarefas-lembretes`):** tarefa cancelar, reabrir e editar (título, prioridade, prazo, projeto); lembrete adiar. Arquivos: `src/lib/acoes.ts`, `acoes-resolver.ts`, `chat-actions.ts`, `ActionCard.tsx`, testes unitários e 3 de integração em `test/goals-chat.integration.test.ts`. Sem migração.
- **Verificado de fato:** typecheck, unit 235, integração 152, build, e2e público 10/10 e mobile 44/44. Publicação (merge, CI, deploy) será registrada na entrada seguinte.
- **PR A publicado:** PR #47, merge `3eed4eb` em 05:49, CI verde, deploy `success`, site 200.
- **PR B (`feat/voz-financas-agenda`):** conta desmarcar e mudar valor do mês; gasto editar e apagar; evento editar e apagar. O escopo `calendar.events` já cobre editar e apagar (OAuth não mudou); rotas novas `PATCH`/`DELETE /api/calendar/:id`. Sem migração. Verificado: typecheck, unit 242, integração 160, build, e2e público 10/10 e mobile 44/44.
- **PR B publicado:** PR #48, merge `7db56d4` em 06:02, CI verde, deploy `success`, rota nova responde 401 sem sessão.
- **PR C (`feat/voz-metas-projetos`):** meta pausar, retomar, arquivar e editar (título, alvo, prazo); projeto editar (nome, objetivo) e arquivar (grava `done`, pois o banco não tem "arquivado"). Sem migração. Verificado: typecheck, unit 246, integração 163, build, e2e público 10/10 e mobile 44/44.
- **PR C publicado:** PR #49, merge `d3c9955` em 06:14, CI verde, deploy `success`.
- **PR D publicado:** PR #50, merge `4a7f9c3` em 06:32, CI verde, deploy `success`, `/login` 200.
- **PR D (`feat/voz-memoria-navegacao`):** memória aprovar, recusar e esquecer; nova conversa (cartão + "sim"); navegação por voz (`navegar`, instantânea, sem cartão). Sem migração. Verificado: typecheck, unit 251, integração 165, build, e2e público 10/10 e mobile 44/44. **Não verificado no navegador:** a navegação e a conversa nova em `GaduApp.tsx` (sem login nesta máquina).
- **Lacunas que restam** (matriz, seção 11): criar e editar agente; criar conta do Financeiro e configurar salário; apagar registro de progresso de meta; abrir conversa anterior; voz, velocidade, termos bloqueados e limites de IA em Configurações (notificações e Google exigem um toque).
- **Próximo:** validar o "Tudo por voz" com a IA real e no aparelho; depois as lacunas acima.

### 23/11/2026 · manhã · Claude Code, revisão dos itens de 22/11
- **Revisou:** PRs #38, #39, #42, #44 (Cursor) e #40 (3D-1, só segurança e custo), lendo os diffs e rodando os testes. Resultado em cada item da lista acima.
- **Corrigiu (PR `fix/revisao-23-11`):** (1) a confirmação falada aceitava "claro que não" e "sim, espera" como "sim"; (2) "muda para…" num lembrete já criado não o desfazia. Teste novo em `voice-confirm.test.ts`.
- **Verificado de fato:** typecheck, unit, integração, build e e2e público e mobile contra `next start`. Sem mudança de banco; `scripts/test-db.sh` não rodou nesta entrega.
- **Ficou aberto:** testes no aparelho e com a IA real, e2e com login, itens do 3D (c) a (f), PRs #22 a #36 anteriores.

### 22/11/2026 · 20:15–21:11 · Cursor (Grok Bot), resto do UX-3 e Tudo por voz
- **Fez e publicou:**
  - PR #38, texto grande (Normal, Grande 115%, Maior 130%), merge `ba3c6c5` às 20:43.
  - PR #39, confirmações faladas (sim, não, muda para…) e respostas faladas curtas, merge `87ab3bf` às 20:59.
  - PR #42, Tudo por voz: metas, marcos, tarefas da meta, concluir e adiar tarefa, cancelar lembrete, "paguei a luz", criar projeto e ajustes pela conversa, sempre com cartão e "sim" falado, merge `61334a1` às 21:11.
  - PR #44, UX-4 (começo): alvos de toque de 48 px no celular e em telas de toque, merge `a881411` às 21:26.
  - Este PR de documentação: regra 8.1 no AGENTS.md, matriz "Tudo por voz" (FEATURE_MATRIX, seção 11), ROADMAP, CHANGELOG e PROJECT_STATUS.
- **Evidências:** CI verde em todos os PRs (os de código refeitos sobre a `main` mais nova antes do merge); deploy Vercel `success` pelos status do GitHub; CSS novo conferido no ar; capturas em `/workspace/gadu-review/ux-after/` (09 a 16, máquina do agente).
- **Paralelo com o Claude Code (3D):** não mexi em arquivos do 3D nem em `src/lib/modules.ts`. O 3D adiciona as próprias ações pela conversa seguindo a regra 8.1.
- **Ficou pela metade:** as lacunas da matriz (cancelar, reabrir e editar tarefa; adiar lembrete; editar ou apagar gasto e evento; desmarcar conta; pausar e arquivar meta; memória; agentes; navegação por voz); e2e com login; teste no aparelho e com a IA real.
- **Próximo passo:** revisar #38, #39 e #42 (lista acima), fechar as lacunas mais usadas (cancelar tarefa, adiar lembrete, apagar gasto, "abre o Financeiro") e começar o UX-4.

### 22/11/2026 · noite · Claude Code, 3D-1 (3D Studio Beta)
- **Fez (local, 4 commits `feat(3d)` em `feat/3d-1-openscad`, sem push e sem PR):** o 3D-1 inteiro conforme [docs/FEATURE-3D.md](FEATURE-3D.md): rota `/api/3d/generate` (pipeline de custo do chat, fail closed), OpenSCAD WASM em Web Worker como componente GPL separado (`public/vendor/openscad/`), visualizador three.js, controles dos parâmetros, verificações da A1, STL e 3MF, interruptor `MODELING_3D_ENABLED` (desligado por padrão; entrada "3D" Beta no Mais; `/app/3d` e `/api/3d/*` 404 desligado), CSP própria só para o worker (páginas inalteradas). Sem migração.
- **Verificado de fato:** typecheck; unit 198/198 (com o OpenSCAD real em Node); integração 143/143; build; `scripts/test-db.sh`; e2e público 10/10 e mobile 44/44 contra `next start`; render real em Chromium a 412 × 915 e 1440 × 1000 (IA simulada); capturas em `/workspace/gadu-review/3d/` (fora do repositório).
- **Ambiente:** o Cursor trocou o checkout compartilhado `/workspace/gadu` para `feat/ux-texto-grande` com arquivos modificados. Para não colidir, o 3D foi feito num **git worktree** `/workspace/gadu-3d` (mesmo repositório, branch `feat/3d-1-openscad`). Para publicar: `git push` dessa branch a partir de qualquer um dos dois. `src/app/review3d/` (página só para capturas) está em `.git/info/exclude` e não vai para o repositório.
- **Não mexeu** em voz/escuta/fala, Configurações, Hoje, Assistente. Tocou o mínimo em `GaduApp.tsx` (uma prop opcional `modeling3dEnabled` repassada ao Mais), `ModulePage.tsx` (tile "3D"), `load.ts` e `modules.ts`. Possível conflito de merge em `GaduApp.tsx` com o Cursor (2 linhas).
- **Não fez:** a revisão dos itens "A revisar por outra IA" anteriores (o Eduardo pediu foco no 3D); o item novo do 3D está na lista.
- **Falta para 3D-1b/3D-2:** (1) ligar `MODELING_3D_ENABLED=1` num preview e rodar as 10 peças de referência com a IA real, medindo o custo por ajuste; (2) o Eduardo enviar o modelo de projeto A1 PLA 0.4 do Bambu Studio e ligar o botão (docs/FEATURE-3D.md); (3) refino por voz e imagem do render para a IA; (4) salvar versões no Supabase (migração, aprovação do Eduardo); (5) rodar o e2e com login (`E2E_3D=1`); (6) 3D-2 (foto → 3D).

### 22/11/2026 · 19:30–20:00 · Cursor (Grok Bot), ciclo UX
- **Fez e publicou:**
  - PR #33: passagem de bastão (`AGENTS.md`, `CLAUDE.md`, `docs/HANDOFF.md`, modelo de PR). Merge às 19:26.
  - PR #34, UX-1: barra de baixo Hoje · Conversa · microfone · Tarefas · Mais; tela Mais; sem menu sanfona; Configurações num lugar só; menu lateral simples. Merge às 19:41.
  - PR #35, UX-2: Hoje em 5 blocos, de cerca de 4,7 para 2,1 telas a 412 × 915; lista única com Feito/Adiar e Desfazer; `ref` em `/api/attention`. Merge às 19:48.
  - PR #36, UX-3 parte 1: tela de escuta em letra grande, envio sozinho em 3 s com Cancelar e conversa contínua. Merge às 19:54.
- **Evidências:**
  - CI verde nos 4 PRs;
  - deploy Vercel `success` pelos status do GitHub;
  - CSS novo conferido no site no ar;
  - capturas antes e depois, a 412 × 915 com dados fictícios, em `/workspace/gadu-review/ux-before` e `ux-after` (máquina do agente).
- **Como testar sem login:** uma página local `src/app/review/page.tsx`, que **não vai para o repositório** (está em `.git/info/exclude`), renderiza o `GaduApp` com dados fictícios. Build com `NEXT_PUBLIC_SUPABASE_URL=https://gadu-fake.example.com`; os scripts de Playwright em `/workspace/gadu-review/*.cjs` simulam o Supabase e as rotas.
- **Não mexeu** em arquivos do 3D: a frente 3D-1 é do Claude Code.
- **Ficou pela metade:**
  - do UX-3: confirmações faladas, respostas faladas mais curtas e opção de texto grande;
  - o e2e com login não foi rodado.
- **Próximo passo:** validar no aparelho com o Eduardo; depois o resto do UX-3 e o UX-4.

### 22/11/2026 · 19:30 · Cursor (Grok Bot)
- **Fez:** criou este sistema de passagem de bastão: [AGENTS.md](../AGENTS.md) (regras para qualquer IA), `CLAUDE.md` apontando para ele, este diário e o modelo de PR com "Feito por (IA)" e "Revisar".
- **PRs:** este PR de documentação.
- **Próximo passo:** UX-1 (navegação) e UX-2 (tela Hoje) do ROADMAP, em PRs pequenos.

### 22/11/2026 · 19:12 · Cursor (Grok Bot), revisão do plano
- **Fez:**
  - leu todos os `.md`;
  - fez uma revisão de experiência a 412 × 915, numa cópia local com dados simulados;
  - escreveu o plano do 3D por fases ([docs/FEATURE-3D.md](FEATURE-3D.md)) e o ciclo UX-1 a UX-6 no ROADMAP;
  - registrou a Casa Inteligente como adiada.
- **PRs:** #32 (merge às 19:12), #31 (registro da publicação de Metas, merge às 18:37).
- **Ficou pela metade:** nada.
- **Próximo passo:** UX-1/UX-2 (Cursor) e 3D-1 (Claude Code).

### 22/11/2026 · 14:00–18:33 · Claude Code (passos 1 a 4 do plano aprovado pelo Eduardo)
- **Fez e publicou:**

  | Entrega | Código | Registro da publicação |
  |---|---|---|
  | Segurança e custo P1 | PR #22 (merge às 14:54) | PR #23 (14:59) |
  | Core "atenção hoje" | PR #24 (15:42) | PR #25 (15:46) |
  | Financeiro base | PR #26 (16:44) | PR #27 (16:48) |
  | Correções do celular | PR #28 (17:19) | PR #29 (17:58, que também ajustou um teste de banco) |
  | Metas fase 1 | PR #30 (18:33) | — |

- **Autoria:** conferida pelo trailer `Co-Authored-By: Claude` nos commits dos PRs #22 a #30. Os PRs #31 e #32 não têm o trailer e foram feitos pelo Cursor/Grok Bot.
- **Ficou pela metade:**
  - validação com login em aparelho de verdade;
  - senhas vazadas no painel do Supabase e S-09 (backups no plano Free).
- **Próximo passo:** revisar a lista acima e seguir o ROADMAP (UX e 3D).
