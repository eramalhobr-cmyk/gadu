# GaDu · Auditoria de segurança (somente leitura) · 15/11/2026

Escopo: código da `main` (`ca1b2fd`) e banco de produção (Supabase `sa-east-1`). **Nada foi alterado** no banco, no RLS, na autenticação, nas permissões ou nas funções financeiras. As consultas ao banco foram só leitura (`select` em catálogos, políticas e definições de função, mais contagens agregadas, sem conteúdo de pessoas). A auditoria anterior citada numa migração (`SECURITY_AUDIT_2026-11-12.md`) não está no repositório; fica no PR #1, ainda não integrado.

Legenda:
- **Prioridade:** P0 imediato · P1 alta · P2 média · P3 baixa.
- **Risco da correção** (docs/FAST_TRACK.md): banco, autenticação, permissões e custo são **alto risco** e só mudam com aprovação específica.

## Resumo
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
