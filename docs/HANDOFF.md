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
| Ciclo UX (UX-1 a UX-4) e Tudo por voz | Cursor (Grok Bot) e Claude Code | — | **UX-4 (PRs #52 a #55) e UX-5 (PRs #58 a #60) publicados em 23/11 pelo Claude Code**; UX-1 a UX-3 e Tudo por voz **publicados** (PRs #34, #35, #36, #38, #39, #42 em 22/11; lacunas da matriz fechadas em 23/11 pelos PRs #47 a #50). Próximo: validar com a IA real e no aparelho, lacunas que restam na seção 11 e UX-6 |
| Financeiro: simulador de salário | Claude Code | — | **publicado** em 23/11 (PR #63). Falta validar com a IA real e com pessoa logada |
| 3D-1 (conversa → OpenSCAD) | Claude Code | `feat/3d-1-openscad` (PR #40, integrado) | **publicado** em 22/11/2026 às 20:55 (Brasília), PR #40, merge `6d87a5f`, CI verde (verify, e2e-public, database), deploy de produção da Vercel concluído. No ar: `/api/3d/generate` sem sessão 401, `/vendor/openscad/render-worker.js` 200 com a CSP própria, e2e público contra a produção 10/10. `MODELING_3D_ENABLED` não definida na Vercel: o 3D está **desligado** em produção até o Eduardo ligar. Falta: revisão por outra IA, PR, ligar o interruptor e testar com a IA real |

## A revisar por outra IA
Marque `[x]` quando revisar e anote quem revisou, a data e o resultado.
- [x] **3D-1, 3D Studio Beta** (Claude Code, branch `feat/3d-1-openscad`, 4 commits `feat(3d)`): (a) `src/app/api/3d/generate/route.ts`: ordem limites → reserva → cota → IA → liquidação, fail closed, e que nenhum valor de custo ou `user_id` vem do cliente; (b) CSP: `src/lib/3d/csp.ts` e `next.config.ts` (CSP própria em `/vendor/openscad/*`) e a exclusão de `vendor/` no matcher de `src/proxy.ts`; confirmar que as páginas não ganharam `wasm-unsafe-eval`; (c) licença GPL do `public/vendor/openscad/openscad.js` (componente separado; ver README ao lado); (d) heurísticas de `src/lib/3d/checks.ts` (parede por raios é estimativa); (e) abrir `/app/3d` com `MODELING_3D_ENABLED=1` no aparelho (Chrome Android e Safari: o worker module e o WebGL não foram testados em WebKit); (f) o e2e com login (`E2E_3D=1`) foi escrito sem rodar. **Revisado por Claude Code em 23/11/2026:** só a parte de segurança e custo (a, b). (a) `/api/3d/generate`: sessão → interruptor → zod `.strict()` (user_id e custo no corpo são recusados) → privacidade → limites por motor → reserva (id da sessão) → cota → IA → liquidação, com `release` no `finally`; fail closed. (b) CSP própria só em `/vendor/openscad/*`, matcher do proxy exclui `vendor/`, páginas sem `wasm-unsafe-eval`. Nenhum problema real. (c) a (e) e (f) seguem abertos.
- [x] **PR #22, segurança P1** (Claude Code): orçamento só no servidor, etapa 2 da cota, limite de tentativas no login. Conferir se as rotas novas não aceitam valor de custo vindo do cliente. **Revisado por Cursor (Grok Bot) em 23/11/2026:** chat, importação de memórias e 3D passam por cota e orçamento no servidor, sem custo vindo do cliente; o cron exige `CRON_SECRET` com comparação em tempo constante. **Achado real:** `/api/search` chamava os embeddings pagos sem nenhum limite. Corrigido no PR `fix/revisao-antigos-busca`: limite de 60 buscas por 10 min por pessoa (hash do id), fail closed (a tela segue com a busca por texto).
- [x] **PR #24, Core "atenção hoje"** (Claude Code): conferir a deduplicação entre fontes e o interruptor `CORE_MVP`. **Revisado por Cursor (Grok Bot) em 23/11/2026:** cada fonte lê só o `user_id` da sessão e emite cada linha uma vez (tarefa atrasada, de hoje ou prioridade alta é um único fato); não há junção entre fontes diferentes (tarefa e e-mail parecidos aparecem os dois, o que é aceitável); `CORE_MVP=0` esconde o cartão e desliga a fonte no chat. Sem bug.
- [x] **PR #26, Financeiro base** (Claude Code): migração, RLS e isolamento entre pessoas; conferir os arredondamentos de valores e o interruptor `FINANCE_ENABLED`. **Revisado por Cursor (Grok Bot) em 23/11/2026:** as contas são em centavos (`toCents` com `Math.round`); com valores de 2 casas (os schemas só aceitam isso) o arredondamento é exato; `FINANCE_ENABLED=0` desliga rotas e ações. Sem bug.
- [x] **PR #28/#29, celular** (Claude Code): o Voltar do Android com uma entrada por camada. A navegação offline no WebKit é limitação do Playwright, então conferir num iPhone de verdade. **Revisado por Cursor (Grok Bot) em 23/11/2026:** no código, cada camada (painel, folha, escuta, confirmação, guia) ocupa uma entrada no histórico e o e2e mobile cobre o Voltar (44/44 no CI). Falta só o iPhone de verdade (pendência humana).
- [x] **PR #30, Metas** (Claude Code): migração `metas_base`, cálculo de ritmo e interruptor `GOALS_ENABLED`. **Revisado por Cursor (Grok Bot) em 23/11/2026:** `calcularProgresso`/`calcularRitmo` cobrem metas que diminuem (82 → 75 kg), prazo vencido, sem prazo, pausada/arquivada, e a tolerância de 5 pontos; datas em dias de Brasília (sem horário de verão). Sem bug.
- [ ] **PR #32, plano** (Cursor/Grok Bot): conferir se as fases 3D-0 a 3D-3 e o ciclo UX-1 a UX-6 no ROADMAP batem com o pedido do Eduardo.
- [ ] **PR #34, UX-1 navegação** (Cursor/Grok Bot): microfone central (toque fala, segurar abre o painel), tela Mais, fim do menu sanfona, Configurações unificada (`?tab=perfil` e `?tab=integracoes` rolam até a parte certa). Conferir o Voltar do Android no aparelho.
- [ ] **PR #35, UX-2 Hoje** (Cursor/Grok Bot): `toActionItem` em `src/lib/core/format.ts` (só `tasks`/`reminders` ganham `ref`); Feito/Adiar/Desfazer gravam pelo cliente com RLS em `AttentionCard.tsx`. Conferir com dados reais; "Virar tarefa" de e-mail saiu do Hoje.
- [ ] **PR #36, UX-3 voz** (Cursor/Grok Bot): `ListenSheet.tsx` e a contagem de 3 s; `voiceSheetRef` no `onText` do reconhecedor em `GaduApp.tsx`. Conferir no Chrome Android e no Samsung Internet se o fim da fala dispara a contagem e se o microfone sempre fecha.
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
- [ ] **Tudo por voz do Cursor em 23/11** (PRs #67 e o de `conversa_abrir`): no aparelho, conferir a troca de voz e a velocidade; com login real, "abre a conversa sobre…" acha a conversa certa e abre o histórico dela.
- [ ] **e2e com login** (`e2e/auth.e2e.cjs`): os testes novos de Mais, Hoje e tela de escuta foram escritos sem rodar (faltam credenciais de teste nesta máquina). Rodar com o usuário de teste e corrigir o que falhar.
- [ ] **Validação com login no aparelho** de tudo o que foi publicado em 22/11 (pendência humana, com o Eduardo).

## Diário (mais recente no topo)

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
