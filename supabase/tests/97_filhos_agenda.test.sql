-- Dados fictícios. Agenda de filhos: propriedade, isolamento, só sábado como data e conta bloqueada.
begin;
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000009a01', 'filhos-a@teste.local'),
  ('00000000-0000-4000-8000-000000009b01', 'filhos-b@teste.local');

insert into public.filhos_agenda_config (user_id, ancora) values
  ('00000000-0000-4000-8000-000000009a01', date '2026-11-28'),
  ('00000000-0000-4000-8000-000000009b01', date '2026-11-28');
insert into public.filhos_agenda_ajustes (id, user_id, tipo, data, comigo) values
  ('00000000-0000-4000-8000-000000009b11', '00000000-0000-4000-8000-000000009b01', 'troca', date '2026-12-05', true);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009a01', true);

do $$
declare n int;
begin
  if (select count(*) from public.filhos_agenda_config) <> 1 then raise exception 'FALHOU: A só pode ler a própria configuração'; end if;
  if (select count(*) from public.filhos_agenda_ajustes) <> 0 then raise exception 'FALHOU: A leu ajuste de B'; end if;

  update public.filhos_agenda_config set feriado_segue = false where user_id = '00000000-0000-4000-8000-000000009b01';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: A alterou a configuração de B'; end if;

  update public.filhos_agenda_ajustes set comigo = false where id = '00000000-0000-4000-8000-000000009b11';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: A alterou ajuste de B'; end if;

  delete from public.filhos_agenda_ajustes where id = '00000000-0000-4000-8000-000000009b11';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: A apagou ajuste de B'; end if;

  begin
    insert into public.filhos_agenda_ajustes (user_id, tipo, data, comigo) values ('00000000-0000-4000-8000-000000009b01', 'troca', date '2026-12-12', true);
    raise exception 'FALHOU: A criou ajuste para B';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.filhos_agenda_ajustes (user_id, tipo, data, comigo) values ('00000000-0000-4000-8000-000000009a01', 'troca', date '2026-12-06', true);
    raise exception 'FALHOU: aceitou data que não é sábado';
  exception when check_violation then null;
  end;

  begin
    update public.filhos_agenda_config set ancora = date '2026-11-29' where user_id = '00000000-0000-4000-8000-000000009a01';
    raise exception 'FALHOU: aceitou referência que não é sábado';
  exception when check_violation then null;
  end;

  insert into public.filhos_agenda_ajustes (user_id, tipo, data, comigo) values ('00000000-0000-4000-8000-000000009a01', 'troca', date '2026-12-05', false);
  begin
    insert into public.filhos_agenda_ajustes (user_id, tipo, data, comigo) values ('00000000-0000-4000-8000-000000009a01', 'troca', date '2026-12-05', true);
    raise exception 'FALHOU: duas trocas no mesmo fim de semana';
  exception when unique_violation then null;
  end;

  update public.filhos_agenda_ajustes set comigo = true where user_id = '00000000-0000-4000-8000-000000009a01' and data = date '2026-12-05';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALHOU: A não altera o próprio ajuste'; end if;

  begin
    update public.filhos_agenda_ajustes set data = date '2026-12-12' where user_id = '00000000-0000-4000-8000-000000009a01';
    raise exception 'FALHOU: data do ajuste não deveria ser alterável (só comigo)';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
insert into public.members (user_id, access) values ('00000000-0000-4000-8000-000000009a01', 'blocked');
set local role authenticated;

do $$
declare n int;
begin
  begin
    insert into public.filhos_agenda_ajustes (user_id, tipo, data, comigo) values ('00000000-0000-4000-8000-000000009a01', 'recorrencia', date '2027-01-02', true);
    raise exception 'FALHOU: bloqueada criou ajuste';
  exception when insufficient_privilege then null;
  end;

  update public.filhos_agenda_config set feriado_segue = false where user_id = '00000000-0000-4000-8000-000000009a01';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: bloqueada alterou a configuração'; end if;

  delete from public.filhos_agenda_ajustes where user_id = '00000000-0000-4000-8000-000000009a01';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALHOU: bloqueada precisa poder apagar os próprios ajustes'; end if;
end $$;

reset role;
rollback;
\echo 'Agenda de filhos: testes SQL passaram'
