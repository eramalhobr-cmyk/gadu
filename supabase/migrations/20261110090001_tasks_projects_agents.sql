-- Fase 2+: tarefas, projetos pessoais e agentes. Tudo por pessoa, com RLS.

create table public.projects (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  goal text check (char_length(goal) <= 400),
  next_steps text check (char_length(next_steps) <= 1000),
  status text not null default 'active' check (status in ('active', 'paused', 'done')),
  color text not null default 'sig' check (color in ('sig', 'hot', 'violet', 'blue', 'green', 'pink')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_user_status_idx on public.projects (user_id, status);

create table public.agents (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  area text not null default 'Pessoal' check (char_length(area) <= 40),
  instructions text not null default '' check (char_length(instructions) <= 4000),
  color text not null default 'sig' check (color in ('sig', 'hot', 'violet', 'blue', 'green', 'pink')),
  icon text not null default 'spark' check (char_length(icon) <= 20),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index agents_user_idx on public.agents (user_id);

create table public.tasks (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  notes text check (char_length(notes) <= 1000),
  status text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  priority smallint not null default 2 check (priority between 1 and 3),
  due_date date,
  project_id bigint references public.projects (id) on delete set null,
  conversation_id bigint references public.conversations (id) on delete set null,
  origin text not null default 'Você' check (char_length(origin) <= 40),
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_user_status_due_idx on public.tasks (user_id, status, due_date);
create index tasks_project_idx on public.tasks (project_id);
create index tasks_conversation_idx on public.tasks (conversation_id);

alter table public.conversations
  add column project_id bigint references public.projects (id) on delete set null,
  add column agent_id bigint references public.agents (id) on delete set null;
create index conversations_project_idx on public.conversations (project_id);
create index conversations_agent_idx on public.conversations (agent_id);

alter table public.projects enable row level security;
alter table public.agents enable row level security;
alter table public.tasks enable row level security;

create policy projects_all on public.projects for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy agents_all on public.agents for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- Tarefa só pode apontar para projeto e conversa da própria pessoa.
create policy tasks_all on public.tasks for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (project_id is null or exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())))
    and (conversation_id is null or exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = (select auth.uid())))
  );

-- Conversa só pode apontar para projeto e agente da própria pessoa.
-- Verificado por gatilho (security invoker: a RLS de projects e agents só mostra os da própria pessoa).
create function private.check_conversation_links() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.project_id is not null and not exists (select 1 from public.projects p where p.id = new.project_id) then
    raise exception 'projeto inválido';
  end if;
  if new.agent_id is not null and not exists (select 1 from public.agents a where a.id = new.agent_id) then
    raise exception 'agente inválido';
  end if;
  return new;
end $$;
create trigger conversations_links before insert or update of project_id, agent_id on public.conversations
  for each row execute function private.check_conversation_links();

create trigger projects_touch before update on public.projects for each row execute function private.touch_updated_at();
create trigger agents_touch before update on public.agents for each row execute function private.touch_updated_at();
create trigger tasks_touch before update on public.tasks for each row execute function private.touch_updated_at();
