-- 3D Studio, peças e versões (migração 20261123140001): vínculo só com a própria peça, CHECKs e cascata.
-- Dados sintéticos, Postgres local descartável. O isolamento linha a linha também roda em 30_isolamento.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000d3a01', 'p3d-a@teste.local'),
  ('00000000-0000-0000-0000-0000000d3b01', 'p3d-b@teste.local');

create function pg_temp.check(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FALHOU: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

create function pg_temp.exec_as(uid text, cmd text) returns text language plpgsql as $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), true);
  set local role authenticated;
  begin
    execute cmd; get diagnostics n = row_count;
  exception when others then
    reset role;
    return 'ERRO:' || sqlstate;
  end;
  reset role;
  return n::text;
end $$;

insert into public.pecas_3d (id, user_id, titulo, pedido) values
  ('00000000-0000-0000-0000-0000000d3a11', '00000000-0000-0000-0000-0000000d3a01', 'suporte', 'suporte de celular'),
  ('00000000-0000-0000-0000-0000000d3b11', '00000000-0000-0000-0000-0000000d3b01', 'gancho', 'gancho de parede');

-- A cria a própria peça e versão pela sessão (user_id padrão = auth.uid()).
select pg_temp.check(pg_temp.exec_as('00000000-0000-0000-0000-0000000d3a01', $q$insert into public.pecas_3d (titulo, pedido) values ('caixa', 'caixa com tampa')$q$) = '1', 'A cria peça sem informar user_id');
select pg_temp.check(pg_temp.exec_as('00000000-0000-0000-0000-0000000d3a01', $q$insert into public.pecas_3d_versoes (peca_id, modo, scad) values ('00000000-0000-0000-0000-0000000d3a11', 'novo', 'cube(10);')$q$) = '1', 'A cria versão na própria peça');
-- A não pendura versão na peça de B (chave composta + RLS).
select pg_temp.check(pg_temp.exec_as('00000000-0000-0000-0000-0000000d3a01', $q$insert into public.pecas_3d_versoes (peca_id, modo, scad) values ('00000000-0000-0000-0000-0000000d3b11', 'novo', 'cube(10);')$q$) like 'ERRO:%', 'A não cria versão na peça de B');
select pg_temp.check(pg_temp.exec_as('00000000-0000-0000-0000-0000000d3a01', $q$update public.pecas_3d_versoes set peca_id = '00000000-0000-0000-0000-0000000d3b11' where user_id = '00000000-0000-0000-0000-0000000d3a01'$q$) like 'ERRO:%', 'A não move versão para a peça de B');
-- CHECKs.
select pg_temp.check(pg_temp.exec_as('00000000-0000-0000-0000-0000000d3a01', $q$insert into public.pecas_3d (titulo, pedido) values ('  ', 'x')$q$) like 'ERRO:%', 'título vazio é recusado');
select pg_temp.check(pg_temp.exec_as('00000000-0000-0000-0000-0000000d3a01', $q$insert into public.pecas_3d (titulo, pedido, valores) values ('x', 'x', '[1]')$q$) like 'ERRO:%', 'valores precisa ser objeto');
select pg_temp.check(pg_temp.exec_as('00000000-0000-0000-0000-0000000d3a01', $q$insert into public.pecas_3d_versoes (peca_id, modo, scad) values ('00000000-0000-0000-0000-0000000d3a11', 'outro', 'cube(1);')$q$) like 'ERRO:%', 'modo fora da lista é recusado');
select pg_temp.check(pg_temp.exec_as('00000000-0000-0000-0000-0000000d3a01', format($q$insert into public.pecas_3d_versoes (peca_id, modo, scad) values ('00000000-0000-0000-0000-0000000d3a11', 'novo', %L)$q$, repeat('a', 20001))) like 'ERRO:%', 'código grande demais é recusado');
-- anon não tem nada.
select pg_temp.check((select count(*) = 0 from information_schema.role_table_grants where grantee = 'anon' and table_name in ('pecas_3d', 'pecas_3d_versoes')), 'anon sem privilégio nas tabelas do 3D');
-- Apagar a peça apaga as versões.
delete from public.pecas_3d where id = '00000000-0000-0000-0000-0000000d3a11';
select pg_temp.check((select count(*) = 0 from public.pecas_3d_versoes where peca_id = '00000000-0000-0000-0000-0000000d3a11'), 'apagar a peça apaga as versões');

delete from auth.users where id in ('00000000-0000-0000-0000-0000000d3a01', '00000000-0000-0000-0000-0000000d3b01');
\echo 'peças 3D: todos os testes SQL passaram'
