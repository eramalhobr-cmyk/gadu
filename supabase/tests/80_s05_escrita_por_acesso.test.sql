-- S-05 (resto), migração 20261123120001: quem não está ativo não grava pelas tabelas do cliente.
-- Prova: ativa grava; bloqueada não grava (insert, update, delete em 18 tabelas) mas ainda lê o que é dela; quem não
-- tem linha em members grava; outra pessoa não lê nem grava; cascata e servidor seguem funcionando; reminders não aceita
-- conversa de outra pessoa; o rollback documentado desfaz tudo. Dados sintéticos, Postgres local descartável.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000f6001', 'ativa@teste.local'),
  ('00000000-0000-0000-0000-0000000f6002', 'bloqueada@teste.local'),
  ('00000000-0000-0000-0000-0000000f6003', 'sem-linha@teste.local');   -- sem linha em members (entra pela lista do servidor)
insert into public.members (user_id, role, access) values
  ('00000000-0000-0000-0000-0000000f6001', 'member', 'active'),
  ('00000000-0000-0000-0000-0000000f6002', 'member', 'blocked');

create function pg_temp.check(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FALHOU: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

-- Executa um comando como authenticated e DESFAZ o efeito. 'GRAVOU' (linhas afetadas), '0 linhas' ou 'recusado <sqlstate>'.
create function pg_temp.exec_as(uid text, cmd text) returns text language plpgsql as $$
declare n int := 0; erro text;
begin
  perform set_config('request.jwt.claim.sub', uid, true);
  set local role authenticated;
  begin
    execute cmd; get diagnostics n = row_count;
    raise exception 'desfaz' using errcode = 'P0001';
  exception when others then
    if sqlstate <> 'P0001' or sqlerrm <> 'desfaz' then erro := sqlstate; end if;
  end;
  reset role;
  if erro is not null then return 'recusado ' || erro; end if;
  return case when n > 0 then 'GRAVOU' else '0 linhas' end;
end $$;

-- Uma consulta que devolve um valor, como authenticated (sem desfazer; só leitura).
create function pg_temp.val_as(role_name text, uid text, q text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), true);
  execute format('set local role %I', role_name);
  begin execute q into r; exception when others then execute 'reset role'; return 'ERRO:' || sqlstate; end;
  execute 'reset role';
  return coalesce(r, 'null');
end $$;

-- Linhas-pai de cada pessoa (n = 1 ativa, 2 bloqueada, 3 sem linha), criadas pelo superusuário.
create function pg_temp.seed(uid uuid, n int) returns void language plpgsql as $$
declare conv bigint := 7000 + n; goal uuid := ('00000000-0000-0000-0000-00000000990' || n)::uuid; item uuid := ('00000000-0000-0000-0000-00000000991' || n)::uuid;
begin
  insert into public.conversations (id, user_id, title) overriding system value values (conv, uid, 'c');
  insert into public.projects (id, user_id, name) overriding system value values (conv, uid, 'p');
  insert into public.agents (id, user_id, name) overriding system value values (conv, uid, 'a');
  insert into public.tasks (id, user_id, title) overriding system value values (conv, uid, 't');
  insert into public.memories (id, user_id, content) overriding system value values (conv, uid, 'm');
  insert into public.reminders (id, user_id, text, due_at) overriding system value values (conv, uid, 'r', now());
  insert into public.push_subscriptions (id, user_id, endpoint, p256dh, auth) overriding system value values (conv, uid, 'e' || n, 'k', 'a');
  insert into public.google_connections (user_id, refresh_token_enc) values (uid, 'x');
  insert into public.goals (id, user_id, titulo, medicao, valor_alvo) values (goal, uid, 'g', 'numerica', 10);
  insert into public.goal_progress (user_id, goal_id, valor, data) values (uid, goal, 1, current_date);
  insert into public.goal_milestones (user_id, goal_id, titulo) values (uid, goal, 'mm');
  insert into public.goal_tasks (user_id, goal_id, task_id) values (uid, goal, conv);
  insert into public.fin_itens (id, user_id, tipo, nome) values (item, uid, 'despesa', 'luz');
  insert into public.fin_item_meses (user_id, item_id, ano, mes, valor) values (uid, item, 2026, 11, 10);
  insert into public.fin_gastos (user_id, ano, mes, dia, valor) values (uid, 2026, 11, 1, 5);
  insert into public.fin_config (user_id) values (uid);
  insert into public.messages (conversation_id, user_id, role, content) values (conv, uid, 'user', 'hi');
  update public.profiles set display_name = 'p' where id = uid;
end $$;
select pg_temp.seed('00000000-0000-0000-0000-0000000f6001', 1);
select pg_temp.seed('00000000-0000-0000-0000-0000000f6002', 2);
select pg_temp.seed('00000000-0000-0000-0000-0000000f6003', 3);

\set A '00000000-0000-0000-0000-0000000f6001'
\set B '00000000-0000-0000-0000-0000000f6002'
\set C '00000000-0000-0000-0000-0000000f6003'

-- Comandos de escrita por tabela, para a pessoa de número :n (7000+n e os uuids acima). Cada tabela: insert, update, delete.
create function pg_temp.cmds(n int) returns table (tab text, ins text, upd text, del text) language sql as $f$
  select * from (values
   ('agents',            'insert into public.agents (name) values (''n'')', 'update public.agents set name=''z''', 'delete from public.agents where user_id = auth.uid()'),
   ('conversations',     'insert into public.conversations (title) values (''n'')', 'update public.conversations set title=''z''', 'delete from public.conversations where user_id = auth.uid()'),
   ('fin_config',        'insert into public.fin_config (user_id) values (auth.uid()) on conflict (user_id) do update set dia_restante=3', 'update public.fin_config set dia_restante=2', 'delete from public.fin_config where user_id = auth.uid()'),
   ('fin_gastos',        'insert into public.fin_gastos (ano,mes,dia,valor) values (2026,11,2,1)', 'update public.fin_gastos set valor=2', 'delete from public.fin_gastos where user_id = auth.uid()'),
   ('fin_item_meses',    'insert into public.fin_item_meses (item_id,ano,mes,valor) values (''00000000-0000-0000-0000-00000000991' || n || ''',2026,12,1)', 'update public.fin_item_meses set valor=2', 'delete from public.fin_item_meses where user_id = auth.uid()'),
   ('fin_itens',         'insert into public.fin_itens (tipo,nome) values (''despesa'',''n'')', 'update public.fin_itens set nome=''z''', 'delete from public.fin_itens where user_id = auth.uid()'),
   ('goal_milestones',   'insert into public.goal_milestones (goal_id,titulo) values (''00000000-0000-0000-0000-00000000990' || n || ''',''n'')', 'update public.goal_milestones set titulo=''z''', 'delete from public.goal_milestones where user_id = auth.uid()'),
   ('goal_progress',     'insert into public.goal_progress (goal_id,valor,data) values (''00000000-0000-0000-0000-00000000990' || n || ''',1,current_date)', 'update public.goal_progress set valor=2', 'delete from public.goal_progress where user_id = auth.uid()'),
   ('goal_tasks',        'insert into public.goal_tasks (goal_id, task_id) select ''00000000-0000-0000-0000-00000000990' || n || ''', id from public.tasks where user_id = auth.uid() and id <> ' || (7000 + n), 'update public.goal_tasks set created_at=now()', 'delete from public.goal_tasks where user_id = auth.uid()'),
   ('goals',             'insert into public.goals (titulo,medicao,valor_alvo) values (''n'',''numerica'',5)', 'update public.goals set titulo=''z''', 'delete from public.goals where user_id = auth.uid()'),
   ('google_connections','insert into public.google_connections (refresh_token_enc) values (''y'') on conflict (user_id) do update set google_email=''q@r.s''', 'update public.google_connections set google_email=''a@b.c''', 'delete from public.google_connections where user_id = auth.uid()'),
   ('memories',          'insert into public.memories (content) values (''n'')', 'update public.memories set content=''z''', 'delete from public.memories where user_id = auth.uid()'),
   ('messages',          'insert into public.messages (conversation_id,role,content) values (' || (7000 + n) || ',''user'',''n'')', 'update public.messages set content=''z''', 'delete from public.messages where user_id = auth.uid()'),
   ('profiles',          'insert into public.profiles (id) values (auth.uid())', 'update public.profiles set settings=''{"a":1}''::jsonb where id=auth.uid()', 'delete from public.profiles where id = auth.uid()'),
   ('projects',          'insert into public.projects (name) values (''n'')', 'update public.projects set name=''z''', 'delete from public.projects where user_id = auth.uid()'),
   ('push_subscriptions','insert into public.push_subscriptions (endpoint,p256dh,auth) values (''e-novo'',''k'',''a'')', 'update public.push_subscriptions set device=''d''', 'delete from public.push_subscriptions where user_id = auth.uid()'),
   ('reminders',         'insert into public.reminders (text,due_at) values (''n'',now())', 'update public.reminders set text=''z''', 'delete from public.reminders where user_id = auth.uid()'),
   ('tasks',             'insert into public.tasks (title) values (''n'')', 'update public.tasks set title=''z''', 'delete from public.tasks where user_id = auth.uid()')
  ) as t(tab, ins, upd, del)
$f$;

-- ===== Estrutura: 18 tabelas x 3 comandos + 2 de reminders; função só para quem deve ===========================
select pg_temp.check((select count(*) from pg_policies where schemaname = 'public' and permissive = 'RESTRICTIVE' and policyname like '%\_ativo\_%') = 54,
  '54 políticas restritivas de acesso (18 tabelas x insert, update, delete)');
select pg_temp.check((select count(*) from pg_policies where schemaname = 'public' and tablename = 'reminders' and policyname like 'reminders\_conversa\_propria\_%') = 2,
  'duas políticas restritivas de conversa própria em reminders');
select pg_temp.check(not has_function_privilege('anon', 'public.can_write()', 'EXECUTE'), 'anon não executa can_write');
select pg_temp.check(has_function_privilege('authenticated', 'public.can_write()', 'EXECUTE'), 'authenticated executa can_write');
select pg_temp.check(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'can_write' and not p.prosecdef),
  'can_write é SECURITY DEFINER');
select pg_temp.check((select array_to_string(proconfig, ',') from pg_proc where proname = 'can_write') = 'search_path=""', 'can_write com search_path fixo');
select pg_temp.check(pg_temp.val_as('authenticated', :'A', 'select public.can_write()') = 'true', 'can_write: ativa = true');
select pg_temp.check(pg_temp.val_as('authenticated', :'B', 'select public.can_write()') = 'false', 'can_write: bloqueada = false');
select pg_temp.check(pg_temp.val_as('authenticated', :'C', 'select public.can_write()') = 'true', 'can_write: sem linha em members = true (igual ao app)');
select pg_temp.check(pg_temp.val_as('authenticated', '', 'select public.can_write()') = 'false', 'can_write: sem sessão = false');
select pg_temp.check(pg_temp.val_as('anon', '', 'select public.can_write()') like 'ERRO:42501', 'anon recebe permissão negada em can_write');

-- ===== Ativa e sem linha gravam em todas as tabelas =============================================================
-- 18 tabelas x 3 comandos = 54. Por desenho, 4 não gravam: profiles (sem política de insert nem de delete), messages
-- (sem política de update) e o insert de goal_tasks deste teste (só há uma tarefa por pessoa). Sobram 50 que gravam.
do $$
declare r record; u text; n int; gravou int; recusados text;
begin
  foreach u in array array['00000000-0000-0000-0000-0000000f6001', '00000000-0000-0000-0000-0000000f6003'] loop
    n := case when u like '%6001' then 1 else 3 end;
    gravou := 0; recusados := '';
    for r in select * from pg_temp.cmds(n) loop
      if pg_temp.exec_as(u, r.ins) = 'GRAVOU' then gravou := gravou + 1; else recusados := recusados || r.tab || '.insert '; end if;
      if pg_temp.exec_as(u, r.upd) = 'GRAVOU' then gravou := gravou + 1; else recusados := recusados || r.tab || '.update '; end if;
      if pg_temp.exec_as(u, r.del) = 'GRAVOU' then gravou := gravou + 1; else recusados := recusados || r.tab || '.delete '; end if;
    end loop;
    if gravou <> 50 then raise exception 'FALHOU: % gravou em % de 54 comandos (esperado 50); sem gravar: %', u, gravou, recusados; end if;
    raise notice 'ok - % grava em 50 de 54 comandos (os 4 restantes não têm política por desenho: %)', case when n = 1 then 'ativa' else 'sem linha em members' end, trim(recusados);
  end loop;
end $$;

-- ===== Bloqueada não grava (insert, update, delete) mas lê o que é dela =========================================
do $$
declare r record; gravou int := 0; falhas text := ''; b text := '00000000-0000-0000-0000-0000000f6002';
begin
  for r in select * from pg_temp.cmds(2) loop
    if pg_temp.exec_as(b, r.ins) = 'GRAVOU' then gravou := gravou + 1; falhas := falhas || r.tab || '.insert '; end if;
    if pg_temp.exec_as(b, r.upd) = 'GRAVOU' then gravou := gravou + 1; falhas := falhas || r.tab || '.update '; end if;
    if pg_temp.exec_as(b, r.del) = 'GRAVOU' then gravou := gravou + 1; falhas := falhas || r.tab || '.delete '; end if;
  end loop;
  if gravou <> 0 then raise exception 'FALHOU: bloqueada ainda grava em % comandos: %', gravou, falhas; end if;
  raise notice 'ok - bloqueada grava em 0 dos 54 comandos (mesmos comandos que a ativa executa 50 vezes com sucesso)';
end $$;
select pg_temp.check(pg_temp.exec_as(:'B', $$insert into public.memories (content) values ('x')$$) like 'recusado 42501', 'bloqueada: insert recusado pela política (42501)');
select pg_temp.check(pg_temp.val_as('authenticated', :'B', $$select count(*) from public.memories where user_id = auth.uid()$$) = '1', 'bloqueada ainda lê a própria memória');
select pg_temp.check(pg_temp.val_as('authenticated', :'B', $$select count(*) from public.fin_gastos$$) = '1', 'bloqueada ainda lê o próprio financeiro');
select pg_temp.check(pg_temp.val_as('authenticated', :'B', $$select count(*) from public.tasks$$) = '1', 'bloqueada ainda lê as próprias tarefas');
-- Não consegue se desbloquear nem mudar o papel (continua sem política de escrita em members).
select pg_temp.check(pg_temp.exec_as(:'B', $$update public.members set access = 'active' where user_id = auth.uid()$$) = '0 linhas', 'bloqueada não se reativa');
select pg_temp.check(pg_temp.exec_as(:'B', $$update public.members set role = 'admin' where user_id = auth.uid()$$) = '0 linhas', 'bloqueada não vira admin');

-- ===== Outra pessoa não lê nem grava nos dados dela ============================================================
select pg_temp.check(pg_temp.val_as('authenticated', :'A', $$select count(*) from public.memories where user_id = '00000000-0000-0000-0000-0000000f6002'$$) = '0', 'A não lê memórias de B');
select pg_temp.check(pg_temp.exec_as(:'A', $$update public.tasks set title = 'invadida' where user_id = '00000000-0000-0000-0000-0000000f6002'$$) = '0 linhas', 'A não altera tarefas de B');
select pg_temp.check(pg_temp.exec_as(:'A', $$delete from public.goals where user_id = '00000000-0000-0000-0000-0000000f6002'$$) = '0 linhas', 'A não apaga metas de B');
select pg_temp.check(pg_temp.exec_as(:'A', $$insert into public.memories (user_id, content) values ('00000000-0000-0000-0000-0000000f6002', 'x')$$) like 'recusado 42501', 'A não insere em nome de B');
select pg_temp.check(pg_temp.exec_as(:'B', $$update public.tasks set title = 'invadida' where user_id = '00000000-0000-0000-0000-0000000f6001'$$) = '0 linhas', 'B (bloqueada) também não altera as de A');

-- ===== A-2: lembrete só aponta para conversa da própria pessoa ==================================================
select pg_temp.check(pg_temp.exec_as(:'A', $$insert into public.reminders (text, due_at, conversation_id) values ('x', now(), 7001)$$) = 'GRAVOU', 'lembrete com conversa própria entra');
select pg_temp.check(pg_temp.exec_as(:'A', $$insert into public.reminders (text, due_at) values ('x', now())$$) = 'GRAVOU', 'lembrete sem conversa entra');
select pg_temp.check(pg_temp.exec_as(:'A', $$insert into public.reminders (text, due_at, conversation_id) values ('x', now(), 7002)$$) like 'recusado 42501', 'lembrete com conversa de outra pessoa é recusado (antes entrava)');
select pg_temp.check(pg_temp.exec_as(:'A', $$insert into public.reminders (text, due_at, conversation_id) values ('x', now(), 987654)$$) like 'recusado 42501', 'conversa inexistente também dá 42501 (sem oráculo 23503)');
select pg_temp.check(pg_temp.exec_as(:'A', $$update public.reminders set conversation_id = 7002 where user_id = auth.uid()$$) like 'recusado 42501', 'trocar para conversa de outra pessoa é recusado');
select pg_temp.check(pg_temp.exec_as(:'A', $$update public.reminders set text = 'novo texto' where user_id = auth.uid()$$) = 'GRAVOU', 'editar o texto do lembrete segue funcionando');

-- ===== Cascata e servidor seguem funcionando ====================================================================
-- A ativa apaga a própria conversa: mensagens e vínculo seguem a cascata, lembretes ficam com conversation_id nulo.
insert into public.reminders (user_id, text, due_at, conversation_id) values ('00000000-0000-0000-0000-0000000f6001', 'liga', now(), 7001);
select set_config('request.jwt.claim.sub', :'A', false);
set role authenticated;
delete from public.conversations where id = 7001;
reset role;
select pg_temp.check((select count(*) from public.messages where conversation_id = 7001) = 0, 'cascata: apagar a conversa apaga as mensagens (ativa)');
select pg_temp.check((select count(*) from public.reminders where text = 'liga' and conversation_id is null) = 1, 'cascata: lembrete fica com conversation_id nulo (set null)');
-- Servidor (service_role) grava mesmo em nome de pessoa bloqueada (ex.: administração).
set role service_role;
insert into public.memories (user_id, content) values ('00000000-0000-0000-0000-0000000f6002', 'gravada pelo servidor');
reset role;
select pg_temp.check((select count(*) from public.memories where user_id = '00000000-0000-0000-0000-0000000f6002' and content = 'gravada pelo servidor') = 1, 'service_role grava para pessoa bloqueada (agendador, administração)');
-- Apagar a pessoa bloqueada (administração) leva os dados dela junto, mesmo com as políticas restritivas.
delete from auth.users where id = '00000000-0000-0000-0000-0000000f6002';
select pg_temp.check((select count(*) from public.memories where user_id = '00000000-0000-0000-0000-0000000f6002') = 0, 'apagar a pessoa bloqueada apaga os dados dela (cascata do dono)');

-- ===== Desbloquear devolve a escrita ============================================================================
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000f6004', 'volta@teste.local');
insert into public.members (user_id, role, access) values ('00000000-0000-0000-0000-0000000f6004', 'member', 'blocked');
select pg_temp.check(pg_temp.exec_as('00000000-0000-0000-0000-0000000f6004', $$insert into public.memories (content) values ('x')$$) like 'recusado 42501', 'bloqueada recém-criada: não grava');
update public.members set access = 'active' where user_id = '00000000-0000-0000-0000-0000000f6004';
select pg_temp.check(pg_temp.exec_as('00000000-0000-0000-0000-0000000f6004', $$insert into public.memories (content) values ('x')$$) = 'GRAVOU', 'depois de reativada, grava na hora');

-- ===== Rollback documentado: desfaz tudo e a pessoa bloqueada volta a gravar (dentro de uma transação desfeita) ===
begin;
do $$ declare t text; begin
  foreach t in array array['agents','conversations','fin_config','fin_gastos','fin_item_meses','fin_itens','goal_milestones','goal_progress','goal_tasks','goals','google_connections','memories','messages','profiles','projects','push_subscriptions','reminders','tasks'] loop
    execute format('drop policy if exists %I on public.%I', t || '_ativo_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_ativo_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_ativo_delete', t);
  end loop;
end $$;
drop policy if exists reminders_conversa_propria_insert on public.reminders;
drop policy if exists reminders_conversa_propria_update on public.reminders;
drop function if exists public.can_write();
select pg_temp.check((select count(*) from pg_policies where permissive = 'RESTRICTIVE' and schemaname = 'public') = 0, 'rollback: nenhuma política restritiva sobra');
select pg_temp.check((select count(*) from pg_proc where proname = 'can_write') = 0, 'rollback: can_write removida');
update public.members set access = 'blocked' where user_id = '00000000-0000-0000-0000-0000000f6004';
select pg_temp.check(pg_temp.exec_as('00000000-0000-0000-0000-0000000f6004', $$insert into public.memories (content) values ('x')$$) = 'GRAVOU', 'rollback: o comportamento anterior volta (bloqueada grava de novo, S-05 aberto)');
rollback;
select pg_temp.check((select count(*) from pg_policies where permissive = 'RESTRICTIVE' and schemaname = 'public') = 56, 'depois do rollback de teste, as 56 políticas continuam (transação desfeita)');

\echo 's05: todos os testes SQL passaram'
