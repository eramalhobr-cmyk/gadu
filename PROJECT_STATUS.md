# GaDu · Situação do projeto

Atualizado em 22/11/2026, com a segurança P1 desenvolvida e testada localmente na branch `fix/seguranca-p1` (**não publicada**; a produção segue como na tabela abaixo, de 16/11). Fonte de verdade: o código na `main` e as evidências abaixo. Intenção e planejamento ficam no [ROADMAP.md](ROADMAP.md); o detalhe por funcionalidade fica em [docs/FEATURE_MATRIX.md](docs/FEATURE_MATRIX.md).

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
| **Segurança P1 / fase 0 do Core** (S-01, S-02, S-03 parcial, S-04, S-05 parcial, S-06, S-07, S-10, S-11, S-12) | **Desenvolvida e testada localmente. Não publicada; migrações não aplicadas no Supabase; painel do Supabase não alterado.** Aprovação para o código já dada; falta publicar na ordem do manual | branch `fix/seguranca-p1`; [docs/SEGURANCA_P1_MANUAL.md](docs/SEGURANCA_P1_MANUAL.md) |
| Documentação Marco Zero (contexto mestre, auditoria, governança) | Rascunho, não integrado. O `DESIGN_SYSTEM.md` dele foi substituído pelo da `main` | PR #1 |
| Especificação de Finanças pessoais | Pronta para revisão, não integrada | PR #5 |

## Pendente
- Logo novo (três movimentos): aguardando o arquivo. Hoje a marca é o texto GaDu.
- Validar a voz, o assistente com o teclado aberto e o Voltar do Android em aparelhos de verdade (iPhone e Android).
- Levar os testes de interface (`npm run test:e2e`) para o CI, com um usuário de teste dedicado (pede segredo no GitHub: aprovação).
- Ver Administração e as telas com dados reais (o usuário de teste não é admin e está vazio).
- Publicar a segurança P1: aplicar a migração aditiva, deploy, aplicar a restritiva (ordem e conferências no [manual](docs/SEGURANCA_P1_MANUAL.md)). Inclui a etapa 2 da cota (remover `consume_quota`).
- Passos manuais no painel: proteção contra senhas vazadas, confirmar plano e backups (RPO e RTO), ensaiar uma restauração; só depois decidir sobre os backups lógicos.
- Decidir o destino do usuário de teste e da liberação do host do Supabase no ambiente "Gadu".
- Auditoria completa de RLS e isolamento; administração de créditos por pessoa.
- Monitoramento e alerta de erro; testes de ponta a ponta automatizados.
- Módulos planejados, sem código: Financeiro, 3D Studio, Agent Office (além dos agentes), Agent Office Studio.

## Problemas conhecidos e riscos
Matriz completa, com evidências e o **status de cada S-xx**: [docs/SECURITY_AUDIT_2026-11-15.md](docs/SECURITY_AUDIT_2026-11-15.md).
**Em produção hoje (até publicar a segurança P1)** os riscos abaixo continuam abertos. Já estão **corrigidos no código e nas migrações da branch `fix/seguranca-p1`, testados só localmente**:
- **S-01 (P1, custo):** uma pessoa logada pode liquidar a própria reserva com custo 0 pela API do Supabase e escapar do teto mensal (a cota diária continua valendo). Corrigido na branch (orçamento só pelo servidor).
- **S-02:** resposta cancelada no meio não registra custo. Corrigido na branch (liquidação por estimativa).
- **S-07, S-10, S-12:** `consume_quota` ainda existe e é usada como contingência; `usage_events` aceita insert da pessoa; `anon` tem SELECT nas tabelas. Corrigidos na migração restritiva da branch.
- **S-03 (limite de tentativas), S-04, S-06, S-11:** corrigidos no código da branch. **S-05:** parcial (sessões encerradas e custo/cota recusados; falta RLS de escrita por acesso).
- **Seguem abertos, mesmo depois da branch:** S-03 senhas vazadas (painel, manual), S-05 RLS de escrita por acesso, S-08 (organizações), S-09 (confirmar backups), S-13, S-14, S-15.
1. App em `iad1` (EUA) e banco em `sa-east-1` (São Paulo): latência extra a cada consulta. Avaliar `gru1`.
2. A proteção contra senhas vazadas está desligada no Supabase Auth (passo manual).
3. O backup automático do plano Supabase não foi confirmado no painel (passo manual).
4. O cruzamento de dados entre módulos, organizações ou clientes não existe: o contexto do assistente é só um rótulo, e o escopo é sempre o da própria pessoa.
5. A estabilidade da voz foi testada com uma síntese de voz simulada; falta confirmar nos aparelhos.
6. O encerramento de sessões ao bloquear (`server_revoke_user_sessions`, apaga `auth.sessions`) foi testado só no banco local com uma imitação do Auth; confirmar em produção (manual, seção 1.3). Se falhar, o bloqueio continua valendo pelo `members`.
7. Se o contador de tentativas de login estiver indisponível, o login **não** é travado (decisão registrada no manual, seção 5).

## Próximas prioridades (em ordem)
1. **Publicar a segurança P1** (fase 0 do Core), já desenvolvida e testada localmente: migração aditiva → deploy → migração restritiva, conforme o [manual](docs/SEGURANCA_P1_MANUAL.md). Depois: senhas vazadas (painel), confirmação de backups e ensaio de restauração (S-09), S-05 (RLS de escrita por acesso).
2. **Core Contextual MVP, fase 1** (escopo pessoal, sem banco novo): primeira entrega proposta em [docs/CORE_ATENCAO_HOJE.md](docs/CORE_ATENCAO_HOJE.md), aguardando decisão; plano geral em [docs/CORE_CONTEXTUAL_MVP.md](docs/CORE_CONTEXTUAL_MVP.md).
3. Testes com login no CI, conforme a proposta em [docs/TESTES_E2E.md](docs/TESTES_E2E.md) (precisa de segredo no GitHub: aprovação).
4. Validação em aparelhos: roteiro curto em [docs/ROTEIRO_ANDROID.md](docs/ROTEIRO_ANDROID.md); lista completa em [docs/VALIDACAO_APARELHOS.md](docs/VALIDACAO_APARELHOS.md).
5. Modelo de organizações e testes de isolamento entre organizações (S-08), antes do Agent Office.
6. Financeiro: revisar o PR #5 e começar a base (alto risco: banco).
7. Agent Office; depois Agent Office Studio e 3D Studio.
8. Observabilidade e créditos por pessoa.

## Ponto de retomada (para qualquer agente)
0. **Ponto de retomada atual (22/11/2026):** a branch `fix/seguranca-p1` tem a segurança P1 pronta e testada localmente (commits em português, sem push). Próximo passo: revisar, abrir o PR, esperar o CI e publicar na ordem do manual, com a aprovação do Eduardo em cada passo sensível (aplicar migração, deploy). Depois do deploy, registrar aqui commit, deploy e evidências de produção.
1. Leia `CLAUDE.md`, este arquivo, [docs/FAST_TRACK.md](docs/FAST_TRACK.md) e [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md). O handoff técnico está em `docs/CLAUDE_HANDOFF_2026-11-12.md`.
2. Confira o estado real: `git log origin/main -5`, PRs abertos no GitHub, o último deploy de produção na Vercel e `list_migrations` no Supabase.
3. Classifique o que vai fazer: baixo risco (UI, docs) segue o processo simplificado; alto risco (banco, auth, custo, permissões) exige aprovação explícita do Eduardo a cada passo.
4. Antes de subir: `npm run typecheck && npm test && npm run build`, mais `npm run test:db` quando houver SQL. Testes de interface: `npm run test:e2e:public` (vai no CI) e `npm run test:e2e:auth` com o usuário de teste ([docs/TESTES_E2E.md](docs/TESTES_E2E.md)). Para mudança visual, siga o roteiro de verificação do Design System (360, 390, 412, 768, 1024, 1440 e 1920 px).
5. Ao terminar: atualize este arquivo, o [CHANGELOG.md](CHANGELOG.md), o [ROADMAP.md](ROADMAP.md) e a [matriz](docs/FEATURE_MATRIX.md), e gere o "GaDu — Resumo para ChatGPT".
