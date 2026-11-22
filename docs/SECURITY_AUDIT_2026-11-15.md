# GaDu · Auditoria de segurança (somente leitura) · 15/11/2026

**Atualização de 22/11/2026:** as correções de prioridade 1 e da fase 0 do Core foram **desenvolvidas e testadas localmente** na branch `fix/seguranca-p1`. **Nada foi publicado e nenhuma migração foi aplicada no Supabase.** Veja "Status das correções" abaixo. O texto original da auditoria (15/11) fica como histórico.

Escopo: código da `main` (`ca1b2fd`) e banco de produção (Supabase `sa-east-1`). **Nada foi alterado** no banco, no RLS, na autenticação, nas permissões ou nas funções financeiras. As consultas ao banco foram só leitura (`select` em catálogos, políticas e definições de função, mais contagens agregadas, sem conteúdo de pessoas). A auditoria anterior citada numa migração (`SECURITY_AUDIT_2026-11-12.md`) não está no repositório; fica no PR #1, ainda não integrado.

Legenda:
- **Prioridade:** P0 imediato · P1 alta · P2 média · P3 baixa.
- **Risco da correção** (docs/FAST_TRACK.md): banco, autenticação, permissões e custo são **alto risco** e só mudam com aprovação específica.

## Status das correções (22/11/2026)
Branch `fix/seguranca-p1`. Estágio de todas: **desenvolvido e testado localmente; não publicado.** Migrações: `20261122120001_seguranca_p1_aditiva.sql` (aplicar antes do deploy) e `20261122120002_seguranca_p1_restritiva.sql` (aplicar depois do deploy). Ordem e conferências: [SEGURANCA_P1_MANUAL.md](SEGURANCA_P1_MANUAL.md).

| ID | Status | O que foi feito | Prova (local) |
|---|---|---|---|
| S-01 | **Corrigido no código e nas migrações; falta publicar** | Funções `server_reserve/settle/release_ai_budget(p_user, ...)` só para `service_role`, chamadas pelo servidor com o id da sessão (`src/lib/ai-budget.ts`). Revoga o execute das antigas (restritiva). O servidor grava o custo real mesmo com `already` (o banco completa a diferença) ou reserva liberada; se a liquidação falhar, grava direto pelo cliente do servidor. `budget_status` continua para a pessoa | `40_seguranca_p1.test.sql`, `20_ai_budget.test.sql`, corrida de liquidação, `test/chat-route.integration.test.ts`; `audit:db`: CORRIGIDO |
| S-02 | **Corrigido no código; falta publicar** | Resposta cortada ou cancelada com texto já enviado é liquidada por estimativa (entrada + caracteres recebidos ÷ 4, limitada ao reservado); só libera se nada saiu (`src/lib/partial-cost.ts`, `chat/route.ts`) | `src/lib/partial-cost.test.ts`, 4 testes de integração do chat |
| S-03 | **Parcial: limite de tentativas corrigido no código; senhas vazadas é passo manual** | `private.rate_limits` + `auth_rate_limit_hit` (só `service_role`), janela de 10 min por IP e por e-mail (hash) em `/api/auth/*` e `/api/invite/accept`, 429 em português. Contador indisponível: **não trava o login** (fail open, com log). Senhas vazadas: painel, ver o manual | `test/auth-rate-limit.integration.test.ts`, `src/lib/client-ip.test.ts`, SQL do contador; **senhas vazadas: pendente (manual)** |
| S-04 | **Corrigido no código e na migração aditiva; falta publicar** | `cron/tick` ignora quem tem `members.access <> 'active'` (lembretes, briefing, revisão, indexação, Google); `index_backlog` também. Sem linha em `members` (só `ALLOWED_EMAILS`) continua ativo, como em `access.ts`. Se a lista de bloqueados falhar, a tarefa falha (não processa às cegas) | `test/cron-tick.integration.test.ts`, SQL de `index_backlog` |
| S-05 | **Parcial** | Feito: bloquear encerra as sessões (`server_revoke_user_sessions`; `auth.admin.signOut` do supabase-js exige o JWT da pessoa, não o id); reserva de orçamento e cota diária recusam quem não está ativo (o custo real de uma resposta em andamento ainda é gravado). **Não feito:** políticas de RLS de escrita por acesso (o `audit:db` mostra "AINDA PRESENTE, parcial") | `test/admin-block.integration.test.ts`, `40_seguranca_p1.test.sql`; encerramento de sessão testado só no banco local (conferir em produção, manual 1.3) |
| S-06 | **Corrigido no código; falta publicar** | Admin não bloqueia a si mesmo, outro admin nem e-mail de `ADMIN_EMAILS` (`src/lib/admin-guard.ts`). A tabela de auditoria de ações de admin **não foi criada** (fora do escopo) | `src/lib/admin-guard.test.ts`, `test/admin-block.integration.test.ts` |
| S-07 | **Corrigido no código e na migração restritiva; falta publicar** | Chat fail closed se `consume_daily_quota` falhar; `consume_quota(integer)` revogada e removida (restritiva) | `test/chat-route.integration.test.ts`, `10_daily_quota.test.sql`, `40_seguranca_p1.test.sql`; `audit:db`: CORRIGIDO |
| S-08 | Aberto (fora do escopo) | — | — |
| S-09 | Aberto: **confirmar no painel** | Passos no manual, seção 3. `private.backup_*` não foram apagadas | — |
| S-10 | **Corrigido na migração restritiva; falta publicar** | Revoga insert/update/delete e remove a política de insert em `usage_events`. Todo código que gravava consumo (só `src/lib/ai-budget.ts`; embeddings, memória e insights não gravam) passa pelo servidor | `40_seguranca_p1.test.sql`; `audit:db`: CORRIGIDO |
| S-11 | **Corrigido no código; falta publicar** | `proxy.ts` responde 503 nas rotas protegidas se faltar a configuração do Supabase; o público segue | `test/proxy.integration.test.ts`, `test/proxy-configured.integration.test.ts` |
| S-12 | **Corrigido na migração restritiva; falta publicar** | `anon` sem privilégio em tabelas, sequências e funções do `public` (nada do app usa `anon` para ler tabelas); `authenticated` sem TRUNCATE, REFERENCES e TRIGGER; privilégios padrão de tabelas futuras; `search_similar` deixa de depender de `PUBLIC`. Funções futuras: o Postgres dá EXECUTE a `PUBLIC` e isso não se desfaz por schema; o teste de CI falha se alguma função do `public` ficar executável por `PUBLIC`/`anon` | `40_seguranca_p1.test.sql`; `audit:db`: CORRIGIDO |
| S-13, S-14, S-15 | Abertos (fora do escopo) | — | — |

Resultado do `npm run audit:db` com as duas migrações aplicadas no banco local: S-01, S-03 (contador), S-04, S-05 (custo e cota), S-07, S-10 e S-12 **CORRIGIDO**; S-05 (escrita direta em tabelas) **AINDA PRESENTE**, como esperado.

## Resumo (texto original de 15/11)
- **Isolamento entre pessoas está correto.** Todas as 18 tabelas públicas têm RLS. Todas as 31 políticas usam `user_id = (select auth.uid())` e são só para `authenticated`. As tabelas internas ficam em `private`, sem políticas e sem permissão para `anon` e `authenticated`.
- **O ponto mais sério é de custo, não de vazamento** (S-01): uma pessoa logada pode chamar a função de liquidação de orçamento direto pela API do Supabase com custo 0 e escapar do teto mensal. Só a cota diária continua limitando.
- **Autenticação no app está bem feita:** toda rota confere a sessão no servidor, o `user_id` vem da sessão, os convites usam hash e o token do Google é cifrado. As lacunas estão no Supabase Auth: limite de tentativas e proteção contra senhas vazadas desligada.
- Nada exige ação de emergência (P0). Há 1 P1, 7 P2 e o resto P3.

## Evidência coletada no banco (15/11/2026)
| Verificação | Resultado |
|---|---|
| RLS nas tabelas `public` | 18 de 18 com RLS ativo; 31 políticas, todas `to authenticated` e com `(select auth.uid())` |
| Tabelas `private` (cota, orçamento, backups) | RLS ativo, 0 políticas, sem `SELECT` para `anon` nem `authenticated` (o assessor do Supabase marca como INFO, e é intencional) |
| Permissão de tabela para `anon` | `GRANT SELECT` padrão existe em `public`, mas sem política para `anon` não retorna nada (proteção em uma camada só) |
| Funções `SECURITY DEFINER` | todas com `search_path = ''`. As do agendador (`expire_ai_reservations`, `index_backlog`, `index_prune`) só para `service_role`. Liberadas para `authenticated`: `budget_status`, `consume_daily_quota`, `consume_quota`, `reserve_ai_budget`, `settle_ai_budget`, `release_ai_budget` |
| `settle_ai_budget` | aceita `p_cost_usd` entre 0 e 100 vindo de quem chama. Se a reserva já está liquidada, devolve `ok: true, already: true` |
| `consume_quota(p_limit)` (antiga) | ainda existe e é executável por `authenticated`. Incrementa `usage_daily` da própria pessoa e compara com o limite **enviado por quem chama**. O app usa `consume_daily_quota` e só cai na antiga como contingência (`route.ts:116`) |
| `usage_events` | política de INSERT para a própria pessoa; custo só com `CHECK (cost_usd >= 0)`, sem teto |
| Teto global | `global_monthly_limit_usd = null` (desligado); teto por pessoa US$ 20; reserva entre US$ 0,01 e 1 |
| Reservas abertas | 0 |
| Pessoas | 2 contas em `auth.users`, 2 em `members` (papéis `admin` e `member`) |
| Backups lógicos | `private.backup_usage_daily_20261113` (2 linhas) e `private.backup_usage_events_20261113` (44 linhas) |
| Assessor de segurança do Supabase | 6 avisos de função `SECURITY DEFINER` executável por `authenticated` (os da linha acima); proteção contra senhas vazadas **desligada** |

## Verificação em execução (16/11/2026)
Postgres 16 local e descartável, com **todas as 9 migrações** aplicadas (inclusive pgvector) sobre uma imitação do Supabase (`supabase/tests/00_supabase_shim.sql`), mais duas pessoas sintéticas e o papel `anon`. Nunca conecta no banco de produção.

**Isolamento** (`supabase/tests/30_isolamento.test.sql`, roda no CI em todo PR):
- Nas **18 tabelas públicas**, a pessoa A lê as próprias linhas. A pessoa B não lê, não altera, não apaga e não insere em nome de A. Sem login não se lê nada. As linhas de A continuam intactas depois das tentativas.
- Vínculos cruzados recusados: B não cria tarefa em projeto de A, não move a própria tarefa para projeto de A, não escreve em conversa de A e não liga conversa a projeto ou agente de A.
- B não muda o próprio papel nem o próprio acesso.
- `search_similar` devolve só os itens da própria pessoa; sem login, nada.
- Funções do agendador recusam quem está logado.
- **Resultado: nenhum vazamento entre pessoas. Todos passaram.**

**Riscos conhecidos** (`npm run audit:db`, informativo, fora do CI):
| ID | Resultado em execução |
|---|---|
| S-01 | **CONFIRMADO:** a pessoa liquidou a própria reserva com custo 0 (`ok: true`). A liquidação real do servidor (US$ 0,30) voltou `already: true` e o custo gravado ficou 0 |
| S-05 | **CONFIRMADO:** pessoa com `access = 'blocked'` inseriu uma tarefa pela API do banco |
| S-07 | **CONFIRMADO:** `consume_quota(1000000)` continuou respondendo `true` com a política diária em 5 (a nova `consume_daily_quota` respeita o limite do servidor) |
| S-10 | **CONFIRMADO:** a pessoa inseriu consumo de US$ 99 em `usage_events` (o teto global está desligado, então só afeta a própria pessoa) |
| S-12 | **CONFIRMADO:** `anon` tem SELECT nas 18 tabelas, mas a RLS não devolve nenhuma linha |

**Organizações e clientes:** o modelo **não existe** no banco (nenhuma tabela `org*` ou de cliente; `members` e `invites` não têm organização). Não há regra por organização a testar; o risco é de preparação (S-08).

**Origem de cada achado:** S-01, S-05, S-07, S-10 e S-12 foram confirmados em execução (local, dados sintéticos). S-02, S-03, S-04, S-06, S-08, S-09, S-11, S-13, S-14 e S-15 foram identificados por leitura do código ou do painel (S-03 e S-09 dependem de configuração do Supabase não visível por SQL). Na produção, a auditoria foi só leitura (catálogos, políticas, definições de função e contagens agregadas, em 15/11).

## Matriz de riscos
| ID | Área | Risco | Evidência | Impacto | Prob. | Prior. | Correção proposta | Risco da correção |
|---|---|---|---|---|---|---|---|---|
| S-01 | Custo | Pessoa logada liquida a própria reserva com custo 0 pela API do Supabase antes do servidor. O servidor recebe `already` e não grava o custo real, então o **teto mensal deixa de valer** | definição de `public.settle_ai_budget` (banco); migração `20261113140001` linhas 57, 147-148, 223; `src/lib/ai-budget.ts:28-29` | Gasto de IA sem teto mensal; o limite passa a ser a cota diária × custo máximo por resposta | Baixa (exige pessoa convidada de má-fé) | **P1** | Tirar `reserve`, `settle` e `release` do papel `authenticated` e chamá-las só no servidor (função com `service_role` recebendo o `user_id` da sessão). Alternativa mínima: `settle` só pelo servidor, e o servidor grava o custo real mesmo quando receber `already` | Alto (banco + custo) |
| S-02 | Custo | Resposta cancelada ou com erro no meio não registra custo: a reserva é liberada | `src/lib/llm/anthropic.ts:39-40`; `src/app/api/chat/route.ts:251,315-317` | Teto mensal contornável cancelando no fim de cada resposta | Média | P2 | Se já saiu texto, liquidar pela estimativa (entrada + caracteres recebidos ÷ 4) ou pelo valor reservado; liberar só sem texto | Alto (custo) |
| S-03 | Autenticação | Limite de tentativas de senha, código e convite fica no Supabase, que vê o IP da Vercel, não o de quem tenta. Proteção contra senhas vazadas desligada | `src/app/api/auth/password/route.ts:11,17`, `verify/route.ts:16`, `otp/route.ts:15`; assessor do Supabase | Adivinhação de senha ou código, ou travar o login de todos | Média | P2 | Ligar a proteção contra senhas vazadas (painel); limite por IP e por e-mail em `/api/auth/*` e `/api/invite/*` (Vercel Firewall ou contador) | Alto (autenticação) |
| S-04 | Bloqueio | O agendador ignora o bloqueio: quem foi bloqueado continua recebendo push, tendo o Google lido e o conteúdo indexado | `src/app/api/cron/tick/route.ts:39-45,58,71,96,118` | Processamento e custo de dados de quem não deveria mais usar | Média | P2 | Filtrar `members.access = 'active'` no agendador e em `index_backlog` | Baixo no código do agendador; alto em `index_backlog` |
| S-05 | Bloqueio | Bloquear não corta o acesso direto ao banco: as políticas checam só `auth.uid()`, não o acesso. A sessão continua valendo até expirar | políticas acima; `src/lib/access.ts:16-18` | Pessoa bloqueada ainda lê e grava os próprios dados pela API (não chega à IA) | Baixa | P2 | Ao bloquear, encerrar as sessões (`auth.admin.signOut(id, 'global')`); função `private.has_access()` nas políticas de escrita e nas funções de custo | Alto (banco + auth) |
| S-06 | Admin | Sem hierarquia entre admins (qualquer admin bloqueia o dono) e sem registro das ações de admin | `src/app/api/admin/people/route.ts:44-54`; `src/lib/access.ts:19` | Admin comprometido tranca o dono fora | Baixa | P2 | Proibir bloquear admin ou e-mail de `ADMIN_EMAILS`; tabela de auditoria de admin | Alto (permissões) |
| S-07 | Função antiga | `consume_quota(p_limit)` continua executável e aceita o limite enviado por quem chama (só infla o contador da própria pessoa). **O chat ainda a usa como contingência** quando `consume_daily_quota` falha | definição no banco; aviso do assessor; `src/app/api/chat/route.ts:110-116` | Baixo (só afeta a própria pessoa); superfície desnecessária | Baixa | P2 | **Etapa 2 da cota:** 1) tirar a contingência do código (fail closed se `consume_daily_quota` falhar); 2) `revoke execute`; 3) `drop function public.consume_quota(integer)`. Com teste em `test:db` e plano de volta | Alto (banco), já planejado |
| S-08 | Multiempresa | Acesso, papel de admin e tela de admin são globais da instância; convites sem organização; o agendador usa a chave secreta e filtra só por `user_id` no código | `src/lib/access.ts:13-19`; `src/app/api/admin/people/route.ts:14-19`; `src/app/api/cron/tick/route.ts` | Hoje correto (um dono). Com organizações, risco de cruzar dados | n/a hoje | **P2 antes do Agent Office** | Modelo `orgs` e `org_members(org_id, user_id, role)`; `org_id` obrigatório nas tabelas novas; políticas por vínculo com função estável; agendador por funções específicas; testes de isolamento entre organizações no `test:db` | Alto |
| S-09 | Backup | Backup automático e recuperação do plano Supabase **não confirmados**; nenhum teste de restauração registrado. Backups lógicos de 13/11 ainda no banco | painel não acessível por SQL; tabelas `private.backup_*` | Perda de dados sem caminho testado de volta | Baixa | P2 | Confirmar no painel o plano, a retenção e a recuperação ponto a ponto; registrar o RPO e o RTO; ensaiar uma restauração num projeto de teste; apagar os backups lógicos só depois, com aprovação | Baixo (verificar); alto (apagar backups) |
| S-10 | Custo | Pessoa pode inserir consumo inventado em `usage_events` (sem teto). Com o teto global **desligado**, só prejudica a própria pessoa; ligado, bloquearia todos | política `usage_events_insert`; `budget_policy.global_monthly_limit_usd = null` | Hoje baixo | Baixa | P3 (vira P1 se o teto global for ligado) | Revogar o INSERT de `authenticated`; contingência por função `security definer` com custo limitado | Alto (banco + custo) |
| S-11 | Proxy | Se faltar a configuração do Supabase, o `proxy.ts` deixa passar as rotas protegidas (falha aberta). As APIs falham, mas `/app` abre a casca da página | `src/proxy.ts:38` | Baixo (só com erro de configuração) | Baixa | P3 | Com configuração ausente, responder 503 nas rotas protegidas | Alto pela regra (autenticação), mas a mudança é pequena |
| S-12 | Banco | `GRANT SELECT` para `anon` nas tabelas públicas (padrão do Supabase). Sem política para `anon` não retorna nada, mas é uma camada só | consulta de privilégios | Muito baixo | Baixa | P3 | `revoke select ... from anon` nas tabelas que não precisam (todas hoje) | Alto (permissões) |
| S-13 | Autenticação | O código de login provavelmente revela quais e-mails têm conta (erro diferente para e-mail sem conta) | `src/app/api/auth/otp/route.ts:6-7,15-22` | Descobrir quem usa o GaDu | Média | P3 | Responder igual para e-mail sem conta | Alto pela regra (autenticação) |
| S-14 | Sessão | Cookies de sessão do `@supabase/ssr` não são `httpOnly` (padrão da biblioteca); o comentário diz o contrário | `src/app/api/auth/verify/route.ts:10` | Roubo de sessão só com XSS (CSP com nonce reduz) | Baixa | P3 | Avaliar `httpOnly` no servidor e no proxy; o comentário já foi corrigido neste ciclo | Alto (autenticação) |
| S-15 | Diversos | Sem checagem de `Origin` nas rotas que mudam estado (só `SameSite=Lax`); push aceita qualquer URL `https` (SSRF limitado); tarefas e lembretes vindos de e-mail gravados sem confirmação (prompt injection); embeddings sem cota; `/api/health` mostra a configuração; GitHub Actions por tag, não por SHA | relatório de código, itens C-10, C-12, C-14, C-15, C-16, C-17 | Baixo | Baixa | P3 | Checar `Origin` no proxy; lista de hosts de push; confirmação quando houver dado externo no contexto; limite em `/api/search`; `/api/health` só com `ok`; actions por SHA | Baixo na maioria |

## Controles confirmados (o que está bem)
- Toda rota de API confere a sessão e o acesso no servidor e valida com zod; o `user_id` sempre vem da sessão. Ids enviados pelo cliente passam por select sob RLS.
- A chave secreta do Supabase só no servidor (agendador, convite, admin), sempre depois de checagem; nenhuma variável secreta com `NEXT_PUBLIC_`.
- Token do Google cifrado (AES-256-GCM, id da pessoa como dado autenticado); chave só no servidor.
- Convites: token de 32 bytes, banco guarda só o hash, uso único e atômico, 7 dias.
- Agendador: segredo comparado em tempo constante; sem segredo, recusa.
- Chat: ordem fail closed (sessão → zod → privacidade → limites por motor → reserva → cota). O contexto do assistente é só rótulo validado, nunca autorização.
- Cabeçalhos: CSP com nonce e `strict-dynamic`, `frame-ancestors 'none'`, HSTS. Coberto agora por teste automático no CI.
- `npm audit` de produção: 0 vulnerabilidades. `.env*` fora do git; workflows sem segredos e com `contents: read`.

## Ordem sugerida de correção (cada passo com aprovação, teste em `test:db` e plano de volta)
1. **S-01 e S-02** (custo): funções de orçamento só pelo servidor; liquidação de respostas interrompidas.
2. **S-03** (painel): ligar a proteção contra senhas vazadas; limite de tentativas na Vercel.
3. **S-07** (etapa 2 da cota) junto com **S-12** (`revoke` de `anon`).
4. **S-04, S-05 e S-06** (bloqueio e admin).
5. **S-09**: confirmar backups e ensaiar uma restauração; depois decidir sobre os backups lógicos.
6. **S-08**: modelo de organizações e testes de isolamento, antes do Agent Office e antes do Core Contextual sair do escopo pessoal.

Relatório completo da revisão de código (18 itens, C-01 a C-18): resumido acima; os IDs C-xx aparecem na coluna de evidência.
