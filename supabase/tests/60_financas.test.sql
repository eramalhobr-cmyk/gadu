-- Finanças, base (migração 20261122190001): isolamento entre pessoas, privilégios, CHECKs e vínculos.
-- Dados sintéticos (nenhum valor real), Postgres local descartável. O isolamento linha a linha de TODAS as tabelas
-- (inclusive fin_*) também roda em 30_isolamento; aqui ficam os casos específicos de finanças.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000f1a01', 'fin-a@teste.local'),
  ('00000000-0000-0000-0000-0000000f1b01', 'fin-b@teste.local');
\set A '00000000-0000-0000-0000-0000000f1a01'
\set B '00000000-0000-0000-0000-0000000f1b01'

create function pg_temp.check(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FALHOU: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

-- Executa um comando como um papel/pessoa. Devolve linhas afetadas ou 'ERRO:<sqlstate>'.
create function pg_temp.exec_as(role_name text, uid text, cmd text) returns text language plpgsql as $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), true);
  execute format('set local role %I', role_name);
  begin
    execute cmd; get diagnostics n = row_count;
  exception when others then
    execute 'reset role';
    return 'ERRO:' || sqlstate;
  end;
  execute 'reset role';
  return n::text;
end $$;

-- Conta linhas visíveis para um papel/pessoa (sem permissão = 0).
create function pg_temp.count_as(role_name text, uid text, q text) returns bigint language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), true);
  execute format('set local role %I', role_name);
  begin
    execute 'select count(*) from (' || q || ') x' into n;
  exception when insufficient_privilege then n := 0;
  end;
  execute 'reset role';
  return n;
end $$;

-- Preparação como administrador do banco: A e B com uma conta, um mês, um gasto e uma config cada.
create temp table ids (who text primary key, item uuid, gasto uuid);
do $$
declare a uuid := '00000000-0000-0000-0000-0000000f1a01'; b uuid := '00000000-0000-0000-0000-0000000f1b01'; u uuid; it uuid; g uuid;
begin
  foreach u in array array[a, b] loop
    insert into public.fin_itens (user_id, tipo, grupo, nome, dia) values (u, 'despesa', 'Moradia', 'Aluguel sintético', 10) returning id into it;
    insert into public.fin_item_meses (user_id, item_id, ano, mes, valor) values (u, it, 2026, 11, 100.50);
    insert into public.fin_gastos (user_id, ano, mes, dia, valor, categoria, meio) values (u, 2026, 11, 5, 12.34, 'Mercado', 'pix') returning id into g;
    insert into public.fin_config (user_id, receita_principal_id) values (u, null);
    insert into ids values (u::text, it, g);
  end loop;
end $$;

-- ===== Privilégios e RLS (catálogo) =========================================================================
select pg_temp.check((select count(*) = 4 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('fin_itens', 'fin_item_meses', 'fin_gastos', 'fin_config') and c.relrowsecurity), 'RLS ligado nas 4 tabelas fin_*');
select pg_temp.check(not exists (
  select 1 from unnest(array['fin_itens', 'fin_item_meses', 'fin_gastos', 'fin_config']) t,
       unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) p
  where has_table_privilege('anon', 'public.' || t, p) or has_table_privilege('public', 'public.' || t, p)), 'anon e PUBLIC sem nenhum privilégio nas tabelas fin_*');
select pg_temp.check(not exists (
  select 1 from unnest(array['fin_itens', 'fin_item_meses', 'fin_gastos', 'fin_config']) t,
       unnest(array['TRUNCATE', 'REFERENCES', 'TRIGGER']) p
  where has_table_privilege('authenticated', 'public.' || t, p)), 'authenticated sem TRUNCATE, REFERENCES e TRIGGER nas tabelas fin_*');
select pg_temp.check((select count(*) = 16 from pg_policies where schemaname = 'public' and permissive = 'PERMISSIVE' and tablename like 'fin\_%'), '4 políticas por tabela fin_* (select, insert, update, delete)');
select pg_temp.check(not exists (select 1 from pg_policies where schemaname = 'public' and permissive = 'PERMISSIVE' and tablename like 'fin\_%' and (roles <> '{authenticated}' or
  coalesce(qual, with_check) not like '%SELECT auth.uid()%' or coalesce(qual, with_check) not like '%user_id%')), 'políticas só para authenticated e com (select auth.uid()) = user_id');
select pg_temp.check(not exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid where c.relname like 'fin\_%' and not t.tgisinternal), 'nenhuma trigger nas tabelas fin_*');
select pg_temp.check((select count(*) = 0 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('public', p.oid, 'EXECUTE'))), 'nenhuma função do public ficou executável por PUBLIC/anon');

-- ===== Sem login: nada ======================================================================================
select pg_temp.check(pg_temp.count_as('anon', null, 'select 1 from public.fin_itens') = 0, 'anon não lê fin_itens');
select pg_temp.check(pg_temp.count_as('anon', null, 'select 1 from public.fin_item_meses') = 0, 'anon não lê fin_item_meses');
select pg_temp.check(pg_temp.count_as('anon', null, 'select 1 from public.fin_gastos') = 0, 'anon não lê fin_gastos');
select pg_temp.check(pg_temp.count_as('anon', null, 'select 1 from public.fin_config') = 0, 'anon não lê fin_config');
select pg_temp.check(pg_temp.exec_as('anon', null, $q$insert into public.fin_gastos (user_id, ano, mes, dia, valor) values ('00000000-0000-0000-0000-0000000f1a01', 2026, 11, 1, 1)$q$) = 'ERRO:42501', 'anon não insere gasto');
select pg_temp.check(pg_temp.exec_as('authenticated', null, $q$insert into public.fin_gastos (ano, mes, dia, valor) values (2026, 11, 1, 1)$q$) in ('ERRO:42501', 'ERRO:23502'), 'sem sessão (auth.uid() nulo) nem o papel authenticated insere');

-- ===== A: o próprio uso funciona (user_id padrão vem da sessão) =============================================
select pg_temp.check(pg_temp.exec_as('authenticated', :'A', $q$insert into public.fin_gastos (ano, mes, dia, valor, categoria, meio) values (2026, 11, 20, 45, 'Mercado', 'pix')$q$) = '1', 'A insere gasto sem informar user_id (default = sessão)');
select pg_temp.check((select user_id from public.fin_gastos where valor = 45) = :'A', 'o user_id gravado é o da sessão');
select pg_temp.check(pg_temp.count_as('authenticated', :'A', 'select 1 from public.fin_gastos') = 2, 'A lê só os 2 gastos dela');
select pg_temp.check(pg_temp.count_as('authenticated', :'B', 'select 1 from public.fin_gastos') = 1, 'B lê só o gasto dele');

-- ===== B contra A ===========================================================================================
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$insert into public.fin_gastos (user_id, ano, mes, dia, valor) values (%L, 2026, 11, 1, 1)$q$, :'A')) = 'ERRO:42501', 'B não insere gasto em nome de A');
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$insert into public.fin_itens (user_id, tipo, nome) values (%L, 'despesa', 'x')$q$, :'A')) = 'ERRO:42501', 'B não insere item em nome de A');
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$update public.fin_gastos set valor = 999 where id = %L$q$, (select gasto from ids where who = :'A'))) = '0', 'B não altera gasto de A');
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$delete from public.fin_gastos where id = %L$q$, (select gasto from ids where who = :'A'))) = '0', 'B não apaga gasto de A');
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$update public.fin_itens set nome = 'x' where id = %L$q$, (select item from ids where who = :'A'))) = '0', 'B não altera item de A');
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$delete from public.fin_itens where id = %L$q$, (select item from ids where who = :'A'))) = '0', 'B não apaga item de A');
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$update public.fin_item_meses set pago = true where item_id = %L$q$, (select item from ids where who = :'A'))) = '0', 'B não marca como pago o mês de A');
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$update public.fin_config set dia_restante = 9 where user_id = %L$q$, :'A')) = '0', 'B não altera a config de A');
-- B não passa a linha dele para A (with check):
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$update public.fin_gastos set user_id = %L where user_id = %L$q$, :'A', :'B')) = 'ERRO:42501', 'B não transfere o próprio gasto para A');
-- Vínculos cruzados: nem com o id certo de A (o banco recusa pela chave composta (id, user_id)).
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$insert into public.fin_item_meses (item_id, ano, mes, valor) values (%L, 2026, 12, 5)$q$, (select item from ids where who = :'A'))) in ('ERRO:23503', 'ERRO:42501'), 'B não cria mês em item de A');
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$insert into public.fin_itens (tipo, nome, cartao_id) values ('despesa', 'x', %L)$q$, (select item from ids where who = :'A'))) = 'ERRO:23503', 'B não vincula item dele ao cartão de A');
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$update public.fin_config set cartao_principal_id = %L where user_id = %L$q$, (select item from ids where who = :'A'), :'B')) = 'ERRO:23503', 'B não escolhe item de A como cartão principal');
select pg_temp.check((select count(*) from public.fin_gastos where user_id = :'A') = 2 and (select valor from public.fin_gastos where id = (select gasto from ids where who = :'A')) = 12.34, 'dados de A intactos depois das tentativas de B');

-- ===== CHECKs ===============================================================================================
create function pg_temp.bad(cmd text) returns boolean language plpgsql as $$
begin
  execute cmd; return false;                          -- aceitou: ruim
exception when check_violation or not_null_violation or foreign_key_violation or unique_violation then return true;
end $$;
select pg_temp.check(pg_temp.bad($q$insert into public.fin_gastos (user_id, ano, mes, dia, valor) values ('00000000-0000-0000-0000-0000000f1a01', 2026, 11, 1, 0)$q$), 'valor 0 recusado');
select pg_temp.check(pg_temp.bad($q$insert into public.fin_gastos (user_id, ano, mes, dia, valor) values ('00000000-0000-0000-0000-0000000f1a01', 2026, 11, 1, -5)$q$), 'valor negativo recusado');
select pg_temp.check(pg_temp.bad($q$insert into public.fin_gastos (user_id, ano, mes, dia, valor) values ('00000000-0000-0000-0000-0000000f1a01', 2026, 13, 1, 5)$q$), 'mês 13 recusado');
select pg_temp.check(pg_temp.bad($q$insert into public.fin_gastos (user_id, ano, mes, dia, valor) values ('00000000-0000-0000-0000-0000000f1a01', 2026, 0, 1, 5)$q$), 'mês 0 recusado');
select pg_temp.check(pg_temp.bad($q$insert into public.fin_gastos (user_id, ano, mes, dia, valor) values ('00000000-0000-0000-0000-0000000f1a01', 2026, 11, 32, 5)$q$), 'dia 32 recusado');
select pg_temp.check(pg_temp.bad($q$insert into public.fin_gastos (user_id, ano, mes, dia, valor) values ('00000000-0000-0000-0000-0000000f1a01', 2026, 11, 0, 5)$q$), 'dia 0 recusado');
select pg_temp.check(pg_temp.bad($q$insert into public.fin_gastos (user_id, ano, mes, dia, valor) values ('00000000-0000-0000-0000-0000000f1a01', 2026, 2, 31, 5)$q$), '31/02 recusado (data inexistente)');
select pg_temp.check(pg_temp.bad($q$insert into public.fin_gastos (user_id, ano, mes, dia, valor) values ('00000000-0000-0000-0000-0000000f1a01', 2027, 2, 29, 5)$q$), '29/02 de ano não bissexto recusado');
select pg_temp.check(not pg_temp.bad($q$insert into public.fin_gastos (user_id, ano, mes, dia, valor) values ('00000000-0000-0000-0000-0000000f1a01', 2028, 2, 29, 5), ('00000000-0000-0000-0000-0000000f1a01', 2026, 12, 31, 5), ('00000000-0000-0000-0000-0000000f1a01', 2026, 4, 30, 5)$q$), '29/02 bissexto, 31/12 e 30/04 aceitos');
select pg_temp.check(pg_temp.bad($q$insert into public.fin_gastos (user_id, ano, mes, dia, valor) values ('00000000-0000-0000-0000-0000000f1a01', 2026, 4, 31, 5)$q$), '31/04 recusado');
select pg_temp.check(pg_temp.bad($q$insert into public.fin_gastos (user_id, ano, mes, dia, valor, meio) values ('00000000-0000-0000-0000-0000000f1a01', 2026, 11, 1, 5, 'dinheiro')$q$), 'meio fora de (debito, pix, credito, reserva) recusado');
select pg_temp.check(not pg_temp.bad($q$insert into public.fin_gastos (user_id, ano, mes, dia, valor, meio) values ('00000000-0000-0000-0000-0000000f1a01', 2026, 11, 1, 5, 'credito'), ('00000000-0000-0000-0000-0000000f1a01', 2026, 11, 1, 5, 'reserva'), ('00000000-0000-0000-0000-0000000f1a01', 2026, 11, 1, 5, 'debito')$q$), 'os meios válidos (credito, reserva, debito, pix) entram');
select pg_temp.check(pg_temp.bad($q$insert into public.fin_gastos (user_id, ano, mes, dia, valor, origem) values ('00000000-0000-0000-0000-0000000f1a01', 2026, 11, 1, 5, 'hacker')$q$), 'origem inválida recusada');
select pg_temp.check(pg_temp.bad($q$insert into public.fin_gastos (user_id, ano, mes, dia, valor, categoria) values ('00000000-0000-0000-0000-0000000f1a01', 2026, 11, 1, 5, '   ')$q$), 'categoria em branco recusada');
select pg_temp.check(pg_temp.bad($q$insert into public.fin_itens (user_id, tipo, nome) values ('00000000-0000-0000-0000-0000000f1a01', 'transferencia', 'x')$q$), 'tipo fora de (despesa, receita) recusado');
select pg_temp.check(pg_temp.bad($q$insert into public.fin_itens (user_id, tipo, nome) values ('00000000-0000-0000-0000-0000000f1a01', 'despesa', '  ')$q$), 'nome em branco recusado');
select pg_temp.check(pg_temp.bad($q$insert into public.fin_itens (user_id, tipo, nome, dia) values ('00000000-0000-0000-0000-0000000f1a01', 'despesa', 'x', 32)$q$), 'item com dia 32 recusado');
select pg_temp.check(pg_temp.bad($q$insert into public.fin_itens (user_id, tipo, nome, dia) values ('00000000-0000-0000-0000-0000000f1a01', 'despesa', 'x', 0)$q$), 'item com dia 0 recusado');
select pg_temp.check(pg_temp.bad(format($q$insert into public.fin_item_meses (user_id, item_id, ano, mes, valor) values (%L, %L, 2026, 12, 0)$q$, :'A', (select item from ids where who = :'A'))), 'mês do item com valor 0 recusado (sem linha = não existe)');
select pg_temp.check(pg_temp.bad(format($q$insert into public.fin_item_meses (user_id, item_id, ano, mes, valor) values (%L, %L, 2026, 13, 5)$q$, :'A', (select item from ids where who = :'A'))), 'mês do item = 13 recusado');
select pg_temp.check(pg_temp.bad(format($q$insert into public.fin_item_meses (user_id, item_id, ano, mes, valor) values (%L, %L, 2026, 11, 5)$q$, :'A', (select item from ids where who = :'A'))), 'um item não tem dois valores no mesmo mês (chave primária)');
select pg_temp.check(pg_temp.bad($q$insert into public.fin_config (user_id) values ('00000000-0000-0000-0000-0000000f1a01')$q$), 'config: uma única linha por pessoa (chave primária)');
select pg_temp.check((select count(*) from public.fin_config where user_id = :'A') = 1, 'uma linha de config por pessoa');
select pg_temp.check(pg_temp.bad($q$update public.fin_config set dia_adiantamento = 0 where user_id = '00000000-0000-0000-0000-0000000f1a01'$q$), 'config: dia do adiantamento 0 recusado');
select pg_temp.check(pg_temp.bad($q$update public.fin_config set dia_restante = 32 where user_id = '00000000-0000-0000-0000-0000000f1a01'$q$), 'config: dia do restante 32 recusado');
select pg_temp.check(pg_temp.bad($q$update public.fin_config set adiantamento_pct = 101 where user_id = '00000000-0000-0000-0000-0000000f1a01'$q$), 'config: adiantamento acima de 100% recusado');
select pg_temp.check(pg_temp.bad($q$update public.fin_config set adiantamento_pct = -1 where user_id = '00000000-0000-0000-0000-0000000f1a01'$q$), 'config: adiantamento negativo recusado');
select pg_temp.check((select dia_adiantamento = 15 and dia_restante = 1 and adiantamento_pct = 0 from public.fin_config where user_id = :'B'), 'config nasce com dia 15 (adiantamento), dia 1 (restante) e sem adiantamento');

-- ===== Vínculos (cartão, segue) =============================================================================
do $$
declare a uuid := '00000000-0000-0000-0000-0000000f1a01'; card uuid; sub uuid; sal uuid; seg uuid;
begin
  insert into public.fin_itens (user_id, tipo, nome) values (a, 'despesa', 'Cartão sintético') returning id into card;
  insert into public.fin_itens (user_id, tipo, nome, cartao_id) values (a, 'despesa', 'Assinatura sintética', card) returning id into sub;
  insert into public.fin_itens (user_id, tipo, nome) values (a, 'receita', 'Salário sintético') returning id into sal;
  insert into public.fin_itens (user_id, tipo, nome, segue_id) values (a, 'despesa', 'Desconto sintético', sal) returning id into seg;
  insert into public.fin_config (user_id) values ('00000000-0000-0000-0000-0000000f1b01') on conflict do nothing;
  execute format('create temp table vinc as select %L::uuid as card, %L::uuid as sub, %L::uuid as sal, %L::uuid as seg', card, sub, sal, seg);
end $$;
select pg_temp.check(pg_temp.bad(format($q$update public.fin_itens set cartao_id = id where id = %L$q$, (select sub from vinc))), 'item não é o próprio cartão');
select pg_temp.check(pg_temp.bad(format($q$update public.fin_itens set segue_id = id where id = %L$q$, (select seg from vinc))), 'item não segue a si mesmo');
select pg_temp.check(pg_temp.bad(format($q$update public.fin_itens set segue_id = %L where id = %L$q$, (select sal from vinc), (select sub from vinc))), 'item não tem cartão e segue ao mesmo tempo');
select pg_temp.check(pg_temp.bad(format($q$insert into public.fin_itens (user_id, tipo, nome, cartao_id) values (%L, 'receita', 'x', %L)$q$, :'A', (select card from vinc))), 'receita não fica dentro de cartão');
select pg_temp.check(pg_temp.bad(format($q$update public.fin_config set cartao_principal_id = %L where user_id = %L$q$, (select card from vinc), :'B')) , 'config de B não aceita cartão de A (chave composta)');
update public.fin_config set receita_principal_id = (select sal from vinc), cartao_principal_id = (select card from vinc) where user_id = :'A';
-- Apagar o cartão solta os vinculados e a config (set null só da coluna; o user_id da linha fica).
delete from public.fin_itens where id = (select card from vinc);
select pg_temp.check((select cartao_id is null from public.fin_itens where id = (select sub from vinc)), 'apagar o cartão solta a assinatura vinculada (não apaga a assinatura)');
select pg_temp.check((select cartao_principal_id is null and receita_principal_id is not null and user_id = :'A' from public.fin_config where user_id = :'A'), 'apagar o cartão limpa só o cartão principal da config');
-- Apagar item apaga os meses dele.
delete from public.fin_itens where id = (select item from ids where who = :'A');
select pg_temp.check((select count(*) = 0 from public.fin_item_meses where item_id = (select item from ids where who = :'A')), 'apagar o item apaga os meses dele (cascata)');
-- Apagar a pessoa apaga tudo dela.
delete from auth.users where id = :'B';
select pg_temp.check((select count(*) = 0 from public.fin_itens where user_id = :'B') and (select count(*) = 0 from public.fin_gastos where user_id = :'B')
  and (select count(*) = 0 from public.fin_item_meses where user_id = :'B') and (select count(*) = 0 from public.fin_config where user_id = :'B'), 'apagar a pessoa apaga todos os dados de finanças dela');

\echo 'finanças: todos os testes SQL passaram'
