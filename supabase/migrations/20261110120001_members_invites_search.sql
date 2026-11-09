-- Convites e acesso por pessoa, busca por significado (pgvector) e revisão da noite.

create extension if not exists vector with schema extensions;

-- Quem tem acesso ao app. Escrito só pelo servidor (chave secreta); cada pessoa só lê a própria linha.
create table public.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'admin')),
  access text not null default 'active' check (access in ('active', 'blocked')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index members_invited_by_idx on public.members (invited_by);
alter table public.members enable row level security;
create policy members_select_own on public.members for select to authenticated using (user_id = (select auth.uid()));

-- Convites: o link leva um código aleatório; aqui fica só o hash. Vale 7 dias e uma vez.
create table public.invites (
  id bigint generated always as identity primary key,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  email text not null check (char_length(email) between 3 and 320),
  name text check (char_length(name) <= 80),
  token_hash text not null unique check (char_length(token_hash) = 64),
  presets jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  used_at timestamptz,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index invites_created_by_idx on public.invites (created_by);
create index invites_user_idx on public.invites (user_id);
alter table public.invites enable row level security;
create policy invites_select_own on public.invites for select to authenticated using (created_by = (select auth.uid()));

-- Índice de busca por significado: memórias aprovadas, resumos de conversas, tarefas e projetos.
create table public.search_index (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('memory', 'conversation', 'task', 'project')),
  ref_id bigint not null,
  content text not null check (char_length(content) <= 4000),
  embedding extensions.vector(1536) not null,
  updated_at timestamptz not null default now(),
  unique (user_id, kind, ref_id)
);
create index search_index_embedding_idx on public.search_index using hnsw (embedding extensions.vector_cosine_ops);
alter table public.search_index enable row level security;
create policy search_index_select_own on public.search_index for select to authenticated using (user_id = (select auth.uid()));

-- Busca da própria pessoa (security invoker: a RLS vale).
create function public.search_similar(query_embedding extensions.vector(1536), match_count int default 8, kinds text[] default null)
returns table (kind text, ref_id bigint, content text, similarity double precision)
language sql stable security invoker set search_path = ''
as $$
  select s.kind, s.ref_id, s.content, 1 - (s.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.search_index s
  where s.user_id = (select auth.uid()) and (kinds is null or s.kind = any (kinds))
  order by s.embedding operator(extensions.<=>) query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

-- Fila de indexação para o agendador (só a chave secreta executa).
create function public.index_backlog(lim int default 40)
returns table (user_id uuid, kind text, ref_id bigint, content text)
language sql stable security definer set search_path = ''
as $$
  (select m.user_id, 'memory', m.id, '[' || m.area || '] ' || m.content
     from public.memories m
     left join public.search_index s on s.user_id = m.user_id and s.kind = 'memory' and s.ref_id = m.id
    where m.status = 'approved' and (s.id is null or s.updated_at < m.updated_at)
    limit lim)
  union all
  (select c.user_id, 'conversation', c.id, coalesce(c.title, '') || ': ' || c.summary
     from public.conversations c
     left join public.search_index s on s.user_id = c.user_id and s.kind = 'conversation' and s.ref_id = c.id
    where c.summary is not null and (s.id is null or s.updated_at < c.summary_at)
    limit lim)
  union all
  (select t.user_id, 'task', t.id, t.title || coalesce(' — ' || t.notes, '')
     from public.tasks t
     left join public.search_index s on s.user_id = t.user_id and s.kind = 'task' and s.ref_id = t.id
    where t.status <> 'cancelled' and (s.id is null or s.updated_at < t.updated_at)
    limit lim)
  union all
  (select p.user_id, 'project', p.id, p.name || coalesce(': ' || p.goal, '') || coalesce('. ' || p.next_steps, '')
     from public.projects p
     left join public.search_index s on s.user_id = p.user_id and s.kind = 'project' and s.ref_id = p.id
    where s.id is null or s.updated_at < p.updated_at
    limit lim);
$$;
revoke execute on function public.index_backlog(int) from public, anon, authenticated;
grant execute on function public.index_backlog(int) to service_role;

-- Remove do índice o que foi apagado, esquecido ou cancelado.
create function public.index_prune()
returns integer
language sql volatile security definer set search_path = ''
as $$
  with gone as (
    delete from public.search_index s
     where (s.kind = 'memory' and not exists (select 1 from public.memories m where m.id = s.ref_id and m.user_id = s.user_id and m.status = 'approved'))
        or (s.kind = 'conversation' and not exists (select 1 from public.conversations c where c.id = s.ref_id and c.user_id = s.user_id))
        or (s.kind = 'task' and not exists (select 1 from public.tasks t where t.id = s.ref_id and t.user_id = s.user_id and t.status <> 'cancelled'))
        or (s.kind = 'project' and not exists (select 1 from public.projects p where p.id = s.ref_id and p.user_id = s.user_id))
    returning 1
  )
  select count(*)::int from gone;
$$;
revoke execute on function public.index_prune() from public, anon, authenticated;
grant execute on function public.index_prune() to service_role;

-- Notificações do dia além do briefing (revisão da noite). Gravado só pelo agendador.
create table public.daily_pushes (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('evening')),
  sent_at timestamptz not null default now(),
  primary key (user_id, day, kind)
);
alter table public.daily_pushes enable row level security;
create policy daily_pushes_select_own on public.daily_pushes for select to authenticated using (user_id = (select auth.uid()));

-- Link do e-mail de origem da tarefa (ex.: e-mail que virou tarefa).
alter table public.tasks add column link text check (char_length(link) <= 500 and link like 'https://%');
