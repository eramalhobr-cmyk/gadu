-- Segurança P1 (migrações 20261122120001 e 20261122120002): prova que S-01, S-03, S-04, S-05 (funções de custo),
-- S-07, S-10 e S-12 estão fechados. Dados sintéticos, Postgres local descartável.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000e4001', 'p1@teste.local'),   -- ativa
  ('00000000-0000-0000-0000-0000000e4002', 'p2@teste.local'),   -- bloqueada
  ('00000000-0000-0000-0000-0000000e4003', 'p3@teste.local');   -- sem linha em members (entra pela lista do servidor)
insert into public.members (user_id, role, access) values
  ('00000000-0000-0000-0000-0000000e4001', 'member', 'active'),
  ('00000000-0000-0000-0000-0000000e4002', 'member', 'blocked')
  on conflict (user_id) do update set access = excluded.access;
update private.budget_policy set monthly_limit_usd = 5.00, min_reserve_usd = 0.01, max_reserve_usd = 1.00, global_monthly_limit_usd = null;
update private.quota_policy set daily_limit = 50;

create function pg_temp.check(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FALHOU: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

-- Executa uma consulta que devolve UM valor, como um papel. Erro vira 'ERRO:<sqlstate>' (42501 = sem permissão).
create function pg_temp.try_as(role_name text, uid text, q text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), true);
  execute format('set local role %I', role_name);
  begin
    execute q into r;
  exception when others then
    execute 'reset role';
    return 'ERRO:' || sqlstate;
  end;
  execute 'reset role';
  return coalesce(r, 'null');
end $$;
-- Executa um comando (insert/update/delete) como um papel. Devolve linhas afetadas ou 'ERRO:<sqlstate>'.
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

\set P1 '00000000-0000-0000-0000-0000000e4001'
\set P2 '00000000-0000-0000-0000-0000000e4002'
\set P3 '00000000-0000-0000-0000-0000000e4003'

-- ===== S-01: orçamento só pelo servidor =====================================================================
select pg_temp.check(
  not has_function_privilege('authenticated', 'public.reserve_ai_budget(text, numeric)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.settle_ai_budget(uuid, text, text, integer, integer, numeric)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.release_ai_budget(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.reserve_ai_budget(text, numeric)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.settle_ai_budget(uuid, text, text, integer, integer, numeric)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.release_ai_budget(uuid)', 'EXECUTE')
  and not has_function_privilege('public', 'public.settle_ai_budget(uuid, text, text, integer, integer, numeric)', 'EXECUTE'),
  'S-01: funções antigas de orçamento fechadas para authenticated, anon e public');
select pg_temp.check(pg_temp.try_as('authenticated', :'P1', $q$select (public.reserve_ai_budget('chat', 0.3))::text$q$) = 'ERRO:42501', 'S-01: a pessoa não reserva pela API do banco');
select pg_temp.check(pg_temp.try_as('anon', null, $q$select (public.reserve_ai_budget('chat', 0.3))::text$q$) = 'ERRO:42501', 'S-01: anon não reserva');
select pg_temp.check(
  not has_function_privilege('authenticated', 'public.server_reserve_ai_budget(uuid, text, numeric)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.server_settle_ai_budget(uuid, uuid, text, text, integer, integer, numeric)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.server_release_ai_budget(uuid, uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.server_settle_ai_budget(uuid, uuid, text, text, integer, integer, numeric)', 'EXECUTE')
  and not has_function_privilege('public', 'public.server_settle_ai_budget(uuid, uuid, text, text, integer, integer, numeric)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.server_settle_ai_budget(uuid, uuid, text, text, integer, integer, numeric)', 'EXECUTE'),
  'S-01: funções do servidor só para service_role');
select pg_temp.check(pg_temp.try_as('authenticated', :'P1', format($q$select (public.server_reserve_ai_budget(%L, 'chat', 0.3))::text$q$, :'P1')) = 'ERRO:42501', 'S-01: a pessoa não chama a função do servidor, nem com o próprio id');
select pg_temp.check(pg_temp.try_as('authenticated', :'P1', $q$select (public.budget_status())::text$q$) not like 'ERRO%', 'S-01: budget_status (leitura) continua para a própria pessoa');

-- O ataque da auditoria: reservar, liquidar com custo 0 antes do servidor.
select pg_temp.try_as('service_role', null, format($q$select (public.server_reserve_ai_budget(%L, 'chat', 0.30))::text$q$, :'P1')) as res \gset
select pg_temp.check((:'res'::jsonb ->> 'allowed')::boolean, 'S-01: servidor reserva para a pessoa da sessão');
select (:'res'::jsonb ->> 'reservation_id') as rid \gset
select pg_temp.check(pg_temp.try_as('authenticated', :'P1', format($q$select (public.settle_ai_budget(%L, 'gemini', 'x', 0, 0, 0))::text$q$, :'rid')) = 'ERRO:42501', 'S-01: a pessoa não consegue liquidar a própria reserva com custo 0');
select pg_temp.try_as('service_role', null, format($q$select (public.server_settle_ai_budget(%L, %L, 'gemini', 'x', 1000, 5000, 0.30))::text$q$, :'P1', :'rid')) as st \gset
select pg_temp.check((:'st'::jsonb ->> 'ok')::boolean and (:'st'::jsonb ->> 'cost')::numeric = 0.30, 'S-01: o servidor liquida pelo custo real');
select pg_temp.check((select sum(cost_usd) = 0.30 from public.usage_events where user_id = :'P1'), 'S-01: custo real gravado (0,30)');

-- Se a reserva já tivesse sido liquidada com custo 0 (janela de transição), o servidor completa o custo real.
select pg_temp.try_as('service_role', null, format($q$select (public.server_reserve_ai_budget(%L, 'chat', 0.20))::text$q$, :'P1')) as res2 \gset
select (:'res2'::jsonb ->> 'reservation_id') as rid2 \gset
insert into public.usage_events (user_id, provider, model, kind, cost_usd) values (:'P1', 'gemini', 'x', 'chat', 0);
update public.ai_reservations set status = 'settled', cost_usd = 0, closed_at = now(), usage_event_id = (select max(id) from public.usage_events) where id = :'rid2'::uuid;
select pg_temp.try_as('service_role', null, format($q$select (public.server_settle_ai_budget(%L, %L, 'gemini', 'x', 10, 10, 0.20))::text$q$, :'P1', :'rid2')) as st2 \gset
select pg_temp.check((:'st2'::jsonb ->> 'already')::boolean and (:'st2'::jsonb ->> 'adjusted')::numeric = 0.20, 'S-01: reserva já liquidada com custo menor: o servidor grava a diferença');
select pg_temp.check((select sum(cost_usd) = 0.50 from public.usage_events where user_id = :'P1'), 'S-01: total do mês = custo real (0,30 + 0,20)');
select pg_temp.try_as('service_role', null, format($q$select (public.server_settle_ai_budget(%L, %L, 'gemini', 'x', 10, 10, 0.20))::text$q$, :'P1', :'rid2')) as st3 \gset
select pg_temp.check((:'st3'::jsonb ->> 'already')::boolean and not (:'st3'::jsonb ? 'adjusted'), 'S-01: repetir a liquidação não duplica o custo');
select pg_temp.check((select sum(cost_usd) = 0.50 from public.usage_events where user_id = :'P1'), 'S-01: total continua 0,50 depois da repetição');

-- Liberada por engano (ou por ataque) e depois liquidada pelo servidor: o custo real entra.
select pg_temp.try_as('service_role', null, format($q$select (public.server_reserve_ai_budget(%L, 'chat', 0.10))::text$q$, :'P1')) as res4 \gset
select (:'res4'::jsonb ->> 'reservation_id') as rid4 \gset
select pg_temp.try_as('service_role', null, format($q$select (public.server_release_ai_budget(%L, %L))::text$q$, :'P1', :'rid4')) as rl \gset
select pg_temp.try_as('service_role', null, format($q$select (public.server_settle_ai_budget(%L, %L, 'anthropic', 'x', 1, 1, 0.07))::text$q$, :'P1', :'rid4')) as st4 \gset
select pg_temp.check((:'rl'::jsonb ->> 'released')::boolean and (:'st4'::jsonb ->> 'ok')::boolean and (select sum(cost_usd) = 0.57 from public.usage_events where user_id = :'P1'), 'S-01: reserva liberada ainda recebe o custo real do servidor');

-- Outra pessoa não alcança reservas alheias, nem pelo servidor com o id errado.
select pg_temp.check(pg_temp.try_as('service_role', null, format($q$select (public.server_settle_ai_budget(%L, %L, 'anthropic', 'x', 1, 1, 0.01))::text$q$, :'P3', :'rid'))::jsonb ->> 'reason' = 'not_found', 'S-01: liquidar com o id de outra pessoa não acha a reserva');
select pg_temp.check(pg_temp.try_as('service_role', null, format($q$select (public.server_settle_ai_budget(%L, %L, 'outro', 'x', 1, 1, 0.01))::text$q$, :'P1', :'rid'))::jsonb ->> 'reason' = 'invalid', 'S-01: provedor desconhecido recusado');
select pg_temp.check(pg_temp.try_as('service_role', null, format($q$select (public.server_settle_ai_budget(%L, %L, 'anthropic', 'x', 1, 1, 1000))::text$q$, :'P1', :'rid'))::jsonb ->> 'reason' = 'invalid', 'S-01: custo absurdo recusado');
select pg_temp.check(pg_temp.try_as('service_role', null, $q$select (public.server_reserve_ai_budget(null, 'chat', 0.1))::text$q$)::jsonb ->> 'reason' = 'auth', 'S-01: sem id de pessoa, nada é reservado');

-- ===== S-05: funções de custo e cota recusam quem não está ativo ===========================================
select pg_temp.check(pg_temp.try_as('service_role', null, format($q$select (public.server_reserve_ai_budget(%L, 'chat', 0.1))::text$q$, :'P2'))::jsonb ->> 'reason' = 'blocked', 'S-05: pessoa bloqueada não reserva orçamento');
select pg_temp.check(pg_temp.try_as('authenticated', :'P2', $q$select (public.consume_daily_quota())::text$q$)::jsonb ->> 'allowed' = 'false', 'S-05: pessoa bloqueada não consome cota');
select pg_temp.check(pg_temp.try_as('authenticated', :'P1', $q$select (public.consume_daily_quota())::text$q$)::jsonb ->> 'allowed' = 'true', 'S-05: pessoa ativa consome cota');
select pg_temp.check(pg_temp.try_as('authenticated', :'P3', $q$select (public.consume_daily_quota())::text$q$)::jsonb ->> 'allowed' = 'true', 'S-05: quem entra só pela lista do servidor (sem linha em members) continua com acesso');
select pg_temp.check((pg_temp.try_as('service_role', null, format($q$select (public.server_reserve_ai_budget(%L, 'chat', 0.1))::text$q$, :'P3'))::jsonb ->> 'allowed')::boolean, 'S-05: o mesmo vale para o orçamento');
-- Bloqueada no meio da resposta: o custo real ainda entra (contabilidade não depende de acesso).
select pg_temp.try_as('service_role', null, format($q$select (public.server_reserve_ai_budget(%L, 'chat', 0.1))::text$q$, :'P1')) as res5 \gset
update public.members set access = 'blocked' where user_id = :'P1';
select pg_temp.try_as('service_role', null, format($q$select (public.server_settle_ai_budget(%L, %L, 'anthropic', 'x', 1, 1, 0.05))::text$q$, :'P1', (:'res5'::jsonb ->> 'reservation_id'))) as st5 \gset
select pg_temp.check((:'st5'::jsonb ->> 'ok')::boolean, 'S-05: bloqueio no meio da resposta não perde o custo real');
update public.members set access = 'active' where user_id = :'P1';
select pg_temp.check((pg_temp.try_as('service_role', null, format($q$select (public.server_reserve_ai_budget(%L, 'chat', 0.1))::text$q$, :'P1'))::jsonb ->> 'allowed')::boolean, 'S-05: liberada de novo, volta a reservar');

-- Sessões: só o servidor encerra, e só as da pessoa pedida.
insert into auth.sessions (user_id) values (:'P1'), (:'P1'), (:'P2');
select pg_temp.check(pg_temp.try_as('authenticated', :'P1', format($q$select (public.server_revoke_user_sessions(%L))::text$q$, :'P2')) = 'ERRO:42501', 'S-05: a pessoa não encerra sessões pela API');
select pg_temp.check(pg_temp.try_as('service_role', null, format($q$select (public.server_revoke_user_sessions(%L))::text$q$, :'P1')) = '2', 'S-05: servidor encerra as 2 sessões da pessoa bloqueada');
select pg_temp.check((select count(*) = 0 from auth.sessions where user_id = :'P1') and (select count(*) = 1 from auth.sessions where user_id = :'P2'), 'S-05: as sessões de outras pessoas ficam intactas');

-- ===== S-04: indexação do agendador ignora quem não está ativo ==============================================
insert into public.memories (user_id, content, area, status) values
  (:'P1', 'memória de pessoa ativa', 'Pessoal', 'approved'),
  (:'P2', 'memória de pessoa bloqueada', 'Pessoal', 'approved'),
  (:'P3', 'memória de pessoa sem linha em members', 'Pessoal', 'approved');
select pg_temp.try_as('service_role', null, $q$select string_agg(distinct user_id::text, ',' order by user_id::text) from public.index_backlog(100)$q$) as idx \gset
select pg_temp.check(position(:'P2' in :'idx') = 0, 'S-04: index_backlog não devolve itens de pessoa bloqueada');
select pg_temp.check(position(:'P1' in :'idx') > 0 and position(:'P3' in :'idx') > 0, 'S-04: index_backlog segue devolvendo pessoas ativas e a que entra pela lista do servidor');
select pg_temp.check(pg_temp.try_as('authenticated', :'P1', $q$select count(*)::text from public.index_backlog(10)$q$) = 'ERRO:42501', 'S-04: index_backlog segue fechada para pessoas logadas');

-- ===== S-07: função antiga da cota removida =================================================================
select pg_temp.check(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'consume_quota'), 'S-07: consume_quota não existe mais');
select pg_temp.check(pg_temp.try_as('authenticated', :'P1', $q$select (public.consume_quota(1000000))::text$q$) = 'ERRO:42883', 'S-07: chamar consume_quota falha (função inexistente)');
select pg_temp.check(has_function_privilege('authenticated', 'public.consume_daily_quota()', 'EXECUTE'), 'S-07: consume_daily_quota continua disponível');

-- ===== S-10: a pessoa não escreve consumo ===================================================================
select pg_temp.check(pg_temp.exec_as('authenticated', :'P1', $q$insert into public.usage_events (provider, model, cost_usd) values ('gemini', 'inventado', 99)$q$) = 'ERRO:42501', 'S-10: pessoa não insere consumo inventado');
select pg_temp.check(pg_temp.exec_as('authenticated', :'P1', $q$update public.usage_events set cost_usd = 0$q$) = 'ERRO:42501', 'S-10: pessoa não altera consumo');
select pg_temp.check(pg_temp.exec_as('authenticated', :'P1', $q$delete from public.usage_events$q$) = 'ERRO:42501', 'S-10: pessoa não apaga consumo');
select pg_temp.check(pg_temp.exec_as('anon', null, $q$insert into public.usage_events (user_id, provider, model, cost_usd) values (null, 'gemini', 'x', 1)$q$) = 'ERRO:42501', 'S-10: anon não insere consumo');
select pg_temp.check(not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'usage_events' and cmd = 'INSERT'), 'S-10: política de insert removida');
select pg_temp.check(pg_temp.try_as('authenticated', :'P1', $q$select count(*)::text from public.usage_events$q$)::int > 0, 'S-10: a pessoa continua lendo o próprio consumo');
select pg_temp.check(pg_temp.try_as('authenticated', :'P3', $q$select count(*)::text from public.usage_events where user_id = '00000000-0000-0000-0000-0000000e4001'$q$) = '0', 'S-10: e não lê o de outra pessoa');
select pg_temp.check(pg_temp.exec_as('service_role', null, format($q$insert into public.usage_events (user_id, provider, model, cost_usd) values (%L, 'gemini', 'servidor', 0.001)$q$, :'P1')) = '1', 'S-10: o servidor continua gravando consumo (contingência direta)');

-- ===== S-12: anon sem acesso ao schema public; authenticated sem TRUNCATE/REFERENCES/TRIGGER =================
select pg_temp.check((select count(*) = 0 from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public'), 'S-12: anon sem nenhum privilégio em tabelas do schema public');
select pg_temp.check((select count(*) = 0 from information_schema.role_usage_grants where grantee = 'anon' and object_schema = 'public'), 'S-12: anon sem uso de sequências do schema public');
select pg_temp.check((select count(*) = 0 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')), 'S-12: anon não executa nenhuma função do schema public');
select pg_temp.check((select count(*) = 0 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and has_function_privilege('public', p.oid, 'EXECUTE')), 'S-12: nenhuma função do schema public depende do grant implícito de PUBLIC');
select pg_temp.check(pg_temp.try_as('anon', null, $q$select count(*)::text from public.tasks$q$) = 'ERRO:42501', 'S-12: anon lendo tasks recebe "permission denied" (antes: 0 linhas pela RLS)');
select pg_temp.check((select count(*) = 0 from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'public' and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')), 'S-12: authenticated sem TRUNCATE, REFERENCES e TRIGGER');
select pg_temp.check(pg_temp.exec_as('authenticated', :'P1', $q$truncate public.tasks$q$) = 'ERRO:42501', 'S-12: pessoa não consegue TRUNCATE (a RLS não protege isso)');
select pg_temp.check(pg_temp.try_as('authenticated', :'P1', $q$select count(*)::text from public.tasks$q$) not like 'ERRO%', 'S-12: o app logado continua lendo as próprias tabelas');
select pg_temp.check(pg_temp.exec_as('authenticated', :'P1', $q$insert into public.tasks (title) values ('tarefa sintética')$q$) = '1', 'S-12: e continua escrevendo nelas (RLS decide)');
select pg_temp.check(pg_temp.try_as('authenticated', :'P1', $q$select count(*)::text from public.search_similar(array_fill(0.01::real, array[1536])::extensions.vector, 3)$q$) not like 'ERRO%', 'S-12: busca por significado segue para pessoa logada');
select pg_temp.check(pg_temp.try_as('anon', null, $q$select count(*)::text from public.search_similar(array_fill(0.01::real, array[1536])::extensions.vector, 3)$q$) = 'ERRO:42501', 'S-12: e fechada para anon');
-- Tabelas criadas depois já nascem fechadas (privilégios padrão). Funções: o guarda acima (nenhuma executável por PUBLIC/anon) pega qualquer migração futura que esqueça o revoke.
create table public.zz_futura (id int);
select pg_temp.check(not has_table_privilege('anon', 'public.zz_futura', 'SELECT') and not has_table_privilege('authenticated', 'public.zz_futura', 'TRUNCATE'), 'S-12: tabela futura nasce sem acesso de anon e sem TRUNCATE para authenticated');
drop table public.zz_futura;

-- ===== S-03: contador de tentativas =========================================================================
select pg_temp.check(not has_function_privilege('authenticated', 'public.auth_rate_limit_hit(text, text, integer, integer)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.auth_rate_limit_hit(text, text, integer, integer)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.auth_rate_limit_hit(text, text, integer, integer)', 'EXECUTE'), 'S-03: contador só para o servidor');
select pg_temp.check(not has_table_privilege('authenticated', 'private.rate_limits', 'SELECT,INSERT,UPDATE,DELETE') and not has_table_privilege('anon', 'private.rate_limits', 'SELECT,INSERT,UPDATE,DELETE'), 'S-03: tabela do contador fechada para a API');
select pg_temp.check((select relrowsecurity from pg_class where oid = 'private.rate_limits'::regclass), 'S-03: RLS ligada na tabela do contador');
select string_agg(pg_temp.try_as('service_role', null, format($q$select (public.auth_rate_limit_hit('password_email', %L, 3, 600))::text$q$, repeat('a', 64)))::jsonb ->> 'allowed', ',' order by n) as seq
  from generate_series(1, 5) n \gset
select pg_temp.check(:'seq' = 'true,true,true,false,false', 'S-03: 3 tentativas passam e a 4ª e a 5ª são negadas');
select pg_temp.check((pg_temp.try_as('service_role', null, format($q$select (public.auth_rate_limit_hit('password_email', %L, 3, 600))::text$q$, repeat('a', 64)))::jsonb ->> 'retry_after')::int between 1 and 600, 'S-03: informa em quantos segundos tenta de novo');
select pg_temp.check((pg_temp.try_as('service_role', null, format($q$select (public.auth_rate_limit_hit('password_email', %L, 3, 600))::text$q$, repeat('b', 64)))::jsonb ->> 'allowed')::boolean, 'S-03: outra chave tem contador próprio');
select pg_temp.check((pg_temp.try_as('service_role', null, format($q$select (public.auth_rate_limit_hit('password_ip', %L, 3, 600))::text$q$, repeat('a', 64)))::jsonb ->> 'allowed')::boolean, 'S-03: outro balde com a mesma chave também é separado');
update private.rate_limits set window_start = window_start - interval '1 hour';
select pg_temp.check((pg_temp.try_as('service_role', null, format($q$select (public.auth_rate_limit_hit('password_email', %L, 3, 600))::text$q$, repeat('a', 64)))::jsonb ->> 'hits')::int = 1, 'S-03: janela nova recomeça a contagem');
select pg_temp.check(pg_temp.try_as('service_role', null, $q$select (public.auth_rate_limit_hit('hack', 'curta', 3, 600))::text$q$) like 'ERRO:%', 'S-03: parâmetros inválidos (balde, chave curta) são recusados');
select pg_temp.check(pg_temp.try_as('service_role', null, format($q$select (public.auth_rate_limit_hit('password_ip', %L, 0, 600))::text$q$, repeat('c', 64))) like 'ERRO:%', 'S-03: limite inválido recusado');
select pg_temp.check(pg_temp.try_as('authenticated', :'P1', format($q$select (public.auth_rate_limit_hit('password_ip', %L, 3, 600))::text$q$, repeat('c', 64))) = 'ERRO:42501', 'S-03: pessoa logada não mexe no contador');

-- ===== Isolamento continua ==================================================================================
select pg_temp.check(pg_temp.try_as('authenticated', :'P3', $q$select count(*)::text from public.tasks$q$) = '0', 'isolamento: P3 não vê a tarefa de P1');
select pg_temp.check((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity) = 0, 'toda tabela do schema public tem RLS');
select pg_temp.check((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'private' and c.relkind = 'r' and not c.relrowsecurity) = 0, 'toda tabela do schema private tem RLS');
select pg_temp.check((select count(*) = 0 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private') and p.prosecdef and not (coalesce(p.proconfig, '{}') @> array['search_path=""'])), 'toda função security definer tem search_path vazio');

-- Limpeza para os testes de concorrência.
delete from public.ai_reservations;
delete from public.usage_events;
delete from public.tasks;
delete from public.memories;
delete from public.usage_daily;
delete from private.rate_limits;
update private.budget_policy set monthly_limit_usd = 20, max_reserve_usd = 1.00, min_reserve_usd = 0.01, global_monthly_limit_usd = null;

\echo 'seguranca p1: todos os testes SQL passaram'
