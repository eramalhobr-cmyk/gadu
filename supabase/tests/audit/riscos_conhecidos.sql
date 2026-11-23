-- Auditoria em execução dos riscos conhecidos (docs/SECURITY_AUDIT_2026-11-15.md), com TODAS as migrações aplicadas,
-- inclusive a segurança P1 (20261122120001 e 20261122120002).
-- NÃO é teste de aprovação (os testes de aprovação são 40_seguranca_p1.test.sql e companhia): cada bloco tenta o
-- ataque original e diz CORRIGIDO (o ataque falhou) ou AINDA PRESENTE (o ataque funcionou).
-- Roda só no Postgres local descartável: npm run audit:db
\set QUIET on
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000a0d01', 'aud-a@teste.local'),
  ('00000000-0000-0000-0000-0000000a0d02', 'aud-b@teste.local');
update private.budget_policy set monthly_limit_usd = 1.00, min_reserve_usd = 0.01, max_reserve_usd = 0.50, global_monthly_limit_usd = null;
update private.quota_policy set daily_limit = 5;

create function pg_temp.run_as(role_name text, uid text, q text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), true);
  execute format('set local role %I', role_name);
  begin execute 'select (' || q || ')::text' into r;
  exception when others then r := 'ERRO: ' || sqlerrm; end;
  execute 'reset role';
  return r;
end $$;
create function pg_temp.exec_as(role_name text, uid text, cmd text) returns text language plpgsql as $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), true);
  execute format('set local role %I', role_name);
  begin execute cmd; get diagnostics n = row_count;
  exception when others then execute 'reset role'; return 'ERRO: ' || sqlerrm; end;
  execute 'reset role';
  return n::text;
end $$;
-- present = o ataque original ainda funciona.
create function pg_temp.report(id text, present boolean, detail text) returns void language plpgsql as $$
begin raise notice '% % — %', case when present then 'AINDA PRESENTE' else 'CORRIGIDO' end, id, detail; end $$;

-- S-01: a pessoa liquida a própria reserva com custo 0; a liquidação real do servidor virava "already".
do $$
declare a text := '00000000-0000-0000-0000-0000000a0d01'; res jsonb; rid uuid; attack text; real jsonb; cost numeric;
begin
  res := pg_temp.run_as('service_role', null, format('public.server_reserve_ai_budget(%L, ''chat'', 0.30)', a))::jsonb;
  rid := (res ->> 'reservation_id')::uuid;
  attack := pg_temp.run_as('authenticated', a, format('public.settle_ai_budget(%L, ''gemini'', ''x'', 0, 0, 0)', rid));
  real := pg_temp.run_as('service_role', null, format('public.server_settle_ai_budget(%L, %L, ''gemini'', ''x'', 1000, 5000, 0.30)', a, rid))::jsonb;
  select coalesce(sum(u.cost_usd), 0) into cost from public.usage_events u where u.user_id = a::uuid;
  perform pg_temp.report('S-01', attack not like 'ERRO:%' or cost <> 0.30,
    format('liquidação com custo 0 pela pessoa: %s; liquidação real do servidor: %s; custo gravado: %s', attack, real, cost));
end $$;

-- S-03: contador de tentativas (parte do banco; o painel do Supabase é passo manual).
do $$
declare r text; i int; allowed text := '';
begin
  for i in 1..4 loop
    r := pg_temp.run_as('service_role', null, format('public.auth_rate_limit_hit(''password_ip'', %L, 3, 600)', repeat('d', 64)));
    allowed := allowed || coalesce((r::jsonb ->> 'allowed'), '?') || ' ';
  end loop;
  perform pg_temp.report('S-03 (limite de tentativas)', allowed <> 'true true true false ', 'limite 3: respostas ' || allowed || '(senhas vazadas: configuração do painel, ver docs/SEGURANCA_P1_MANUAL.md)');
end $$;

-- S-04: o agendador ignora quem está bloqueado.
do $$
declare b uuid := '00000000-0000-0000-0000-0000000a0d02'; n int;
begin
  insert into public.members (user_id, role, access) values (b, 'member', 'blocked') on conflict (user_id) do update set access = 'blocked';
  insert into public.memories (user_id, content, area, status) values (b, 'memória de pessoa bloqueada', 'Pessoal', 'approved');
  select count(*) into n from public.index_backlog(100) x where x.user_id = b;
  perform pg_temp.report('S-04', n > 0, format('itens de pessoa bloqueada em index_backlog: %s (o filtro do agendador em TypeScript tem teste de integração)', n));
end $$;

-- S-05 (funções de custo e cota): pessoa bloqueada reserva orçamento ou consome cota?
do $$
declare b text := '00000000-0000-0000-0000-0000000a0d02'; r text; q text;
begin
  r := pg_temp.run_as('service_role', null, format('public.server_reserve_ai_budget(%L, ''chat'', 0.1)', b));
  q := pg_temp.run_as('authenticated', b, 'public.consume_daily_quota()');
  perform pg_temp.report('S-05 (funções de custo e cota)', (r::jsonb ->> 'allowed') = 'true' or (q::jsonb ->> 'allowed') = 'true',
    format('pessoa bloqueada reservando orçamento: %s; consumindo cota: %s', r::jsonb ->> 'reason', q));
end $$;

-- S-05 (escrita direta nas tabelas): fechado pela migração 20261123120001 (políticas restritivas com public.can_write()).
-- Sem ela (ou antes de aplicá-la em produção), este item volta a aparecer como AINDA PRESENTE.
do $$
declare b text := '00000000-0000-0000-0000-0000000a0d02'; r text;
begin
  r := pg_temp.exec_as('authenticated', b, 'insert into public.tasks (title) values (''escrita depois do bloqueio'')');
  perform pg_temp.report('S-05 (escrita direta em tabelas)', r = '1', 'insert de tarefa por pessoa bloqueada pela API do banco: ' || r || ' (políticas restritivas de escrita por acesso: migração 20261123120001)');
end $$;

-- S-07: a função antiga aceitava o limite enviado por quem chama.
do $$
declare a text := '00000000-0000-0000-0000-0000000a0d01'; r text;
begin
  r := pg_temp.run_as('authenticated', a, 'public.consume_quota(1000000)');
  perform pg_temp.report('S-07', r not like 'ERRO:%', 'consume_quota(1000000) como pessoa logada: ' || r);
end $$;

-- S-10: a pessoa insere consumo inventado direto em usage_events.
do $$
declare a text := '00000000-0000-0000-0000-0000000a0d01'; r text;
begin
  r := pg_temp.exec_as('authenticated', a, 'insert into public.usage_events (provider, model, cost_usd) values (''gemini'', ''inventado'', 99)');
  perform pg_temp.report('S-10', r = '1', 'insert de consumo de US$ 99 pela própria pessoa: ' || r);
end $$;

-- S-12: anon tinha SELECT nas tabelas (a RLS escondia as linhas, mas era uma camada só).
do $$
declare n int; r text;
begin
  select count(*) into n from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public';
  r := pg_temp.run_as('anon', null, '(select count(*) from public.tasks)');
  perform pg_temp.report('S-12', n > 0 or r not like 'ERRO:%', format('privilégios de anon em tabelas públicas: %s; leitura de tasks por anon: %s', n, r));
end $$;
