-- Testes do orçamento mensal com reserva e reconciliação (migração 20261113140001).
-- Rodam como "authenticated", com o usuário simulado em request.jwt.claim.sub.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a1@teste.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'a2@teste.local');
update private.budget_policy set monthly_limit_usd = 1.00, min_reserve_usd = 0.01, max_reserve_usd = 0.50, global_monthly_limit_usd = null;

create function pg_temp.check(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FALHOU: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

-- Executa uma expressão SQL como um usuário e devolve o jsonb.
create function pg_temp.as_user(uid text, sql text) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), true);
  execute 'set local role authenticated';
  execute 'select (' || sql || ')::jsonb' into r;
  execute 'reset role';
  return r;
end $$;

\set A '''00000000-0000-0000-0000-0000000000a1'''
\set B '''00000000-0000-0000-0000-0000000000a2'''

-- 1. Reserva dentro do teto.
select pg_temp.as_user(:A, $q$public.reserve_ai_budget('chat', 0.30)$q$) as r1 \gset
select pg_temp.check((:'r1'::jsonb ->> 'allowed')::boolean and (:'r1'::jsonb ->> 'amount')::numeric = 0.30, 'reserva de 0,30 permitida');

-- 2. Reservas abertas contam no teto: 0,30 + 0,50 = 0,80; mais 0,30 passaria de 1,00.
select pg_temp.check((pg_temp.as_user(:A, $q$public.reserve_ai_budget('chat', 0.50)$q$) ->> 'allowed')::boolean, 'segunda reserva (0,50) permitida');
select pg_temp.as_user(:A, $q$public.reserve_ai_budget('chat', 0.30)$q$) as r3 \gset
select pg_temp.check(:'r3'::jsonb ->> 'allowed' = 'false' and :'r3'::jsonb ->> 'reason' = 'monthly', 'reserva que estouraria o teto é negada');
select pg_temp.check((:'r3'::jsonb ->> 'reserved')::numeric = 0.80, 'resposta informa o valor já reservado');

-- 3. Estimativa limitada pela política.
insert into private.user_budget (user_id, monthly_limit_usd) values (:B, 5);
select pg_temp.check((pg_temp.as_user(:B, $q$public.reserve_ai_budget('chat', 100)$q$) ->> 'amount')::numeric = 0.50, 'estimativa alta é limitada ao máximo da política');
select pg_temp.check((pg_temp.as_user(:B, $q$public.reserve_ai_budget('summary', -5)$q$) ->> 'amount')::numeric = 0.01, 'estimativa negativa vira o mínimo');
select pg_temp.check((pg_temp.as_user(:B, $q$public.reserve_ai_budget('chat', null)$q$) ->> 'amount')::numeric = 0.50, 'estimativa ausente reserva o máximo');
select pg_temp.check(pg_temp.as_user(:B, $q$public.reserve_ai_budget('hack', 0.1)$q$) ->> 'reason' = 'invalid', 'tipo inválido é recusado');

-- 4. Liquidação: grava o consumo e fecha a reserva na mesma transação.
select pg_temp.as_user(:A, format($q$public.settle_ai_budget(%L, 'anthropic', 'claude-opus-5-5', 1000, 200, 0.0123)$q$, :'r1'::jsonb ->> 'reservation_id')) as s1 \gset
select pg_temp.check((:'s1'::jsonb ->> 'ok')::boolean and (:'s1'::jsonb ->> 'over') = 'false', 'liquidação ok');
select pg_temp.check((select status = 'settled' and cost_usd = 0.0123 and usage_event_id is not null from public.ai_reservations where id = (:'r1'::jsonb ->> 'reservation_id')::uuid), 'reserva liquidada com custo real e ligada ao consumo');
select pg_temp.check((select count(*) = 1 and sum(cost_usd) = 0.0123 from public.usage_events where user_id = :A and kind = 'chat'), 'consumo gravado uma única vez');
select pg_temp.check((pg_temp.as_user(:A, format($q$public.settle_ai_budget(%L, 'anthropic', 'x', 0, 0, 0.0123)$q$, :'r1'::jsonb ->> 'reservation_id')) ->> 'already')::boolean, 'liquidar de novo é idempotente');
select pg_temp.check((select count(*) = 1 from public.usage_events where user_id = :A), 'liquidar de novo não duplica o consumo');

-- 5. Depois de liquidar, o teto usa o custo real: 0,0123 gasto + 0,50 reservado; cabe mais 0,30.
select pg_temp.check((pg_temp.as_user(:A, $q$public.reserve_ai_budget('chat', 0.30)$q$) ->> 'allowed')::boolean, 'custo real menor libera espaço no teto');

-- 6. Custo real acima do reservado é registrado (sinal "over").
select pg_temp.as_user(:B, $q$public.reserve_ai_budget('summary', 0.01)$q$) as rb \gset
select pg_temp.check((pg_temp.as_user(:B, format($q$public.settle_ai_budget(%L, 'gateway', 'haiku', 10, 10, 0.02)$q$, :'rb'::jsonb ->> 'reservation_id')) ->> 'over')::boolean, 'custo acima da reserva é marcado como over');

-- 7. Uma pessoa não liquida nem libera a reserva de outra.
select pg_temp.as_user(:A, $q$public.reserve_ai_budget('chat', 0.01)$q$) as ra \gset
select pg_temp.check(pg_temp.as_user(:B, format($q$public.settle_ai_budget(%L, 'anthropic', 'x', 0, 0, 0.01)$q$, :'ra'::jsonb ->> 'reservation_id')) ->> 'reason' = 'not_found', 'não liquida reserva de outra pessoa');
select pg_temp.check((pg_temp.as_user(:B, format($q$public.release_ai_budget(%L)$q$, :'ra'::jsonb ->> 'reservation_id')) ->> 'released')::boolean = false, 'não libera reserva de outra pessoa');

-- 8. Liberação: reserva liberada deixa de contar e não pode mais ser liquidada.
select pg_temp.check((pg_temp.as_user(:A, format($q$public.release_ai_budget(%L)$q$, :'ra'::jsonb ->> 'reservation_id')) ->> 'released')::boolean, 'liberação fecha a reserva');
select pg_temp.check(pg_temp.as_user(:A, format($q$public.settle_ai_budget(%L, 'anthropic', 'x', 0, 0, 0.01)$q$, :'ra'::jsonb ->> 'reservation_id')) ->> 'reason' = 'closed', 'reserva liberada não é liquidada');

-- 9. Valores inválidos na liquidação são recusados.
select pg_temp.as_user(:A, $q$public.reserve_ai_budget('chat', 0.01)$q$) as rv \gset
select pg_temp.check(pg_temp.as_user(:A, format($q$public.settle_ai_budget(%L, 'anthropic', 'x', 0, 0, -1)$q$, :'rv'::jsonb ->> 'reservation_id')) ->> 'reason' = 'invalid', 'custo negativo recusado');
select pg_temp.check(pg_temp.as_user(:A, format($q$public.settle_ai_budget(%L, 'outro', 'x', 0, 0, 0.01)$q$, :'rv'::jsonb ->> 'reservation_id')) ->> 'reason' = 'invalid', 'provedor desconhecido recusado');

-- 10. Reserva vencida não conta no teto e o agendador marca como expirada.
update public.ai_reservations set expires_at = now() - interval '1 second' where user_id = :A and status = 'reserved';
select pg_temp.check((pg_temp.as_user(:A, $q$public.budget_status()$q$) ->> 'reserved')::numeric = 0, 'reserva vencida não conta no teto');
select pg_temp.check(public.expire_ai_reservations() >= 1, 'agendador expira reservas vencidas');
select pg_temp.check(not has_function_privilege('authenticated', 'public.expire_ai_reservations()', 'EXECUTE'), 'só o servidor expira reservas');

-- 11. Teto individual e ausência de política.
insert into private.user_budget (user_id, monthly_limit_usd) values (:A, 0);
select pg_temp.check(pg_temp.as_user(:A, $q$public.reserve_ai_budget('chat', 0.01)$q$) ->> 'reason' = 'monthly', 'teto individual zero bloqueia');
delete from private.user_budget;
delete from private.budget_policy;
select pg_temp.check(pg_temp.as_user(:A, $q$public.reserve_ai_budget('chat', 0.01)$q$) ->> 'allowed' = 'false', 'sem política, ninguém reserva (fail closed)');
insert into private.budget_policy (id, monthly_limit_usd, max_reserve_usd) values (true, 1.00, 0.50);

-- 12. Sem usuário e acessos diretos.
select pg_temp.check(pg_temp.as_user(null, $q$public.reserve_ai_budget('chat', 0.01)$q$) ->> 'reason' = 'auth', 'sem usuário é negado');
select pg_temp.check(not has_function_privilege('anon', 'public.reserve_ai_budget(text, numeric)', 'EXECUTE'), 'anon não reserva');
select pg_temp.check(not has_table_privilege('authenticated', 'private.budget_policy', 'SELECT,UPDATE'), 'authenticated não lê nem altera a política');
select pg_temp.check(not has_table_privilege('authenticated', 'public.ai_reservations', 'INSERT,UPDATE,DELETE'), 'authenticated não escreve reservas diretamente');
select pg_temp.check((pg_temp.as_user(:B, $q$(select jsonb_build_object('n', count(*)) from public.ai_reservations where user_id = '00000000-0000-0000-0000-0000000000a1')$q$) ->> 'n')::int = 0, 'cada pessoa só enxerga as próprias reservas');

-- Limpeza para os testes de concorrência (o teto global soma tudo do mês).
delete from public.ai_reservations;
delete from public.usage_events;
update private.budget_policy set monthly_limit_usd = 20, max_reserve_usd = 1.00, min_reserve_usd = 0.01, global_monthly_limit_usd = null;

\echo 'ai budget: todos os testes SQL passaram'
