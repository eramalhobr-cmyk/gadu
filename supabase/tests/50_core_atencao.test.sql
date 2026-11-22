-- Core "O que merece minha atenção hoje?": as consultas EXATAS do Core (src/lib/core/sources/*.ts e google-adapter.ts),
-- executadas como a pessoa B, devolvem só itens de B; como A, só de A; sem sessão (anon), nada.
-- O Core usa o cliente com a sessão da pessoa (papel authenticated, RLS). Dados sintéticos, Postgres local descartável.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c0a1', 'core-a@teste.local'),
  ('00000000-0000-0000-0000-00000000c0b1', 'core-b@teste.local');

create function pg_temp.check(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FALHOU: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

-- Roda uma consulta como papel/pessoa e devolve o resultado como texto (títulos concatenados, ordenados).
create function pg_temp.as_text(role_name text, uid text, q text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), true);
  execute format('set local role %I', role_name);
  begin
    execute q into r;
  exception when insufficient_privilege then r := 'SEM-PERMISSAO';
  end;
  execute 'reset role';
  return coalesce(r, '');
end $$;

-- Dados de A e de B (criados como administrador do banco; só para preparar). Hoje fixo: 2026-11-22.
do $$
declare a uuid := '00000000-0000-0000-0000-00000000c0a1'; b uuid := '00000000-0000-0000-0000-00000000c0b1';
  pa bigint; pb bigint;
begin
  insert into public.profiles (id, display_name, settings) values (a, 'A', '{"blocked":["segredo-a"]}'), (b, 'B', '{"blocked":["segredo-b"]}') on conflict (id) do update set settings = excluded.settings;
  insert into public.projects (user_id, name) values (a, 'proj-A') returning id into pa;
  insert into public.projects (user_id, name) values (b, 'proj-B') returning id into pb;
  insert into public.tasks (user_id, title, status, priority, due_date, project_id) values
    (a, 'a-atrasada', 'open', 2, '2026-11-10', pa), (a, 'a-hoje', 'open', 2, '2026-11-22', pa), (a, 'a-alta-sem-prazo', 'open', 1, null, null),
    (a, 'a-futura', 'open', 2, '2026-12-30', null), (a, 'a-feita', 'done', 1, '2026-11-01', null),
    (b, 'b-atrasada', 'open', 2, '2026-11-05', pb), (b, 'b-hoje', 'open', 2, '2026-11-22', pb), (b, 'b-alta-sem-prazo', 'open', 1, null, null),
    (b, 'b-futura', 'open', 3, '2026-12-31', null), (b, 'b-cancelada', 'cancelled', 1, '2026-11-02', null),
    -- vínculo cruzado tentado como administrador: B com tarefa apontando para o projeto de A (o FK permite; a RLS esconde o nome)
    (b, 'b-com-projeto-de-a', 'open', 2, '2026-11-20', pa);
  insert into public.reminders (user_id, text, due_at, status) values
    (a, 'a-lembrete', '2026-11-22 21:00+00', 'pending'), (a, 'a-lembrete-feito', '2026-11-22 20:00+00', 'done'),
    (b, 'b-lembrete', '2026-11-22 22:00+00', 'pending'), (b, 'b-lembrete-enviado', '2026-11-22 12:00+00', 'sent');
  insert into public.google_connections (user_id, scopes, refresh_token_enc) values
    (a, 'openid https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/gmail.readonly', 'x'),
    (b, 'openid https://www.googleapis.com/auth/calendar.readonly', 'y');
end $$;

\set A '00000000-0000-0000-0000-00000000c0a1'
\set B '00000000-0000-0000-0000-00000000c0b1'

-- Consulta de tarefas do Core (tasksQuery): user_id da sessão, abertas, vencidas/hoje ou prioridade alta sem prazo,
-- com o nome do projeto embutido (projects(name), que também passa pela RLS), ordenadas, limite 15.
create function pg_temp.q_tasks(uid text) returns text language sql as $$
  select 'select string_agg(title || coalesce(''@'' || pname, ''''), '','' order by due_date nulls last, priority, title) from ('
    || 'select t.title, t.priority, t.due_date, p.name as pname from public.tasks t left join public.projects p on p.id = t.project_id '
    || 'where t.user_id = ''' || uid || ''' and t.status = ''open'' and (t.due_date <= ''2026-11-22'' or (t.priority = 1 and t.due_date is null)) '
    || 'order by t.due_date nulls last, t.priority limit 15) x'
$$;
-- A mesma, SEM o filtro por user_id: prova que a RLS sozinha já isola (defesa em profundidade do Core).
create function pg_temp.q_tasks_rls_only() returns text language sql as $$
  select 'select string_agg(title || coalesce(''@'' || pname, ''''), '','' order by due_date nulls last, priority, title) from ('
    || 'select t.title, t.priority, t.due_date, p.name as pname from public.tasks t left join public.projects p on p.id = t.project_id '
    || 'where t.status = ''open'' and (t.due_date <= ''2026-11-22'' or (t.priority = 1 and t.due_date is null)) '
    || 'order by t.due_date nulls last, t.priority limit 15) x'
$$;
create function pg_temp.q_reminders(uid text) returns text language sql as $$
  select 'select string_agg(text, '','' order by due_at) from (select text, due_at from public.reminders '
    || 'where user_id = ''' || uid || ''' and status = ''pending'' and due_at >= ''2026-11-20 15:00+00'' and due_at < ''2026-11-23 03:00+00'' order by due_at limit 10) x'
$$;
create function pg_temp.q_reminders_rls_only() returns text language sql as $$
  select 'select string_agg(text, '','' order by due_at) from (select text, due_at from public.reminders '
    || 'where status = ''pending'' and due_at >= ''2026-11-20 15:00+00'' and due_at < ''2026-11-23 03:00+00'' order by due_at limit 10) x'
$$;

-- Como B
select pg_temp.check(pg_temp.as_text('authenticated', :'B', pg_temp.q_tasks(:'B')) = 'b-atrasada@proj-B,b-com-projeto-de-a,b-hoje@proj-B,b-alta-sem-prazo',
  'B: tarefas do Core devolvem só itens de B (projeto de A não vaza o nome: b-com-projeto-de-a sem projeto)');
select pg_temp.check(pg_temp.as_text('authenticated', :'B', pg_temp.q_tasks_rls_only()) = pg_temp.as_text('authenticated', :'B', pg_temp.q_tasks(:'B')),
  'B: sem o filtro por user_id a RLS sozinha devolve o mesmo (só B)');
select pg_temp.check(pg_temp.as_text('authenticated', :'B', pg_temp.q_tasks(:'A')) = '',
  'B pedindo o user_id de A (consulta adulterada): nada');
select pg_temp.check(pg_temp.as_text('authenticated', :'B', pg_temp.q_reminders(:'B')) = 'b-lembrete',
  'B: lembretes do Core devolvem só os de B (pendentes)');
select pg_temp.check(pg_temp.as_text('authenticated', :'B', pg_temp.q_reminders_rls_only()) = 'b-lembrete', 'B: lembretes só por RLS');
select pg_temp.check(pg_temp.as_text('authenticated', :'B', pg_temp.q_reminders(:'A')) = '', 'B pedindo lembretes de A: nada');
-- Conexão Google (status/escopos do adaptador): B enxerga só a própria (sem Gmail); A não vaza.
select pg_temp.check(pg_temp.as_text('authenticated', :'B', 'select string_agg(scopes, ''|'') from public.google_connections') = 'openid https://www.googleapis.com/auth/calendar.readonly',
  'B: status do Google só da própria conexão (sem escopo do Gmail)');
select pg_temp.check(pg_temp.as_text('authenticated', :'B', 'select settings->>''blocked'' from public.profiles') = '["segredo-b"]',
  'B: termos bloqueados lidos só do próprio perfil');

-- Como A
select pg_temp.check(pg_temp.as_text('authenticated', :'A', pg_temp.q_tasks(:'A')) = 'a-atrasada@proj-A,a-hoje@proj-A,a-alta-sem-prazo',
  'A: tarefas do Core devolvem só itens de A, sem a futura e sem a feita');
select pg_temp.check(pg_temp.as_text('authenticated', :'A', pg_temp.q_tasks_rls_only()) = pg_temp.as_text('authenticated', :'A', pg_temp.q_tasks(:'A')), 'A: só por RLS igual');
select pg_temp.check(pg_temp.as_text('authenticated', :'A', pg_temp.q_reminders(:'A')) = 'a-lembrete', 'A: lembretes do Core só de A');
select pg_temp.check(pg_temp.as_text('authenticated', :'A', 'select count(*) from public.google_connections')::int = 1
  and pg_temp.as_text('authenticated', :'A', 'select scopes like ''%gmail.readonly%'' from public.google_connections') = 'true', 'A: vê o próprio escopo do Gmail');

-- Sem sessão (anon): nada, nem permissão.
select pg_temp.check(pg_temp.as_text('anon', '', pg_temp.q_tasks(:'A')) in ('', 'SEM-PERMISSAO'), 'anon: tarefas de A inacessíveis');
select pg_temp.check(pg_temp.as_text('anon', '', pg_temp.q_reminders(:'B')) in ('', 'SEM-PERMISSAO'), 'anon: lembretes de B inacessíveis');

-- O Core não precisa de privilégio de escrita: a sessão da pessoa não altera tarefas alheias (leitura apenas no Core).
select pg_temp.check(pg_temp.as_text('authenticated', :'B', 'with u as (update public.tasks set title = ''x'' where title = ''a-hoje'' returning 1) select count(*) from u')::int = 0, 'B não altera tarefa de A');
