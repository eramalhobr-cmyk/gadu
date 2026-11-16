-- Auditoria em execução dos riscos conhecidos (docs/SECURITY_AUDIT_2026-11-15.md).
-- NÃO é teste de aprovação: cada bloco diz CONFIRMADO (o risco existe hoje) ou NÃO REPRODUZIDO.
-- Roda só no Postgres local descartável: npm run audit:db
\set QUIET on
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000a0d01', 'aud-a@teste.local'),
  ('00000000-0000-0000-0000-0000000a0d02', 'aud-b@teste.local');
update private.budget_policy set monthly_limit_usd = 1.00, min_reserve_usd = 0.01, max_reserve_usd = 0.50, global_monthly_limit_usd = null;
update private.quota_policy set daily_limit = 5;

create function pg_temp.as_user(uid text, q text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('request.jwt.claim.sub', uid, true);
  execute 'set local role authenticated';
  begin execute 'select (' || q || ')::text' into r;
  exception when others then r := 'ERRO: ' || sqlerrm; end;
  execute 'reset role';
  return r;
end $$;
create function pg_temp.exec_as(uid text, cmd text) returns text language plpgsql as $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', uid, true);
  execute 'set local role authenticated';
  begin execute cmd; get diagnostics n = row_count;
  exception when others then execute 'reset role'; return 'ERRO: ' || sqlerrm; end;
  execute 'reset role';
  return n::text;
end $$;
create function pg_temp.report(id text, confirmed boolean, detail text) returns void language plpgsql as $$
begin raise notice '% % — %', case when confirmed then 'CONFIRMADO' else 'NÃO REPRODUZIDO' end, id, detail; end $$;

-- S-01: a própria pessoa liquida a reserva com custo 0; a liquidação real do servidor vira "already".
do $$
declare a text := '00000000-0000-0000-0000-0000000a0d01'; res jsonb; rid uuid; s1 jsonb; s2 jsonb; cost numeric;
begin
  res := pg_temp.as_user(a, 'public.reserve_ai_budget(''chat'', 0.30)')::jsonb;
  rid := (res ->> 'reservation_id')::uuid;
  s1 := pg_temp.as_user(a, format('public.settle_ai_budget(%L, ''gemini'', ''x'', 0, 0, 0)', rid))::jsonb;
  s2 := pg_temp.as_user(a, format('public.settle_ai_budget(%L, ''gemini'', ''x'', 1000, 5000, 0.30)', rid))::jsonb;
  select cost_usd into cost from public.ai_reservations where id = rid;
  perform pg_temp.report('S-01', (s1 ->> 'ok')::boolean and (s2 ->> 'already')::boolean and cost = 0,
    format('reserva %s; liquidação pela pessoa: %s; liquidação do servidor: %s; custo gravado: %s', res ->> 'allowed', s1, s2, cost));
end $$;

-- S-05: pessoa bloqueada continua escrevendo nas próprias tabelas pela API do banco.
do $$
declare b text := '00000000-0000-0000-0000-0000000a0d02'; r text;
begin
  insert into public.members (user_id, role, access) values (b::uuid, 'member', 'blocked') on conflict (user_id) do update set access = 'blocked';
  r := pg_temp.exec_as(b, 'insert into public.tasks (title) values (''escrita depois do bloqueio'')');
  perform pg_temp.report('S-05', r = '1', 'insert de tarefa por pessoa bloqueada: ' || r);
end $$;

-- S-07: a função antiga aceita o limite enviado por quem chama.
do $$
declare a text := '00000000-0000-0000-0000-0000000a0d01'; r text; i int;
begin
  for i in 1..10 loop r := pg_temp.as_user(a, 'public.consume_quota(1000000)'); end loop;
  perform pg_temp.report('S-07', r = 'true', format('10 chamadas com p_limit = 1.000.000 e política diária 5: última resposta %s (a nova consume_daily_quota respeita o limite do servidor)', r));
end $$;

-- S-10: a pessoa insere consumo inventado direto em usage_events.
do $$
declare a text := '00000000-0000-0000-0000-0000000a0d01'; r text;
begin
  r := pg_temp.exec_as(a, 'insert into public.usage_events (provider, model, cost_usd) values (''gemini'', ''inventado'', 99)');
  perform pg_temp.report('S-10', r = '1', 'insert de consumo de US$ 99 pela própria pessoa: ' || r || ' (teto global hoje desligado)');
end $$;

-- S-12: anon tem permissão de SELECT nas tabelas, mas a RLS não devolve linhas.
do $$
declare n int; rows bigint;
begin
  select count(*) into n from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public' and privilege_type = 'SELECT';
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon; select count(*) into rows from public.tasks; reset role;
  perform pg_temp.report('S-12', n > 0 and rows = 0, format('tabelas com SELECT para anon: %s; linhas visíveis em tasks: %s', n, rows));
end $$;
