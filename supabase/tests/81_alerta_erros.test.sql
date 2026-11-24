-- Alerta de erros (migração 20261123200001): user_id opcional em error_events e as tabelas de estado do alerta.
-- Dados sintéticos, Postgres local descartável.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000e9a01', 'alr-admin@teste.local'),
  ('00000000-0000-0000-0000-0000000e9b01', 'alr-membro@teste.local');
insert into public.members (user_id, role, access) values
  ('00000000-0000-0000-0000-0000000e9a01', 'admin', 'active'),
  ('00000000-0000-0000-0000-0000000e9b01', 'member', 'active')
on conflict (user_id) do update set role = excluded.role, access = excluded.access;
\set ADM '00000000-0000-0000-0000-0000000e9a01'
\set MEM '00000000-0000-0000-0000-0000000e9b01'

create function pg_temp.check(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FALHOU: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

create function pg_temp.exec_as(role_name text, uid text, cmd text) returns integer language plpgsql as $$
declare n integer;
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), true);
  execute format('set local role %I', role_name);
  begin
    execute cmd; get diagnostics n = row_count;
  exception when others then
    execute 'reset role';
    return -1;
  end;
  execute 'reset role';
  return n;
end $$;

-- error_events: erro sem sessão (cron, sistema) entra; pessoa inexistente continua recusada.
select pg_temp.check(pg_temp.exec_as('service_role', null, $q$insert into public.error_events (user_id, origem, rota, nome, impressao) values (null, 'servidor', '/api/cron/tick', 'Error', repeat('e', 64))$q$) = 1, 'o servidor registra erro sem pessoa (user_id nulo)');
select pg_temp.check(pg_temp.exec_as('service_role', null, $q$insert into public.error_events (origem, rota, nome, impressao) values ('servidor', '/api/cron/tick', 'Error', repeat('e', 64))$q$) = 1, 'user_id pode ser omitido');
select pg_temp.check(pg_temp.exec_as('service_role', null, $q$insert into public.error_events (user_id, origem, rota, nome, impressao) values (gen_random_uuid(), 'servidor', '/api/chat', 'Error', repeat('e', 64))$q$) = -1, 'pessoa inexistente continua recusada (FK)');
select pg_temp.check(pg_temp.exec_as('service_role', null, $q$insert into public.error_events (user_id, origem, rota, nome, impressao) values (null, 'servidor', '/api/chat?x=1', 'Error', repeat('e', 64))$q$) = -1, 'sem user_id, rota com query string continua recusada');
select pg_temp.check(pg_temp.exec_as('authenticated', :'ADM', $q$insert into public.error_events (user_id, origem, rota, nome, impressao) values (null, 'servidor', '/app', 'x', repeat('c', 16))$q$) = -1, 'administrador não insere erro sem pessoa pelo cliente');
select pg_temp.check(pg_temp.exec_as('authenticated', :'ADM', 'select count(*) from public.error_events') = 1, 'administrador ainda lê error_events (grant de select intacto)');
select pg_temp.check(pg_temp.exec_as('authenticated', :'MEM', 'select count(*) from public.error_events where user_id is null') = 1, 'consulta da pessoa comum roda');
select pg_temp.check((select count(*) from public.error_events where user_id is null) = 2, 'os registros sem pessoa ficaram gravados');
select pg_temp.check(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'error_events' and policyname = 'error_events_select_admin'), 'a política antiga de leitura continua');

-- Cascata continua valendo quando há user_id.
select pg_temp.check(pg_temp.exec_as('service_role', null, format($q$insert into public.error_events (user_id, origem, rota, nome, impressao) values (%L, 'cliente', '/app', 'x', repeat('d', 16))$q$, :'MEM')) = 1, 'registro com pessoa entra');
delete from auth.users where id = :'MEM';
select pg_temp.check((select count(*) = 0 from public.error_events where user_id = :'MEM'), 'apagar a pessoa apaga os registros dela');
select pg_temp.check((select count(*) = 2 from public.error_events where user_id is null), 'apagar a pessoa não apaga os registros sem pessoa');

-- error_alert_state: só o servidor escreve e lê.
select pg_temp.check(pg_temp.exec_as('service_role', null, $q$insert into public.error_alert_state (impressao) values (repeat('a', 64))$q$) = 1, 'o servidor cria o estado de um grupo');
select pg_temp.check(pg_temp.exec_as('service_role', null, $q$insert into public.error_alert_state (impressao) values (repeat('a', 64))$q$) = -1, 'grupo repetido recusado (chave primária)');
select pg_temp.check(pg_temp.exec_as('service_role', null, $q$update public.error_alert_state set ultimo_alerta = now(), alertas = alertas + 1$q$) = 1, 'o servidor atualiza o estado');
select pg_temp.check(pg_temp.exec_as('service_role', null, $q$insert into public.error_alert_state (impressao) values ('curta')$q$) = -1, 'impressão curta demais recusada');
select pg_temp.check(pg_temp.exec_as('service_role', null, $q$update public.error_alert_state set alertas = -1$q$) = -1, 'contagem negativa recusada');
select pg_temp.check(pg_temp.exec_as('authenticated', :'ADM', 'select * from public.error_alert_state') = -1, 'administrador não lê o estado pelo cliente');
select pg_temp.check(pg_temp.exec_as('authenticated', :'ADM', $q$insert into public.error_alert_state (impressao) values (repeat('b', 64))$q$) = -1, 'administrador não insere estado');
select pg_temp.check(pg_temp.exec_as('authenticated', :'ADM', 'update public.error_alert_state set alertas = 0') = -1, 'administrador não altera estado');
select pg_temp.check(pg_temp.exec_as('authenticated', :'ADM', 'delete from public.error_alert_state') = -1, 'administrador não apaga estado');
select pg_temp.check(pg_temp.exec_as('anon', null, 'select * from public.error_alert_state') = -1, 'sem login não lê o estado');
select pg_temp.check(pg_temp.exec_as('anon', null, $q$insert into public.error_alert_state (impressao) values (repeat('b', 64))$q$) = -1, 'sem login não insere estado');

-- error_alert_dia: a vaga do dia só é tomada uma vez.
select pg_temp.check(pg_temp.exec_as('service_role', null, $q$insert into public.error_alert_dia (dia, vaga) values (date '2026-11-23', 1)$q$) = 1, 'o servidor toma a vaga 1 do dia');
select pg_temp.check(pg_temp.exec_as('service_role', null, $q$insert into public.error_alert_dia (dia, vaga) values (date '2026-11-23', 1)$q$) = -1, 'a mesma vaga não é tomada duas vezes');
select pg_temp.check(pg_temp.exec_as('service_role', null, $q$insert into public.error_alert_dia (dia, vaga) values (date '2026-11-23', 2)$q$) = 1, 'a vaga 2 do mesmo dia é livre');
select pg_temp.check(pg_temp.exec_as('service_role', null, $q$insert into public.error_alert_dia (dia, vaga) values (date '2026-11-24', 1)$q$) = 1, 'no dia seguinte a vaga 1 volta');
select pg_temp.check(pg_temp.exec_as('service_role', null, $q$insert into public.error_alert_dia (dia, vaga) values (date '2026-11-23', 51)$q$) = -1, 'vaga fora do intervalo recusada');
select pg_temp.check(pg_temp.exec_as('service_role', null, $q$delete from public.error_alert_dia where dia < date '2026-11-24'$q$) = 2, 'o servidor apaga vagas antigas (retenção)');
select pg_temp.check(pg_temp.exec_as('authenticated', :'ADM', 'select * from public.error_alert_dia') = -1, 'administrador não lê as vagas pelo cliente');
select pg_temp.check(pg_temp.exec_as('authenticated', :'ADM', $q$insert into public.error_alert_dia (dia, vaga) values (date '2026-11-25', 1)$q$) = -1, 'administrador não toma vaga');
select pg_temp.check(pg_temp.exec_as('anon', null, 'select * from public.error_alert_dia') = -1, 'sem login não lê as vagas');

-- RLS ligado e sem coluna pessoal.
select pg_temp.check((select bool_and(relrowsecurity) from pg_class where oid in ('public.error_alert_state'::regclass, 'public.error_alert_dia'::regclass)), 'RLS ligado nas duas tabelas novas');
select pg_temp.check(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name in ('error_alert_state', 'error_alert_dia') and column_name in ('user_id', 'email', 'ip', 'message', 'mensagem', 'body', 'nome', 'rota')), 'as tabelas de alerta não têm coluna pessoal');

\echo 'alerta de erros: todos os testes SQL passaram'
