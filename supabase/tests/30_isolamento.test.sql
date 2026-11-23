-- Isolamento entre pessoas em TODAS as tabelas públicas (dados sintéticos, Postgres local descartável).
-- Para cada tabela: A lê o que é seu; B não lê, não altera, não apaga e não insere em nome de A; anon não lê nada.
-- Também: vínculos cruzados (tarefa em projeto alheio, mensagem em conversa alheia, conversa com projeto alheio),
-- busca por significado só nos próprios itens, e papéis que a pessoa não pode mudar sozinha.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000aaa1', 'iso-a@teste.local'),
  ('00000000-0000-0000-0000-00000000bbb1', 'iso-b@teste.local');

create function pg_temp.check(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FALHOU: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

-- Conta linhas visíveis para um papel/pessoa.
create function pg_temp.count_as(role_name text, uid text, q text) returns bigint language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), true);
  execute format('set local role %I', role_name);
  begin
    execute 'select count(*) from (' || q || ') x' into n;
  exception when insufficient_privilege then n := 0;  -- sem permissão = não vê nada
  end;
  execute 'reset role';
  return n;
end $$;

-- Executa um comando como pessoa; devolve linhas afetadas, ou -1 se o banco recusou (RLS, permissão ou regra).
create function pg_temp.exec_as(uid text, cmd text) returns integer language plpgsql as $$
declare n integer;
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), true);
  execute 'set local role authenticated';
  begin
    execute cmd;
    get diagnostics n = row_count;
  exception when insufficient_privilege or check_violation or raise_exception or foreign_key_violation or not_null_violation then
    n := -1;
  end;
  execute 'reset role';
  return n;
end $$;

\set A '00000000-0000-0000-0000-00000000aaa1'
\set B '00000000-0000-0000-0000-00000000bbb1'

-- Dados sintéticos de A e de B, criados como administrador do banco (ignora RLS só para preparar).
do $$
declare a uuid := '00000000-0000-0000-0000-00000000aaa1'; b uuid := '00000000-0000-0000-0000-00000000bbb1'; u uuid;
  v extensions.vector;
begin
  v := array_fill(0.01::real, array[1536])::extensions.vector;
  insert into public.profiles (id, display_name) values (a, 'A'), (b, 'B') on conflict (id) do nothing;
  foreach u in array array[a, b] loop
    insert into public.projects (user_id, name) values (u, 'projeto sintético');
    insert into public.agents (user_id, name) values (u, 'agente sintético');
    insert into public.conversations (user_id, title) values (u, 'conversa sintética');
    insert into public.messages (conversation_id, user_id, role, content) select id, u, 'user', 'mensagem sintética' from public.conversations where user_id = u;
    insert into public.memories (user_id, content) values (u, 'memória sintética');
    insert into public.tasks (user_id, title) values (u, 'tarefa sintética');
    insert into public.reminders (user_id, text, due_at) values (u, 'lembrete sintético', now() + interval '1 day');
    insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (u, 'https://push.example.test/' || u, 'p', 'a');
    insert into public.google_connections (user_id, refresh_token_enc) values (u, 'cifrado-sintetico');
    insert into public.usage_events (user_id, provider, model, cost_usd) values (u, 'gemini', 'teste', 0.01);
    insert into public.usage_daily (user_id, messages) values (u, 1);
    insert into public.daily_briefings (user_id, day) values (u, current_date);
    insert into public.daily_pushes (user_id, day, kind) values (u, current_date, 'evening');
    insert into public.members (user_id, role, access) values (u, 'member', 'active') on conflict (user_id) do nothing;
    insert into public.invites (created_by, email, token_hash, expires_at) values (u, u || '@convite.test', md5(u::text) || md5(u::text || 'x'), now() + interval '7 days');
    insert into public.search_index (user_id, kind, ref_id, content, embedding) values (u, 'memory', 1, 'índice sintético', v);
    insert into public.ai_reservations (user_id, kind, amount_usd, expires_at) values (u, 'chat', 0.05, now() + interval '10 minutes');
    -- Finanças (sintético, sem valor real)
    insert into public.fin_itens (user_id, tipo, nome) values (u, 'despesa', 'conta sintética');
    insert into public.fin_item_meses (user_id, item_id, ano, mes, valor) select u, id, 2026, 11, 1.00 from public.fin_itens where user_id = u;
    insert into public.fin_gastos (user_id, ano, mes, dia, valor) values (u, 2026, 11, 5, 1.00);
    insert into public.fin_config (user_id) values (u);
    insert into public.fin_tetos (user_id, categoria, valor) values (u, 'Mercado', 800);
    insert into public.insight_respostas (user_id, dia, tipo, decisao) values (u, current_date, 'atrasadas', 'ignorada');
    -- Metas (sintético)
    insert into public.goals (user_id, titulo, medicao, valor_alvo) values (u, 'meta sintética', 'numerica', 10);
    insert into public.goal_progress (user_id, goal_id, valor, data) select u, id, 1, current_date from public.goals where user_id = u;
    insert into public.goal_milestones (user_id, goal_id, titulo) select u, id, 'marco sintético' from public.goals where user_id = u;
    insert into public.goal_tasks (user_id, goal_id, task_id) select u, g.id, (select t.id from public.tasks t where t.user_id = u limit 1) from public.goals g where g.user_id = u;
    insert into public.goal_projects (user_id, goal_id, project_id) select u, g.id, (select p.id from public.projects p where p.user_id = u limit 1) from public.goals g where g.user_id = u;
    insert into public.goal_events (user_id, goal_id, event_id, titulo, inicio, fim) select u, g.id, 'evsintetico1', 'Bloco sintético', now() + interval '1 day', now() + interval '1 day 1 hour' from public.goals g where g.user_id = u;
    -- Telemetria de erros (sintético, sem texto de mensagem)
    insert into public.error_events (user_id, origem, rota, nome, impressao) values (u, 'cliente', '/app', 'Erro sintético', md5(u::text) || md5('x'));
    -- 3D Studio (sintético)
    insert into public.pecas_3d (user_id, titulo, pedido) values (u, 'peça sintética', 'cubo de 10 mm');
    insert into public.pecas_3d_versoes (user_id, peca_id, modo, scad) select u, id, 'novo', 'cube(10);' from public.pecas_3d where user_id = u;
  end loop;
end $$;

-- Tabela, coluna dona, comando de alteração inofensivo e um insert em nome de A feito por B.
create temp table iso_cases (t text, owner text, upd text, ins_as_a text);
insert into iso_cases values
  ('profiles',           'id',         'display_name = ''x''', null),
  ('projects',           'user_id',    'name = ''x''',        'insert into public.projects (user_id, name) values (%L, ''x'')'),
  ('agents',             'user_id',    'name = ''x''',        'insert into public.agents (user_id, name) values (%L, ''x'')'),
  ('conversations',      'user_id',    'title = ''x''',       'insert into public.conversations (user_id, title) values (%L, ''x'')'),
  ('messages',           'user_id',    'content = ''x''',     null),
  ('memories',           'user_id',    'content = ''x''',     'insert into public.memories (user_id, content) values (%L, ''x'')'),
  ('tasks',              'user_id',    'title = ''x''',       'insert into public.tasks (user_id, title) values (%L, ''x'')'),
  ('reminders',          'user_id',    'text = ''x''',        'insert into public.reminders (user_id, text, due_at) values (%L, ''x'', now() + interval ''1 day'')'),
  ('push_subscriptions', 'user_id',    'device = ''x''',      'insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (%L, ''https://x.test'', ''p'', ''a'')'),
  ('google_connections', 'user_id',    'google_email = ''x''', 'insert into public.google_connections (user_id, refresh_token_enc) values (%L, ''x'')'),
  ('usage_events',       'user_id',    'cost_usd = 0',        'insert into public.usage_events (user_id, provider, model, cost_usd) values (%L, ''gemini'', ''x'', 0)'),
  ('usage_daily',        'user_id',    'messages = 0',        'insert into public.usage_daily (user_id, day, messages) values (%L, current_date - 1, 0)'),
  ('daily_briefings',    'user_id',    'sent_at = now()',     'insert into public.daily_briefings (user_id, day) values (%L, current_date - 1)'),
  ('daily_pushes',       'user_id',    'sent_at = now()',     'insert into public.daily_pushes (user_id, day, kind) values (%L, current_date - 1, ''evening'')'),
  ('members',            'user_id',    'role = ''admin''',    'insert into public.members (user_id, role) values (%L, ''admin'')'),
  ('invites',            'created_by', 'name = ''x''',        'insert into public.invites (created_by, email, token_hash, expires_at) values (%L, ''x@x.test'', ''x'', now())'),
  ('search_index',       'user_id',    'content = ''x''',     null),
  ('ai_reservations',    'user_id',    'status = ''released''', 'insert into public.ai_reservations (user_id, kind, amount_usd, expires_at) values (%L, ''chat'', 0.01, now())'),
  ('fin_itens',          'user_id',    'nome = ''x''',        'insert into public.fin_itens (user_id, tipo, nome) values (%L, ''despesa'', ''x'')'),
  ('fin_item_meses',     'user_id',    'valor = 2',           'insert into public.fin_item_meses (user_id, item_id, ano, mes, valor) values (%1$L, (select id from public.fin_itens where user_id = %1$L limit 1), 2026, 12, 1)'),
  ('fin_gastos',         'user_id',    'valor = 2',           'insert into public.fin_gastos (user_id, ano, mes, dia, valor) values (%L, 2026, 11, 6, 1)'),
  ('insight_respostas',  'user_id',    'decisao = ''aceita''', 'insert into public.insight_respostas (user_id, dia, tipo, decisao) values (%L, current_date, ''email'', ''ignorada'')'),
  ('fin_tetos',          'user_id',    'valor = 1',           'insert into public.fin_tetos (user_id, categoria, valor) values (%L, ''Lazer'', 1)'),
  ('fin_config',         'user_id',    'dia_restante = 5',    'insert into public.fin_config (user_id) values (%L)'),
  ('goals',              'user_id',    'titulo = ''x''',      'insert into public.goals (user_id, titulo, medicao, valor_alvo) values (%L, ''x'', ''numerica'', 5)'),
  ('goal_progress',      'user_id',    'valor = 2',           'insert into public.goal_progress (user_id, goal_id, valor, data) values (%1$L, (select id from public.goals where user_id = %1$L limit 1), 1, current_date)'),
  ('goal_milestones',    'user_id',    'titulo = ''x''',      'insert into public.goal_milestones (user_id, goal_id, titulo) values (%1$L, (select id from public.goals where user_id = %1$L limit 1), ''x'')'),
  ('error_events',       'user_id',    'status = 500',        'insert into public.error_events (user_id, origem, rota, nome, impressao) values (%L, ''cliente'', ''/app'', ''x'', repeat(''a'', 16))'),
  ('pecas_3d',           'user_id',    'titulo = ''x''',      'insert into public.pecas_3d (user_id, titulo, pedido) values (%L, ''x'', ''x'')'),
  ('pecas_3d_versoes',   'user_id',    'scad = ''cube(1);''', 'insert into public.pecas_3d_versoes (user_id, peca_id, modo, scad) values (%1$L, (select id from public.pecas_3d where user_id = %1$L limit 1), ''novo'', ''cube(1);'')'),
  ('goal_tasks',         'user_id',    'created_at = now()',  'insert into public.goal_tasks (user_id, goal_id, task_id) values (%1$L, (select id from public.goals where user_id = %1$L limit 1), (select id from public.tasks where user_id = %1$L limit 1))'),
  ('goal_projects',      'user_id',    'created_at = now()',  'insert into public.goal_projects (user_id, goal_id, project_id) values (%1$L, (select id from public.goals where user_id = %1$L limit 1), (select id from public.projects where user_id = %1$L limit 1))'),
  ('goal_events',        'user_id',    'titulo = ''x''',      'insert into public.goal_events (user_id, goal_id, event_id, titulo, inicio, fim) values (%1$L, (select id from public.goals where user_id = %1$L limit 1), ''evoutro01'', ''x'', now(), now() + interval ''1 hour'')');

do $$
declare c record; a text := '00000000-0000-0000-0000-00000000aaa1'; b text := '00000000-0000-0000-0000-00000000bbb1';
  own bigint; seen bigint; n integer; total integer := 0;
begin
  for c in select * from iso_cases loop
    execute format('select count(*) from public.%I where %I = %L', c.t, c.owner, a) into own;
    perform pg_temp.check(own > 0, format('%s: há dados sintéticos de A', c.t));
    -- error_events é só do administrador: a própria pessoa comum também não lê (0), diferente das demais tabelas.
    perform pg_temp.check(pg_temp.count_as('authenticated', a, format('select 1 from public.%I where %I = %L', c.t, c.owner, a)) = case when c.t = 'error_events' then 0 else own end, format('%s: A lê as próprias linhas (ou nada, se for só do administrador)', c.t));
    perform pg_temp.check(pg_temp.count_as('authenticated', b, format('select 1 from public.%I where %I = %L', c.t, c.owner, a)) = 0, format('%s: B não lê linhas de A', c.t));
    perform pg_temp.check(pg_temp.count_as('anon', null, format('select 1 from public.%I', c.t)) = 0, format('%s: sem login não lê nada', c.t));
    n := pg_temp.exec_as(b, format('update public.%I set %s where %I = %L', c.t, c.upd, c.owner, a));
    perform pg_temp.check(n <= 0, format('%s: B não altera linhas de A (resultado %s)', c.t, n));
    n := pg_temp.exec_as(b, format('delete from public.%I where %I = %L', c.t, c.owner, a));
    perform pg_temp.check(n <= 0, format('%s: B não apaga linhas de A (resultado %s)', c.t, n));
    if c.ins_as_a is not null then
      n := pg_temp.exec_as(b, format(c.ins_as_a, a));
      perform pg_temp.check(n = -1, format('%s: B não insere em nome de A', c.t));
    end if;
    execute format('select count(*) from public.%I where %I = %L', c.t, c.owner, a) into seen;
    perform pg_temp.check(seen = own, format('%s: linhas de A intactas depois das tentativas de B', c.t));
    total := total + 1;
  end loop;
  raise notice 'ok - % tabelas verificadas', total;
end $$;

-- A suíte cobre TODAS as tabelas do schema public: tabela nova sem caso aqui faz o teste falhar.
select pg_temp.check(not exists (select 1 from pg_tables t where t.schemaname = 'public' and t.tablename not in (select c.t from iso_cases c)),
  'toda tabela do schema public está na suíte de isolamento');
select pg_temp.check((select count(*) from pg_tables t where t.schemaname = 'public') = (select count(*) from iso_cases), 'a suíte não lista tabela que não existe');
select pg_temp.check((select count(*) from pg_tables t where t.schemaname = 'public' and t.tablename like 'fin\_%' and t.rowsecurity) = 5, 'as 5 tabelas fin_* existem e têm RLS ligado');
select pg_temp.check((select count(*) from pg_tables t where t.schemaname = 'public' and t.tablename like 'goal%' and t.rowsecurity) = 6, 'as 6 tabelas de metas existem e têm RLS ligado');

-- Vínculos cruzados: B não usa um projeto, conversa ou agente de A nos próprios registros.
select pg_temp.check(pg_temp.exec_as(:'B', format('insert into public.tasks (title, project_id) values (''x'', %s)', (select id from public.projects where user_id = :'A' limit 1))) = -1, 'tasks: B não cria tarefa dentro de projeto de A');
select pg_temp.check(pg_temp.exec_as(:'B', format('insert into public.messages (conversation_id, role, content) values (%s, ''user'', ''x'')', (select id from public.conversations where user_id = :'A' limit 1))) = -1, 'messages: B não escreve em conversa de A');
select pg_temp.check(pg_temp.exec_as(:'B', format('insert into public.conversations (title, project_id) values (''x'', %s)', (select id from public.projects where user_id = :'A' limit 1))) = -1, 'conversations: B não liga conversa a projeto de A');
select pg_temp.check(pg_temp.exec_as(:'B', format('insert into public.conversations (title, agent_id) values (''x'', %s)', (select id from public.agents where user_id = :'A' limit 1))) = -1, 'conversations: B não liga conversa a agente de A');
select pg_temp.check(pg_temp.exec_as(:'B', format('update public.tasks set project_id = %s where user_id = %L', (select id from public.projects where user_id = :'A' limit 1), :'B')) = -1, 'tasks: B não move a própria tarefa para projeto de A');

-- Papel e acesso: a pessoa não se promove nem se libera sozinha.
select pg_temp.check(pg_temp.exec_as(:'B', format('update public.members set role = ''admin'', access = ''active'' where user_id = %L', :'B')) <= 0, 'members: B não muda o próprio papel nem o próprio acesso');
select pg_temp.check((select role from public.members where user_id = :'B') = 'member', 'members: papel de B continua member');

-- Busca por significado: só devolve itens da própria pessoa.
select pg_temp.check(pg_temp.count_as('authenticated', :'B', 'select * from public.search_similar(array_fill(0.01::real, array[1536])::extensions.vector, 50, null)') = 1, 'search_similar: B só encontra o próprio item');
select pg_temp.check(pg_temp.count_as('anon', null, 'select * from public.search_similar(array_fill(0.01::real, array[1536])::extensions.vector, 50, null)') = 0, 'search_similar: sem login não encontra nada');

-- Funções do agendador não são chamáveis por quem está logado.
select pg_temp.check(pg_temp.exec_as(:'B', 'select public.index_backlog(10)') = -1, 'index_backlog: só o agendador');
select pg_temp.check(pg_temp.exec_as(:'B', 'select public.expire_ai_reservations()') = -1, 'expire_ai_reservations: só o agendador');

-- Limpeza: os dados sintéticos não podem interferir nos testes seguintes (teto global soma reservas e consumo).
delete from public.ai_reservations where user_id in (:'A', :'B');
delete from public.usage_events where user_id in (:'A', :'B');

\echo 'isolamento: todos os testes SQL passaram'
