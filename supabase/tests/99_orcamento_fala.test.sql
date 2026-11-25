-- Orçamento da síntese (migração 20261125090001): o tipo 'speech' reserva, liquida e entra no teto como o chat.
-- Dados sintéticos, Postgres local descartável.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000e9801', 'fala@teste.local');
insert into public.members (user_id, role, access) values ('00000000-0000-0000-0000-0000000e9801', 'member', 'active')
  on conflict (user_id) do update set access = excluded.access;
update private.budget_policy set monthly_limit_usd = 5.00, min_reserve_usd = 0.01, max_reserve_usd = 1.00, global_monthly_limit_usd = null;

create function pg_temp.check(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FALHOU: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

create function pg_temp.svc(q text) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  set local role service_role;
  execute q into r;
  reset role;
  return r;
end $$;

\set U '00000000-0000-0000-0000-0000000e9801'

select pg_temp.svc(format($q$select public.server_reserve_ai_budget(%L, 'speech', 0.002)$q$, :'U')) as res \gset
select pg_temp.check((:'res'::jsonb ->> 'allowed')::boolean, 'síntese: reserva aceita');
select pg_temp.check((:'res'::jsonb ->> 'amount')::numeric = 0.01, 'síntese: reserva respeita o mínimo da política');
select :'res'::jsonb ->> 'reservation_id' as rid \gset
select pg_temp.check((select kind from public.ai_reservations where id = :'rid') = 'speech', 'síntese: reserva gravada com o tipo certo');

select pg_temp.check((pg_temp.svc(format($q$select public.server_settle_ai_budget(%L, %L, 'gateway', 'elevenlabs/eleven-flash-v2.5', 3, 33, 0.00008)$q$, :'U', :'rid')) ->> 'ok')::boolean, 'síntese: liquidação pelo custo real');
select pg_temp.check((select count(*) = 1 and min(kind) = 'speech' and min(input_tokens) = 3 from public.usage_events where user_id = :'U'), 'síntese: consumo gravado com tipo, caracteres e custo');

select pg_temp.check(pg_temp.svc(format($q$select public.server_reserve_ai_budget(%L, 'outro', 0.01)$q$, :'U')) ->> 'reason' = 'invalid', 'tipo desconhecido continua recusado');

-- Teto mensal vale para a síntese também.
update private.budget_policy set monthly_limit_usd = 0.005;
select pg_temp.check(not (pg_temp.svc(format($q$select public.server_reserve_ai_budget(%L, 'speech', 0.002)$q$, :'U')) ->> 'allowed')::boolean, 'síntese: bloqueada quando o teto do mês não comporta');
update private.budget_policy set monthly_limit_usd = 5.00;

-- Limpa para não afetar os testes de concorrência do teto global (que somam o gasto de todas as pessoas).
delete from public.usage_events where user_id = :'U';
delete from public.ai_reservations where user_id = :'U';
