-- Compatibilidade da migração ADITIVA (20261122120001) com o app que está em produção hoje.
-- Roda logo depois dela e ANTES da restritiva. Tudo dentro de uma transação que é desfeita no fim.
-- Prova: o app atual continua funcionando (funções antigas de orçamento, consume_quota, insert em usage_events,
-- cota diária) e as funções novas já existem, só para o servidor. Pode aplicar a aditiva antes do deploy.
\set ON_ERROR_STOP on
\set QUIET on
begin;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000c0a1', 'compat@teste.local');
update private.quota_policy set daily_limit = 50;

create function pg_temp.check(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FALHOU: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;
create function pg_temp.as_user(sql text) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c0a1', true);
  execute 'set local role authenticated';
  execute 'select (' || sql || ')::jsonb' into r;
  execute 'reset role';
  return r;
end $$;

-- App atual: chat com as funções antigas de orçamento e a cota.
select pg_temp.as_user($q$public.reserve_ai_budget('chat', 0.10)$q$) as rv \gset
select pg_temp.check((:'rv'::jsonb ->> 'allowed')::boolean, 'compat: reserve_ai_budget antiga continua funcionando para authenticated');
select pg_temp.check((pg_temp.as_user(format($q$public.settle_ai_budget(%L, 'anthropic', 'claude-opus-5-5', 10, 10, 0.01)$q$, :'rv'::jsonb ->> 'reservation_id')) ->> 'ok')::boolean, 'compat: settle_ai_budget antiga continua funcionando');
select pg_temp.as_user($q$public.reserve_ai_budget('chat', 0.10)$q$) as rv2 \gset
select pg_temp.check((pg_temp.as_user(format($q$public.release_ai_budget(%L)$q$, :'rv2'::jsonb ->> 'reservation_id')) ->> 'released')::boolean, 'compat: release_ai_budget antiga continua funcionando');
select pg_temp.check((pg_temp.as_user($q$public.consume_daily_quota()$q$) ->> 'allowed')::boolean, 'compat: consume_daily_quota continua respondendo o mesmo formato');
select pg_temp.check((pg_temp.as_user($q$to_jsonb(public.consume_quota(50))$q$))::text = 'true', 'compat: consume_quota (contingência do app atual) continua existindo');
select pg_temp.check((pg_temp.as_user($q$public.budget_status()$q$) ->> 'limit') is not null, 'compat: budget_status continua para a própria pessoa');

-- App atual: o insert direto em usage_events (contingência de liquidação) continua permitido.
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c0a1', true);
  set local role authenticated;
  insert into public.usage_events (provider, model, cost_usd) values ('gemini', 'compat', 0.001);
  reset role;
  raise notice 'ok - compat: insert em usage_events pela pessoa continua permitido (cai só na restritiva)';
end $$;

-- Funções novas: existem e são só do servidor.
select pg_temp.check(has_function_privilege('service_role', 'public.server_reserve_ai_budget(uuid, text, numeric)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.server_settle_ai_budget(uuid, uuid, text, text, integer, integer, numeric)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.server_release_ai_budget(uuid, uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.auth_rate_limit_hit(text, text, integer, integer)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.server_revoke_user_sessions(uuid)', 'EXECUTE'), 'funções novas existem e o service_role executa');
select pg_temp.check(not has_function_privilege('authenticated', 'public.server_reserve_ai_budget(uuid, text, numeric)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.server_settle_ai_budget(uuid, uuid, text, text, integer, integer, numeric)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.server_release_ai_budget(uuid, uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.auth_rate_limit_hit(text, text, integer, integer)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.server_revoke_user_sessions(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.server_reserve_ai_budget(uuid, text, numeric)', 'EXECUTE'), 'funções novas não são executáveis por authenticated nem anon');

-- Agendador: index_backlog e expire continuam só do servidor e com a mesma forma.
select pg_temp.check(has_function_privilege('service_role', 'public.index_backlog(integer)', 'EXECUTE') and not has_function_privilege('authenticated', 'public.index_backlog(integer)', 'EXECUTE'), 'compat: index_backlog segue só do servidor');
set local role service_role;
select count(*) from public.index_backlog(5);
reset role;

rollback;
\echo 'compat da aditiva: todos os testes passaram'
