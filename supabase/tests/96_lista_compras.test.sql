-- Dados fictícios. Testa propriedade, isolamento de escritas e duplicação.
begin;
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000007a01', 'lista-a@teste.local'),
  ('00000000-0000-4000-8000-000000007b01', 'lista-b@teste.local');

insert into public.lista_compras_itens (id, user_id, nome) values
  ('00000000-0000-4000-8000-000000007a11', '00000000-0000-4000-8000-000000007a01', 'Café'),
  ('00000000-0000-4000-8000-000000007b11', '00000000-0000-4000-8000-000000007b01', 'Café');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000007a01', true);

do $$
declare n int;
begin
  if (select count(*) from public.lista_compras_itens) <> 1 then
    raise exception 'FALHOU: pessoa A só pode ler a própria lista';
  end if;

  update public.lista_compras_itens set comprado = true where id = '00000000-0000-4000-8000-000000007b11';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: pessoa A alterou item de B'; end if;

  delete from public.lista_compras_itens where id = '00000000-0000-4000-8000-000000007b11';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: pessoa A apagou item de B'; end if;

  begin
    insert into public.lista_compras_itens (user_id, nome) values ('00000000-0000-4000-8000-000000007b01', 'Leite');
    raise exception 'FALHOU: pessoa A criou item para B';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.lista_compras_itens (user_id, nome) values ('00000000-0000-4000-8000-000000007a01', 'CAFÉ');
    raise exception 'FALHOU: lista aceitou item duplicado';
  exception when unique_violation then null;
  end;

  update public.lista_compras_itens set comprado = true where id = '00000000-0000-4000-8000-000000007a11';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALHOU: pessoa A não consegue marcar o próprio item'; end if;

  insert into public.lista_compras_itens (user_id, nome) values ('00000000-0000-4000-8000-000000007a01', 'Leite');
  delete from public.lista_compras_itens where nome = 'Leite';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALHOU: pessoa A não consegue remover o próprio item'; end if;
end $$;

reset role;
insert into public.members (user_id, access)
values ('00000000-0000-4000-8000-000000007a01', 'blocked');
set local role authenticated;

do $$
declare n int;
begin
  begin
    insert into public.lista_compras_itens (user_id, nome) values ('00000000-0000-4000-8000-000000007a01', 'Farinha');
    raise exception 'FALHOU: pessoa bloqueada criou item';
  exception when insufficient_privilege then null;
  end;

  update public.lista_compras_itens set comprado = false where id = '00000000-0000-4000-8000-000000007a11';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: pessoa bloqueada alterou item'; end if;

  delete from public.lista_compras_itens where id = '00000000-0000-4000-8000-000000007a11';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALHOU: pessoa bloqueada precisa poder apagar os próprios dados'; end if;
end $$;

reset role;
rollback;
\echo 'Lista de compras: testes SQL passaram'
