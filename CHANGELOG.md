# GaDu · Changelog

Cada entrada diz em que estágio a mudança está: **desenvolvido** (código em branch), **testado** (testes automáticos ou verificação executada, descrita na entrada), **publicado** (na `main` e em produção na Vercel, com migrações aplicadas quando houver). Datas são as do commit. Antes de 12/11 o histórico foi reconstruído a partir do `git log` e do ROADMAP; o que não tem evidência registrada aparece como "verificação não registrada".

## Em aberto (não publicado)
- **3D-1 · 3D Studio (Beta): conversa → OpenSCAD → STL e 3MF** (branch `feat/3d-1-openscad`, 4 commits `feat(3d)`, de 22/11/2026) · **publicado** em 22/11/2026 às 20:55 (Brasília), PR #40, merge `6d87a5f`, CI verde (verify, e2e-public, database), deploy de produção da Vercel concluído. No ar: `/api/3d/generate` sem sessão 401, `/vendor/openscad/render-worker.js` 200 com a CSP própria, e2e público contra a produção 10/10. `MODELING_3D_ENABLED` não definida na Vercel: o 3D está **desligado** em produção até o Eduardo ligar. Interruptor `MODELING_3D_ENABLED` (desligado por padrão). Rota `/api/3d/generate` com o pipeline de custo do chat (reserva → cota → IA → liquidação, fail closed); OpenSCAD WASM (GPL, sem modificações) como componente separado em `public/vendor/openscad/`, só num Web Worker, com CSP própria sem rede (as páginas não mudaram); visualizador three.js, controles deslizantes, verificações da A1, STL e 3MF; 3MF "A1 PLA 0.4" pronto mas desativado até o Eduardo enviar o projeto. Pacotes: `three` 0.187.0 (MIT), `@types/three` (dev); `openscad-wasm-prebuilt` 1.2.0 (GPL-2.0-or-later) só como arquivo copiado. Sem migração. **Evidências (máquina local):** `npm run typecheck`; `test:unit` 198/198 (inclui o OpenSCAD WASM real compilando um cubo em Node); `test:integration` 143/143; `npm run build`; `scripts/test-db.sh` ok; e2e público 10/10 e mobile 44/44 contra `next start`; renderização conferida em Chromium real a 412 × 915 e 1440 × 1000 com a IA simulada (mexer num controle re-renderiza sem chamar a rota). **Não testado:** IA real (custo), WebKit/iPhone, e2e com login (`E2E_3D=1`), Samsung Internet.
- **PR #5 · Especificação de Finanças pessoais** (`docs/FEATURE-FINANCAS.md`): integrada em 22/11/2026 (merge `ff8fff0`); ver a entrada de publicação do PR #26.
- **PR #1 · Marco Zero: contexto mestre, auditoria de segurança, governança.** Só documentação, rascunho. O `DESIGN_SYSTEM.md` dele foi substituído pelo da `main` (PR #10).

## 2026-11-23 · Tudo por voz, PR C: metas (pausar, retomar, arquivar, editar) e projetos (editar, arquivar) · **testado** (branch `feat/voz-metas-projetos`)
- **Feito por:** Claude Code.
- **Novo pela conversa (cartão + "sim" falado; nada é gravado antes):** `meta_pausar`, `meta_retomar`, `meta_arquivar` (nada é apagado), `meta_editar` (título, alvo só em meta numérica, prazo), `projeto_editar` (nome, objetivo) e `projeto_arquivar`. As metas respeitam `GOALS_ENABLED`; o projeto não depende dele. Gravações pelas mesmas rotas e consultas das telas (`PATCH /api/goals/:id`; `projects` pela sessão, com RLS).
- **Decisão:** "arquivar projeto" grava o status `done` ("Concluído"), porque a tabela só tem `active`, `paused` e `done`; um status "arquivado" exigiria migração e não foi feito.
- **Evidência:** typecheck; unit 246/246; integração 163/163 (3 testes novos em `goals-chat`: cartões sem gravar, isolamento entre pessoas, interruptor e termo bloqueado); build; e2e público 10/10 e mobile 44/44. Sem migração. **Não testado:** IA real.
- **Publicação do PR B (registrada aqui):** PR #48, merge `7db56d4` em 23/11/2026 às 06:02 (Brasília), CI verde (verify, e2e-public, database), deploy da Vercel `success`, `/login` 200 e `DELETE /api/calendar/:id` sem sessão = 401 no ar.

## 2026-11-23 · Tudo por voz, PR B: finanças (conta e gasto) e agenda (editar e apagar evento) · **publicado** (PR #48, merge `7db56d4`, 06:02)
- **Feito por:** Claude Code.
- **Novo pela conversa (cartão + "sim" falado; nada é gravado antes):** `conta_desmarcar`, `conta_valor` (este mês ou até dezembro), `gasto_editar`, `gasto_apagar`, `evento_editar`, `evento_apagar`. Apagar tem confirmação explícita ("não dá para desfazer" no cartão e na pergunta falada). Gasto: valor, nome e dia ajudam a achar; se couber em mais de um, o GaDu pede mais detalhe em vez de escolher. Finanças desligado (`FINANCE_ENABLED=0`) não gera cartão de conta nem de gasto.
- **Agenda:** o escopo OAuth atual (`calendar.events`, já pedido para criar evento) permite editar e apagar, então **o OAuth não mudou**. Rotas novas `PATCH` e `DELETE /api/calendar/:id` (sessão, zod estrito, token da própria pessoa) e `updateEvent`/`deleteEvent` em `src/lib/google.ts`. O servidor lê a agenda (ontem a 45 dias) só para achar o evento pelo nome.
- **Evidência:** typecheck; unit 242/242; integração 160/160 (4 testes novos em `finance-chat`, `calendar-write.integration.test.ts` novo); build; e2e público 10/10 e mobile 44/44; rota nova sem sessão = 401 contra `next start`. Sem migração. **Não testado:** Google real (evento de verdade) e IA real.
- **Publicação do PR A (registrada aqui):** PR #47, merge `3eed4eb` em 23/11/2026 às 05:49 (Brasília), CI verde (verify, e2e-public, database), deploy da Vercel `success`, site no ar (`/login` 200).

## 2026-11-23 · Tudo por voz, PR A: tarefas (cancelar, reabrir, editar) e lembretes (adiar) · **publicado** (PR #47, merge `3eed4eb`, 05:49)
- **Feito por:** Claude Code.
- **Novo pela conversa (proposta com cartão e "sim" falado; nada é gravado antes):** `tarefa_cancelar`, `tarefa_reabrir`, `tarefa_editar` (título, prioridade, prazo, projeto pelo nome) e `lembrete_adiar` ("me lembra daqui a 1 hora", "adia para amanhã às 9"). Nomes só entre os itens da própria pessoa (sessão + `user_id`); título bloqueado não vira cartão. As gravações são as mesmas consultas das telas, com a sessão e a RLS. Sem migração.
- **Evidência:** typecheck; unit 235/235; integração 152/152 (3 testes novos: cartões sem gravar, isolamento entre pessoas, interruptores desligados); build; e2e público 10/10 e mobile 44/44 contra `next start`. `scripts/test-db.sh` não rodou (sem mudança de banco).

## 2026-11-23 · Revisão dos PRs de 22/11 e correção da confirmação falada · **testado** (PR de `fix/revisao-23-11`)
- **Feito por:** Claude Code.
- **Corrige:** o "sim" falado com negação ou pausa ("claro que não", "sim, espera") não grava mais; "muda para…" num item que o servidor já criou (lembrete) agora o desfaz em vez de duplicar.
- **Revisão (sem bug real):** #38, #42, #44 e a parte de segurança e custo do #40 (3D-1).
- **Evidência:** typecheck, unit 229/229, integração 149/149, build, e2e público e mobile contra `next start`. Sem migração.

## 2026-11-22 · UX-4 (começo) · Alvos de toque de 48 px no celular (PR #44, merge `a881411`) · **publicado**
- **Feito por:** Cursor (Grok Bot).
- **Estágio:** **publicado** em 22/11/2026 às 21:26 (Brasília), PR #44, merge `a881411`. CI verde (verify, e2e-public, database); deploy Vercel `success`; `--touch:48px` conferido no CSS do site no ar.
- No celular (até 1023 px) e em telas de toque, `--touch` passa de 44 para 48 px, e botões pequenos, chips, abas (inclusive as de Metas, que tinham 36 px), botões redondos, campos e o "Pular para o conteúdo" seguem o mínimo de 48 px. O computador com mouse não muda. Só CSS (`src/app/ux.css`).
- **Testes executados (22/11/2026):** auditoria com Playwright a 412 × 915 em 11 telas (Hoje, Conversa, Tarefas, Mais, Configurações, Financeiro, Metas, Projetos, Memória, Agenda, Lembretes): de 70 alvos abaixo de 48 px para 0 (os 6 restantes são as caixas escondidas dos interruptores, cujo alvo é a linha inteira), sem rolagem lateral; typecheck; 228 unitários e 149 de integração; build; e2e mobile 44/44 e público 10/10 contra `next start`.

## 2026-11-22 · Tudo por voz: ações de todos os módulos pela conversa, com confirmação (PR #42, merge `61334a1`) · **publicado**
- **Feito por:** Cursor (Grok Bot). Pedido do Eduardo às 20:43: "tudo no GaDu precisa poder ser feito por voz ou pela conversa".
- **Estágio:** **publicado** em 22/11/2026 às 21:11 (Brasília), PR #42, merge `61334a1`. CI verde (verify, e2e-public, database); deploy Vercel `success` (status do GitHub). Ainda não validado com pessoa logada em aparelho nem com a IA real.
- **O que a conversa passa a fazer (sempre como proposta; a pessoa confirma com um toque ou dizendo "sim"):** criar meta (número, percentual, marcos ou tarefas); registrar progresso e concluir meta pelo nome; adicionar e concluir marco; criar tarefa da meta; concluir e adiar tarefa; cancelar lembrete; marcar a conta do mês como paga ("paguei a luz"); criar projeto; ajustes do aparelho (tamanho do texto, conversa contínua, respostas curtas, resposta falada, tema). Tarefa anotada pela conversa vira cartão com **Desfazer**.
- **Como:** bloco de controle `"acoes"` com validação estrita (`src/lib/acoes.ts`, regras no prompt estável); o servidor resolve os nomes para ids só entre os itens da pessoa, com o cliente da sessão e `user_id` (`src/lib/acoes-resolver.ts`), respeitando `GOALS_ENABLED`, `FINANCE_ENABLED` e os termos bloqueados; o que não acha vira aviso. As gravações são as mesmas rotas e consultas das telas, com a sessão da pessoa. Sem migração.
- **Correção junto:** o estado dos cartões passou a morar no app, então a confirmação falada funciona mesmo quando o cartão não está à vista no painel do celular.
- **Testes executados (22/11/2026):** `npm run typecheck`; `npm test` 228 unitários e 149 de integração, 0 falhas (novos `acoes.test.ts`, `acoes-resolver.test.ts`, casos em `chat-actions.test.ts`, 4 em `goals-chat` e 2 em `finance-chat`, incluindo isolamento entre pessoas e interruptores); `npm run build`; Playwright a 412 × 915 com voz simulada (criar meta, conta paga, concluir tarefa, texto Maior, Desfazer da tarefa, toque no cartão sem voz).
- **Lacunas registradas** na matriz "Tudo por voz" (docs/FEATURE_MATRIX.md, seção 11). Regra nova para toda função: [AGENTS.md](AGENTS.md), seção 8.1.

## 2026-11-22 · UX-3 · Confirmações faladas e respostas faladas curtas (PR #39, merge `87ab3bf`) · **publicado**
- **Feito por:** Cursor (Grok Bot).
- **Estágio:** **publicado** em 22/11/2026 às 20:59 (Brasília), PR #39, merge `87ab3bf` (refeito sobre a `main` depois do PR #40, com o CI verde de novo). CI verde (verify, e2e-public, database); deploy Vercel `success`; CSS novo (`confirm-sheet`) conferido no site no ar.
- **Confirmações faladas:** quando a mensagem foi falada e a voz da resposta está ligada, o GaDu lê o que vai gravar (gasto, meta, evento, lembrete) e espera "sim", "não" ou "muda para…". Tela com a pergunta em letra grande e botões Sim/Não grandes; sem resposta, pergunta de novo e depois deixa o cartão; Voltar e Esc fecham sem gravar. Lembrete criado vira cartão com Desfazer.
- **Respostas faladas curtas:** fala cerca de 20 s e diz "O resto está na tela"; opção em Configurações › Voz (ligada por padrão); o briefing fala inteiro; o prompt pede a resposta direta em 1 ou 2 frases primeiro.
- **Código:** `src/lib/voice-confirm.ts`, `src/lib/chat-actions.ts`, `ActionCard.tsx` (substitui `EventCard`, `GastoCard` e `MetaCard`), `ConfirmSheet.tsx`, `Speaker.maxChars` em `src/lib/speech.ts`.
- **Testes executados:** typecheck; `npm test` 184 unitários e 126 de integração, 0 falhas; build; Playwright com voz simulada (sim grava, não apaga o lembrete, "muda para 60 reais" reenvia, silêncio desiste, toque em Sim, Voltar, resposta longa resumida, opção desligada fala tudo).

## 2026-11-22 · UX-3 · Texto grande em Configurações (PR #38, merge `ba3c6c5`) · **publicado**
- **Feito por:** Cursor (Grok Bot).
- **Estágio:** **publicado** em 22/11/2026 às 20:43 (Brasília), PR #38, merge `ba3c6c5`. CI verde; deploy Vercel `success`; CSS novo (`data-texto`, `--ts`) conferido no site no ar.
- Opção **Tamanho do texto** (Normal, Grande 115%, Maior 130%), aplicada pelo servidor (cookie `gadu_texto`) sem piscar. Todas as fontes do CSS viraram `calc(Npx * var(--ts, 1))`; corpo de 16 px no normal e textos secundários acima de 16 px no Grande e no Maior.
- **Testes executados:** typecheck; `npm test` 167 + 126, 0 falhas; build; Playwright a 412 × 915 (corpo 18,4 px e 20,8 px, sem rolagem lateral, a escolha sobrevive ao recarregar).

## 2026-11-22 · Passagem de bastão entre IAs (PR #33, merge `0b1c707`) · só documentação
- `AGENTS.md` (regras para qualquer IA), `CLAUDE.md` apontando para ele, diário `docs/HANDOFF.md` e modelo de PR com "Feito por (IA)" e "Revisar". Feito pelo Cursor (Grok Bot). Integrado em 22/11/2026 às 19:26 (Brasília), com CI verde rodado manualmente.

## 2026-11-22 · UX-3 (primeira parte) · Voz em um toque: tela de escuta com letra grande e envio sozinho em 3 s (PR #36, merge `b7b2320`) · **publicado**
- **Feito por:** Cursor (Grok Bot).
- **Estágio:** **publicado** em 22/11/2026 às 19:54 (Brasília), PR #36, merge `b7b2320`. CI verde (verify, e2e-public, database); deploy Vercel `success` (status do GitHub); CSS novo conferido no site no ar. Ainda não validado com pessoa logada em aparelho.
- **Um toque para falar:** o microfone central e o botão "Falar com o GaDu" abrem a **tela de escuta**:
  - "Estou ouvindo…" e a transcrição ao vivo em letra grande (26 px);
  - botão grande de parar;
  - quando a pessoa termina de falar, aparece "Enviando em 3…", com **Enviar agora**, **Cancelar** e **Corrigir o texto**;
  - depois do envio, a resposta aparece no painel do assistente (ou na Conversa).
  - Antes eram 3 toques: abrir o painel, tocar no microfone pequeno e tocar em Enviar.
- **Conversa contínua** (mãos-livres) liga e desliga na própria tela de escuta. É a mesma preferência de Configurações.
- **Voltar do Android e Esc** fecham a tela de escuta e param o microfone. Tocar e segurar o microfone continua abrindo o painel para escrever. Sem reconhecimento de voz no navegador, o toque abre o lugar de escrever.
- O microfone dentro da Conversa e do painel continua como antes: o texto fica no campo para revisar, a menos que "Enviar sozinho" esteja ligado.
- **Testes executados (22/11/2026):**
  - `npm run typecheck` ok;
  - `npm test`: 165 unitários e 126 de integração, 0 falhas;
  - `npm run build` ok;
  - Playwright local com reconhecimento de voz simulado: fala final, contagem e envio sozinho com a resposta no painel; Cancelar não envia; Voltar e Esc fecham; Parar para o microfone; o interruptor de conversa contínua grava a preferência.
  - Novo teste no `e2e/auth.e2e.cjs` (não rodado: exige credenciais).
- **Falta no UX-3:** confirmações faladas ("sim", "não", "muda para…"), respostas faladas mais curtas e a opção de texto grande (115% a 130%) em Configurações.

## 2026-11-22 · UX-2 · Tela Hoje curta: 5 blocos, "Falar com o GaDu" e uma lista só com Feito/Adiar (PR #35, merge `0e26745`) · **publicado**
- **Feito por:** Cursor (Grok Bot).
- **Estágio:** **publicado** em 22/11/2026 às 19:48 (Brasília), PR #35, merge `0e26745`. CI verde (verify, e2e-public, database); deploy Vercel `success` (status do GitHub); CSS novo conferido no site no ar. Ainda não validado com pessoa logada em aparelho.
- **Hoje em 5 blocos:**
  1. saudação com o botão grande **"Falar com o GaDu"** e a ação do momento;
  2. "Agora", com o próximo compromisso ou um convite para conectar o Google;
  3. **uma lista única "Merece sua atenção"**;
  4. "Peça com um toque", com 3 frases prontas;
  5. "Ver tudo": tarefas, compromissos, lembretes e Mais, todos tocáveis. Os lembretes abrem aqui mesmo, com "+ Novo".
- **Rolagem:** a 412 × 915, com dados fictícios, caiu de cerca de 4,7 telas (3.765 px) para cerca de 2,1 telas (1.663 px).
- **Lista única:** junta o Core (tarefas, lembretes, compromissos e e-mails), as metas que pedem atenção e as memórias para revisar.
  - Tarefas e lembretes têm **Feito** e **Adiar** (para amanhã) no próprio item, com aviso **"Desfazer"** por 6 s.
  - Saíram os blocos duplicados "Precisa de atenção" (tarefas, compromissos, lembretes e e-mails), "Suas metas", "Recomendações" e o catálogo "Módulos do GaDu".
- **API:** `/api/attention` passa a mandar `ref` (tabela e id) só em tarefas e lembretes da própria pessoa. A gravação continua pelo cliente com a sessão (RLS), como já era no Hoje.
- **Letra e toque:** no Hoje, corpo com no mínimo 16 px e botões de 48 px (antes havia 15 textos de 11 px).
- Tocar no título do topo volta ao começo da tela.
- **Testes executados (22/11/2026):**
  - `npm run typecheck` ok;
  - `npm test`: 165 unitários e 126 de integração, 0 falhas; o teste de integração de `/api/attention` passou a conferir `ref`;
  - `npm run build` ok;
  - Playwright num app local com dados fictícios: Feito, Desfazer, Adiar de tarefa e de lembrete gravam e revertem; a lista de lembretes abre pelo número; nenhum alvo abaixo de 48 px e nenhum texto abaixo de 16 px no conteúdo, salvo a data e os números grandes.
  - Novo teste no `e2e/auth.e2e.cjs` (não rodado: exige credenciais).
- **Fica para depois:** "Virar tarefa" a partir de um e-mail (o e-mail abre no Gmail pela lista); janelas livres da agenda (as antigas "Recomendações") pelo chat ("Priorizar meu dia").

## 2026-11-22 · UX-1 · Navegação simples: microfone no centro, "Mais" no lugar de Módulos, sem menu lateral no celular (PR #34, merge `2c8e98f`) · **publicado**
- **Feito por:** Cursor (Grok Bot).
- **Estágio:** **publicado** em 22/11/2026 às 19:41 (Brasília), PR #34, merge `2c8e98f`. CI verde (verify, e2e-public, database); deploy Vercel `success` (status do GitHub); CSS novo conferido no site no ar. Ainda não validado com pessoa logada em aparelho.
- **Barra de baixo (celular):** Hoje · Conversa · **microfone grande** · Tarefas · Mais.
  - Um toque no microfone fala com o GaDu de qualquer tela: abre o painel já escutando. Sem reconhecimento de voz no navegador, abre o campo de escrever.
  - Tocar e segurar abre o painel para escrever.
  - Durante a resposta, o toque para.
- **"Mais"** substitui "Módulos":
  - blocos grandes só com o que funciona: Agenda, Financeiro, Metas, Projetos, Memória, Agentes, Conversas anteriores, Configurações, Administração (só para administradores) e Ajuda;
  - planejados numa linha "Em breve", sem selos "Beta" ou "Planejado".
- **Menu sanfona do celular removido.** A conta fica em Mais › Configurações. Saiu também o botão duplicado de abrir o assistente no topo do celular.
- **Configurações num lugar só:** perfil, aparência e voz, conexões, custos, conta e privacidade, e ajuda. `?tab=perfil` e `?tab=integracoes` continuam válidos e abrem a mesma tela, já na parte certa.
- **Menu lateral do computador:** lista simples na mesma ordem do celular, sem grupos recolhíveis e sem planejados (ficam em "Em breve").
- **Nomes únicos:** Conversa, Memória, Configurações. Saiu o rótulo de módulo ("Pessoal", "Plataforma") acima do título.
- **Testes executados (22/11/2026, nesta máquina):**
  - `npm run typecheck` ok;
  - `npm test`: 165 unitários e 126 de integração, 0 falhas;
  - `npm run build` ok;
  - conferência com Playwright a 412 × 915 num app local com dados fictícios: microfone abre o painel, Voltar fecha, histórico pelo Mais, Perfil e Integrações abrem Configurações, tocar e segurar abre o painel.
  - O e2e com login (`e2e/auth.e2e.cjs`) foi atualizado para Mais e o microfone, mas não foi rodado: exige credenciais, como antes.
- **Capturas:** `/workspace/gadu-review/ux-before/` e `/workspace/gadu-review/ux-after/` (máquina do agente, fora do repositório).

## 2026-11-22 · Revisão geral do plano: 3D por fases, ciclo de UX com voz primeiro, Casa adiada · só documentação
- **Estágio:** só documentação, sem mudança de código nem de banco.
- **3D Studio:** especificação 3D-0 em [docs/FEATURE-3D.md](docs/FEATURE-3D.md) e fases no ROADMAP: 3D-1 (conversa → OpenSCAD WASM em Web Worker → three.js, controles deslizantes, verificações para a A1, STL, 3MF comum e 3MF "A1 PLA 0.4" a partir de um projeto-modelo do Bambu Studio), 3D-2 (figura a partir de foto com TRELLIS.2 ou Hunyuan3D-2.1 no Hugging Face ZeroGPU, reparo de malha) e 3D-3 (envio direto para a A1, depois). Sem serviço pago por geração.
- **UX:** novo ciclo "voz primeiro e uso simples" (UX-1 a UX-6) no ROADMAP, a partir de revisão do código e de capturas a 412 × 915 (telas com login num app local com dados simulados).
- **Casa Inteligente:** adiada por decisão do Eduardo; quando retomar, Home Assistant.
- **Correções de documentação:** PROJECT_STATUS e prioridades revisados; na matriz, itens dos PRs #22, #24, #26, #28 e #30 que ainda apareciam como "em desenvolvimento" ou "não publicado" agora estão como publicados; seção de Metas do ROADMAP sem a branch antiga.

## 2026-11-22 · Metas, base (PR #30, merge `901e27d`) · **publicado**

- Publicação: **publicada** em 22/11/2026 às 18:33 (Brasília), PR #30, merge `901e27d`. CI verde (verify, e2e-public, database). Migração `metas_base` aplicada na produção antes do merge (só aditiva); conferido: `goals`, `goal_progress`, `goal_milestones` e `goal_tasks` com RLS, 4 políticas cada, `anon` sem SELECT. Deploy de produção da Vercel concluído; home 200, `/api/goals` sem sessão 401, `/api/health` ok; e2e público contra a produção 9/9. `GOALS_ENABLED` não definida na Vercel (ligado por padrão). **Não verificado:** tela Metas, resumo do Hoje e propostas no chat com pessoa logada e em aparelho.
- **Estágio:** desenvolvido e testado localmente. Sem push, sem PR, sem migração aplicada em serviço remoto. Aprovado pelo Eduardo (inclusive tabelas novas).
- **Banco:** migração `20261122210001_metas_base.sql` (`goals`, `goal_progress`, `goal_milestones`, `goal_tasks`; RLS, chaves compostas, CHECKs; só aditiva, com uma restrição `unique (id, user_id)` em `tasks`; rollback no topo).
- **App:** cálculo de progresso e ritmo (`src/lib/goals/`), API `/api/goals/*`, tela Metas (Beta, mobile first), resumo no Hoje, fonte `goals` do Core e atualização como proposta com confirmação, `GOALS_ENABLED=0`.
- **Executado nesta máquina (22/11/2026), com commits na branch:** `npm run typecheck` ok; `npm test`: unitários 165 e integração 126, 0 falhas; `npm run build` ok; `bash scripts/test-db.sh` todos passaram (usuário normal, Postgres 17 + pgvector); `npm run test:e2e:public` 9/9 e `npm run test:e2e:mobile` 44/44 contra `next start` local (Supabase fictício); conferência visual em 390 px e no tema claro com prévia temporária, já removida.
- **Não testado:** com pessoa logada, em aparelho real, em produção; nenhuma chamada a IA real. `test:e2e:auth` não foi rodado (exige credenciais); o teste foi ajustado para Metas como Beta.
- **Limitações:** sem conquistas, recomendações, hábito, vínculo com projetos e agenda, indicadores de outros módulos e metas compartilhadas. Detalhe em [docs/METAS_CONQUISTAS.md](docs/METAS_CONQUISTAS.md).

## 2026-11-22 · Publicação do PR #28 (validação de uso diário no celular) · **publicado**
- PR #28 integrado em 22/11/2026 às 17:19 (Brasília), merge `97f4d642ebe695286ceaabc80d83b05cf47b304d`. CI verde: `verify`, `e2e-public` (com a suíte mobile) e `database`. Deploy de produção na Vercel: `success`.
- **Verificado em produção (só leitura):** `sw.js` com cache `gadu-v5`; `/icons/badge-96.png` 200; e2e público 8/8; suíte mobile 43/44 antes do ajuste do teste (falha só a navegação offline no WebKit, limitação do Playwright, investigada na entrada seguinte do ajuste, commit `89ec767`) e 44/44 com o ajuste rodando localmente contra a produção.
- **Não testado em aparelho real.** Os itens de [docs/CHECKLIST_CELULAR.md](docs/CHECKLIST_CELULAR.md) seguem pendentes com o Eduardo. O commit `89ec767` (ajuste do teste e docs) está só na branch `fix/mobile-offline-webkit`, sem push.

## 2026-11-22 · Validação de uso diário no celular (branch `fix/mobile-validacao`) · desenvolvido e testado localmente / emulado (publicado no PR #28, ver acima)
- **Estágio na época:** desenvolvido e testado localmente, com celular **emulado** (depois publicado no PR #28). Sem migração. Nenhum teste em aparelho de verdade foi feito; o que falta está em [docs/CHECKLIST_CELULAR.md](docs/CHECKLIST_CELULAR.md).
- **Bugs corrigidos (commits `76701d9` e `f741e6c` + docs):**
  - **Voltar do Android:** havia uma só entrada de histórico para qualquer número de camadas. Com assistente e menu abertos, o 1º Voltar fechava o menu e o 2º saía da tela. Agora há uma entrada por camada (`src/lib/overlay-history.ts`, usada em `GaduApp.tsx`), sem corrida entre fechar pela interface e o `popstate`, e o endereço da tela é reacertado depois.
  - **Voz falada:** frase longa sem pontuação era falada de uma vez (o Chrome do Android corta falas longas): agora o texto vira trechos de até 170 caracteres (`splitForSpeech`). O "despertador" pause/resume rodava também no Android, onde `pause()` cancela a fala: agora só no Chrome do computador. Vozes são consultadas no primeiro toque (`voiceschanged`), e voltar do segundo plano retoma a fala pausada.
  - **Reconhecimento de voz:** não é oferecido em HTTP puro; construtor que falha não derruba o app; `service-not-allowed` (Samsung Internet) ganhou mensagem própria; o microfone para ao ir para o segundo plano, ao bloquear a tela e ao sair do app.
  - **Notificações:** a assinatura que expira agora é refeita (`pushsubscriptionchange`) e a velha só é apagada depois de salvar a nova; o clique foca a janela e depois leva à rota (só rotas do próprio app, inclusive `//` recusado); selo da barra de status monocromático (`public/icons/badge-96.png`, antes era o ícone colorido, que o Android mostra como quadrado branco); Ajustes explica permissão negada e iOS sem suporte (`src/lib/push-client.ts`); `Notification` indefinido não quebra. `sw.js` passou a `gadu-v5`.
  - **CSP na tela offline:** a página `/offline` era estática e tinha 11 scripts bloqueados pela CSP (sem nonce); agora é dinâmica. Achado pela suíte nova; **a produção atual ainda tem o problema**.
  - **Alvos de toque:** o link "← GaDu" de Privacidade e Termos tinha 14 px de altura; agora 48 px.
  - **Campos e toque:** `enterkeyhint`, `autocomplete`, `autocapitalize`/`autocorrect` no login, mensagem e buscas; `touch-action: manipulation`, sem destaque cinza no toque, `text-size-adjust`; o campo em foco é mantido à vista quando o teclado abre.
  - Já estavam corretos e foram só verificados: viewport (`width=device-width, initial-scale=1, viewport-fit=cover`, sem bloquear zoom), `theme-color` claro e escuro, `100dvh`, `env(safe-area-inset-*)`, campos de 16 px, manifest completo (id, escopo, ícones 192, 512 e maskable), `Service-Worker-Allowed`, `manifest-src` e `worker-src` na CSP.
- **Testes novos:** `src/lib/overlay-history.test.ts` (7), mais casos em `speech.test.ts`, `errors.test.ts`, `src/lib/push-client.test.ts` (5), `test/sw.integration.test.ts` (6, service worker em ambiente simulado) e `e2e/mobile.e2e.cjs` (44 testes; `npm run test:e2e:mobile`), incluído no job `e2e-public` do CI (instala o WebKit também; `npm run e2e:browsers` agora instala os dois).
- **Executado nesta máquina (22/11/2026):** `npm run typecheck` ok; `npm test`: unitários 143 e integração 100, 0 falhas; `npm run build` ok; `bash scripts/test-db.sh` todos passaram (usuário normal); `npm run test:e2e:public` 8/8; `npm run test:e2e:mobile` 44/44 contra `next start` local (rodado 3 vezes, estável).
- **Produção (só leitura, `https://gadu-agent.vercel.app`, código ainda sem estas correções):** `test:e2e:mobile` 24 de 44. As 20 falhas são as mesmas 4 verificações nos 5 perfis: alvo de 14 px em Privacidade, campo de e-mail sem `autocapitalize`, destaque cinza no toque e CSP bloqueando scripts da tela offline; todas corrigidas aqui. Manifest, ícones, service worker, viewport, área segura e campos de 16 px passam; `getInstallabilityErrors` vazio nos 4 perfis Chromium. Lighthouse 13.6 (mobile, `/login`): local desempenho 95, acessibilidade 100, boas práticas 100, SEO 63; produção 93, 100, 100, 63. O SEO baixo é `is-crawlable` e é de propósito (o app é privado e usa `noindex`). O Lighthouse 13 não tem a categoria PWA nem `installable-manifest`; a instalabilidade foi verificada pelo CDP.
- **WebKit offline (investigado, só GET em produção):** a falha do iPhone 14 em produção vinha de `setOffline` do Playwright WebKit, que corta a rede antes do service worker (até recurso do cache do SW falha); não é bug do `sw.js`. O teste agora só confere o cache no WebKit e avisa no log; conferir no iPhone real. Detalhes em `docs/TESTES_E2E.md`.
- **Emulado:** motor Chromium e WebKit com perfil de celular (tela, UA, toque); UA do Samsung Internet sobre Chromium; offline, service worker e instalabilidade do Chromium de verdade; histórico, fala, reconhecimento e push com objetos simulados.
- **Não verificável sem aparelho:** teclado virtual real, microfone e reconhecimento, vozes e corte de falas no Chrome do Android, push de verdade, Voltar físico e gesto, instalação pelo menu, Samsung Internet real, iPhone real (iOS 16.4+ instalado), desempenho e bateria. O "despertador" só no desktop e o comportamento de `pause()` no Android seguem a documentação e relatos conhecidos do Chrome, não foram observados em aparelho.

## 2026-11-22 · `41eb3ed` · Finanças, base: Contas e Dia a dia (PR #26) · publicado
- **Publicado.** PR #26 integrado em 22/11/2026 às 16:44 (Brasília), merge commit `41eb3edd7caaf640675f970f2dd2457dd942c8bf`. CI do PR verde: `verify`, `e2e-public`, `database`. Antes, o PR #5 (especificação) foi atualizado com a `main` e integrado às 15:49 (Brasília), merge `ff8fff0`.
- **Migração aplicada na produção antes do merge** (só aditiva): `financas_base`, versão `20261122194404`. Conferido: as 4 tabelas `fin_*` com RLS ligada, 4 políticas cada, `anon` sem SELECT. Assessor de segurança do Supabase sem avisos novos.
- **Deploy de produção da Vercel:** `success`.
- **Produção:** home 200; `/api/finance/resumo` sem sessão 401; `/api/health` ok.
- **e2e público** (8 testes) contra a produção: 8 passaram.
- **Flags:** `FINANCE_ENABLED` e `CORE_MVP` não estão definidas na Vercel, então o recurso está ligado por padrão.
- **Não verificado em produção:** tela Financeiro e lançamento pela conversa com pessoa logada, em aparelho.
- Detalhes do desenvolvimento e dos testes locais na entrada a seguir.

## 2026-11-22 · Finanças, base: desenvolvimento (branch `feat/financas-base`) · desenvolvido e testado localmente
- **Desenvolvido.** Primeira fatia da especificação (aprovada pelo Eduardo, inclusive as tabelas novas com RLS). Publicada na entrada acima (PR #26). Nome do arquivo na época: `20261122190001_financas_base.sql`; na produção a migração está registrada como `20261122194404`.
- **Banco (aditiva):** `supabase/migrations/20261122190001_financas_base.sql` cria `fin_itens`, `fin_item_meses`, `fin_gastos` e `fin_config`; `user_id` da sessão, RLS ligado, 16 políticas só para `authenticated` com `(select auth.uid()) = user_id`, `anon` sem nenhum privilégio, `authenticated` sem TRUNCATE/REFERENCES/TRIGGER, CHECKs (valor > 0, mês 1-12, dia 1-31, data existente, `meio`, `tipo`, `origem`), índices por `(user_id, ano, mes)`, vínculos por chave composta, sem função nem trigger. Rollback comentado no topo.
- **Código:** `src/lib/finance/` (resumo, vínculos, previsão, lançamento, schemas, flag); `src/app/api/finance/*` (resumo, itens, valor/pago por mês, gastos, config); `src/lib/core/finance.ts` (fonte `finance` do Core); `FinanceiroPage.tsx` e `GastoCard.tsx`; módulo Financeiro de "planejado" para Beta; `/api/chat` entende perguntas financeiras e propõe lançamentos.
- **Comportamento:** perguntas sobre gastos e contas injetam o bloco `[F1]…` com "Fontes" para o Financeiro, sem IA extra; "gastei 45 no mercado no pix" só gera uma proposta, que a pessoa confirma antes de gravar (a gravação é pela rota, com a sessão dela). Custo continua pelos limites, reserva, cota diária e liquidação (fail closed). Termos bloqueados e dado sensível viram "(omitido pela regra de privacidade)".
- **Flags:** `FINANCE_ENABLED=0` esconde a tela e desliga rotas, fonte do Core e proposta de gasto (ligado por padrão); `CORE_MVP=0` desliga só a fonte `finance`. Nenhuma variável foi criada na Vercel.
- **Testes executados localmente:** `npm run typecheck` ok; `npm test` (unitários 124, integração 94, 0 falhas); `npm run build` ok; `bash scripts/test-db.sh` todos passaram (inclui `60_financas.test.sql` e o isolamento A x B agora em 22 tabelas, com verificação de que toda tabela do `public` está na suíte); e2e público 8 de 8 contra `next start` local (inclui as 12 rotas `/api/finance/*` com 401 sem sessão). Tela conferida em 390 px (escuro e claro) e 1280 px com dados fictícios interceptados: sem rolagem lateral, sem alvo abaixo de 40 px, sem erro no console.
- **Não verificado:** a migração em um Supabase real; a tela com pessoa logada e dados reais; teste de interface com login (`e2e/auth.e2e.cjs` foi ajustado para o Financeiro Beta, mas não rodou); voz e lançamento por voz no aparelho; custo por mensagem.
- **Limitações:** sem teto por categoria, saldo do banco, caixa, acumulado do ano, print/PDF/áudio dedicado, log nem regras de classificação; simulador bruto → líquido é o próximo item (não implementado).

## 2026-11-22 · `215edab` · Core Contextual: "O que merece minha atenção hoje?" (PR #24) · publicado
- **Publicado.** PR #24 integrado em 22/11/2026 às 15:42 (Brasília), merge commit `215edab0d7d879e3483d0a6d77539609ce95f39c`. CI do PR verde: `verify`, `e2e-public`, `database`.
- **Deploy de produção da Vercel:** `success`.
- **Produção:** home 200; `/api/attention` sem sessão 401 (rota nova no ar); `/api/health` ok.
- **e2e público** (7 testes) contra a produção: 7 passaram.
- **Migrações:** nenhuma.
- **Flag:** `CORE_MVP` não está definida na Vercel, então o recurso está ligado por padrão.
- **Não verificado:** tela Hoje e Fontes com pessoa logada; Gmail e agenda reais; voz no aparelho; custo por mensagem medido.
- Detalhes do desenvolvimento e dos testes locais na entrada a seguir.

## 2026-11-22 · Core Contextual: desenvolvimento (branch `feat/core-atencao-hoje`) · desenvolvido e testado localmente
- **Desenvolvido.** Primeira entrega do Core, aprovada pelo Eduardo: escopo pessoal, só leitura, sem banco novo e sem migração. Publicada na entrada acima (PR #24).
- **Código:** `src/lib/core/` (`scopes`, `plan`, `collect`, `format`, `flag`, `privacy`, `google-adapter`, fontes `tasks`, `reminders`, `agenda`, `email`); `/api/chat` injeta o bloco do Core quando a intenção é "atencao_hoje" e envia o evento `sources`; rota nova `/api/attention` (zod, sessão obrigatória); `AttentionCard` na tela Hoje; `SourcesDetail` ("Fontes") no assistente e na Conversa.
- **Comportamento:** nenhuma chamada de IA nova; custo continua pela reserva, cota diária e liquidação já existentes (fail closed). Core usa só o cliente da sessão (RLS); termos bloqueados e dado sensível viram "(omitido pela regra de privacidade)". Gmail: até 5 não lidos das últimas 48 h, só remetente e assunto, e só com o escopo `gmail.readonly` já concedido; senão vai para "indisponível". Com o Core ligado e a intenção, o chat não lê o Google duas vezes (o caminho antigo só roda se pedir a semana).
- **Flag:** `CORE_MVP=0` desliga (chat e Hoje voltam ao comportamento anterior). Ligado por padrão porque não há acesso às variáveis da Vercel agora; para desligar em produção será preciso criar a variável lá.
- **Testes executados localmente:** `npm run typecheck` ok; `npm test` (unitários 76, integração 67, 0 falhas); `npm run build` ok; `bash scripts/test-db.sh` todos passaram (inclui `50_core_atencao.test.sql`: consulta do Core como B só devolve itens de B); e2e público 7 de 7 contra `next start` local (inclui `/api/attention` 401 sem sessão).
- **Não verificado:** tela Hoje e "Fontes" em celular (390 px) com pessoa logada e dados reais; Gmail e Calendar reais; comportamento em produção.

## 2026-11-22 · `cc85040` · Segurança P1 / fase 0 do Core (PR #22) · publicada
- **Publicado.** PR #22 integrado em 22/11/2026 às 14:54 (Brasília), merge commit `cc850400ff982d2463cf750de539fa194b04b5b6`. CI do PR verde: `verify`, `e2e-public`, `database`.
- **Migrações aplicadas no Supabase de produção:** aditiva antes do deploy (versão `20261122175405`, `seguranca_p1_aditiva`); restritiva depois do deploy (versão `20261122175542`, `seguranca_p1_restritiva`).
- **Deploy da Vercel** (`gadu-agent`) do merge commit: "Deployment has completed". Site: home 200, `/app` redireciona para `/login`, `/api/chat` sem sessão 401, `/api/health` ok.
- **Prova de que o código novo está no ar:** uma tentativa de login com e-mail fictício gerou linhas em `private.rate_limits` (`password_ip` e `password_email`).
- **Conferido no banco depois da restritiva:** `consume_quota` não existe; `authenticated` sem EXECUTE em `settle_ai_budget`; sem INSERT em `usage_events`; `anon` com 0 privilégios de tabela em `public`; `consume_daily_quota` e `budget_status` continuam para `authenticated`.
- **Assessor de segurança do Supabase:** avisos de SECURITY DEFINER de 6 para 2 (`budget_status` e `consume_daily_quota`, intencionais). Senhas vazadas continua desligado (passo manual).
- **e2e público** (6 testes) contra a produção: 6 passaram.
- **Não verificado:** chat com uma pessoa logada em produção (e2e com login precisa de credenciais); encerramento de sessões ao bloquear em produção.
- **S-09 pendente:** plano Supabase da organização é Free (sem backups automáticos baixáveis nem PITR); depende de decisão do Eduardo (plano Pro ou dump lógico agendado).
- Detalhes do desenvolvimento (código, migrações, testes locais) na entrada a seguir.

## 2026-11-22 · Segurança P1: desenvolvimento (branch `fix/seguranca-p1`)
(S-01, S-02, S-03 parcial, S-04, S-05 parcial, S-06, S-07, S-10, S-11, S-12). Desenvolvido e testado localmente; publicação na entrada acima.
  - **Migrações** (nunca editou uma antiga): `20261122120001_seguranca_p1_aditiva.sql` (funções `server_*` de orçamento só para `service_role`, tabela e função do limite de tentativas, `server_revoke_user_sessions`, recusa de quem não está ativo em `consume_daily_quota` e `index_backlog`; compatível com o app de hoje) e `20261122120002_seguranca_p1_restritiva.sql` (revoga as funções antigas de orçamento, remove `consume_quota`, fecha insert em `usage_events`, tira `anon` do schema `public`). Ordem: aditiva → deploy → restritiva. Cada uma com rollback no topo.
  - **Código:** orçamento pelo cliente do servidor com o id da sessão (`src/lib/ai-budget.ts`); estimativa no cancelamento (`src/lib/partial-cost.ts`); chat sem contingência de cota; limite de tentativas (`src/lib/rate-limit.ts`, `client-ip.ts`) em `/api/auth/*` e `/api/invite/accept`, com 429 em português e fail open se o contador cair; agendador ignora bloqueados; bloqueio encerra sessões e protege admins (`src/lib/admin-guard.ts`; a tela de admin mostra a mensagem de recusa); proxy com 503 sem configuração.
  - **Testes:** `test:db` com `40_seguranca_p1.test.sql`, `compat/aditiva_compat.sql` (roda entre as duas migrações), corrida de 20 liquidações simultâneas e testes de cota e orçamento migrados para as funções do servidor; integração para chat (fail closed sem `consume_quota`, liquidação no servidor, `already`, estimativa no cancelamento), limite de tentativas, bloqueio de admin, agendador e proxy. A imitação do Supabase ganhou privilégios padrão de função e `auth.sessions`.
  - **Executado localmente** (Postgres 17 com pgvector, usuário normal): `bash scripts/test-db.sh` aprovado (303 verificações `ok`, 0 falhas); `GADU_AUDIT=1` mostra S-01, S-03 (contador), S-04, S-05 (custo e cota), S-07, S-10 e S-12 como CORRIGIDO e S-05 (escrita direta em tabelas) como AINDA PRESENTE; `npm run typecheck`; `npm test` (54 unitários e 51 de integração, 0 falhas); `npm run build`. Não há script de lint no projeto. Testes de interface (`test:e2e`) e CI do GitHub **não foram executados** nesta etapa.
  - **Docs:** `docs/SEGURANCA_P1_MANUAL.md` (ordem de implantação, conferências, senhas vazadas, backups, RPO e RTO, ensaio de restauração, Vercel Firewall), status por S-xx na auditoria, `PROJECT_STATUS.md` e `ROADMAP.md`.
  - **Não executado na época do desenvolvimento:** encerramento de sessão no Auth real (testado só com imitação). Depois, na publicação, foram aplicadas as migrações; o painel do Supabase e da Vercel não foi alterado.

## 2026-11-16 · `b992422` · Isolamento e preparação do Core (PR #20)
- **Banco de teste completo:** `scripts/test-db.sh` aplica **todas** as 9 migrações, em ordem, inclusive a de pgvector. Antes eram 5. Sem pgvector, o teste falha em vez de pular tabelas. O shim ganhou o schema `extensions`.
- **Isolamento entre pessoas** (`supabase/tests/30_isolamento.test.sql`, com dados sintéticos):
  - 18 tabelas: leitura própria; sem leitura, alteração, exclusão ou inserção na outra pessoa; nada sem login; linhas intactas;
  - vínculos cruzados (tarefa, mensagem e conversa com dono diferente);
  - a pessoa não muda o próprio papel ou acesso;
  - `search_similar` só com os próprios itens;
  - funções do agendador recusadas.
- **Auditoria em execução** (`npm run audit:db`, `supabase/tests/audit/riscos_conhecidos.sql`): S-01, S-05, S-07, S-10 e S-12 confirmados localmente. Nada muda no banco de produção.
- **CI:** o job `database` instala o pgvector e passa a rodar o isolamento em todo PR.
- **Docs novos:** `docs/CORE_ATENCAO_HOJE.md` (proposta para decisão) e `docs/ROTEIRO_ANDROID.md`. Atualizados: auditoria (verificação em execução), testes, status e roadmap.
- Testado:
  - `npm run test:db`: 218 verificações, todas aprovadas (cota, orçamento, concorrência, isolamento);
  - `npm run audit:db`: 5 de 5 riscos confirmados;
  - typecheck, testes unitários e de integração, build;
  - testes de interface públicos (clone limpo) e com login (servidor local).
- **CI no GitHub** (run 43865196515): `verify`, `e2e-public` (6 aprovados, 0 pulados) e `database` aprovados. O `database` usou Postgres 18 com pgvector, aplicou as 9 migrações e passou no isolamento das 18 tabelas.
- **Publicado**: deploy `dpl_93GgJbNyQZH6AVPDyPZp11UUtJEx` `READY`. Sem mudança no app. Depois do deploy, em produção com o usuário de teste: 6 + 14 testes de interface aprovados, 0 pulados.

## 2026-11-15 · `4669181` · Qualidade e Segurança (PR #18; ajuste no PR #19)
- **Testes de interface:**
  - Playwright 1.63.0 como dependência oficial (versão fixa, lockfile atualizado);
  - suíte dividida em `e2e/public.e2e.cjs` (6 testes, sem login e sem segredos) e `e2e/auth.e2e.cjs` (14 testes, usuário de teste), com funções comuns em `e2e/helpers.cjs` e login por variável de ambiente em `e2e/login.cjs`;
  - **nada é pulado:** faltando variável, a suíte falha;
  - scripts novos: `test:e2e:public`, `test:e2e:auth`, `test:e2e`, `e2e:browsers`.
- **CI:** novo job `e2e-public` no `pr-checks.yml`. Ele sobe o app com um Supabase fictício e roda os testes públicos (home e login em 7 larguras, 401 nas APIs sem login, CSP, tema claro).
- **Corrigido** (achado pelos testes novos): links do topo e do rodapé da home e a marca agora têm 44 px.
- **Auditoria de segurança somente leitura:** `docs/SECURITY_AUDIT_2026-11-15.md`, com matriz S-01 a S-15, evidências do banco e do código e ordem de correção. Nada foi mudado no banco, RLS, autenticação, permissões ou custo.
- **Comentários corrigidos** (sem mudança de comportamento): cliente admin e cookies de sessão.
- **Docs novos:** `docs/TESTES_E2E.md` (inclui a proposta de testes com login no CI), `docs/VALIDACAO_APARELHOS.md` e `docs/CORE_CONTEXTUAL_MVP.md`.
- Testado:
  - typecheck, 46 testes unitários e 16 de integração, build;
  - os 6 testes públicos num **clone limpo depois de `npm ci`**, sem `.env`, com Supabase fictício (como no CI);
  - os 6 + 14 testes contra o servidor local com o usuário de teste: 20 aprovados, 0 pulados.
- **CI no GitHub:** o job `e2e-public` rodou 6 testes, 6 aprovados e 0 pulados.
- **Publicado**: deploy `dpl_DkLudEdzoaxcpiAQVN8WohUGjLyj` `READY`. Em produção, com o usuário de teste: 6 + 14 testes aprovados, 0 pulados. No PR #19, os testes de 401 e CSP passaram a medir pelo próprio navegador (o cliente HTTP do Playwright não usa o proxy de algumas redes). Rollback: reverter os PRs #18 e #19 ou promover o deploy do PR #17.

## 2026-11-14 · `18f1071` · Sprint UX/UI v2.2 (PR #16)
- **Navegação híbrida no celular** (`GaduApp.tsx`, `src/app/v2.css`):
  - a barra de baixo fica com o uso frequente: Hoje, Conversas, GaDu, Tarefas e Módulos;
  - nova tela **Módulos** (`ModulesHub`) para explorar o produto por área, com os planejados discretos;
  - o menu (☰) virou uma gaveta pela esquerda, só com conta, plataforma, histórico e guia (sem repetir a barra);
  - a gaveta fica sempre montada, com animação de entrada e saída e fundo escurecido;
  - fecha ao tocar fora, ao escolher um destino, com Esc e com o **Voltar do Android**;
  - respeita as safe areas e o "reduzir movimento", e trava a rolagem da página por trás.
- **Computador:** menu lateral por área (Produtividade pessoal, Vida pessoal, Agentes e criação, Plataforma), **recolhível só para ícones**, com a escolha salva no aparelho.
- **Assistente Universal em três estados**, com a mesma conversa nos três (`Assistant.tsx`):
  - compacto: o orbe;
  - rápido: painel com as últimas trocas, alça para fechar e link para as anteriores;
  - completo: a tela Conversa.
  - No computador, a borda do painel é arrastável (320 a 640 px, também pelo teclado).
  - O avatar do painel ganhou halo por estado.
  - Corrigido: o cabeçalho do painel ficava fora da tela no computador.
- **Voz:**
  - tocar enquanto o GaDu responde agora só interrompe (antes, abria o microfone junto);
  - o modo mãos-livres só volta a ouvir quando nada está acontecendo;
  - o envio automático vem **desligado por padrão**, e a transcrição fica no campo para revisar;
  - trocar de tela com o microfone aberto e sem controle à vista para a escuta;
  - no celular, o assistente não abre sozinho ao carregar.
- **Pendências da v2.1:**
  - botões do painel com 44 px, e todos os botões pequenos, chips, grupos e abas com 44 px;
  - `themeColor` e manifest com as cores novas;
  - abas de Configurações quebram em linhas no celular;
  - interruptores acessíveis (`role="switch"`, linha inteira clicável);
  - a Agenda é dona da própria página;
  - dicas próprias para Tarefas e Projetos;
  - Hoje mais compacto, com indicadores em uma linha e o cartão **"Agora"** (próximo compromisso real);
  - o estado da voz no cabeçalho só aparece quando há algo acontecendo.
- **Contexto:** a interface separa "Contexto da tela" (Beta) de "Inteligência integrada entre módulos" (Planejada).
- **Módulos novos, planejados:**
  - **Metas & Conquistas** e **Casa Inteligente (GaDu Casa)** no catálogo único (`modules.ts`), com páginas e especificação;
  - docs `CASA_INTELIGENTE.md`, `METAS_CONQUISTAS.md` e `INTEGRACOES_SAUDE.md` (Samsung Health e Health Connect).
  - Nenhuma integração real e nenhuma tabela.
- **Protótipo do Lovable:** encontrado e avaliado (`docs/LOVABLE_VISUAL_REFRESH.md`); incorporados o cartão "Agora" e o halo por estado.
- **Home e Guia** atualizados com a visão ampliada.
- Testado:
  - typecheck, 46 testes unitários e 16 de integração, build;
  - **16 testes de interface com Playwright** (`npm run test:e2e`, `e2e/ui.e2e.cjs`) contra o servidor local com o usuário de teste;
  - os testes cobrem: 7 larguras sem rolagem lateral e com alvos de 44 px; menu (toque fora, Esc, Voltar, escolha); tela Módulos; barra de baixo sem esconder conteúdo; temas; assistente (orbe, Voltar, alça, histórico compartilhado); voz simulada (microfone negado, revisão da transcrição, limite de 20 s, interrupção, troca de tela); interruptores; Tarefas e Projetos com fixtures, estado vazio e erro; menu recolhível e largura do painel no computador;
  - chat e voz simulados, sem chamada à IA paga.
- Não verificado: voz e teclado em aparelhos físicos; prévia navegável do protótipo do Lovable (bloqueada pela rede do ambiente).
- **Publicado**: deploy `dpl_DEQDkX2dCyP9tbdaHSit6HzniL6U` `READY`. Os 16 testes de interface também passaram **em produção** (usuário de teste; chat e voz simulados). Capturas reais em produção: Hoje, menu, assistente, Módulos, Casa, Metas, Conversa e home, em 390 e 1440 px, nos dois temas. Rollback: promover `dpl_BSXyR5vex6zNB5F1Z9f9M6SCZAxJ` (PR #14).

## 2026-11-14 · `9733685` · Sprint UX/UI v2.1 (PR #14)
- **Identidade** (`src/app/v2.css`):
  - paleta azul-marinho e grafite no lugar do preto puro; ciano, azul e laranja como cores de identidade; menos neon;
  - Michroma só na marca e no título da home; rótulos sem caixa alta espaçada;
  - marca em texto nos cabeçalhos (`.brand`); avatar só no assistente;
  - logo novo de três movimentos: **asset pendente**, não está no repositório.
- **Navegação** (`GaduApp.tsx`):
  - menu com grupos recolhíveis (estado salvo no aparelho), rolagem própria, "Em breve" para módulos planejados e Administração só para admin;
  - no celular, a folha não repete o que está na barra;
  - barra de baixo de 58 px, com orbe de 50 px que muda só em estado real.
- **Módulos** (`src/lib/modules.ts`): status Disponível, Beta, Em desenvolvimento e Planejado; telas novas Tarefas, Agenda, Integrações e Perfil.
- **Hoje** (`TodayPage.tsx`): saudação compacta por horário (de noite: Revisar o dia e Planejar amanhã), indicadores, "Precisa de atenção", recomendações a partir dos dados reais.
- **Conversa:**
  - palco compacto no celular, com Nova e Histórico em botões de ícone;
  - estado vazio com sugestões;
  - microfone dentro do campo;
  - a escuta para sozinha em 20 s;
  - "Enviar sozinho o que eu falar" pode ser desligado para revisar a transcrição.
- **Assistente Universal** (`Assistant.tsx`): painel que pode ser alargado no computador (520 a 600 px); no celular, acompanha o teclado (`visualViewport`).
- **Telas** (`v2-pages.css`, `kit.tsx`):
  - Tarefas e Projetos separados;
  - Agenda (estado vazio com Conectar o Google), Agentes, Memórias, Administração, Guia e Como funciona, páginas de módulo, cartão de evento e gaveta de conversas;
  - componentes `PageHeader`, `Panel` e `EmptyState`.
- **Home pública** (`src/app/page.tsx`): visão completa e bloco "Inteligência contextual" marcado como Beta.
- **Core Contextual:** arquitetura futura em `docs/CORE_CONTEXTUAL.md`; tipos em `src/lib/core-context.ts`, sem uso em produção.
- Corrigido:
  - dica duplicada em Projetos (chave do React repetida);
  - rótulo de duração "1h30h" na Agenda.
- Testado:
  - typecheck, 45 testes unitários e 16 de integração, build;
  - auditoria autenticada local em 360, 412, 768, 1024 e 1920 px, em 7 telas: sem rolagem horizontal; alvos de 44 px (exceto links dentro do texto e caixinhas dentro de linhas clicáveis de 48 px);
  - contraste AA medido nos dois temas;
  - capturas em 390 e 1440 px, nos temas escuro e claro.
- Não verificado:
  - voz em iPhone e Android (validação humana);
  - Administração e telas com dados reais (o usuário de teste não é admin e não tem dados).
- **Publicado**: deploy `dpl_BSXyR5vex6zNB5F1Z9f9M6SCZAxJ` `READY`. Capturas em produção com sessão autenticada, sem rolagem horizontal: Hoje (escuro e claro), Conversa, Projetos, Agenda, menu do celular, assistente aberto (computador e celular) e home, em 1440 e 390 px. Rollback: promover `dpl_HT87wCvBrfSDQjkJ7ANsfkuFAAPF` (PR #13).

## 2026-11-13 · `883ea23` · UX/UI v2 (PR #12)
- **Módulos** (`src/lib/modules.ts`, `ModulePage.tsx`): seis módulos com status real; módulo planejado abre uma página que diz que ele ainda não existe.
- **Navegação** (`GaduApp.tsx`, `src/app/v2.css`): menu lateral por módulos no computador; no celular, barra de baixo com o assistente no centro e folha de módulos.
- **Assistente Universal** (`Assistant.tsx`): voz e texto em qualquer tela, com a mesma conversa. Painel lateral no computador, painel de baixo expansível no celular.
- **Contrato de contexto** (`src/lib/assistant-context.ts`, `src/app/api/chat/route.ts`): rótulo de módulo e tela, validado no servidor; inválido é recusado com 400 antes de qualquer custo; não amplia o acesso.
- **Temas claro e escuro** (`src/lib/theme.ts`, `layout.tsx`): cookie `gadu_theme`; cores antigas viraram tokens.
- **Telas redesenhadas**: painel Hoje (`TodayPage.tsx`), Conversa, Perfil e ajustes (`SettingsPage.tsx`), home pública (`src/app/page.tsx`). Memória virou tela própria.
- Preservados: avatar animado, marca GaDu e `public/avatar`.
- Testado:
  - 45 testes unitários e 16 de integração (7 novos), typecheck, build e CI;
  - navegador com sessão autenticada de um usuário de teste, local e em produção, em 1440 e 390 px, nos dois temas, sem rolagem horizontal.
- **Publicado**: deploy `dpl_ENVExSFmz4Wq1BLn6drKSreuQc5j` `READY`. Em produção, o assistente respondeu pelo painel no computador e no celular e informou corretamente a tela ("módulo Pessoal, tela Tarefas e projetos").
- Não incluído: redesenho de Projetos, Agentes, Memória, Admin, Guia e Agenda (usam os temas, com o desenho anterior); cruzamento de dados entre módulos ou clientes; validação da voz nos aparelhos.

## 2026-11-13 · `fd77f84` · Design System v1, menu lateral e responsividade (PR #10)
- Tokens únicos em `:root` (`src/app/globals.css`): espaço, raio, texto, movimento, camadas, toque, gradiente holográfico.
- Computador (1024+): menu lateral fixo (`.side` em `src/components/GaduApp.tsx`), cabeçalho com o título da tela, sem o menu de baixo.
- Conversa no computador: avatar em 38%, leitura centralizada (máx. 760 px).
- Hoje: 2 colunas (700 a 1279 px) e 3 colunas (1280 px ou mais).
- Celular: logo no cabeçalho, conteúdo livre da voz flutuante, ☰ vira "Menu" (`ConversationsDrawer.tsx`).
- Acessibilidade: atalho "Pular para o conteúdo", alvos de toque de 40 px. Home com topo alinhado.
- Corrigido:
  - erro de hidratação na voz em Ajustes (`SettingsPage.tsx`);
  - seta dos itens de Ajuda fora do lugar.
- Novo `docs/DESIGN_SYSTEM.md`.
- Testado: capturas em 390, 768, 1024 e 1440 px (prévia local com dados fictícios para as telas do app), teclado, alvos de toque, console sem erro de hidratação, `npm test`, typecheck, build e CI.
- **Publicado**: deploy `dpl_H9wxTBkNm1uEKHvNTJV57dWP5q1R` `READY`; smoke test em produção ok.

## 2026-11-13 · `758286c` · Erros em português, telas de erro e voz mais estável (PR #9)
- `src/lib/errors.ts`: mensagens do chat por situação (sem internet, 429, 5xx, 504, 413) e do microfone; 4xx não repete a tentativa.
- Telas próprias: `src/app/error.tsx`, `global-error.tsx`, `not-found.tsx` (`ErrorScreen.tsx`).
- Voz (`src/lib/speech.ts`):
  - "terminou" só depois da resposta inteira;
  - prazo por trecho (iPhone sem aviso de fim);
  - despertador no Chrome;
  - voz presa limpa ao começar;
  - um microfone por vez;
  - o modo conversa volta a ouvir mesmo sem voz na resposta.
- Ajustes: teto e reservas do mês vindos de `budget_status()`, com valor disponível (`src/app/api/usage/route.ts`).
- Testado: 8 testes novos (`errors.test.ts`, `speech.test.ts` com síntese simulada); 40 unitários e 14 de integração; typecheck, build e CI. **Falta confirmar a voz nos aparelhos.**
- **Publicado**: deploy `dpl_ELAhLL3G7DMh3hfQSQKAhZ4Uu3rF` `READY`; página 404 conferida em produção.

## 2026-11-13 · `9e9351a` · Orçamento mensal com reserva e reconciliação (PR #6)
- Migração `20261113140001_ai_budget_reservations.sql`: `private.budget_policy` (US$ 20), `private.user_budget`, `public.ai_reservations` (RLS), `reserve/settle/release/expire_ai_reservations`, `budget_status`.
- App: o chat, o resumo e a importação reservam antes e liquidam pelo custo real; o agendador expira reservas vencidas.
- Testado:
  - 32 testes unitários, 14 de integração e `test:db` (31 checks SQL e concorrência: 20 reservas simultâneas de US$ 0,25 com teto de US$ 1,00 → exatamente 4);
  - em produção, com usuário temporário e rollback: teto, idempotência, liberação, isolamento entre pessoas, permissões.
- **Publicado**:
  - backup `private.backup_usage_events_20261113` (44 linhas, somas iguais);
  - migração aplicada (registro `ai_budget_reservations`);
  - deploy `dpl_CBrNxW8eLPRPTQ6tjFP2ba9iTrU1` `READY`;
  - **uso real**: 1 reserva liquidada e ligada ao consumo.

## 2026-11-13 · `fcf7415` · Documentação central (PR #7)
- Novos `PROJECT_STATUS.md`, `CHANGELOG.md` e `docs/FEATURE_MATRIX.md`.
- `ROADMAP.md` ganha uma visão por módulo, com prioridade, status, dependências e próximos passos.
- `docs/ARCHITECTURE.md` atualizado com o fluxo real do chat, a cota e as decisões oficiais.
- `CLAUDE.md` passa a apontar para a documentação central e para as decisões vigentes.
- **Publicado** (só documentação, merge `fcf7415`).

## 2026-11-12 · `c6bbb30` · GaDu Fast Track (PR #4)
- `docs/FAST_TRACK.md`, seção no `CLAUDE.md`, item "Modelo de trabalho" no ROADMAP.
- **Publicado** (só documentação; deploy `dpl_2vUKHfMwytwdzztYpVXhQkb34RhN` `READY`).

## 2026-11-12 · `d18286f` · Cota diária atômica (PR #3)
- Corrige três problemas da cota antiga:
  - a contagem passava do limite;
  - o limite vinha do cliente;
  - o dia virava às 21h de Brasília, porque usava UTC.
- Banco: `private.quota_policy` (150), `private.user_quota` e `public.consume_daily_quota()`.
- App: o chat chama a função nova sem enviar limite; a cota é a última verificação. Na transição, se a função não existir, usa a antiga.
- Testes: unitários, integração e `test:db` local, inclusive 40 chamadas simultâneas com limite 10 → 10; CI com job de banco.
- **Publicado**:
  - backup de `usage_daily` em `private.backup_usage_daily_20261113`;
  - migração aplicada (registrada como `20261113004434 daily_quota_atomic`);
  - deploy `dpl_31Q3Q78PKHySMqB6FqdkRgk5icHn` `READY`;
  - verificação em produção com usuário temporário e rollback: limite respeitado, `anon` sem acesso, política ilegível para usuários.
- Teste real com login feito pelo Eduardo: 4 mensagens contadas em 12/11 (dia de Brasília).

## 2026-11-12 · `6ae6bac` · Chat fail closed (PR #2)
- Se a cota, o teto mensal ou os limites por motor não puderem ser validados, o chat não chama a IA e não grava nada.
- Arquivos: `src/lib/chat-budget-guard.ts`, `src/app/api/chat/route.ts`, `test/chat-route.integration.test.ts`, `.github/workflows/pr-checks.yml`.
- Testes: unitários e integração da rota; contra a `main` anterior, 4 de 8 testes falhavam, o que comprova a correção.
- **Publicado** (deploy `dpl_6tjFxWQV76zyfARx4mBZCtMa7GWu` `READY`; smoke test sem login → 401; funções do banco verificadas com usuário temporário).

## 2026-11-09 · `475ad50` · Home pública
- Home aberta em `/` (avatar animado, funções, um dia com o GaDu, arquitetura, botão Entrar). `src/app/page.tsx`.
- Publicado. Verificação não registrada além do deploy.

## 2026-11-09 · `df6b8cf` · Avatar oficial animado e ícone
- `src/components/avatar-engine.ts`, `RobotFace.tsx`, `public/avatar/*`, `public/icons/*`; plano `docs/PLANO-AGENTES.md`.
- Publicado.

## 2026-11-09 · `5df9543`, `1c2225f`, `775d5a3` · Guia, dicas e "Como funciona"
- `/app/guia`, `/app/sobre`, `HelpNav.tsx`, `TipCard.tsx`, `src/lib/tips.ts`.
- Publicado.

## 2026-11-09 · `b75b53a` · Agenda visual, voz flutuante, busca por significado, convites e admin
- Agenda semanal com criação de eventos por voz.
- Botão de voz em todas as telas.
- Busca por significado: pgvector e `search_index`, indexados pelo agendador.
- Convites (`members`, `invites`) e área Admin.
- Publicado. A criação de eventos depende de você liberar a permissão `calendar.events` no Google.

## 2026-11-09 · `4aa6330` · Correção ao abrir o app
- Publicado.

## 2026-11-09 · `d3d6f24`, `0557f40`, `40523b1` · Tarefas, projetos, agentes e Hoje em painel
- Tabelas `tasks`, `projects`, `agents`, com RLS.
- Publicado.

## 2026-11-09 · `ba5d7c9` · Hoje, lembretes por voz e briefing da manhã
- `reminders`, `push_subscriptions`, `daily_briefings`, Web Push e Vercel Cron a cada minuto.
- Publicado.

## 2026-11-09 · `20b07b4`, `570b210` · Google (agenda e Gmail, só leitura) e páginas legais
- Publicado. Primeira conexão real registrada no ROADMAP.

## 2026-11-09 · `fc47bef`, `3a135be`, `3fe3a83`, `68b6598`, `b54ab3b` · Fase 1
- Limites por motor, lista de conversas, memória v2 (resumos), importação de memórias, voz configurável.
- Login com senha, gasto do mês e teto mensal.
- Correção do microfone.
- Publicado.

## 2026-11-08 · `85454e7` → `241c28a` · MVP
- Conversa por voz e texto, memória com aprovação, login, motor pelo Vercel AI Gateway.
- Publicado (primeira resposta real registrada no ROADMAP).
