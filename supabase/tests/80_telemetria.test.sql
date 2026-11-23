-- Telemetria de erros (migração 20261123110001): só o servidor escreve, só administrador lê, sem texto de mensagem.
-- Dados sintéticos, Postgres local descartável.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000e8a01', 'tel-admin@teste.local'),
  ('00000000-0000-0000-0000-0000000e8b01', 'tel-membro@teste.local'),
  ('00000000-0000-0000-0000-0000000e8c01', 'tel-bloqueado@teste.local');
insert into public.members (user_id, role, access) values
  ('00000000-0000-0000-0000-0000000e8a01', 'admin', 'active'),
  ('00000000-0000-0000-0000-0000000e8b01', 'member', 'active'),
  ('00000000-0000-0000-0000-0000000e8c01', 'admin', 'blocked')
on conflict (user_id) do update set role = excluded.role, access = excluded.access;
\set ADM '00000000-0000-0000-0000-0000000e8a01'
\set MEM '00000000-0000-0000-0000-0000000e8b01'
\set BLQ '00000000-0000-0000-0000-0000000e8c01'

create function pg_temp.check(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FALHOU: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

-- Executa como papel/pessoa; devolve linhas afetadas ou -1 se o banco recusou.
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

create function pg_temp.count_as(role_name text, uid text) returns bigint language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), true);
  execute format('set local role %I', role_name);
  begin
    select count(*) into n from public.error_events where user_id in ('00000000-0000-0000-0000-0000000e8a01', '00000000-0000-0000-0000-0000000e8b01');
  exception when insufficient_privilege then n := 0;
  end;
  execute 'reset role';
  return n;
end $$;

-- O servidor (service_role) escreve; as demais pessoas e o anon não.
select pg_temp.check(pg_temp.exec_as('service_role', null, format($q$insert into public.error_events (user_id, origem, rota, nome, codigo, status, local_codigo, versao, impressao)
  values (%L, 'servidor', '/api/chat', 'TypeError', 'E_X', 500, 'src/app/api/chat/route.ts:42', 'abc1234', repeat('a', 64))$q$, :'MEM')) = 1, 'o servidor registra um erro');
select pg_temp.check(pg_temp.exec_as('service_role', null, format($q$insert into public.error_events (user_id, origem, rota, nome, impressao) values (%L, 'cliente', '/app', 'Erro', repeat('b', 16))$q$, :'ADM')) = 1, 'o servidor registra erro de cliente');
select pg_temp.check(pg_temp.exec_as('authenticated', :'MEM', format($q$insert into public.error_events (user_id, origem, rota, nome, impressao) values (%L, 'cliente', '/app', 'x', repeat('c', 16))$q$, :'MEM')) = -1, 'pessoa logada não insere pelo cliente (nem em seu nome)');
select pg_temp.check(pg_temp.exec_as('authenticated', :'ADM', format($q$insert into public.error_events (user_id, origem, rota, nome, impressao) values (%L, 'cliente', '/app', 'x', repeat('c', 16))$q$, :'ADM')) = -1, 'nem administrador insere pelo cliente');
select pg_temp.check(pg_temp.exec_as('anon', null, $q$insert into public.error_events (user_id, origem, rota, nome, impressao) values (gen_random_uuid(), 'cliente', '/app', 'x', repeat('c', 16))$q$) = -1, 'sem login não insere');

-- Leitura: só administrador ativo.
select pg_temp.check(pg_temp.count_as('authenticated', :'ADM') = 2, 'administrador lê todos os registros (de todas as pessoas)');
select pg_temp.check(pg_temp.count_as('authenticated', :'MEM') = 0, 'pessoa comum não lê nem o próprio registro');
select pg_temp.check(pg_temp.count_as('authenticated', :'BLQ') = 0, 'administrador bloqueado não lê');
select pg_temp.check(pg_temp.count_as('anon', null) = 0, 'sem login não lê');
select pg_temp.check(pg_temp.count_as('authenticated', null) = 0, 'sessão sem pessoa não lê');

-- Alterar e apagar: ninguém pelo cliente (nem administrador).
select pg_temp.check(pg_temp.exec_as('authenticated', :'ADM', 'update public.error_events set status = 400') = -1, 'administrador não altera registro');
select pg_temp.check(pg_temp.exec_as('authenticated', :'ADM', 'delete from public.error_events') = -1, 'administrador não apaga pelo cliente');
select pg_temp.check(pg_temp.exec_as('service_role', null, $q$delete from public.error_events where user_id = '00000000-0000-0000-0000-0000000e8a01'$q$) = 1, 'o servidor apaga registros (retenção)');

-- Sem dados pessoais: rota com query string ou espaço, e campos longos, são recusados pelo banco.
select pg_temp.check(pg_temp.exec_as('service_role', null, format($q$insert into public.error_events (user_id, origem, rota, nome, impressao) values (%L, 'cliente', '/app?email=a@b.c', 'x', repeat('d', 16))$q$, :'MEM')) = -1, 'rota com query string recusada');
select pg_temp.check(pg_temp.exec_as('service_role', null, format($q$insert into public.error_events (user_id, origem, rota, nome, impressao) values (%L, 'cliente', '/app a', 'x', repeat('d', 16))$q$, :'MEM')) = -1, 'rota com espaço recusada');
select pg_temp.check(pg_temp.exec_as('service_role', null, format($q$insert into public.error_events (user_id, origem, rota, nome, impressao) values (%L, 'cliente', '/app', repeat('x', 81), repeat('d', 16))$q$, :'MEM')) = -1, 'nome com mais de 80 caracteres recusado');
select pg_temp.check(pg_temp.exec_as('service_role', null, format($q$insert into public.error_events (user_id, origem, rota, nome, impressao) values (%L, 'celular', '/app', 'x', repeat('d', 16))$q$, :'MEM')) = -1, 'origem fora de (servidor, cliente) recusada');
select pg_temp.check(pg_temp.exec_as('service_role', null, format($q$insert into public.error_events (user_id, origem, rota, nome, status, impressao) values (%L, 'cliente', '/app', 'x', 42, repeat('d', 16))$q$, :'MEM')) = -1, 'status HTTP fora de 100 a 599 recusado');
select pg_temp.check(pg_temp.exec_as('service_role', null, $q$insert into public.error_events (user_id, origem, rota, nome, impressao) values (gen_random_uuid(), 'cliente', '/app', 'x', repeat('d', 16))$q$) = -1, 'registro de pessoa inexistente recusado');
select pg_temp.check(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'error_events' and column_name in ('message', 'mensagem', 'email', 'ip', 'body', 'stack')), 'a tabela não tem coluna de mensagem, e-mail, IP, corpo ou stack');

-- Cascata: apagar a pessoa apaga os registros dela.
delete from auth.users where id = :'MEM';
select pg_temp.check((select count(*) = 0 from public.error_events where user_id = :'MEM'), 'apagar a pessoa apaga os registros de erro dela');

\echo 'telemetria: todos os testes SQL passaram'
