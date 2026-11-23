# GaDu · Auditoria de RLS e escrita por acesso (23/11/2026)

Autor: Claude Code. Escopo: tarefa 7a (S-05, resto, e preparo do S-08). Complementa [SECURITY_AUDIT_2026-11-15.md](SECURITY_AUDIT_2026-11-15.md).

**Como foi feito (tudo reproduzível, em Postgres local descartável, com dados sintéticos; nada foi aplicado no Supabase de produção):**
- inventário de tabelas, políticas, funções e gatilhos lido do catálogo do Postgres depois de aplicar as 13 migrações da `main` (`scripts/test-db.sh` até a etapa de migrações);
- `npm run audit:db` (`GADU_AUDIT=1 bash scripts/test-db.sh`): todos os testes SQL passam; o único risco que aparece como "AINDA PRESENTE" é o S-05 (escrita direta em tabelas);
- uma matriz "pessoa bloqueada tenta gravar" (insert, update e delete em cada tabela, como o papel `authenticated`, desfazendo cada comando) e sondagens de chave estrangeira entre pessoas.

Limite: isto é o **esquema das migrações**. O banco de produção pode ter diferenças feitas pelo painel; a comparação com a produção (`list_tables`, `get_advisors`) precisa do Cursor ou do Eduardo.

## 1. Resumo

| # | Achado | Gravidade | Estado |
|---|---|---|---|
| A-1 | **S-05:** pessoa com `members.access = 'blocked'` ainda insere, altera e apaga dados em **18 tabelas** pelo cliente (a API do banco aceita a chave pública + a sessão dela) | Média (a sessão é encerrada ao bloquear; vale só até o token expirar, e quem tem token já emitido) | Aberto. Migração em **rascunho** (PR separado), precisa do OK do Eduardo |
| A-2 | `reminders.conversation_id` aceita o id de uma conversa **de outra pessoa** (sem política e sem chave composta): serve de oráculo de existência de ids (sucesso × erro 23503) | Baixa (não vaza conteúdo; ids são sequenciais) | Aberto. Corrigido no mesmo rascunho do S-05 (política restritiva) |
| A-3 | Tabelas só do servidor (`members`, `invites`, `usage_daily`, `search_index`, `daily_briefings`, `daily_pushes`) mantêm o privilégio `INSERT/UPDATE/DELETE` para `authenticated`; só a **falta de política** impede a escrita | Baixa hoje; **alta se alguém criar uma política permissiva por engano** (em `members` seria autopromoção a admin) | Recomendação (revogar os privilégios de escrita; passo próprio, aprovação do Eduardo) |
| A-4 | `google_connections.refresh_token_enc` é legível pelo cliente da própria pessoa (texto cifrado com a chave do servidor) | Baixa (cifrado; só da própria pessoa) | Recomendação (revogar `select` dessa coluna e ler só no servidor) |
| A-5 | `messages.input_tokens/output_tokens/cost_usd` são graváveis pela pessoa no insert | Baixa: o teto usa `usage_events` (só servidor) desde S-10; nada lê o custo da `messages` para decidir | Informativo |
| A-6 | `profiles.settings` é editável pela pessoa; o servidor lê só preferências e `budgets` por provedor (a pessoa só pode **baixar** o próprio teto por provedor; o teto real é `private.budget_policy`/`user_budget`) | Informativa | Sem ação |
| A-7 | **S-08:** não existe organização no banco; admin, acesso e convites são da instância toda | Preparo | Desenho em [ORGANIZACOES.md](ORGANIZACOES.md) |

Conferido e **sem problema**: RLS ligado em todas as 26 tabelas do schema `public` e nas 5 do `private`; toda tabela de pessoa tem `user_id` (`profiles` usa `id`); toda política usa `(select auth.uid())`; toda política de escrita tem `WITH CHECK`; vínculos entre linhas da mesma pessoa usam chave composta `(id, user_id)` (metas, financeiro) ou política/gatilho (tarefas, conversas, mensagens); `anon` sem nenhum privilégio no `public`; nenhuma função `SECURITY DEFINER` sem `search_path = ''`; funções de custo e fila só para `service_role`.

## 2. Tabelas do schema `public`

Todas com RLS ligado, sem `FORCE` (o dono das tabelas ignora a RLS por desenho do Supabase; o app nunca usa essa conexão). "Escrita" = políticas de `INSERT/UPDATE/DELETE` para `authenticated`.

| Tabela | `user_id` | Leitura | Escrita pela pessoa | Observação |
|---|---|---|---|---|
| `profiles` | `id` | própria | só `UPDATE` (própria) | criada pelo gatilho `handle_new_user` |
| `conversations` | sim | própria | tudo (própria) | gatilho valida `project_id` e `agent_id` |
| `messages` | sim | própria | `INSERT` (conversa tem de ser da pessoa), `DELETE` | sem `UPDATE` |
| `memories` | sim | própria | tudo | |
| `projects`, `agents` | sim | própria | tudo | |
| `tasks` | sim | própria | tudo; `WITH CHECK` confere projeto e conversa da pessoa | |
| `reminders` | sim | própria | tudo | **A-2:** sem conferir `conversation_id` |
| `push_subscriptions` | sim | própria | tudo | |
| `google_connections` | sim (chave) | própria | tudo | **A-4** |
| `goals`, `goal_progress`, `goal_milestones`, `goal_tasks` | sim | própria | tudo | chaves compostas `(id, user_id)` |
| `fin_itens`, `fin_item_meses`, `fin_gastos`, `fin_config` | sim | própria | tudo | chaves compostas |
| `usage_daily`, `usage_events`, `ai_reservations` | sim | própria | **nenhuma** (escreve o servidor/função) | `usage_events` e `ai_reservations` sem privilégio de escrita |
| `daily_briefings`, `daily_pushes`, `search_index` | sim | própria | **nenhuma** (escreve o agendador) | **A-3** |
| `members` | sim (chave) | própria linha | **nenhuma** (só o servidor) | **A-3** |
| `invites` | `created_by` | de quem convidou | **nenhuma** | **A-3** |

`private.*` (`budget_policy`, `user_budget`, `quota_policy`, `user_quota`, `rate_limits`): RLS ligado e `revoke all` de `public`, `anon` e `authenticated`.

## 3. Funções

Todas as 21 funções de `public` e `private` têm `search_path` fixo (`''`). As `SECURITY DEFINER`:

| Função | Quem executa | Comentário |
|---|---|---|
| `consume_daily_quota()`, `budget_status()` | `authenticated` | usam `auth.uid()`; a primeira recusa quem está bloqueado |
| `server_reserve/settle/release_ai_budget`, `auth_rate_limit_hit`, `server_revoke_user_sessions`, `index_backlog`, `index_prune`, `expire_ai_reservations` | só `service_role` | o servidor passa o `user_id` da sessão validada |
| `reserve/settle/release_ai_budget` (antigas) | ninguém (revogadas na etapa 2) | ficam por compatibilidade |
| `private.handle_new_user`, `private.is_blocked` | ninguém | `is_blocked` só é chamada por outras funções `SECURITY DEFINER` |

`private.check_conversation_links` e `private.touch_updated_at` são executáveis por `PUBLIC` (padrão do Postgres), mas são funções de gatilho, o schema `private` não é exposto e não têm efeito fora do gatilho. Sem ação.

`search_similar`, `month_spend`, `month_spend_by_provider` são `SECURITY INVOKER` (a RLS vale).

O servidor usa a chave secreta (`service_role`, que ignora a RLS) só em: limite de tentativas, orçamento (`ai-budget.ts`), convite (página e aceite), administração de pessoas e convites e o agendador (`cron/tick`). Nessas rotas o filtro por `user_id` é **código**, não banco (parte do S-08).

## 4. O que uma pessoa bloqueada ainda grava (A-1)

Medido no banco local: pessoa A ativa, pessoa B com `members.access = 'blocked'`. Cada comando foi executado como `authenticated` com o `sub` de B e depois desfeito. "GRAVOU" = a linha foi inserida, alterada ou apagada.

| Tabela | INSERT | UPDATE | DELETE |
|---|---|---|---|
| agents, conversations, fin_config, fin_gastos, fin_item_meses, fin_itens, goal_milestones, goal_progress, goal_tasks, goals, google_connections, memories, projects, push_subscriptions, reminders, tasks | GRAVOU | GRAVOU | GRAVOU |
| messages | GRAVOU | sem política (0 linhas) | GRAVOU |
| profiles | recusado (sem política) | GRAVOU | sem política (0 linhas) |

Tabelas só do servidor, mesma pessoa bloqueada: `members` (promover-se a admin ou reativar o próprio acesso), `usage_daily` (zerar a cota), `search_index` e `invites`: **todas recusadas** (0 linhas ou 42501). Ou seja, a pessoa bloqueada **não** consegue se desbloquear nem zerar a própria cota. O que ela ainda faz é mexer nos **próprios** dados.

O que o bloqueio já faz hoje (migração `20261122120001` + rotas): encerra as sessões (`server_revoke_user_sessions`), recusa reserva de orçamento e cota diária, tira a pessoa da indexação do agendador, e o servidor recusa `accessOf().ok = false`. Falta só a RLS de escrita.

## 5. Isolamento entre pessoas (sondagem)

Pessoa A ativa tentando tocar em linhas de B:

| Tentativa | Resultado |
|---|---|
| ler `messages` de B | 0 linhas |
| `messages.conversation_id` de B | recusado (RLS) |
| `tasks.conversation_id` de B | recusado (RLS) |
| `conversations.project_id` de B | recusado (gatilho) |
| `goal_progress.goal_id` de B | recusado (chave composta, 23503) |
| `reminders.conversation_id` de B | **GRAVOU** (A-2) |
| `reminders.conversation_id` inexistente | recusado 23503 → a diferença revela que o id de B existe |

## 6. Recomendações e próximos passos

1. **A-1 + A-2:** rascunho de migração (PR separado, **não mergear sem o OK do Eduardo**): função `public.can_write()` e políticas **restritivas** de escrita (`insert`, `update`, `delete`) nas 18 tabelas, mais a política restritiva de `reminders.conversation_id`. Testes e plano de rollback no PR. É restritivo: alto risco.
2. **A-3:** revogar `insert, update, delete` de `authenticated` nas seis tabelas só do servidor (defesa em profundidade). Precisa conferir que nenhuma rota usa a sessão da pessoa para escrever nelas (hoje nenhuma usa: `members` e `invites` por `supabaseAdmin`, o resto por função ou agendador). Passo próprio.
3. **A-4:** tirar `select (refresh_token_enc)` do cliente e ler só pelo servidor. Pede conferir `src/app/api/google/*`.
4. **S-08:** seguir o [desenho](ORGANIZACOES.md), só depois do S-05.
5. Comparar este inventário com o banco de produção (`list_tables`, `get_advisors` pelo MCP) para achar o que foi mexido fora das migrações. Fora do alcance desta auditoria.
6. Senhas vazadas (painel do Supabase Auth) e backups (S-09) seguem pendentes, humanos.
