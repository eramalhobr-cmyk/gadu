-- Testes da cota diária atômica (migração 20261113120001). Rodam como o papel "authenticated",
-- com o usuário simulado em request.jwt.claim.sub, igual a uma chamada real pelo app.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@teste.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@teste.local'),
  ('00000000-0000-0000-0000-00000000000c', 'c@teste.local');
update private.quota_policy set daily_limit = 3;

create function pg_temp.check(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FALHOU: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

-- Executa consume_daily_quota() como um usuário (ou sem usuário) e volta ao superusuário.
create function pg_temp.consume(uid text) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), true);
  execute 'set local role authenticated';
  r := public.consume_daily_quota();
  execute 'reset role';
  return r;
end $$;

-- 1. Primeiro uso, último permitido e tentativa excedente (limite 3).
select pg_temp.check((pg_temp.consume('00000000-0000-0000-0000-00000000000a') ->> 'allowed')::boolean, '1ª mensagem permitida');
select pg_temp.check((pg_temp.consume('00000000-0000-0000-0000-00000000000a') ->> 'used')::int = 2, '2ª mensagem conta 2');
select pg_temp.check(pg_temp.consume('00000000-0000-0000-0000-00000000000a') = '{"allowed": true, "used": 3, "limit": 3}', '3ª (última permitida) conta 3');
select pg_temp.check(pg_temp.consume('00000000-0000-0000-0000-00000000000a') = '{"allowed": false, "used": 3, "limit": 3}', '4ª é negada');
select pg_temp.check(pg_temp.consume('00000000-0000-0000-0000-00000000000a') = '{"allowed": false, "used": 3, "limit": 3}', '5ª é negada');
select pg_temp.check((select messages from public.usage_daily where user_id = '00000000-0000-0000-0000-00000000000a') = 3, 'a contagem NÃO passa do limite');

-- 2. Usuários distintos não se misturam.
select pg_temp.check(pg_temp.consume('00000000-0000-0000-0000-00000000000b') = '{"allowed": true, "used": 1, "limit": 3}', 'outro usuário começa do zero');

-- 3. Exceção por pessoa (private.user_quota) tem prioridade sobre a política global.
insert into private.user_quota (user_id, daily_limit) values ('00000000-0000-0000-0000-00000000000b', 1);
select pg_temp.check(pg_temp.consume('00000000-0000-0000-0000-00000000000b') = '{"allowed": false, "used": 1, "limit": 1}', 'limite individual menor bloqueia');
update private.user_quota set daily_limit = 5 where user_id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check(pg_temp.consume('00000000-0000-0000-0000-00000000000b') = '{"allowed": true, "used": 2, "limit": 5}', 'limite individual maior libera');

-- 4. Limite zero: nega e não cria linha.
insert into private.user_quota (user_id, daily_limit) values ('00000000-0000-0000-0000-00000000000c', 0);
select pg_temp.check(pg_temp.consume('00000000-0000-0000-0000-00000000000c') = '{"allowed": false, "used": 0, "limit": 0}', 'limite zero nega');
select pg_temp.check(not exists (select 1 from public.usage_daily where user_id = '00000000-0000-0000-0000-00000000000c'), 'limite zero não grava contagem');

-- 5. Sem usuário (anon/JWT ausente): nega e não grava.
select pg_temp.check(pg_temp.consume(null) = '{"allowed": false, "used": 0, "limit": 0}', 'sem usuário é negado');

-- 6. Sem política configurada: fecha (fail closed).
delete from private.quota_policy;
select pg_temp.check((pg_temp.consume('00000000-0000-0000-0000-00000000000a') ->> 'allowed')::boolean = false, 'sem política, ninguém passa');
insert into private.quota_policy (id, daily_limit) values (true, 3);

-- 7. O dia é o de Brasília.
select pg_temp.check((select day from public.usage_daily where user_id = '00000000-0000-0000-0000-00000000000a') = (now() at time zone 'America/Sao_Paulo')::date, 'dia gravado é o de Brasília');

-- 8. Manipulação direta pelo usuário: não há como passar o limite nem mexer na política.
select pg_temp.check(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'consume_daily_quota' and p.pronargs > 0), 'a função nova não recebe limite como argumento');
select pg_temp.check(not has_table_privilege('authenticated', 'private.quota_policy', 'SELECT,UPDATE,INSERT,DELETE'), 'authenticated não lê nem altera a política global');
select pg_temp.check(not has_table_privilege('authenticated', 'private.user_quota', 'SELECT,UPDATE,INSERT,DELETE'), 'authenticated não lê nem altera limites individuais');
select pg_temp.check(not has_function_privilege('anon', 'public.consume_daily_quota()', 'EXECUTE'), 'anon não executa a função');

do $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
  set local role authenticated;
  update public.usage_daily set messages = 0 where user_id = '00000000-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  reset role;
  if n <> 0 then raise exception 'FALHOU: usuário conseguiu zerar a própria contagem'; end if;
  raise notice 'ok - usuário não consegue zerar a própria contagem (RLS)';
end $$;

do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
  set local role authenticated;
  begin
    insert into public.usage_daily (user_id, day, messages) values ('00000000-0000-0000-0000-00000000000a', current_date + 1, 0);
    raise exception 'FALHOU: usuário inseriu contagem diretamente';
  exception when insufficient_privilege then
    raise notice 'ok - usuário não insere contagem diretamente (RLS)';
  end;
  reset role;
end $$;

-- 8b. Limite reduzido abaixo do que já foi usado hoje: nega, mantém a contagem e responde de forma coerente.
update private.quota_policy set daily_limit = 2;
select pg_temp.check(pg_temp.consume('00000000-0000-0000-0000-00000000000a') = '{"allowed": false, "used": 3, "limit": 2}', 'limite reduzido abaixo do uso nega');
select pg_temp.check((select messages from public.usage_daily where user_id = '00000000-0000-0000-0000-00000000000a') = 3, 'limite reduzido não altera a contagem já feita');
update private.quota_policy set daily_limit = 4;
select pg_temp.check(pg_temp.consume('00000000-0000-0000-0000-00000000000a') = '{"allowed": true, "used": 4, "limit": 4}', 'limite aumentado no mesmo dia libera a diferença');
update private.quota_policy set daily_limit = 3;

-- 9. Compatibilidade da etapa 1: a função antiga continua existindo para a versão em produção.
select pg_temp.check(exists (select 1 from pg_proc where proname = 'consume_quota'), 'consume_quota(integer) mantida até a etapa 2');

\echo 'daily quota: todos os testes SQL passaram'
