-- Segurança P1, etapa 2 de 2 (RESTRITIVA). Aplicar SÓ DEPOIS do deploy do app que usa as funções server_* e
-- depois de 20261122120001. Auditoria: docs/SECURITY_AUDIT_2026-11-15.md (S-01, S-07, S-10, S-12).
--
-- O que esta migração faz:
--   S-01  revoga o execute de reserve/settle/release_ai_budget (versões antigas, com auth.uid()) de
--         public, anon e authenticated. budget_status() continua para a própria pessoa (tela de Ajustes).
--   S-07  revoga e remove public.consume_quota(integer). consume_daily_quota() continua.
--   S-10  revoga INSERT (e demais escritas) de anon e authenticated em usage_events e remove a política de insert.
--         O consumo só é gravado por funções security definer e pelo servidor (service_role).
--   S-12  anon perde todos os privilégios nas tabelas, sequências e funções do schema public (o app nunca usa
--         anon para ler tabelas: só autenticado). authenticated perde TRUNCATE, REFERENCES e TRIGGER
--         (a RLS não protege TRUNCATE). Privilégios padrão de objetos futuros ajustados do mesmo jeito.
--
-- O app de ANTES do deploy deixa de funcionar com esta migração (chat usa as funções antigas): não aplique antes.
--
-- Rollback (desfaz as revogações; os dados não são tocados):
--   grant execute on function public.reserve_ai_budget(text, numeric) to authenticated;
--   grant execute on function public.settle_ai_budget(uuid, text, text, integer, integer, numeric) to authenticated;
--   grant execute on function public.release_ai_budget(uuid) to authenticated;
--   grant insert on public.usage_events to authenticated;
--   create policy usage_events_insert on public.usage_events for insert to authenticated with check ((select auth.uid()) = user_id);
--   grant select on all tables in schema public to anon;   -- só se algum dia for preciso (hoje nada usa)
--   grant execute on function public.search_similar(extensions.vector, integer, text[]) to public;  -- opcional
--   recriar consume_quota(integer) com a definição de 20261108000001_init.sql (e voltar o app antigo).
--   Reverter só as revogações NÃO desfaz o risco: S-01 e S-10 voltam a existir.

-- S-01: orçamento só pelo servidor.
revoke execute on function public.reserve_ai_budget(text, numeric) from public, anon, authenticated;
revoke execute on function public.settle_ai_budget(uuid, text, text, integer, integer, numeric) from public, anon, authenticated;
revoke execute on function public.release_ai_budget(uuid) from public, anon, authenticated;
grant execute on function public.budget_status() to authenticated;

-- S-07: etapa 2 da cota.
revoke execute on function public.consume_quota(integer) from public, anon, authenticated;
drop function public.consume_quota(integer);

-- S-10: consumo não é escrito pela pessoa.
drop policy usage_events_insert on public.usage_events;
revoke insert, update, delete, truncate, references, trigger on public.usage_events from anon, authenticated;

-- S-12: anon não precisa de nada no schema public.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
-- search_similar só dependia do grant implícito de PUBLIC: passa a ser explícito (só pessoas logadas e o servidor).
revoke execute on function public.search_similar(extensions.vector, integer, text[]) from public, anon;
grant execute on function public.search_similar(extensions.vector, integer, text[]) to authenticated, service_role;
-- authenticated mantém SELECT/INSERT/UPDATE/DELETE (a RLS decide), mas não TRUNCATE, REFERENCES e TRIGGER.
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- Objetos criados no futuro (por quem roda as migrações) já nascem sem acesso de anon.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;
alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from authenticated;
