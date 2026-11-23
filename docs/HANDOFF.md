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
| Ciclo UX (UX-1 a UX-3) e Tudo por voz | Cursor (Grok Bot) | — | **publicados** em 22/11 (PRs #34, #35, #36, #38, #39, #42). Próximo: lacunas da matriz "Tudo por voz" (FEATURE_MATRIX, seção 11) e UX-4 |
| 3D-1 (conversa → OpenSCAD) | Claude Code | `feat/3d-1-openscad` (PR #40, integrado) | **publicado** em 22/11/2026 às 20:55 (Brasília), PR #40, merge `6d87a5f`, CI verde (verify, e2e-public, database), deploy de produção da Vercel concluído. No ar: `/api/3d/generate` sem sessão 401, `/vendor/openscad/render-worker.js` 200 com a CSP própria, e2e público contra a produção 10/10. `MODELING_3D_ENABLED` não definida na Vercel: o 3D está **desligado** em produção até o Eduardo ligar. Falta: revisão por outra IA, PR, ligar o interruptor e testar com a IA real |

## A revisar por outra IA
Marque `[x]` quando revisar e anote quem revisou, a data e o resultado.
- [ ] **3D-1, 3D Studio Beta** (Claude Code, branch `feat/3d-1-openscad`, 4 commits `feat(3d)`): (a) `src/app/api/3d/generate/route.ts`: ordem limites → reserva → cota → IA → liquidação, fail closed, e que nenhum valor de custo ou `user_id` vem do cliente; (b) CSP: `src/lib/3d/csp.ts` e `next.config.ts` (CSP própria em `/vendor/openscad/*`) e a exclusão de `vendor/` no matcher de `src/proxy.ts`; confirmar que as páginas não ganharam `wasm-unsafe-eval`; (c) licença GPL do `public/vendor/openscad/openscad.js` (componente separado; ver README ao lado); (d) heurísticas de `src/lib/3d/checks.ts` (parede por raios é estimativa); (e) abrir `/app/3d` com `MODELING_3D_ENABLED=1` no aparelho (Chrome Android e Safari: o worker module e o WebGL não foram testados em WebKit); (f) o e2e com login (`E2E_3D=1`) foi escrito sem rodar.
- [ ] **PR #22, segurança P1** (Claude Code): orçamento só no servidor, etapa 2 da cota, limite de tentativas no login. Conferir se as rotas novas não aceitam valor de custo vindo do cliente.
- [ ] **PR #24, Core "atenção hoje"** (Claude Code): conferir a deduplicação entre fontes e o interruptor `CORE_MVP`.
- [ ] **PR #26, Financeiro base** (Claude Code): migração, RLS e isolamento entre pessoas; conferir os arredondamentos de valores e o interruptor `FINANCE_ENABLED`.
- [ ] **PR #28/#29, celular** (Claude Code): o Voltar do Android com uma entrada por camada. A navegação offline no WebKit é limitação do Playwright, então conferir num iPhone de verdade.
- [ ] **PR #30, Metas** (Claude Code): migração `metas_base`, cálculo de ritmo e interruptor `GOALS_ENABLED`.
- [ ] **PR #32, plano** (Cursor/Grok Bot): conferir se as fases 3D-0 a 3D-3 e o ciclo UX-1 a UX-6 no ROADMAP batem com o pedido do Eduardo.
- [ ] **PR #34, UX-1 navegação** (Cursor/Grok Bot): microfone central (toque fala, segurar abre o painel), tela Mais, fim do menu sanfona, Configurações unificada (`?tab=perfil` e `?tab=integracoes` rolam até a parte certa). Conferir o Voltar do Android no aparelho.
- [ ] **PR #35, UX-2 Hoje** (Cursor/Grok Bot): `toActionItem` em `src/lib/core/format.ts` (só `tasks`/`reminders` ganham `ref`); Feito/Adiar/Desfazer gravam pelo cliente com RLS em `AttentionCard.tsx`. Conferir com dados reais; "Virar tarefa" de e-mail saiu do Hoje.
- [ ] **PR #36, UX-3 voz** (Cursor/Grok Bot): `ListenSheet.tsx` e a contagem de 3 s; `voiceSheetRef` no `onText` do reconhecedor em `GaduApp.tsx`. Conferir no Chrome Android e no Samsung Internet se o fim da fala dispara a contagem e se o microfone sempre fecha.
- [ ] **PR #38, texto grande** (Cursor/Grok Bot): `src/lib/text-size.ts`, cookie `gadu_texto` lido em `src/app/layout.tsx`; todas as fontes em `calc(Npx * var(--ts, 1))`. Conferir no aparelho, com "Maior", se nada corta ou sobrepõe (barra de baixo, cartões, Financeiro).
- [ ] **PR #39, confirmações faladas** (Cursor/Grok Bot): máquina de estados em `GaduApp.tsx` (`confirmQ`, `listenConfirm`, `answerConfirm`, ramos `confirmListenRef` no reconhecedor), `parseAnswer` em `src/lib/voice-confirm.ts` ("não, foi 60 reais" = mudar), `Speaker.maxChars`. Conferir no Chrome Android e no Samsung Internet se o microfone abre depois da pergunta e sempre fecha.
- [ ] **PR #42, Tudo por voz** (Cursor/Grok Bot): (a) `src/lib/acoes-resolver.ts`: toda consulta com `.eq("user_id")` e cliente da sessão, `matchByName` devolve nada quando há empate; (b) `ActionCard.tsx` (`runAction`): `meta_tarefa` cancela a tarefa se o vínculo falhar; `conta_paga` usa `PUT /api/finance/itens/:id/mes`; (c) o estado dos cartões em `GaduApp` (`cards`, `cardOp`); (d) testar com a IA real se ela usa `acoes` nas frases comuns ("cria uma meta de…", "paguei a luz", "aumenta a letra").
- [ ] **PR #44, UX-4 alvos de 48 px** (Cursor/Grok Bot): bloco no fim de `src/app/ux.css` (`--touch: 48px` até 1023 px ou em tela de toque). Conferir no aparelho se nada ficou apertado.
- [ ] **e2e com login** (`e2e/auth.e2e.cjs`): os testes novos de Mais, Hoje e tela de escuta foram escritos sem rodar (faltam credenciais de teste nesta máquina). Rodar com o usuário de teste e corrigir o que falhar.
- [ ] **Validação com login no aparelho** de tudo o que foi publicado em 22/11 (pendência humana, com o Eduardo).

## Diário (mais recente no topo)

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
