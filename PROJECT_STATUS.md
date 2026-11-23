# GaDu · Situação do projeto

Atualizado em 23/11/2026 às 14:20 (Brasília): **Agentes com ferramentas e teto de gasto próprios** pelo Cursor (migração aditiva `agentes_ferramentas_teto`, PR #91, aplicada às 14:16; código no PR seguinte). Antes: **Percepções com Aceitar/Ignorar** (tela Hoje, voz `percepcao`, briefing) pelo Cursor; migração aditiva `insight_respostas` (PR #89) aplicada às 14:00 (versão `20261123170034`). Antes, às 13:45: **Metas fase 2, agenda da meta** (`meta_agenda`) em PR pelo Cursor, sobre o rascunho do Claude Code; projetos ligados à meta publicados (PR #86). Antes, às 13:20: **Metas fase 2, etapa 2a (projetos ligados à meta)** pelo Claude Code: migração `20261123170001` **aplicada** pelo Cursor; código em PR `feat/metas-fase2-projetos` (tela, rotas, ação `meta_projeto`, Core); falta a agenda (`meta_agenda`). Antes, às 13:10: **Metas fase 2, etapa 1** pelo Claude Code: migração aditiva `20261123170001_metas_fase2.sql` (`goal_projects`, `goal_events`) em PR só da migração; **MIGRAÇÃO PENDENTE** (o Cursor aplica pelo MCP; o código vem depois). Antes, às 12:15: **Finanças: teto por categoria e acumulado do ano** pelo Cursor (migração aditiva `fin_tetos`, PR #81; código em `feat/fin-tetos-app`). Antes, às 11:05: **3D Studio ligado em produção** (Eduardo, ~09:37) e **peças/versões do 3D salvas** pelo Cursor (migração aditiva `pecas_3d` aplicada pelo MCP, versão do PR #78). Migração `telemetria_erros` (PR #76, Claude Code) aplicada pelo MCP às ~10:57; conferido `error_events` com RLS. Antes, às 09:05: **Simulador de salário bruto → líquido publicado** pelo Claude Code (PR #63, merge `e7c3d5d` às 09:07, CI verde, deploy `success`, sem migração): aba "Salário" no Financeiro e pela conversa (`salario_simular`; o servidor calcula, o modelo não); tabelas de 2026 com fonte oficial em `src/lib/finance/salario.ts`. Antes, às 08:48: **UX-5 publicado pelo Claude Code** (PRs #58 a #60, CI verde e deploy `success`): padrão único de tela de módulo (#58, merge `a70152a`, 08:03), cartão de confirmação único (#59, `8f637ac`, 08:13) e Design System etapa 2 (#60, `a211d40`, 08:44). Sem migração. **Não verificado:** com login e no aparelho. Antes: **UX-4 fechado pelo Claude Code** (PRs #52 a #55, todos com CI verde e deploy `success`): linguagem simples e menos escolhas (#52, merge `ed64dc0`, 06:57), "Feito · Desfazer" em toda ação que grava, com "desfaz" por voz (#53, `850f01b`, 07:09), erros claros com "Tentar de novo" e erro falado (#54, `a79578f`, 07:18) e primeiro uso guiado e falado em 3 passos, refeito em Configurações e por voz (#55, `36a41fb`, 07:29). Sem migração. **Não verificado:** com login no Supabase real e no aparelho (voz, microfone, gravação do nome e da marca do guia). Antes, em 22/11/2026 às 21:11: **UX-3 completo e "Tudo por voz" publicados** pelo Cursor (Grok Bot): texto grande (PR #38), confirmações faladas e respostas faladas curtas (PR #39) e ações de todos os módulos pela conversa com confirmação (PR #42); matriz "Tudo por voz" em [docs/FEATURE_MATRIX.md](docs/FEATURE_MATRIX.md), seção 11, e regra nova no [AGENTS.md](AGENTS.md), seção 8.1. Antes: **3D-1 (3D Studio Beta) **publicado** em 22/11/2026 às 20:55 (Brasília), PR #40, merge `6d87a5f`, CI verde (verify, e2e-public, database), deploy de produção da Vercel concluído. No ar: `/api/3d/generate` sem sessão 401, `/vendor/openscad/render-worker.js` 200 com a CSP própria, e2e público contra a produção 10/10. `MODELING_3D_ENABLED` não definida na Vercel: o 3D está **desligado** em produção até o Eduardo ligar** (branch `feat/3d-1-openscad`, desligado por padrão com `MODELING_3D_ENABLED`; ver "3D Studio" abaixo). Antes, às 20:00: **ciclo UX publicado**: UX-1 navegação (PR #34), UX-2 Hoje em 5 blocos (PR #35) e UX-3 voz em um toque, parte 1 (PR #36), mais a passagem de bastão entre IAs (PR #33: `AGENTS.md` e `docs/HANDOFF.md`). Todos pelo Cursor (Grok Bot), CI verde e deploy Vercel `success`; falta validar com pessoa logada no aparelho. Antes: (revisão geral do plano, só documentação: plano do 3D por fases em [docs/FEATURE-3D.md](docs/FEATURE-3D.md), novo ciclo de UX com voz primeiro e Casa Inteligente adiada; ver "Revisão geral (22/11/2026)" abaixo; antes: Metas, base, **publicada**, PR #30, merge `901e27d`, migração aplicada e deploy no ar; evidências em "Metas, base" abaixo; antes: Finanças, base, **publicada**, PR #26, merge `41eb3ed`, migração aplicada e deploy no ar; evidências em "Finanças base: publicação" abaixo; antes: Core "atenção hoje" **publicado**, PR #24, merge `215edab`; evidências em "Core atenção hoje: publicação" abaixo), com a segurança P1 **publicada** (PR #22, merge `cc85040`, migrações aplicadas e deploy no ar; evidências em "Segurança P1: publicação" abaixo). A tabela de produção abaixo é de 16/11 e não foi reescrita. Fonte de verdade: o código na `main` e as evidências abaixo. Intenção e planejamento ficam no [ROADMAP.md](ROADMAP.md); o detalhe por funcionalidade fica em [docs/FEATURE_MATRIX.md](docs/FEATURE_MATRIX.md).

**23/11/2026 (Claude Code):** auditoria de RLS publicada em `docs/SECURITY_AUDIT_2026-11-23.md`; revisão cruzada dos PRs do Cursor concluída (correção no PR #72, merge `0088ca1`). S-05 (resto) e S-08 em andamento: ver `docs/HANDOFF.md`.

## Ambiente de produção (verificado em 14/11/2026)
| Item | Estado | Evidência |
|---|---|---|
| App | https://gadu-agent.vercel.app | Vercel, projeto `gadu-agent`, região `iad1` |
| Última publicação | commit `b992422` (merge do PR #20, Isolamento e preparação do Core) | deploy `dpl_93GgJbNyQZH6AVPDyPZp11UUtJEx`, `READY`; testes de interface em produção: 6 públicos + 14 com login, 0 pulados; CI com isolamento nas 18 tabelas |
| Banco | Supabase `sa-east-1`, Postgres 17 | 9 migrações registradas; as últimas são `daily_quota_atomic` e `ai_budget_reservations` |
| Cota diária | `consume_daily_quota()`, limite 150 em `private.quota_policy` | teste com usuário temporário e rollback; **uso real**: 4 mensagens contadas em 12/11 (dia de Brasília) |
| Orçamento mensal | `reserve/settle/release_ai_budget`, teto US$ 20 em `private.budget_policy` | teste com usuário temporário e rollback (teto, idempotência, isolamento, permissões); **uso real**: 1 reserva liquidada pelo custo real e ligada ao consumo |
| Rollback do app | deploys `dpl_BSXyR5vex6zNB5F1Z9f9M6SCZAxJ` (PR #14, antes da v2.2), `dpl_HT87wCvBrfSDQjkJ7ANsfkuFAAPF` (PR #13, antes da v2.1), `dpl_DFKuhDx6…` (antes da v2, PR #11), `dpl_ELAhLL3G…` (PR #9), `dpl_CBrNxW8e…` (PR #6) | promover na Vercel |
| Usuário de teste | conta `teste-ui@example.com`, criada pelo fluxo de convite, com teto de US$ 2 por mês; sem dados pessoais | usada só para capturas e testes de tela; a senha não fica no repositório |
| Rollback do banco | orçamento: drop das funções novas, `public.ai_reservations`, `private.budget_policy`, `private.user_budget`; cota: drop de `consume_daily_quota()`, `private.user_quota`, `private.quota_policy` | as funções antigas (`month_spend`, `consume_quota`) continuam lá |
| Backups lógicos | `private.backup_usage_daily_20261113` (2 linhas), `private.backup_usage_events_20261113` (44 linhas) | apagar depois de estabilizar |

## Concluído (entregue e verificado)
- Base do assistente: login, conversa com streaming e contingência de motor, voz do aparelho, memória com aprovação, Hoje, agenda, lembretes, tarefas, projetos, agentes simples, busca por significado, convites e admin, guia e home pública.
- Marco Zero, segurança:
  - PR #2: chat fail closed.
  - PR #3: cota diária atômica.
  - PR #6: orçamento mensal com reserva atômica e reconciliação.
  - Todos em produção, validados no uso real.
- PR #9: mensagens de erro em português por situação, telas de erro próprias (erro, erro geral, 404), voz mais estável, e teto e reservas do mês visíveis em Ajustes.
- PR #10: Design System v1 (tokens únicos), menu lateral no computador, layouts para tablet e computador, acessibilidade (atalho de teclado, alvos de toque) e home alinhada. [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md).
- PR #12, UX/UI v2:
  - arquitetura de seis módulos com status real (Pessoal, Financeiro, Agent Office, Agent Office Studio, 3D Studio, Plataforma);
  - menu lateral por módulos no computador; barra de baixo com o assistente no centro e folha de módulos no celular;
  - Assistente Universal por voz e texto em qualquer tela, com contrato de contexto validado no servidor;
  - temas claro e escuro;
  - painel Hoje, Conversa, Perfil e ajustes e home pública redesenhados;
  - avatar animado, marca e arquivos de `public/avatar` preservados.
- PR #14, Sprint UX/UI v2.1:
  - paleta azul-marinho e grafite, com contraste AA medido;
  - menu com grupos recolhíveis;
  - Hoje por horário;
  - Conversa compacta com voz mais segura (limite de 20 s, transcrição revisável);
  - assistente alargável e compatível com o teclado;
  - todas as telas restantes redesenhadas;
  - home com a visão completa;
  - arquitetura do Core Contextual documentada.
- PR #20, Isolamento e preparação do Core (16/11):
  - teste de isolamento entre pessoas nas 18 tabelas, no CI;
  - banco de teste com todas as migrações (pgvector);
  - riscos S-01, S-05, S-07, S-10 e S-12 confirmados em execução local (`npm run audit:db`);
  - proposta "O que merece minha atenção hoje?" (docs/CORE_ATENCAO_HOJE.md);
  - roteiro Android (docs/ROTEIRO_ANDROID.md).
- PRs #18 e #19, Qualidade e Segurança (15/11):
  - Playwright como dependência oficial (versão fixa);
  - testes de interface separados em público (no CI, sem segredos) e com login (falham se faltar credencial, nunca são pulados);
  - regressão completa aprovada;
  - auditoria de segurança somente leitura com matriz de riscos;
  - plano do Core Contextual MVP.
- PR #16, Sprint UX/UI v2.2:
  - navegação híbrida no celular (barra de baixo, tela Módulos, menu da conta com o Voltar do Android);
  - menu do computador por área e recolhível;
  - assistente em três estados com largura ajustável;
  - voz mais segura (envio automático desligado por padrão, interrupção sem reabrir o microfone);
  - pendências da v2.1 fechadas;
  - Metas & Conquistas e Casa Inteligente como planejados, com especificação;
  - planejamento de saúde;
  - protótipo do Lovable avaliado;
  - 16 testes de interface com Playwright.
- Modelo de trabalho Fast Track (PR #4) e documentação central (PRs #7 e #8).

## Em andamento
| Trabalho | Estágio | Onde |
|---|---|---|
| **Segurança P1 / fase 0 do Core** (S-01, S-02, S-03 parcial, S-04, S-05 parcial, S-06, S-07, S-10, S-11, S-12) | **Publicada em 22/11/2026**: PR #22 integrado, migrações aditiva e restritiva aplicadas, deploy no ar. Pendentes: senhas vazadas (painel), S-09 (backups), chat logado e encerramento de sessões em produção ainda não verificados | PR #22, merge `cc850400ff982d2463cf750de539fa194b04b5b6`; [docs/SEGURANCA_P1_MANUAL.md](docs/SEGURANCA_P1_MANUAL.md) |
| **Core Contextual: "O que merece minha atenção hoje?"** (fase 1, escopo pessoal, só leitura, sem banco novo) | **Publicado em 22/11/2026** (PR #24, merge `215edab`), sem migração. No ar e ligado por padrão (`CORE_MVP` não existe na Vercel); `CORE_MVP=0` desliga. Pendente: validar com pessoa logada (tela Hoje e Fontes, Gmail e agenda reais, voz no aparelho) e medir o custo por mensagem | [docs/CORE_ATENCAO_HOJE.md](docs/CORE_ATENCAO_HOJE.md), [docs/CORE_CONTEXTUAL_MVP.md](docs/CORE_CONTEXTUAL_MVP.md) |
| Documentação Marco Zero (contexto mestre, auditoria, governança) | Rascunho, não integrado. O `DESIGN_SYSTEM.md` dele foi substituído pelo da `main` | PR #1 |
| **Finanças, base: Contas e Dia a dia** (alto risco: banco novo) | **Publicada em 22/11/2026** (PR #26, merge `41eb3ed`). Migração `financas_base` aplicada na produção (versão `20261122194404`). No ar e ligado por padrão (`FINANCE_ENABLED` não existe na Vercel). Pendente: validar a tela Financeiro e o lançamento pela conversa com pessoa logada, em aparelho | [docs/FEATURE-FINANCAS.md](docs/FEATURE-FINANCAS.md) |
| Especificação de Finanças pessoais | Integrada (PR #5, em 22/11/2026 às 15:49, Brasília, merge `ff8fff0`) | `docs/FEATURE-FINANCAS.md` |

## Metas, base (22/11/2026): **publicada**

- **publicada** em 22/11/2026 às 18:33 (Brasília), PR #30, merge `901e27d`. CI verde (verify, e2e-public, database). Migração `metas_base` aplicada na produção antes do merge (só aditiva); conferido: `goals`, `goal_progress`, `goal_milestones` e `goal_tasks` com RLS, 4 políticas cada, `anon` sem SELECT. Deploy de produção da Vercel concluído; home 200, `/api/goals` sem sessão 401, `/api/health` ok; e2e público contra a produção 9/9. `GOALS_ENABLED` não definida na Vercel (ligado por padrão). **Não verificado:** tela Metas, resumo do Hoje e propostas no chat com pessoa logada e em aparelho.
- Branch `feat/metas-base`, sem push e sem PR. Migração `20261122210001_metas_base` **não aplicada** na produção. Aprovada pelo Eduardo (inclusive banco).
- Entrega: 4 tabelas com RLS e chaves compostas, cálculo de progresso e ritmo, API `/api/goals/*`, tela Metas (Beta), resumo no Hoje, fonte `goals` do Core e atualização por proposta com confirmação, `GOALS_ENABLED=0`. Detalhe em [docs/METAS_CONQUISTAS.md](docs/METAS_CONQUISTAS.md).
- Testes locais: typecheck, `npm test` (165 + 126), build, `test-db`, e2e público 9/9 e mobile 44/44 contra `next start` local. Nada validado com pessoa logada nem em aparelho.
- **Ponto de retomada:** revisão do Eduardo, PR (alto risco: banco), aprovação explícita para aplicar a migração, publicar e validar com login.

## Validação no celular (22/11/2026, PR #28): **publicada**, validada só em celular emulado; aparelho real pendente
- Correções: Voltar do Android por camada, voz em trechos curtos, push com reinscrição e selo, CSP da tela offline, alvos de toque, atributos de teclado. Detalhes e evidências no CHANGELOG.
- Testes: typecheck, `npm test` (143 + 100), build, `test-db`, e2e público 8/8 e e2e mobile 44/44 contra `next start` local; e2e mobile na produção atual 24/44 (as falhas são as correções ainda não publicadas); instalável pelo CDP nos dois.
- **Publicação:** PR #28 integrado em 22/11/2026 às 17:19 (Brasília), merge `97f4d642ebe695286ceaabc80d83b05cf47b304d`. CI verde (`verify`, `e2e-public` com a suíte mobile, `database`); deploy de produção na Vercel com status `success`. Produção serve `sw.js` com cache `gadu-v5` e `/icons/badge-96.png` com 200. E2E público contra a produção 8/8. Suíte mobile contra a produção: 43/44 antes do ajuste do teste (falhou só a navegação offline no WebKit, limitação do `setOffline` do Playwright, não bug do `sw.js`; ver `docs/TESTES_E2E.md`) e 44/44 com o ajuste, rodando localmente contra a produção. O ajuste está no commit `89ec767` (branch `fix/mobile-offline-webkit`, **sem push**, ainda não publicado).
- **Ponto de retomada:** publicar o ajuste do teste (`89ec767`). Nada foi testado em aparelho real. O Eduardo roda o [docs/CHECKLIST_CELULAR.md](docs/CHECKLIST_CELULAR.md) no Galaxy S26 Ultra (Chrome e Samsung Internet) e anota. Sem aparelho, nada de teclado, voz, push e Voltar físico foi verificado.

## Pendente
- Logo novo (três movimentos): aguardando o arquivo. Hoje a marca é o texto GaDu.
- Validar a voz, o assistente com o teclado aberto e o Voltar do Android em aparelhos de verdade (iPhone e Android).
- Levar os testes de interface (`npm run test:e2e`) para o CI, com um usuário de teste dedicado (pede segredo no GitHub: aprovação).
- Ver Administração e as telas com dados reais (o usuário de teste não é admin e está vazio).
- Segurança P1 publicada (22/11). Falta verificar em produção, com uma pessoa logada, o chat e o encerramento de sessões ao bloquear (manual, seções 1.3 e etapa 4).
- Passos manuais no painel: proteção contra senhas vazadas; S-09: o plano é Free, então decidir entre plano Pro ou dump lógico agendado; só depois decidir sobre os backups lógicos.
- Decidir o destino do usuário de teste e da liberação do host do Supabase no ambiente "Gadu".
- Auditoria completa de RLS e isolamento; administração de créditos por pessoa.
- Monitoramento e alerta de erro (migração `error_events` mergeada no PR #76 e aplicada pelo Cursor; falta rota, Admin e alerta).
- Módulos planejados, sem código: 3D Studio, Agent Office (além dos agentes), Agent Office Studio. Financeiro: base publicada (PR #26); o restante da especificação segue planejado.

## Segurança P1: publicação (22/11/2026)
- **PR #22** integrado em 22/11/2026 às 14:54 (Brasília), merge commit `cc850400ff982d2463cf750de539fa194b04b5b6`. CI do PR verde: `verify`, `e2e-public`, `database`.
- **Migrações no Supabase de produção:** aditiva aplicada antes do deploy (versão `20261122175405`, `seguranca_p1_aditiva`); restritiva aplicada depois do deploy (versão `20261122175542`, `seguranca_p1_restritiva`).
- **Deploy da Vercel** (`gadu-agent`) do merge commit: "Deployment has completed". Site: home 200, `/app` redireciona para `/login`, `/api/chat` sem sessão 401, `/api/health` ok.
- **Código novo no ar:** uma tentativa de login com e-mail fictício gerou linhas em `private.rate_limits` (`password_ip` e `password_email`).
- **Banco depois da restritiva:** `consume_quota` não existe; `authenticated` sem EXECUTE em `settle_ai_budget` e sem INSERT em `usage_events`; `anon` com 0 privilégios de tabela em `public`; `consume_daily_quota` e `budget_status` continuam para `authenticated`.
- **Assessor de segurança do Supabase:** avisos de função SECURITY DEFINER caíram de 6 para 2 (`budget_status` e `consume_daily_quota`, intencionais). Senhas vazadas continua desligado (passo manual).
- **e2e público** (6 testes) contra a produção: 6 passaram.
- **Não verificado:** chat com uma pessoa logada em produção (o e2e com login precisa de credenciais); encerramento de sessões ao bloquear em produção.
- **S-09:** plano Supabase da organização é Free (sem backups automáticos baixáveis nem PITR). Segue pendente; depende de decisão do Eduardo: plano Pro ou dump lógico agendado.

## Observabilidade e e2e com login (23/11/2026)
- **Migração `20261123110001_telemetria_erros.sql`** (PR #76, merge `a3b4a79`, 10:51): tabela `error_events` (só servidor escreve, só administrador lê, sem texto de mensagem). aplicada em produção pelo Cursor (~10:57, via MCP).
- **e2e com login no CI** (workflow `e2e-auth.yml`, Supabase local, sem segredo): 17 de 17. Detalhe e achados em docs/TESTES_E2E.md. Corrigidos: CSP para Supabase local, link "Pular o guia" com 44 px, testes antigos.

## Telemetria de erros, código (23/11/2026)
- Rota `/api/telemetria/erro`, captura do servidor (`instrumentation.ts`) e do navegador, Admin › Erros recentes, resumo `POST /api/cron/telemetria-resumo` e alerta diário (`alerta-erros.yml`). Interruptor `TELEMETRIA_ENABLED`. Falta o Eduardo criar `TELEMETRIA_TOKEN` (GitHub e Vercel). Ver docs/OBSERVABILIDADE.md.

## Problemas conhecidos e riscos
Matriz completa, com evidências e o **status de cada S-xx**: [docs/SECURITY_AUDIT_2026-11-15.md](docs/SECURITY_AUDIT_2026-11-15.md).
**Corrigidos pela segurança P1, publicada em 22/11/2026** (descrições abaixo são do risco original; evidências de produção em "Segurança P1: publicação"):
- **S-01 (P1, custo):** uma pessoa logada pode liquidar a própria reserva com custo 0 pela API do Supabase e escapar do teto mensal (a cota diária continua valendo). Corrigido na branch (orçamento só pelo servidor).
- **S-02:** resposta cancelada no meio não registra custo. Corrigido na branch (liquidação por estimativa).
- **S-07, S-10, S-12:** `consume_quota` ainda existe e é usada como contingência; `usage_events` aceita insert da pessoa; `anon` tem SELECT nas tabelas. Corrigidos na migração restritiva da branch.
- **S-03 (limite de tentativas), S-04, S-06, S-11:** corrigidos no código da branch. **S-05:** parcial (sessões encerradas e custo/cota recusados; falta RLS de escrita por acesso).
- **Seguem abertos, mesmo depois da branch:** S-03 senhas vazadas (painel, manual), S-05 RLS de escrita por acesso, S-08 (organizações), S-09 (confirmar backups), S-13, S-14, S-15.
1. App em `iad1` (EUA) e banco em `sa-east-1` (São Paulo): latência extra a cada consulta. Avaliar `gru1`.
2. A proteção contra senhas vazadas está desligada no Supabase Auth (passo manual).
3. O plano Supabase da organização é Free: sem backups automáticos baixáveis nem PITR (S-09 pendente, decisão do Eduardo: plano Pro ou dump lógico agendado).
4. O cruzamento de dados entre módulos, organizações ou clientes não existe: o contexto do assistente é só um rótulo, e o escopo é sempre o da própria pessoa.
5. A estabilidade da voz foi testada com uma síntese de voz simulada; falta confirmar nos aparelhos.
6. O encerramento de sessões ao bloquear (`server_revoke_user_sessions`, apaga `auth.sessions`) foi testado só no banco local com uma imitação do Auth; **não verificado em produção** (manual, seção 1.3). Se falhar, o bloqueio continua valendo pelo `members`.
7. Se o contador de tentativas de login estiver indisponível, o login **não** é travado (decisão registrada no manual, seção 5).

## Finanças base: publicação (22/11/2026)
- **PR #5 (especificação)** atualizado com a `main` e integrado em 22/11/2026 às 15:49 (Brasília), merge `ff8fff0`.
- **PR #26 integrado** em 22/11/2026 às 16:44 (Brasília), merge commit `41eb3edd7caaf640675f970f2dd2457dd942c8bf`. CI verde: `verify`, `e2e-public`, `database`.
- **Migração:** `financas_base` aplicada na produção **antes do merge** (só aditiva), registrada como versão `20261122194404`. Conferido: as 4 tabelas `fin_*` com RLS ligada, 4 políticas cada, `anon` sem SELECT. Assessor de segurança do Supabase sem avisos novos.
- **Deploy de produção da Vercel:** `success`.
- **Produção:** home 200; `/api/finance/resumo` sem sessão 401; `/api/health` ok.
- **e2e público** (8 testes) contra a produção: 8 passaram.
- **Flags:** `FINANCE_ENABLED` e `CORE_MVP` não estão definidas na Vercel, então o recurso está ligado por padrão.
- **Não verificado:** tela Financeiro e lançamento pela conversa com pessoa logada, em aparelho.

## Finanças base: desenvolvimento (22/11/2026) · histórico, já publicado
- **Estágio (na época):** desenvolvido e testado localmente, antes da publicação acima.
- **Banco:** 4 tabelas novas (`fin_itens`, `fin_item_meses`, `fin_gastos`, `fin_config`) numa migração só aditiva, com RLS e rollback comentado. Plano de implantação: PR de alto risco, aprovação do Eduardo, aplicar a migração (ela não afeta o app de hoje), publicar o app, conferir 401 nas rotas e a tela com pessoa logada.
- **Interruptor:** `FINANCE_ENABLED=0` (ligado por padrão, como o `CORE_MVP`); para desligar em produção será preciso criar a variável na Vercel.
- **Testes locais:** typecheck ok; `npm test` 124 unitários + 94 de integração; build ok; `test:db` todos (22 tabelas no isolamento); e2e público 8 de 8.
- **Não verificado:** migração em Supabase real, tela com pessoa logada em celular, lançamento por voz, custo por mensagem.

## Core atenção hoje: publicação (22/11/2026)
- **PR #24 integrado em 22/11/2026 às 15:42 (Brasília), merge commit `215edab0d7d879e3483d0a6d77539609ce95f39c`. CI verde: `verify`, `e2e-public`, `database`.
- **Deploy de produção da Vercel:** `success`.
- **Produção:** home 200; `/api/attention` sem sessão 401 (a rota nova está no ar); `/api/health` ok.
- **e2e público** (7 testes) contra a produção: 7 passaram.
- **Migrações:** nenhuma.
- **Flag:** `CORE_MVP` não está definida na Vercel, então o recurso está ligado por padrão.
- **Não verificado:** tela Hoje e Fontes com pessoa logada; Gmail e agenda reais; voz no aparelho; custo por mensagem medido.

## Revisão geral (22/11/2026)
Só documentação, sem mudança de código. Leitura de todos os `.md` e revisão de experiência pelo código e por capturas a 412 × 915 (telas com login num app local com dados simulados, sem banco real).
- **Feito e publicado:** base do assistente; segurança P1 (PR #22); Core "atenção hoje" (PR #24); Financeiro base (PR #26); celular (PRs #28 e #29); Metas fase 1 (PR #30).
- **Parcial:** nada do que foi publicado em 22/11 foi validado com pessoa logada em aparelho; modo conversa e notificações em beta; eventos pela voz bloqueados até `calendar.events`; senhas vazadas e S-09 pendentes; Design System etapa 2.
- **Não começado:** 3D Studio (só especificação), Agent Office e Studio, Saúde, voz natural paga, simulador bruto → líquido, testes com login no CI, monitoramento de erros.
- **3D Studio:** **3D-1 **publicado** em 22/11/2026 às 20:55 (Brasília), PR #40, merge `6d87a5f`, CI verde (verify, e2e-public, database), deploy de produção da Vercel concluído. No ar: `/api/3d/generate` sem sessão 401, `/vendor/openscad/render-worker.js` 200 com a CSP própria, e2e público contra a produção 10/10. `MODELING_3D_ENABLED` não definida na Vercel: o 3D está **desligado** em produção até o Eduardo ligar**: conversa → OpenSCAD (modelo barato, pipeline de custo do chat) → OpenSCAD WASM num Web Worker (GPL, componente separado) → three.js, controles, verificações da A1, STL e 3MF; interruptor `MODELING_3D_ENABLED` desligado por padrão; sem migração; 3MF "A1 PLA 0.4" pronto mas desativado até o Eduardo enviar o projeto. Pendente: IA real, refino por voz/imagem, salvar versões. Especificação 3D-0 feita ([docs/FEATURE-3D.md](docs/FEATURE-3D.md)); fases 3D-1 (conversa → OpenSCAD → STL/3MF para a A1), 3D-2 (figura a partir de foto, modelos abertos gratuitos) e 3D-3 (envio direto, depois) no [ROADMAP](ROADMAP.md). Sem serviço pago por geração.
- **UX:** novo ciclo "voz primeiro e uso simples" (UX-1 a UX-6) no [ROADMAP](ROADMAP.md), com as evidências: Hoje com 9 blocos e cerca de 4,7 telas de rolagem; falar exige 3 toques no celular; navegação dividida entre barra de baixo, menu sanfona e tela Módulos; nomes repetidos; textos de 11 px; nenhuma ação com "Desfazer".
- **Casa Inteligente:** adiada por decisão do Eduardo; quando retomar, Home Assistant como camada ([docs/CASA_INTELIGENTE.md](docs/CASA_INTELIGENTE.md)).
- **Documentação corrigida:** a [matriz](docs/FEATURE_MATRIX.md) ainda marcava como "em desenvolvimento" ou "não publicado" itens dos PRs #22, #24, #26 e #30; agora estão como publicados.

## Próximas prioridades (em ordem; revisadas em 22/11/2026)
1. **Validar com pessoa logada, em aparelho,** o que foi publicado em 22/11 (Hoje e Fontes, Financeiro, Metas, voz, notificações) e fechar os passos manuais da segurança P1: senhas vazadas (painel), S-09 (plano Pro ou dump lógico agendado), chat logado e encerramento de sessões.
2. ~~UX-1 a UX-3~~ **publicados em 22/11** (PRs #34 a #36, #38 e #39). **Tudo por voz** publicado (PR #42); fechar as lacunas da matriz (FEATURE_MATRIX, seção 11).
3. **3D-1 (feito localmente, revisar e publicar com aprovação):** MVP conversa → OpenSCAD → STL e 3MF; falta o 3MF "A1 PLA 0.4" ([docs/FEATURE-3D.md](docs/FEATURE-3D.md)). A migração das tabelas do 3D precisa de aprovação explícita.
4. ~~UX-4~~ **publicado em 23/11** (PRs #52 a #55). ~~UX-5~~ **publicado em 23/11** (PRs #58 a #60). Falta UX-6 (teste com uma pessoa não digital, no aparelho).
5. Financeiro: simulador bruto → líquido, tetos por categoria, fase Conversa.
6. Testes com login no CI ([docs/TESTES_E2E.md](docs/TESTES_E2E.md); precisa de segredo no GitHub: aprovação).
7. S-05 (RLS de escrita por acesso) e organizações (S-08), antes do Agent Office.
8. 3D-2; Agent Office; Agent Office Studio; observabilidade e créditos por pessoa.
- Adiado por decisão do Eduardo: Casa Inteligente. Depois: 3D-3.

## Ponto de retomada (para qualquer agente)
0. **Comece por [AGENTS.md](AGENTS.md) e [docs/HANDOFF.md](docs/HANDOFF.md)** (22/11/2026): regras comuns às IAs, diário de sessões e lista "A revisar por outra IA".
0. **Tudo por voz, lacunas (23/11/2026, Claude Code):** PR A (#47, merge `3eed4eb`, 05:49, publicado) fechou tarefa cancelar, reabrir e editar e lembrete adiar. PR B (#48, merge `7db56d4`, 06:02, publicado) fechou conta desmarcar e valor do mês, gasto editar e apagar, evento editar e apagar. PR C (#49, merge `d3c9955`, 06:14, publicado) fechou meta pausar, retomar, arquivar e editar e projeto editar e arquivar. PR D (#50, merge `4a7f9c3`, 06:32, publicado) fechou memória aprovar, recusar e esquecer, nova conversa e navegação por voz. Lacunas que restam na seção 11 da matriz: agentes, criar conta e salário do Financeiro, apagar registro de meta, abrir conversa anterior e alguns ajustes.
0. **Tudo por voz (22/11/2026, noite):** UX-3 completo (PRs #38 e #39) e ações de todos os módulos pela conversa (PR #42), publicados. Toda função nova sai com a ação pela conversa e testes ([AGENTS.md](AGENTS.md), seção 8.1). UX-4 começou com os alvos de toque de 48 px (PR #44, publicado às 21:26). Próximo: validar no aparelho, fechar as lacunas da matriz e o resto do UX-4.
0. **Ciclo UX (22/11/2026, 20:00):** UX-1, UX-2 e UX-3 (parte 1) publicados (PRs #34, #35, #36). Próximo de UX: validar no aparelho, depois o resto do UX-3 e o UX-4 (linguagem simples, primeiro uso guiado, Desfazer em todas as ações, alvos de 48 px fora do Hoje).
0. **Revisão geral (22/11/2026):** plano atualizado (3D por fases, ciclo UX voz primeiro, Casa adiada). Próximo passo de código: UX-1 a UX-3 e, em paralelo, 3D-1 conforme [docs/FEATURE-3D.md](docs/FEATURE-3D.md). Antes do 3D-1 exportar o 3MF da A1, o Eduardo precisa salvar no Bambu Studio um projeto vazio com A1, bico 0.4 e PLA.
0. **Finanças (22/11/2026):** a base está **publicada** (PR #26, merge `41eb3ed`; migração `financas_base` aplicada, versão `20261122194404`). Próximo passo: validar a tela Financeiro e o lançamento pela conversa com pessoa logada, em aparelho. Depois: simulador bruto → líquido (INSS/IRRF por ano).
0. **Ponto de retomada anterior (22/11/2026):** a segurança P1 está publicada (PR #22). Próximos passos: decisão do Eduardo sobre S-09, ligar senhas vazadas no painel, verificar em produção o chat logado e o encerramento de sessões, depois S-05. Alto risco: aprovação explícita a cada passo. O Core "atenção hoje" também está publicado (PR #24); falta validá-lo com pessoa logada (tela Hoje e Fontes, Gmail e agenda reais, voz) e medir o custo por mensagem.
1. Leia `CLAUDE.md`, este arquivo, [docs/FAST_TRACK.md](docs/FAST_TRACK.md) e [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md). O handoff técnico está em `docs/CLAUDE_HANDOFF_2026-11-12.md`.
2. Confira o estado real: `git log origin/main -5`, PRs abertos no GitHub, o último deploy de produção na Vercel e `list_migrations` no Supabase.
3. Classifique o que vai fazer: baixo risco (UI, docs) segue o processo simplificado; alto risco (banco, auth, custo, permissões) exige aprovação explícita do Eduardo a cada passo.
4. Antes de subir: `npm run typecheck && npm test && npm run build`, mais `npm run test:db` quando houver SQL. Testes de interface: `npm run test:e2e:public` (vai no CI) e `npm run test:e2e:auth` com o usuário de teste ([docs/TESTES_E2E.md](docs/TESTES_E2E.md)). Para mudança visual, siga o roteiro de verificação do Design System (360, 390, 412, 768, 1024, 1440 e 1920 px).
5. Ao terminar: atualize este arquivo, o [CHANGELOG.md](CHANGELOG.md), o [ROADMAP.md](ROADMAP.md) e a [matriz](docs/FEATURE_MATRIX.md), e gere o "GaDu — Resumo para ChatGPT".
