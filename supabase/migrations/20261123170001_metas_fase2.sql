-- Metas, fase 2 (docs/METAS_CONQUISTAS.md): vínculo da meta com PROJETOS e com a AGENDA (blocos de tempo reservados para a meta).
-- Migração ADITIVA: cria 2 tabelas novas e UMA restrição de unicidade em projects (id já é único; a restrição só habilita a chave composta,
-- como foi feito em tasks na fase 1). Nenhuma coluna ou política existente muda. Sem função, trigger nem objeto no schema private.
--
--   goal_projects  vínculo meta ↔ projeto (chave composta nos dois lados: só dados da mesma pessoa)
--   goal_events    blocos de agenda da meta: guarda o id do evento no Google Agenda e um retrato do título e do horário.
--                  O evento em si mora no Google (escopo calendar.events, que já existe); aqui fica só a ligação com a meta.
--                  Evento NÃO conta como progresso: progresso continua só de registro com origem (regra 1 da especificação).
--
-- Acesso: só a própria pessoa (user_id da sessão), RLS ligado, nada para anon. Segue o S-05 (20261123150001): quem está
-- bloqueado não insere nem altera (políticas restritivas com public.can_write()), mas lê e apaga os próprios dados.
--
-- Rollback (apaga só os vínculos; metas, projetos e eventos do Google ficam):
--   drop table public.goal_events;
--   drop table public.goal_projects;
--   alter table public.projects drop constraint projects_id_user_unique;

-- Habilita a chave estrangeira composta (project_id, user_id). id já é chave primária: a restrição nunca falha nem muda dado.
alter table public.projects add constraint projects_id_user_unique unique (id, user_id);

-- ---------------------------------------------------------------------------------------------------------
-- goal_projects: as DUAS chaves são compostas com user_id: nem a meta nem o projeto podem ser de outra pessoa.
-- ---------------------------------------------------------------------------------------------------------
create table public.goal_projects (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null,
  project_id bigint not null,
  created_at timestamptz not null default now(),
  primary key (goal_id, project_id),
  constraint goal_projects_goal_fk foreign key (goal_id, user_id) references public.goals (id, user_id) on delete cascade,
  constraint goal_projects_project_fk foreign key (project_id, user_id) references public.projects (id, user_id) on delete cascade
);
create index goal_projects_user_project_idx on public.goal_projects (user_id, project_id);

-- ---------------------------------------------------------------------------------------------------------
-- goal_events: bloco de agenda ligado à meta. event_id é o id do evento no Google (agenda principal da pessoa).
-- ---------------------------------------------------------------------------------------------------------
create table public.goal_events (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null,
  event_id text not null check (char_length(event_id) between 5 and 1024 and event_id ~ '^[A-Za-z0-9_-]+$'),
  titulo text not null check (char_length(btrim(titulo)) between 1 and 160),
  inicio timestamptz not null,
  fim timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (goal_id, event_id),
  constraint goal_events_goal_fk foreign key (goal_id, user_id) references public.goals (id, user_id) on delete cascade,
  constraint goal_events_fim_depois_do_inicio check (fim > inicio and fim - inicio <= interval '24 hours')
);
create index goal_events_user_inicio_idx on public.goal_events (user_id, inicio);

-- ---------------------------------------------------------------------------------------------------------
-- Acesso: só pessoas logadas, só as próprias linhas. anon não tem privilégio algum.
-- ---------------------------------------------------------------------------------------------------------
alter table public.goal_projects enable row level security;
alter table public.goal_events enable row level security;

revoke all on public.goal_projects, public.goal_events from public, anon, authenticated;
grant select, insert, update, delete on public.goal_projects, public.goal_events to authenticated;

create policy goal_projects_select on public.goal_projects for select to authenticated using ((select auth.uid()) = user_id);
create policy goal_projects_insert on public.goal_projects for insert to authenticated with check ((select auth.uid()) = user_id);
create policy goal_projects_update on public.goal_projects for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy goal_projects_delete on public.goal_projects for delete to authenticated using ((select auth.uid()) = user_id);

create policy goal_events_select on public.goal_events for select to authenticated using ((select auth.uid()) = user_id);
create policy goal_events_insert on public.goal_events for insert to authenticated with check ((select auth.uid()) = user_id);
create policy goal_events_update on public.goal_events for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy goal_events_delete on public.goal_events for delete to authenticated using ((select auth.uid()) = user_id);

-- S-05: quem está bloqueado não insere nem altera.
create policy goal_projects_ativo_insert on public.goal_projects as restrictive for insert to authenticated with check ((select public.can_write()));
create policy goal_projects_ativo_update on public.goal_projects as restrictive for update to authenticated using ((select public.can_write())) with check ((select public.can_write()));
create policy goal_events_ativo_insert on public.goal_events as restrictive for insert to authenticated with check ((select public.can_write()));
create policy goal_events_ativo_update on public.goal_events as restrictive for update to authenticated using ((select public.can_write())) with check ((select public.can_write()));
