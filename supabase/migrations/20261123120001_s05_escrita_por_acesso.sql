-- S-05 (resto): quem não está ativo não grava pelas tabelas do cliente. RESTRITIVA = ALTO RISCO.
-- RASCUNHO: NÃO APLICAR sem o OK explícito do Eduardo. Auditoria: docs/SECURITY_AUDIT_2026-11-23.md (A-1 e A-2).
--
-- O que esta migração faz (nada é apagado, renomeado nem alterado nos dados):
--   1. public.can_write(): verdadeiro para quem está logado e não está bloqueado (mesma regra de private.is_blocked:
--      bloqueado = existe linha em members com access <> 'active'; quem não tem linha em members continua ativo,
--      como em src/lib/access.ts). Só autenticado e o servidor executam; devolve só o estado de quem chama.
--   2. Políticas RESTRITIVAS (AS RESTRICTIVE: valem em conjunto com as permissivas que já existem, que não são
--      tocadas) de INSERT, UPDATE e DELETE para authenticated nas 18 tabelas de dados da pessoa:
--      exigem can_write(). SELECT não muda: quem está bloqueado ainda lê os próprios dados.
--   3. A-2: política restritiva em reminders: conversation_id, se vier, tem de ser de uma conversa da própria pessoa
--      (antes aceitava o id de outra pessoa; sucesso x erro 23503 revelava que o id existe).
--
-- Não muda: service_role (ignora a RLS; é o que o servidor usa em convite, administração e agendador); gatilhos e
-- ações de chave estrangeira (cascata ao apagar conversa, meta ou pessoa rodam como dono da tabela e não passam pela
-- RLS: testado); anon (sem acesso); as tabelas só do servidor (já sem política de escrita).
--
-- Efeito para a pessoa bloqueada: o servidor já recusa o app inteiro (accessOf) e as sessões são encerradas ao
-- bloquear; isto fecha o acesso direto à API do banco com um token ainda válido. Efeito para quem está ativo: nenhum
-- (uma consulta por chave primária em members, avaliada uma vez por comando).
--
-- Rollback (sem perda de dados; tabelas e linhas não são tocadas). O mesmo bloco é executado, dentro de uma
-- transação desfeita, em supabase/tests/80_s05_escrita_por_acesso.test.sql:
--   do $$ declare t text; begin
--     foreach t in array array['agents','conversations','fin_config','fin_gastos','fin_item_meses','fin_itens','goal_milestones','goal_progress','goal_tasks','goals','google_connections','memories','messages','profiles','projects','push_subscriptions','reminders','tasks'] loop
--       execute format('drop policy if exists %I on public.%I', t || '_ativo_insert', t);
--       execute format('drop policy if exists %I on public.%I', t || '_ativo_update', t);
--       execute format('drop policy if exists %I on public.%I', t || '_ativo_delete', t);
--     end loop;
--   end $$;
--   drop policy if exists reminders_conversa_propria_insert on public.reminders;
--   drop policy if exists reminders_conversa_propria_update on public.reminders;
--   drop function if exists public.can_write();

create function public.can_write()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and not private.is_blocked((select auth.uid()))
$$;
revoke execute on function public.can_write() from public, anon;
grant execute on function public.can_write() to authenticated, service_role;
comment on function public.can_write() is
  'S-05: a pessoa logada pode gravar? Falso se estiver bloqueada (members.access <> active). Usada pelas políticas restritivas de escrita.';

do $$
declare
  t text;
begin
  foreach t in array array[
    'agents', 'conversations', 'fin_config', 'fin_gastos', 'fin_item_meses', 'fin_itens',
    'goal_milestones', 'goal_progress', 'goal_tasks', 'goals', 'google_connections', 'memories',
    'messages', 'profiles', 'projects', 'push_subscriptions', 'reminders', 'tasks'
  ] loop
    execute format('create policy %I on public.%I as restrictive for insert to authenticated with check ((select public.can_write()))', t || '_ativo_insert', t);
    execute format('create policy %I on public.%I as restrictive for update to authenticated using ((select public.can_write())) with check ((select public.can_write()))', t || '_ativo_update', t);
    execute format('create policy %I on public.%I as restrictive for delete to authenticated using ((select public.can_write()))', t || '_ativo_delete', t);
  end loop;
end $$;

-- A-2: lembrete só aponta para conversa da própria pessoa (tarefas já tinham essa regra na política).
create policy reminders_conversa_propria_insert on public.reminders as restrictive for insert to authenticated
  with check (conversation_id is null or exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = (select auth.uid())));
create policy reminders_conversa_propria_update on public.reminders as restrictive for update to authenticated
  using (true)
  with check (conversation_id is null or exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = (select auth.uid())));
