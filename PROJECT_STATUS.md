# GaDu · Situação do projeto

Atualizado em 13/11/2026 (Claude Code). Fonte de verdade: o código na `main` e as evidências abaixo. Intenção e planejamento ficam no [ROADMAP.md](ROADMAP.md); o detalhe por funcionalidade fica em [docs/FEATURE_MATRIX.md](docs/FEATURE_MATRIX.md).

## Ambiente de produção (verificado em 13/11/2026)
| Item | Estado | Evidência |
|---|---|---|
| App | https://gadu-agent.vercel.app | Vercel, projeto `gadu-agent`, região `iad1` |
| Última publicação | commit `fcf7415` (merge do PR #7, só documentação; último código: `d18286f`, PR #3) | deploy `dpl_25gzRNdYZfvUpKajHRTQr6j7cVLd`, `READY`, alias `gadu-agent.vercel.app`; home 200 e `/api/chat` sem login 401 |
| Erros em produção | nenhum nas 2h após o deploy | `get_runtime_errors` da Vercel |
| Banco | Supabase `sa-east-1`, Postgres 17 | 8 migrações registradas; a última é `daily_quota_atomic` |
| Cota diária | `consume_daily_quota()` ativa, limite 150 em `private.quota_policy` | teste com usuário temporário e rollback: para no limite sem passar |
| Rollback do app | deploys `dpl_31Q3Q78P…` (PR #3), `dpl_6tjFxWQV…` (PR #2), `dpl_VQszN7E9…` (antes do Marco Zero) | promover na Vercel |
| Rollback do banco | `drop function public.consume_daily_quota(); drop table private.user_quota; drop table private.quota_policy;` | a função antiga continua no banco |

## Concluído (entregue e verificado)
- Base do assistente: login, conversa com streaming e contingência de motor, voz do aparelho, memória com aprovação, Hoje, agenda, lembretes, tarefas, projetos, agentes simples, busca por significado, convites e admin, guia e home pública. Lista completa: [docs/FEATURE_MATRIX.md](docs/FEATURE_MATRIX.md).
- Marco Zero, segurança:
  - PR #2: o chat bloqueia quando cota, teto mensal ou limites por motor não podem ser validados (fail closed).
  - PR #3: cota diária atômica, com limite no servidor e dia de Brasília. Migração aplicada e verificada.
- Modelo de trabalho: GaDu Fast Track (PR #4, [docs/FAST_TRACK.md](docs/FAST_TRACK.md)).
- Documentação central (PR #7): este arquivo, CHANGELOG, matriz de funcionalidades, arquitetura e decisões oficiais.

## Em andamento
| Trabalho | Estágio | Onde |
|---|---|---|
| Orçamento mensal com reserva e reconciliação | Código e testes prontos, CI verde; **migração não aplicada; aguarda aprovação** | PR #6, branch `fix/monthly-budget-reservation-20261113` |
| Documentação Marco Zero (contexto mestre, Design System, auditoria) | Rascunho, não integrado | PR #1 |
| Especificação de Finanças pessoais | Pronta para revisão, não integrada | PR #5 |

## Pendente
- Teste real do chat com login em produção, feito pelo Eduardo. O último uso real registrado é de 10/11.
- Etapa 2 da cota, depois de 24h estáveis: remover `consume_quota(integer)` e o código de transição.
- Apagar `private.backup_usage_daily_20261113` depois de estabilizar.
- Gastos de IA, reservas e limite mensal visíveis no app (depende do PR #6).
- Estabilidade da conversa por voz; mensagens de erro em português; tela de erro própria.
- Auditoria completa de RLS e isolamento; administração de créditos.
- Módulos planejados: Finanças, Agent Office, Agent Office Studio, 3D Studio, Casa Inteligente.

## Problemas conhecidos e riscos
1. O teto mensal ainda não reserva valor antes de chamar a IA, então pedidos simultâneos podem passar um pouco do teto. O PR #6 corrige.
2. A função antiga `consume_quota` ainda pode ser chamada por usuários logados (transição).
3. App em `iad1` (EUA) e banco em `sa-east-1` (São Paulo): latência extra a cada consulta.
4. A proteção contra senhas vazadas está desligada no Supabase Auth.
5. O backup automático do plano Supabase não foi confirmado no painel.
6. Não há testes de ponta a ponta no navegador nem alerta de erro em produção.

## Próximas prioridades (em ordem)
1. **Teste real do chat** (Eduardo envia 2–3 mensagens); conferir `usage_daily` e `usage_events`.
2. **PR #6, orçamento com reserva**, depois de aprovação: backup, migração, teste com usuário temporário, merge, deploy e teste real.
3. **Gastos de IA, reservas e limite mensal na tela** (Ajustes e Hoje).
4. **Mensagens de erro em português e estabilidade da voz.**
5. **Etapa 2 da cota e limpeza do backup**, depois de 24h estáveis.

## Ponto de retomada (para qualquer agente)
1. Leia `CLAUDE.md`, este arquivo, [docs/FAST_TRACK.md](docs/FAST_TRACK.md) e o handoff mais recente em `docs/CLAUDE_HANDOFF_2026-11-12.md`. A versão completa do handoff está na branch do PR #6.
2. Confira o estado real: `git log origin/main -5`, PRs abertos no GitHub, o último deploy de produção na Vercel e `list_migrations` no Supabase.
3. Classifique o que vai fazer: baixo risco (UI, docs) segue o processo simplificado; alto risco (banco, auth, custo, permissões) exige aprovação explícita do Eduardo a cada passo.
4. Antes de subir: `npm run typecheck && npm test && npm run build`, mais `npm run test:db` quando houver SQL.
5. Ao terminar: atualize este arquivo, o [CHANGELOG.md](CHANGELOG.md), o [ROADMAP.md](ROADMAP.md) e a [matriz](docs/FEATURE_MATRIX.md), e gere o "GaDu — Resumo para ChatGPT".
