# GaDu · Situação do projeto

Atualizado em 13/11/2026, depois da UX/UI v2 (Claude Code). Fonte de verdade: o código na `main` e as evidências abaixo. Intenção e planejamento ficam no [ROADMAP.md](ROADMAP.md); o detalhe por funcionalidade fica em [docs/FEATURE_MATRIX.md](docs/FEATURE_MATRIX.md).

## Ambiente de produção (verificado em 13/11/2026)
| Item | Estado | Evidência |
|---|---|---|
| App | https://gadu-agent.vercel.app | Vercel, projeto `gadu-agent`, região `iad1` |
| Última publicação | commit `883ea23` (merge do PR #12, UX/UI v2) | deploy `dpl_ENVExSFmz4Wq1BLn6drKSreuQc5j`, `READY`; telas reais capturadas com sessão autenticada em 1440 e 390 px; assistente respondeu em produção com o contexto da tela |
| Banco | Supabase `sa-east-1`, Postgres 17 | 9 migrações registradas; as últimas são `daily_quota_atomic` e `ai_budget_reservations` |
| Cota diária | `consume_daily_quota()`, limite 150 em `private.quota_policy` | teste com usuário temporário e rollback; **uso real**: 4 mensagens contadas em 12/11 (dia de Brasília) |
| Orçamento mensal | `reserve/settle/release_ai_budget`, teto US$ 20 em `private.budget_policy` | teste com usuário temporário e rollback (teto, idempotência, isolamento, permissões); **uso real**: 1 reserva liquidada pelo custo real e ligada ao consumo |
| Rollback do app | deploys `dpl_DFKuhDx6…` (antes da v2, PR #11), `dpl_ELAhLL3G…` (PR #9), `dpl_CBrNxW8e…` (PR #6) | promover na Vercel |
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
- Modelo de trabalho Fast Track (PR #4) e documentação central (PRs #7 e #8).

## Em andamento
| Trabalho | Estágio | Onde |
|---|---|---|
| Documentação Marco Zero (contexto mestre, auditoria, governança) | Rascunho, não integrado. O `DESIGN_SYSTEM.md` dele foi substituído pelo da `main` | PR #1 |
| Especificação de Finanças pessoais | Pronta para revisão, não integrada | PR #5 |

## Pendente
- Levar as telas Projetos, Agentes, Memória, Admin, Guia e Agenda para os componentes da v2 (hoje usam os tokens e os temas, mas mantêm o desenho anterior).
- Auditoria de contraste do tema claro em todas as telas; migrar estilos inline restantes.
- Validar a voz e o assistente no celular de verdade (iPhone e Android).
- Etapa 2 da cota (remover `consume_quota(integer)`) e apagar os backups lógicos: alto risco, pede aprovação.
- Decidir o destino do usuário de teste (manter para capturas ou remover).
- Auditoria completa de RLS e isolamento; administração de créditos por pessoa.
- Monitoramento e alerta de erro; testes de ponta a ponta automatizados.
- Módulos planejados, sem código: Financeiro, 3D Studio, Agent Office (além dos agentes), Agent Office Studio.

## Problemas conhecidos e riscos
1. A função antiga `consume_quota` ainda pode ser chamada por usuários logados (transição; sai na etapa 2).
2. App em `iad1` (EUA) e banco em `sa-east-1` (São Paulo): latência extra a cada consulta. Avaliar `gru1`.
3. A proteção contra senhas vazadas está desligada no Supabase Auth.
4. O backup automático do plano Supabase não foi confirmado no painel.
5. O cruzamento de dados entre módulos, organizações ou clientes não existe: o contexto do assistente é só um rótulo, e o escopo é sempre o da própria pessoa.
6. A estabilidade da voz foi testada com uma síntese de voz simulada; falta confirmar nos aparelhos.

## Próximas prioridades (em ordem)
1. **Feedback do Eduardo sobre a v2** no computador e no celular; corrigir o que aparecer no uso.
2. **Completar a v2** nas telas que ainda têm o desenho anterior (Projetos, Agentes, Memória, Admin, Agenda).
3. **Voz no aparelho**: validar e ajustar.
4. **Financeiro**: revisar a especificação (PR #5) e começar a base (alto risco: banco).
5. **Etapa 2 da cota e limpeza dos backups** (alto risco: banco).

## Ponto de retomada (para qualquer agente)
1. Leia `CLAUDE.md`, este arquivo, [docs/FAST_TRACK.md](docs/FAST_TRACK.md) e [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md). O handoff técnico está em `docs/CLAUDE_HANDOFF_2026-11-12.md`.
2. Confira o estado real: `git log origin/main -5`, PRs abertos no GitHub, o último deploy de produção na Vercel e `list_migrations` no Supabase.
3. Classifique o que vai fazer: baixo risco (UI, docs) segue o processo simplificado; alto risco (banco, auth, custo, permissões) exige aprovação explícita do Eduardo a cada passo.
4. Antes de subir: `npm run typecheck && npm test && npm run build`, mais `npm run test:db` quando houver SQL. Para mudança visual, siga o roteiro de verificação do Design System (390, 768, 1024 e 1440 px).
5. Ao terminar: atualize este arquivo, o [CHANGELOG.md](CHANGELOG.md), o [ROADMAP.md](ROADMAP.md) e a [matriz](docs/FEATURE_MATRIX.md), e gere o "GaDu — Resumo para ChatGPT".
