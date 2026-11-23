-- Agentes: ferramentas e teto próprios (migração 20261123190001). Dados sintéticos, Postgres local descartável.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000a9a01', 'ag-a@teste.local'),
  ('00000000-0000-0000-0000-0000000a9b01', 'ag-b@teste.local');

create function pg_temp.check(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FALHOU: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

create function pg_temp.exec_as(role_name text, uid text, cmd text) returns text language plpgsql as $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), true);
  execute format('set local role %I', role_name);
  begin
    execute cmd; get diagnostics n = row_count;
  exception when others then
    reset role;
    return 'ERRO:' || sqlstate;
  end;
  reset role;
  return n::text;
end $$;

insert into public.agents (id, user_id, name) overriding system value values
  (99001, '00000000-0000-0000-0000-0000000a9a01', 'Mentor A'),
  (99002, '00000000-0000-0000-0000-0000000a9b01', 'Mentor B');

-- Padrão mantém o comportamento de hoje.
select pg_temp.check((select cardinality(ferramentas) = 8 and teto_mensal_usd is null from public.agents where id = 99001), 'agente novo: todas as ferramentas e sem teto próprio');
-- A muda as ferramentas e o teto do próprio agente pela sessão; valores fora da lista ou do intervalo são recusados.
select pg_temp.check(pg_temp.exec_as('authenticated', '00000000-0000-0000-0000-0000000a9a01', $q$update public.agents set ferramentas = array['agenda','tarefas'], teto_mensal_usd = 2.50 where id = 99001$q$) = '1', 'A limita ferramentas e teto do próprio agente');
select pg_temp.check(pg_temp.exec_as('authenticated', '00000000-0000-0000-0000-0000000a9a01', $q$update public.agents set ferramentas = array['shell'] where id = 99001$q$) like 'ERRO:23514', 'ferramenta desconhecida é recusada');
select pg_temp.check(pg_temp.exec_as('authenticated', '00000000-0000-0000-0000-0000000a9a01', $q$update public.agents set teto_mensal_usd = 500 where id = 99001$q$) like 'ERRO:23514', 'teto acima de US$ 100 é recusado');
select pg_temp.check(pg_temp.exec_as('authenticated', '00000000-0000-0000-0000-0000000a9a01', $q$update public.agents set teto_mensal_usd = 0 where id = 99001$q$) like 'ERRO:23514', 'teto zero é recusado');
select pg_temp.check(pg_temp.exec_as('authenticated', '00000000-0000-0000-0000-0000000a9a01', $q$update public.agents set teto_mensal_usd = 1 where id = 99002$q$) = '0', 'A não muda o agente de B');

-- agent_uso: só o servidor grava; a pessoa só lê o que é dela.
select pg_temp.check(pg_temp.exec_as('authenticated', '00000000-0000-0000-0000-0000000a9a01', $q$insert into public.agent_uso (user_id, agent_id, mes) values ('00000000-0000-0000-0000-0000000a9a01', 99001, '2026-11-01')$q$) like 'ERRO:42501', 'cliente não insere em agent_uso');
select pg_temp.check(pg_temp.exec_as('authenticated', '00000000-0000-0000-0000-0000000a9a01', $q$select public.server_add_agent_usage('00000000-0000-0000-0000-0000000a9a01', 99001, 1)$q$) like 'ERRO:42501', 'cliente não executa server_add_agent_usage');
select pg_temp.check(pg_temp.exec_as('anon', '', $q$select public.server_add_agent_usage('00000000-0000-0000-0000-0000000a9a01', 99001, 1)$q$) like 'ERRO:42501', 'anon não executa server_add_agent_usage');
select pg_temp.check(pg_temp.exec_as('anon', '', $q$select 1 from public.agent_uso$q$) like 'ERRO:42501', 'anon não lê agent_uso');

-- O servidor soma de forma atômica; o agente precisa ser da pessoa.
select public.server_add_agent_usage('00000000-0000-0000-0000-0000000a9a01', 99001, 0.25);
select public.server_add_agent_usage('00000000-0000-0000-0000-0000000a9a01', 99001, 0.50);
select pg_temp.check((select custo_usd = 0.75 and mensagens = 2 from public.agent_uso where agent_id = 99001), 'servidor soma custo e mensagens do mês');
do $$ begin
  perform public.server_add_agent_usage('00000000-0000-0000-0000-0000000a9b01', 99001, 9);
  raise exception 'FALHOU: aceitou somar no agente de outra pessoa';
exception when foreign_key_violation then raise notice 'ok - agente de outra pessoa é recusado (chave composta)';
end $$;
select pg_temp.check((select custo_usd from public.agent_uso where agent_id = 99001) = 0.75, 'custo de A intacto');
select pg_temp.check(pg_temp.exec_as('authenticated', '00000000-0000-0000-0000-0000000a9b01', $q$select 1 from public.agent_uso where agent_id = 99001$q$) = '0', 'B não lê o gasto do agente de A');
select pg_temp.check(pg_temp.exec_as('authenticated', '00000000-0000-0000-0000-0000000a9a01', $q$select 1 from public.agent_uso where agent_id = 99001$q$) = '1', 'A lê o gasto do próprio agente');
-- Apagar o agente apaga o gasto dele.
delete from public.agents where id = 99001;
select pg_temp.check(not exists (select 1 from public.agent_uso where agent_id = 99001), 'apagar o agente apaga o gasto dele');

\echo 'agentes ferramentas/teto: todos os testes SQL passaram'
