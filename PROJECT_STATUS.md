# GaDu · Situação do projeto

Atualizado em 13/11/2026, à tarde (Claude Code). Fonte de verdade: o código na `main` e as evidências abaixo. Intenção e planejamento ficam no [ROADMAP.md](ROADMAP.md); o detalhe por funcionalidade fica em [docs/FEATURE_MATRIX.md](docs/FEATURE_MATRIX.md).

## Ambiente de produção (verificado em 13/11/2026)
| Item | Estado | Evidência |
|---|---|---|
| App | https://gadu-agent.vercel.app | Vercel, projeto `gadu-agent`, região `iad1` |
| Última publicação | commit `fd77f84` (merge do PR #10, Design System) | deploy `dpl_H9wxTBkNm1uEKHvNTJV57dWP5q1R`, `READY`, alias `gadu-agent.vercel.app`; home 200, `/app` redireciona para o login, `/api/chat` sem login 401, página inexistente 404 |
| Banco | Supabase `sa-east-1`, Postgres 17 | 9 migrações registradas; as últimas são `daily_quota_atomic` e `ai_budget_reservations` |
| Cota diária | `consume_daily_quota()`, limite 150 em `private.quota_policy` | teste com usuário temporário e rollback; **uso real**: 4 mensagens contadas em 12/11 (dia de Brasília) |
| Orçamento mensal | `reserve/settle/release_ai_budget`, teto US$ 20 em `private.budget_policy` | teste com usuário temporário e rollback (teto, idempotência, isolamento, permissões); **uso real**: 1 reserva liquidada pelo custo real e ligada ao consumo |
| Rollback do app | deploys `dpl_ELAhLL3G…` (PR #9), `dpl_CBrNxW8e…` (PR #6), `dpl_31Q3Q78P…` (PR #3) | promover na Vercel |
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
- Modelo de trabalho Fast Track (PR #4) e documentação central (PRs #7 e #8).

## Em andamento
| Trabalho | Estágio | Onde |
|---|---|---|
| Documentação Marco Zero (contexto mestre, auditoria, governança) | Rascunho, não integrado. O `DESIGN_SYSTEM.md` dele foi substituído pelo da `main` | PR #1 |
| Especificação de Finanças pessoais | Pronta para revisão, não integrada | PR #5 |

## Pendente
- Etapa 2 da cota, depois de 24h estáveis: remover `consume_quota(integer)` e o código de transição; apagar os backups lógicos.
- Validar a voz nova no celular de verdade (iPhone e Android): modo conversa, interromper, respostas longas.
- Migrar os estilos inline restantes para tokens (cerca de 140, a maioria em Ajustes, Hoje e Agenda).
- Auditoria completa de RLS e isolamento; administração de créditos por pessoa (a base é `private.user_budget`).
- Monitoramento e alerta de erro; testes de ponta a ponta no navegador com login.
- Módulos planejados: Finanças, 3D Studio, Agent Office, Agent Office Studio, Casa Inteligente.

## Problemas conhecidos e riscos
1. A função antiga `consume_quota` ainda pode ser chamada por usuários logados (transição; sai na etapa 2).
2. App em `iad1` (EUA) e banco em `sa-east-1` (São Paulo): latência extra a cada consulta. Avaliar `gru1`.
3. A proteção contra senhas vazadas está desligada no Supabase Auth.
4. O backup automático do plano Supabase não foi confirmado no painel.
5. As telas do app só foram conferidas numa prévia local com dados fictícios: sem login automatizado, não há captura das telas reais com dados.
6. A estabilidade da voz foi testada com uma síntese de voz simulada; falta confirmar nos aparelhos.

## Próximas prioridades (em ordem)
1. **Uso diário e feedback do Eduardo** no celular e no computador (menu lateral, voz, erros).
2. **Etapa 2 da cota e limpeza dos backups** (alto risco: banco; pedir aprovação).
3. **Ajustes da voz** a partir do uso real.
4. **Design System, etapa 2**: migrar estilos inline de Ajustes, Hoje e Agenda; componentes compartilhados.
5. **Finanças**: revisar o PR #5 e começar a base (tabelas `fin_*` com RLS; alto risco: banco).

## Ponto de retomada (para qualquer agente)
1. Leia `CLAUDE.md`, este arquivo, [docs/FAST_TRACK.md](docs/FAST_TRACK.md) e [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md). O handoff técnico está em `docs/CLAUDE_HANDOFF_2026-11-12.md`.
2. Confira o estado real: `git log origin/main -5`, PRs abertos no GitHub, o último deploy de produção na Vercel e `list_migrations` no Supabase.
3. Classifique o que vai fazer: baixo risco (UI, docs) segue o processo simplificado; alto risco (banco, auth, custo, permissões) exige aprovação explícita do Eduardo a cada passo.
4. Antes de subir: `npm run typecheck && npm test && npm run build`, mais `npm run test:db` quando houver SQL. Para mudança visual, siga o roteiro de verificação do Design System (390, 768, 1024 e 1440 px).
5. Ao terminar: atualize este arquivo, o [CHANGELOG.md](CHANGELOG.md), o [ROADMAP.md](ROADMAP.md) e a [matriz](docs/FEATURE_MATRIX.md), e gere o "GaDu — Resumo para ChatGPT".
