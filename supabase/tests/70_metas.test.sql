-- Metas, base (migração 20261122210001): isolamento entre pessoas, privilégios, CHECKs e vínculos com tarefas.
-- Dados sintéticos (nenhum dado real), Postgres local descartável. O isolamento linha a linha das 4 tabelas também roda
-- em 30_isolamento; aqui ficam os casos específicos de metas.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000e7a01', 'meta-a@teste.local'),
  ('00000000-0000-0000-0000-0000000e7b01', 'meta-b@teste.local');
\set A '00000000-0000-0000-0000-0000000e7a01'
\set B '00000000-0000-0000-0000-0000000e7b01'

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
    execute 'reset role';
    return 'ERRO:' || sqlstate;
  end;
  execute 'reset role';
  return n::text;
end $$;

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

-- Preparação como administrador do banco: A e B com uma tarefa, uma meta, um registro, um marco e um vínculo cada.
create temp table ids (who text primary key, task bigint, goal uuid, prog uuid, marco uuid);
do $$
declare a uuid := '00000000-0000-0000-0000-0000000e7a01'; b uuid := '00000000-0000-0000-0000-0000000e7b01'; u uuid; t bigint; g uuid; p uuid; m uuid;
begin
  foreach u in array array[a, b] loop
    insert into public.tasks (user_id, title) values (u, 'tarefa sintética') returning id into t;
    insert into public.goals (user_id, titulo, medicao, unidade, valor_alvo, prazo) values (u, 'Meta sintética', 'numerica', 'livros', 12, current_date + 30) returning id into g;
    insert into public.goal_progress (user_id, goal_id, valor, data, origem) values (u, g, 2, current_date, 'manual') returning id into p;
    insert into public.goal_milestones (user_id, goal_id, titulo) values (u, g, 'Marco sintético') returning id into m;
    insert into public.goal_tasks (user_id, goal_id, task_id) values (u, g, t);
    insert into ids values (u::text, t, g, p, m);
  end loop;
end $$;

-- ===== Privilégios e RLS (catálogo) =========================================================================
select pg_temp.check((select count(*) = 4 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('goals', 'goal_progress', 'goal_milestones', 'goal_tasks') and c.relrowsecurity), 'RLS ligado nas 4 tabelas de metas');
select pg_temp.check(not exists (
  select 1 from unnest(array['goals', 'goal_progress', 'goal_milestones', 'goal_tasks']) t,
       unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) p
  where has_table_privilege('anon', 'public.' || t, p) or has_table_privilege('public', 'public.' || t, p)), 'anon e PUBLIC sem nenhum privilégio nas tabelas de metas');
select pg_temp.check(not exists (
  select 1 from unnest(array['goals', 'goal_progress', 'goal_milestones', 'goal_tasks']) t,
       unnest(array['TRUNCATE', 'REFERENCES', 'TRIGGER']) p
  where has_table_privilege('authenticated', 'public.' || t, p)), 'authenticated sem TRUNCATE, REFERENCES e TRIGGER nas tabelas de metas');
select pg_temp.check((select count(*) = 16 from pg_policies where schemaname = 'public' and permissive = 'PERMISSIVE' and tablename in ('goals', 'goal_progress', 'goal_milestones', 'goal_tasks')), '4 políticas por tabela de metas');
select pg_temp.check(not exists (select 1 from pg_policies where schemaname = 'public' and permissive = 'PERMISSIVE' and tablename in ('goals', 'goal_progress', 'goal_milestones', 'goal_tasks') and (roles <> '{authenticated}' or
  coalesce(qual, with_check) not like '%SELECT auth.uid()%' or coalesce(qual, with_check) not like '%user_id%')), 'políticas só para authenticated e com (select auth.uid()) = user_id');
select pg_temp.check(not exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid where c.relname in ('goals', 'goal_progress', 'goal_milestones', 'goal_tasks') and not t.tgisinternal), 'nenhuma trigger nas tabelas de metas');
select pg_temp.check((select count(*) = 0 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('public', p.oid, 'EXECUTE'))), 'nenhuma função do public ficou executável por PUBLIC/anon');

-- ===== Sem login: nada ======================================================================================
select pg_temp.check(pg_temp.count_as('anon', null, 'select 1 from public.goals') = 0, 'anon não lê goals');
select pg_temp.check(pg_temp.count_as('anon', null, 'select 1 from public.goal_progress') = 0, 'anon não lê goal_progress');
select pg_temp.check(pg_temp.count_as('anon', null, 'select 1 from public.goal_milestones') = 0, 'anon não lê goal_milestones');
select pg_temp.check(pg_temp.count_as('anon', null, 'select 1 from public.goal_tasks') = 0, 'anon não lê goal_tasks');
select pg_temp.check(pg_temp.exec_as('anon', null, $q$insert into public.goals (user_id, titulo, medicao, valor_alvo) values ('00000000-0000-0000-0000-0000000e7a01', 'x', 'numerica', 5)$q$) = 'ERRO:42501', 'anon não insere meta');
select pg_temp.check(pg_temp.exec_as('authenticated', null, $q$insert into public.goals (titulo, medicao, valor_alvo) values ('x', 'numerica', 5)$q$) in ('ERRO:42501', 'ERRO:23502'), 'sem sessão (auth.uid() nulo) nem o papel authenticated insere');

-- ===== A: o próprio uso funciona (user_id padrão vem da sessão) =============================================
select pg_temp.check(pg_temp.exec_as('authenticated', :'A', $q$insert into public.goals (titulo, categoria, medicao, valor_alvo) values ('Ler mais', 'educacao', 'numerica', 20)$q$) = '1', 'A cria meta sem informar user_id (default = sessão)');
select pg_temp.check((select user_id from public.goals where titulo = 'Ler mais') = :'A', 'o user_id gravado é o da sessão');
select pg_temp.check(pg_temp.count_as('authenticated', :'A', 'select 1 from public.goals') = 2, 'A lê só as 2 metas dela');
select pg_temp.check(pg_temp.count_as('authenticated', :'B', 'select 1 from public.goals') = 1, 'B lê só a meta dele');

-- ===== B contra A ===========================================================================================
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$insert into public.goals (user_id, titulo, medicao, valor_alvo) values (%L, 'x', 'numerica', 5)$q$, :'A')) = 'ERRO:42501', 'B não cria meta em nome de A');
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$update public.goals set titulo = 'x' where id = %L$q$, (select goal from ids where who = :'A'))) = '0', 'B não altera meta de A');
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$delete from public.goals where id = %L$q$, (select goal from ids where who = :'A'))) = '0', 'B não apaga meta de A');
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$update public.goals set user_id = %L where user_id = %L$q$, :'A', :'B')) = 'ERRO:42501', 'B não transfere a própria meta para A');
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$insert into public.goal_progress (goal_id, valor, data) values (%L, 5, current_date)$q$, (select goal from ids where who = :'A'))) = 'ERRO:23503', 'B não registra progresso na meta de A (chave composta)');
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$insert into public.goal_progress (user_id, goal_id, valor, data) values (%L, %L, 5, current_date)$q$, :'A', (select goal from ids where who = :'A'))) = 'ERRO:42501', 'B não registra progresso em nome de A');
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$update public.goal_progress set valor = 999 where id = %L$q$, (select prog from ids where who = :'A'))) = '0', 'B não altera registro de A');
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$delete from public.goal_progress where id = %L$q$, (select prog from ids where who = :'A'))) = '0', 'B não apaga registro de A');
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$insert into public.goal_milestones (goal_id, titulo) values (%L, 'x')$q$, (select goal from ids where who = :'A'))) = 'ERRO:23503', 'B não cria marco na meta de A');
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$update public.goal_milestones set concluido_em = now() where id = %L$q$, (select marco from ids where who = :'A'))) = '0', 'B não conclui marco de A');
-- Vínculos meta ↔ tarefa: nenhum dos dois lados pode ser da outra pessoa.
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$insert into public.goal_tasks (goal_id, task_id) values (%L, %L)$q$, (select goal from ids where who = :'B'), (select task from ids where who = :'A'))) = 'ERRO:23503', 'B não vincula tarefa de A à meta dele');
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$insert into public.goal_tasks (goal_id, task_id) values (%L, %L)$q$, (select goal from ids where who = :'A'), (select task from ids where who = :'B'))) = 'ERRO:23503', 'B não vincula tarefa dele à meta de A');
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$insert into public.goal_tasks (goal_id, task_id) values (%L, %L)$q$, (select goal from ids where who = :'A'), (select task from ids where who = :'A'))) in ('ERRO:23503', 'ERRO:23505'), 'B não recria o vínculo de A (recusado por chave composta ou duplicidade)');
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$insert into public.goal_tasks (user_id, goal_id, task_id) values (%L, %L, %L)$q$, :'A', (select goal from ids where who = :'A'), (select task from ids where who = :'B'))) = 'ERRO:42501', 'B não cria vínculo em nome de A');
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$delete from public.goal_tasks where goal_id = %L$q$, (select goal from ids where who = :'A'))) = '0', 'B não desfaz vínculo de A');
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$update public.goal_tasks set goal_id = %L where goal_id = %L$q$, (select goal from ids where who = :'A'), (select goal from ids where who = :'B'))) = 'ERRO:23503', 'B não move o vínculo dele para a meta de A');
select pg_temp.check((select count(*) from public.goals where user_id = :'A') = 2 and (select valor = 2 from public.goal_progress where id = (select prog from ids where who = :'A'))
  and (select count(*) from public.goal_tasks where user_id = :'A') = 1, 'dados de A intactos depois das tentativas de B');
select pg_temp.check(pg_temp.exec_as('authenticated', :'A', format($q$insert into public.goal_tasks (goal_id, task_id) values (%L, %L)$q$, (select goal from ids where who = :'A'), (select task from ids where who = :'A'))) = 'ERRO:23505', 'A não vincula a mesma tarefa duas vezes');
select pg_temp.check(pg_temp.exec_as('authenticated', :'A', format($q$insert into public.goal_tasks (goal_id, task_id) select %L, id from public.tasks where user_id = %L$q$, (select goal from ids where who = :'A'), :'A')) in ('ERRO:23505', '0'), 'o vínculo de A segue único por (meta, tarefa)');

-- ===== CHECKs ===============================================================================================
create function pg_temp.bad(cmd text) returns boolean language plpgsql as $$
begin
  execute cmd; return false;                          -- aceitou: ruim
exception when check_violation or not_null_violation or foreign_key_violation or unique_violation then return true;
end $$;
select pg_temp.check(pg_temp.bad($q$insert into public.goals (user_id, titulo, medicao, valor_alvo) values ('00000000-0000-0000-0000-0000000e7a01', '   ', 'numerica', 5)$q$), 'título em branco recusado');
select pg_temp.check(pg_temp.bad($q$insert into public.goals (user_id, titulo, medicao, valor_alvo) values ('00000000-0000-0000-0000-0000000e7a01', repeat('x', 121), 'numerica', 5)$q$), 'título com mais de 120 caracteres recusado');
select pg_temp.check(pg_temp.bad($q$insert into public.goals (user_id, titulo, categoria, medicao, valor_alvo) values ('00000000-0000-0000-0000-0000000e7a01', 'x', 'outra', 'numerica', 5)$q$), 'categoria fora da lista recusada');
select pg_temp.check(pg_temp.bad($q$insert into public.goals (user_id, titulo, medicao, valor_alvo) values ('00000000-0000-0000-0000-0000000e7a01', 'x', 'magica', 5)$q$), 'tipo de medição fora da lista recusado');
select pg_temp.check(pg_temp.bad($q$insert into public.goals (user_id, titulo, medicao) values ('00000000-0000-0000-0000-0000000e7a01', 'x', 'numerica')$q$), 'meta numérica sem alvo recusada');
select pg_temp.check(pg_temp.bad($q$insert into public.goals (user_id, titulo, medicao, valor_inicial, valor_alvo) values ('00000000-0000-0000-0000-0000000e7a01', 'x', 'numerica', 5, 5)$q$), 'meta numérica com alvo igual ao início recusada');
select pg_temp.check(not pg_temp.bad($q$insert into public.goals (user_id, titulo, medicao, valor_inicial, valor_alvo, unidade) values ('00000000-0000-0000-0000-0000000e7a01', 'Chegar a 75 kg', 'numerica', 82, 75, 'kg')$q$), 'meta que diminui (82 para 75) é aceita');
select pg_temp.check(pg_temp.bad($q$insert into public.goals (user_id, titulo, medicao, valor_alvo, agregacao) values ('00000000-0000-0000-0000-0000000e7a01', 'x', 'percentual', 100, 'soma')$q$), 'percentual só com agregação "ultimo"');
select pg_temp.check(pg_temp.bad($q$insert into public.goals (user_id, titulo, medicao, valor_alvo, agregacao) values ('00000000-0000-0000-0000-0000000e7a01', 'x', 'percentual', 50, 'ultimo')$q$), 'percentual com alvo diferente de 100 recusado');
select pg_temp.check(not pg_temp.bad($q$insert into public.goals (user_id, titulo, medicao, valor_alvo, agregacao) values ('00000000-0000-0000-0000-0000000e7a01', 'x', 'percentual', 100, 'ultimo')$q$), 'percentual 0 a 100 aceito');
select pg_temp.check(pg_temp.bad($q$insert into public.goals (user_id, titulo, medicao, unidade) values ('00000000-0000-0000-0000-0000000e7a01', 'x', 'marcos', 'km')$q$), 'unidade só em meta numérica');
select pg_temp.check(not pg_temp.bad($q$insert into public.goals (user_id, titulo, medicao) values ('00000000-0000-0000-0000-0000000e7a01', 'x', 'marcos'), ('00000000-0000-0000-0000-0000000e7a01', 'y', 'tarefas')$q$), 'metas por marcos e por tarefas não precisam de alvo');
select pg_temp.check(pg_temp.bad($q$insert into public.goals (user_id, titulo, medicao, categoria_nome) values ('00000000-0000-0000-0000-0000000e7a01', 'x', 'marcos', 'Minha')$q$), 'nome de categoria só quando é personalizada');
select pg_temp.check(not pg_temp.bad($q$insert into public.goals (user_id, titulo, medicao, categoria, categoria_nome) values ('00000000-0000-0000-0000-0000000e7a01', 'x', 'marcos', 'personalizada', 'Minha')$q$), 'categoria personalizada com nome aceita');
select pg_temp.check(pg_temp.bad($q$insert into public.goals (user_id, titulo, medicao, inicio, prazo) values ('00000000-0000-0000-0000-0000000e7a01', 'x', 'marcos', '2026-12-10', '2026-12-01')$q$), 'prazo antes do início recusado');
select pg_temp.check(pg_temp.bad($q$insert into public.goals (user_id, titulo, medicao, status) values ('00000000-0000-0000-0000-0000000e7a01', 'x', 'marcos', 'feita')$q$), 'status fora da lista recusado');
select pg_temp.check(pg_temp.bad($q$insert into public.goals (user_id, titulo, medicao, status) values ('00000000-0000-0000-0000-0000000e7a01', 'x', 'marcos', 'concluida')$q$), 'meta concluída exige a data de conclusão');
select pg_temp.check(not pg_temp.bad($q$insert into public.goals (user_id, titulo, medicao, status, concluida_em) values ('00000000-0000-0000-0000-0000000e7a01', 'x', 'marcos', 'concluida', now())$q$), 'meta concluída com data aceita');
select pg_temp.check(pg_temp.bad($q$insert into public.goals (user_id, titulo, medicao, valor_alvo) values ('00000000-0000-0000-0000-0000000e7a01', 'x', 'numerica', 2000000000)$q$), 'valor absurdo recusado');
select pg_temp.check(pg_temp.bad(format($q$insert into public.goal_progress (user_id, goal_id, valor, data, origem) values (%L, %L, 1, current_date, 'inventada')$q$, :'A', (select goal from ids where who = :'A'))), 'origem do registro fora de (manual, conversa, tarefa) recusada');
select pg_temp.check(pg_temp.bad(format($q$insert into public.goal_progress (user_id, goal_id, valor) values (%L, %L, 1)$q$, :'A', (select goal from ids where who = :'A'))), 'registro sem data recusado');
select pg_temp.check(pg_temp.bad(format($q$insert into public.goal_progress (user_id, goal_id, data) values (%L, %L, current_date)$q$, :'A', (select goal from ids where who = :'A'))), 'registro sem valor recusado');
select pg_temp.check(pg_temp.bad(format($q$insert into public.goal_progress (user_id, goal_id, valor, data, nota) values (%L, %L, 1, current_date, repeat('x', 201))$q$, :'A', (select goal from ids where who = :'A'))), 'nota do registro com mais de 200 caracteres recusada');
select pg_temp.check(pg_temp.bad($q$insert into public.goal_progress (user_id, goal_id, valor, data) values ('00000000-0000-0000-0000-0000000e7a01', gen_random_uuid(), 1, current_date)$q$), 'registro de meta inexistente recusado');
select pg_temp.check(not pg_temp.bad(format($q$insert into public.goal_progress (user_id, goal_id, valor, data, origem) values (%L, %L, 1, current_date, 'conversa'), (%L, %L, 1, current_date, 'tarefa')$q$, :'A', (select goal from ids where who = :'A'), :'A', (select goal from ids where who = :'A'))), 'origens válidas (conversa, tarefa) entram');
select pg_temp.check(pg_temp.bad(format($q$insert into public.goal_milestones (user_id, goal_id, titulo) values (%L, %L, '  ')$q$, :'A', (select goal from ids where who = :'A'))), 'marco com título em branco recusado');

-- ===== Fase 2: vínculo com projetos e blocos de agenda (migração 20261123170001) =============================
create temp table ids2 (who text primary key, proj bigint);
do $$
declare a uuid := '00000000-0000-0000-0000-0000000e7a01'; b uuid := '00000000-0000-0000-0000-0000000e7b01'; u uuid; pr bigint;
begin
  foreach u in array array[a, b] loop
    insert into public.projects (user_id, name) values (u, 'Projeto sintético') returning id into pr;
    insert into public.goal_projects (user_id, goal_id, project_id) select u, goal, pr from ids where who = u::text;
    insert into public.goal_events (user_id, goal_id, event_id, titulo, inicio, fim) select u, goal, 'evsintetico' || right(u::text, 2), 'Bloco sintético', now() + interval '1 day', now() + interval '1 day 1 hour' from ids where who = u::text;
    insert into ids2 values (u::text, pr);
  end loop;
end $$;
select pg_temp.check((select count(*) = 2 from pg_policies where schemaname = 'public' and permissive = 'RESTRICTIVE' and tablename = 'goal_projects')
  and (select count(*) = 2 from pg_policies where schemaname = 'public' and permissive = 'RESTRICTIVE' and tablename = 'goal_events'), 'goal_projects e goal_events têm as políticas restritivas do S-05');
select pg_temp.check(pg_temp.count_as('anon', null, 'select 1 from public.goal_projects') = 0 and pg_temp.count_as('anon', null, 'select 1 from public.goal_events') = 0, 'anon não lê vínculos de projeto nem de agenda');
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$insert into public.goal_projects (goal_id, project_id) values (%L, %L)$q$, (select goal from ids where who = :'B'), (select proj from ids2 where who = :'A'))) = 'ERRO:23503', 'B não liga a própria meta a projeto de A');
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$insert into public.goal_projects (goal_id, project_id) values (%L, %L)$q$, (select goal from ids where who = :'A'), (select proj from ids2 where who = :'B'))) = 'ERRO:23503', 'B não liga meta de A ao próprio projeto');
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$insert into public.goal_projects (user_id, goal_id, project_id) values (%L, %L, %L)$q$, :'A', (select goal from ids where who = :'A'), (select proj from ids2 where who = :'A'))) like 'ERRO:%', 'B não cria vínculo em nome de A');
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$delete from public.goal_projects where goal_id = %L$q$, (select goal from ids where who = :'A'))) = '0', 'B não desfaz vínculo de projeto de A');
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$insert into public.goal_events (goal_id, event_id, titulo, inicio, fim) values (%L, 'evinvasor1', 'x', now(), now() + interval '1 hour')$q$, (select goal from ids where who = :'A'))) = 'ERRO:23503', 'B não cria bloco de agenda na meta de A');
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$update public.goal_events set titulo = 'x' where goal_id = %L$q$, (select goal from ids where who = :'A'))) = '0', 'B não altera bloco de agenda de A');
select pg_temp.check(pg_temp.exec_as('authenticated', :'B', format($q$delete from public.goal_events where goal_id = %L$q$, (select goal from ids where who = :'A'))) = '0', 'B não apaga bloco de agenda de A');
select pg_temp.check(pg_temp.count_as('authenticated', :'B', format($q$select 1 from public.goal_events where goal_id = %L$q$, (select goal from ids where who = :'A'))) = 0, 'B não lê bloco de agenda de A');
select pg_temp.check(pg_temp.exec_as('authenticated', :'A', format($q$insert into public.goal_projects (goal_id, project_id) values (%L, %L)$q$, (select goal from ids where who = :'A'), (select proj from ids2 where who = :'A'))) = 'ERRO:23505', 'A não liga a mesma meta ao mesmo projeto duas vezes');
select pg_temp.check(pg_temp.exec_as('authenticated', :'A', format($q$insert into public.goal_events (goal_id, event_id, titulo, inicio, fim) values (%L, 'evdeA00001', 'Corrida', now() + interval '2 days', now() + interval '2 days 1 hour')$q$, (select goal from ids where who = :'A'))) = '1', 'A cria bloco de agenda na própria meta');
select pg_temp.check(pg_temp.bad($q$insert into public.goal_events (user_id, goal_id, event_id, titulo, inicio, fim) select user_id, goal, 'evfimantes1', 'x', now(), now() - interval '1 hour' from (select '00000000-0000-0000-0000-0000000e7a01'::uuid as user_id) u, ids where who = '00000000-0000-0000-0000-0000000e7a01'$q$), 'bloco que termina antes de começar é recusado');
select pg_temp.check(pg_temp.bad($q$insert into public.goal_events (user_id, goal_id, event_id, titulo, inicio, fim) select '00000000-0000-0000-0000-0000000e7a01', goal, 'evlongo0001', 'x', now(), now() + interval '25 hours' from ids where who = '00000000-0000-0000-0000-0000000e7a01'$q$), 'bloco com mais de 24 horas é recusado');
select pg_temp.check(pg_temp.bad($q$insert into public.goal_events (user_id, goal_id, event_id, titulo, inicio, fim) select '00000000-0000-0000-0000-0000000e7a01', goal, 'a b/c?', 'x', now(), now() + interval '1 hour' from ids where who = '00000000-0000-0000-0000-0000000e7a01'$q$), 'id de evento com caractere inválido é recusado');
select pg_temp.check(pg_temp.bad($q$insert into public.goal_events (user_id, goal_id, event_id, titulo, inicio, fim) select '00000000-0000-0000-0000-0000000e7a01', goal, 'evtitulo001', '  ', now(), now() + interval '1 hour' from ids where who = '00000000-0000-0000-0000-0000000e7a01'$q$), 'bloco com título em branco é recusado');
-- Cascatas da fase 2: apagar o projeto desfaz o vínculo (a meta fica); apagar a meta apaga os blocos.
delete from public.projects where id = (select proj from ids2 where who = :'A');
select pg_temp.check((select count(*) = 0 from public.goal_projects where user_id = :'A') and (select count(*) = 1 from public.goals where id = (select goal from ids where who = :'A')), 'apagar o projeto desfaz o vínculo e não apaga a meta');
select pg_temp.check((select count(*) = 2 from public.goal_events where user_id = :'A'), 'a meta de A tem 2 blocos de agenda antes da cascata');

-- ===== Cascatas =============================================================================================
select pg_temp.check((select count(*) from public.goal_progress where goal_id = (select goal from ids where who = :'A')) >= 1, 'A tem registros na meta');
delete from public.tasks where id = (select task from ids where who = :'A');
select pg_temp.check((select count(*) = 0 from public.goal_tasks where user_id = :'A' and task_id = (select task from ids where who = :'A')), 'apagar a tarefa desfaz o vínculo (e não apaga a meta)');
select pg_temp.check((select count(*) = 1 from public.goals where id = (select goal from ids where who = :'A')), 'a meta continua depois de a tarefa ser apagada');
delete from public.goals where id = (select goal from ids where who = :'A');
select pg_temp.check((select count(*) = 0 from public.goal_progress where goal_id = (select goal from ids where who = :'A'))
  and (select count(*) = 0 from public.goal_milestones where goal_id = (select goal from ids where who = :'A'))
  and (select count(*) = 0 from public.goal_events where user_id = :'A'), 'apagar a meta apaga registros, marcos e blocos de agenda dela (cascata)');
delete from auth.users where id = :'B';
select pg_temp.check((select count(*) = 0 from public.goals where user_id = :'B') and (select count(*) = 0 from public.goal_progress where user_id = :'B')
  and (select count(*) = 0 from public.goal_milestones where user_id = :'B') and (select count(*) = 0 from public.goal_tasks where user_id = :'B') and (select count(*) = 0 from public.goal_projects where user_id = :'B') and (select count(*) = 0 from public.goal_events where user_id = :'B'), 'apagar a pessoa apaga todos os dados de metas dela');

\echo 'metas: todos os testes SQL passaram'
