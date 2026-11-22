# GaDu · Segurança P1: passos manuais

Para o Eduardo. Cobre o que **não está no código**: a ordem de implantação das duas migrações, o que conferir no painel do Supabase (senhas vazadas, backups, restauração) e, opcionalmente, o limite de tentativas na Vercel. Contexto: [SECURITY_AUDIT_2026-11-15.md](SECURITY_AUDIT_2026-11-15.md).

Estado desta entrega (atualizado em 22/11/2026): **publicada** (PR #22, merge `cc850400ff982d2463cf750de539fa194b04b5b6`). As duas migrações foram aplicadas na produção (aditiva `20261122175405`, restritiva `20261122175542`) e o deploy da Vercel está no ar. **Nenhuma configuração do painel foi mudada.** Os passos de publicação (seção 1) estão marcados como feitos; as seções 2 a 4 continuam pendentes.

Nenhum valor secreto aparece aqui. Chaves ficam só nas variáveis de ambiente da Vercel e do Supabase.

---

## 1. Ordem de implantação (alto risco: banco e custo)

As migrações foram divididas para o chat **não cair** em produção:

| Etapa | O que fazer | Por que nessa ordem |
|---|---|---|
| 0 | ⚠️ Não feito como descrito: o plano Supabase é Free, sem backups baixáveis (ver seção 3). A existência de `SUPABASE_SECRET_KEY` na Vercel não foi registrada como conferida. Conferir backup do banco (seção 3). Conferir na Vercel que `SUPABASE_SECRET_KEY` existe em Production | O app novo chama as funções de orçamento com essa chave. Sem ela, o chat **bloqueia** (fail closed) |
| 1 | ✅ Feito (versão `20261122175405`). Aplicar `supabase/migrations/20261122120001_seguranca_p1_aditiva.sql` | Só adiciona. O app de hoje continua funcionando (provado em `supabase/tests/compat/aditiva_compat.sql`) |
| 2 | ✅ Feito. Conferir a etapa 1 (consultas da seção 1.1) | Garante que as funções novas existem antes do deploy |
| 3 | ✅ Feito (22/11/2026 14:54, deploy concluído). Fazer o merge e o deploy do app novo na Vercel | O app novo usa `server_reserve/settle/release_ai_budget` e não usa mais `consume_quota` |
| 4 | ❌ Não verificado em produção com pessoa logada (e2e com login precisa de credenciais). Só o público (6 de 6) e `/api/chat` sem sessão 401 foram testados. Testar no app: enviar uma mensagem no chat e conferir que o consumo apareceu em Ajustes | Valida o app novo com o banco da etapa 1 |
| 5 | ✅ Feito (versão `20261122175542`). Aplicar `supabase/migrations/20261122120002_seguranca_p1_restritiva.sql` | Só agora revoga as funções antigas, `consume_quota`, o insert em `usage_events` e o `anon` |
| 6 | ◐ Conferência do banco feita (`consume_quota` ausente; sem EXECUTE em `settle_ai_budget`; sem INSERT em `usage_events`; `anon` com 0 privilégios de tabela em `public`; `consume_daily_quota` e `budget_status` mantidas). Repetir o teste do chat com pessoa logada: pendente. Conferir a etapa 5 (consultas da seção 1.2) e repetir o teste do chat | Fecha o ciclo |

**Nunca aplique a restritiva antes do deploy:** o app antigo usa as funções que ela revoga e o chat para de responder.

Como aplicar: Supabase → **SQL Editor** → colar o conteúdo do arquivo → **Run**. (Ou `supabase db push`, se você usa a CLI ligada ao projeto.) As duas migrações são rápidas e não reescrevem tabelas.

### 1.1 Conferência depois da etapa 1 (somente leitura)
No SQL Editor:

```sql
-- As cinco funções novas existem e só o service_role executa (esperado: todas as linhas com anon = false e authenticated = false)
select p.oid::regprocedure as funcao,
       has_function_privilege('service_role', p.oid, 'execute') as service_role,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
       has_function_privilege('anon', p.oid, 'execute') as anon
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('server_reserve_ai_budget','server_settle_ai_budget','server_release_ai_budget','auth_rate_limit_hit','server_revoke_user_sessions');

-- A tabela do contador existe, com RLS (esperado: true)
select relrowsecurity from pg_class where oid = 'private.rate_limits'::regclass;
```

### 1.2 Conferência depois da etapa 5 (somente leitura)
```sql
-- Funções antigas de orçamento fechadas (esperado: false, false, false)
select has_function_privilege('authenticated','public.reserve_ai_budget(text,numeric)','execute'),
       has_function_privilege('authenticated','public.settle_ai_budget(uuid,text,text,integer,integer,numeric)','execute'),
       has_function_privilege('authenticated','public.release_ai_budget(uuid)','execute');

-- consume_quota removida (esperado: 0)
select count(*) from pg_proc where proname = 'consume_quota';

-- Ninguém escreve em usage_events pela API (esperado: false)
select has_table_privilege('authenticated','public.usage_events','insert');

-- anon sem privilégio em tabelas do schema public (esperado: 0)
select count(*) from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public';

-- Nenhuma função do schema public executável por anon ou PUBLIC (esperado: 0)
select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('public', p.oid, 'execute'));
```

### 1.3 Teste de bloqueio (**pendente: não verificado em produção**; uma vez, com a conta de teste, nunca com a sua)
1. Em **Administração**, bloqueie a conta de teste.
2. Confirme que a conta de teste perde o acesso (o app manda para o login).
3. Confira se as sessões foram encerradas: a resposta do bloqueio traz `sessionsRevoked`. Se for `false`, olhe o log da Vercel. A mensagem é *"encerrar sessões do bloqueado falhou"*. O bloqueio vale mesmo assim (o acesso é checado em toda chamada); só o encerramento da sessão falhou. A função `server_revoke_user_sessions` apaga linhas de `auth.sessions`. Isso foi testado só no banco local, com uma imitação do Auth. Em produção, confirme esse passo.
4. Libere a conta de teste de novo.
5. Tente bloquear a **sua** conta e outra conta admin: o app deve recusar com mensagem em português.

### 1.4 Plano de volta
- **App:** na Vercel, promova o deploy anterior (os ids estão no `PROJECT_STATUS.md`).
- **Banco, etapa 5:** o comentário no topo da restritiva traz os `grant` que desfazem as revogações. Atenção: ao desfazer, **S-01 e S-10 voltam a existir** (só vale como emergência). `consume_quota` precisa ser recriada com a definição da migração `20261108000001_init.sql`.
- **Banco, etapa 1:** o comentário no topo da aditiva lista os `drop` (só objetos novos, sem perda de dados).

---

## 2. Proteção contra senhas vazadas (S-03, configuração do painel)

Hoje está **desligada**, passo **pendente** (o assessor de segurança do Supabase avisa). É configuração do Auth, não do código. Não há migração para isso.

1. Abra o painel do Supabase e escolha o projeto do GaDu.
2. Menu **Authentication**.
3. Abra **Sign In / Providers** e clique em **Email**. Em projetos com o painel mais antigo, o caminho é **Authentication → Settings** (ou **Policies**) e a seção **Password security**.
4. Ligue **Prevent use of leaked passwords** (também chamado "Leaked password protection"). Ele consulta a base HaveIBeenPwned.
5. Na mesma tela, confira o **tamanho mínimo da senha**. O convite exige 10 caracteres no app. Pode deixar 10 ou mais aqui.
6. Clique em **Save**.

Observações:
- O recurso costuma ficar **disponível só em planos pagos** (Pro ou acima). Se o painel mostrar um aviso de plano, anote e me avise; o risco continua aberto e dá para aceitar por enquanto (o app tem limite de tentativas desde esta entrega).
- **Efeito:** quem criar ou trocar senha com uma senha vazada recebe erro. O convite já trata isso com a mensagem "Senha fraca. Escolha outra com letras e números." Senhas já existentes não são afetadas até a próxima troca.
- **Para conferir:** o assessor de segurança (Database → **Advisors** → Security) deixa de mostrar o aviso "Leaked Password Protection Disabled".

---

## 3. Backups, RPO e RTO (S-09: só confirmar)

**Não apague as tabelas `private.backup_usage_daily_20261113` e `private.backup_usage_events_20261113` ainda.** Elas só saem depois da sua aprovação e de uma restauração ensaiada com sucesso.

### 3.1 Conferir o plano e os backups
**Conferido em 22/11/2026:** o plano da organização é **Free**, sem backups automáticos baixáveis nem PITR. S-09 segue pendente e depende de decisão do Eduardo: plano Pro ou dump lógico agendado.

1. Painel do Supabase → **Settings → Billing** (ou **Subscription**): anote o **plano** (Free, Pro...).
2. **Database → Backups**:
   - aba **Scheduled backups**: deve listar um backup por dia, com a data de cada um. Anote **quantos dias de retenção** aparecem (em geral 7 dias no Pro; no Free o painel pode não oferecer backups restauráveis);
   - aba **Point in Time** (PITR): diz se o recurso está ligado. Ele é um **complemento pago** e permite voltar a um minuto específico.
3. Registre no `PROJECT_STATUS.md`: plano, retenção, PITR ligado ou não, data da conferência. **Sem dados pessoais.**

### 3.2 RPO e RTO
- **RPO** (quanto de dado você aceita perder): só com backup diário, até **24 horas**. Com PITR, perto de **alguns minutos**.
- **RTO** (quanto tempo até voltar): depende do tamanho do banco. Hoje é pequeno, mas **o número real vem do ensaio da seção 3.3**. Anote o tempo medido e use esse valor, não uma estimativa.
- Decida o que serve para o GaDu hoje (uso pessoal e poucas pessoas) e registre. Sugestão: RPO de 24 h e RTO de 2 h são aceitáveis agora. Se o GaDu passar a ser usado por mais gente, ligue o PITR.

### 3.3 Ensaiar uma restauração (num projeto de teste, nunca no de produção)
Caminho A, restaurar para um projeto novo (planos pagos):
1. **Database → Backups** → escolha um backup → **Restore to a new project** (se o botão existir no seu plano). Dê um nome como `gadu-ensaio-restauracao`.
2. Marque a hora de início e a hora em que o projeto novo ficou **Healthy**. Essa diferença é o seu **RTO medido**.
3. No projeto novo, abra o **SQL Editor** e confira só contagens, sem ler conteúdo:
   ```sql
   select (select count(*) from auth.users) as pessoas,
          (select count(*) from public.members) as membros,
          (select count(*) from public.conversations) as conversas;
   ```
   Compare com o projeto de produção (mesma consulta). Diferença pequena é esperada se houve uso depois do backup.
4. Confira que as migrações estão lá: `select count(*) from supabase_migrations.schema_migrations;`.
5. **Apague o projeto de ensaio** (Settings → General → Delete project) para não acumular custo nem manter cópia dos dados.

Caminho B, restauração lógica (qualquer plano): baixe o backup (Database → Backups → Download, se disponível), restaure em um Postgres local descartável com `pg_restore` ou `psql`, e confira as contagens como acima. Apague o arquivo e o banco local depois: o backup contém dados de pessoas.

Registre no `PROJECT_STATUS.md`: data do ensaio, caminho usado, RTO medido e se as contagens bateram.

---

## 4. Opcional: limite de tentativas também na Vercel (camada extra para `/api/auth/*`)

O app já limita por IP e por e-mail (código desta entrega). A Vercel pode barrar antes de a requisição chegar ao app:

1. Painel da Vercel → projeto `gadu-agent` → **Firewall** → **Configure**.
2. **Add Rule** (regra personalizada):
   - **Name:** `limite de login`
   - **If:** *Request Path* **starts with** `/api/auth/`  (adicione `/api/invite/` em outra condição com OU, ou crie uma segunda regra)
   - **Then:** *Rate Limit*, janela fixa de **60 segundos**, **20 requisições**, chave **IP**
   - Ação ao estourar: *Deny* (ou *Challenge*)
3. **Save Rule** e **Publish** (a Vercel pede a publicação das mudanças do firewall).
4. Teste: em outra aba anônima, tente entrar mais de 20 vezes em um minuto com senha errada; deve receber bloqueio. Depois de um minuto volta ao normal.

Os nomes dos menus podem mudar um pouco com o tempo; a ideia é: regra por caminho + limite por IP. O recurso de rate limit do firewall pode depender do plano da Vercel.

---

## 5. Como o limite de tentativas do app funciona (referência)

- Janela fixa de 10 minutos. Limites por janela: senha 20 por IP e 8 por e-mail; código por e-mail 10 e 5; conferência do código 20 e 10; aceitar convite 10 por IP e 10 por token.
- Passou do limite: resposta **429**, "Muitas tentativas. Aguarde N minutos e tente de novo.", e o login nem é tentado.
- O banco guarda só **hash** (SHA-256) do e-mail, do IP e do token, nunca o valor puro. Linhas com mais de 2 dias são apagadas sozinhas.
- **Se o contador estiver fora do ar** (banco, função ausente, chave do servidor faltando): o login **continua funcionando** (não travamos todos por falha de infraestrutura). O erro vai para o log como *"limite de tentativas indisponível"*. O Supabase Auth continua com os limites dele.
- **Trade-off conhecido:** quem digita o e-mail de outra pessoa muitas vezes pode bloquear o login dela por até 10 minutos. Aceitamos isso porque o GaDu tem poucas pessoas convidadas. Se virar problema, troque a chave por e-mail + IP em `src/lib/rate-limit.ts`.
- O IP vem de `x-real-ip` ou `x-forwarded-for`, que a Vercel reescreve com o IP real. Fora da Vercel, só confie nisso atrás de um proxy seu.

---

## 6. Itens que continuam abertos (fora desta entrega)
- **S-05, parte da escrita direta:** a pessoa bloqueada ainda escreve nas próprias tabelas pela API do banco, enquanto o token dela vale (até 1 hora). As sessões são encerradas ao bloquear e as funções de custo e cota recusam, mas as políticas de RLS ainda só olham `auth.uid()`.
- **S-08** (organizações), **S-09** (confirmar backup e depois decidir sobre os `private.backup_*`), **S-13, S-14, S-15**.
