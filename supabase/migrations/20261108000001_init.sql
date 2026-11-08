-- Gadu · esquema inicial
-- Multiusuário desde o início: todo dado pertence a um usuário (user_id) e o RLS
-- garante que cada pessoa só enxerga as próprias informações.

create schema if not exists private;

-- Perfil e ajustes ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Conversas e mensagens --------------------------------------------------------
create table public.conversations (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text check (char_length(title) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_user_updated_idx on public.conversations (user_id, updated_at desc);

create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id bigint not null references public.conversations (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 20000),
  provider text check (char_length(provider) <= 40),
  created_at timestamptz not null default now()
);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index messages_user_idx on public.messages (user_id);

-- Memória (sempre revisada pela pessoa) -----------------------------------------
create table public.memories (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  area text not null default 'Pessoal' check (char_length(area) <= 40),
  origin text not null default 'Conversa' check (char_length(origin) <= 40),
  status text not null default 'pending' check (status in ('pending', 'approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index memories_user_status_idx on public.memories (user_id, status, created_at desc);

-- Cota diária (proteção de custo) ----------------------------------------------
create table public.usage_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  messages integer not null default 0 check (messages >= 0),
  primary key (user_id, day)
);

-- RLS ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.memories enable row level security;
alter table public.usage_daily enable row level security;

create policy profiles_select on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy conversations_all on public.conversations for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy messages_select on public.messages for select to authenticated using ((select auth.uid()) = user_id);
create policy messages_insert on public.messages for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = (select auth.uid()))
  );
create policy messages_delete on public.messages for delete to authenticated using ((select auth.uid()) = user_id);

create policy memories_all on public.memories for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- A cota só é lida pela pessoa; só a função abaixo escreve nela.
create policy usage_select on public.usage_daily for select to authenticated using ((select auth.uid()) = user_id);

-- Funções ------------------------------------------------------------------------
-- Cria o perfil quando alguém entra pela primeira vez.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Consome uma unidade da cota do dia. Só mexe na linha da própria pessoa.
create or replace function public.consume_quota(p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  n integer;
begin
  if uid is null then
    return false;
  end if;
  insert into public.usage_daily (user_id, day, messages)
  values (uid, current_date, 1)
  on conflict (user_id, day) do update set messages = public.usage_daily.messages + 1
  returning messages into n;
  return n <= greatest(p_limit, 0);
end;
$$;
revoke execute on function public.consume_quota(integer) from public, anon;
grant execute on function public.consume_quota(integer) to authenticated;

-- Mantém updated_at.
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger profiles_touch before update on public.profiles for each row execute function private.touch_updated_at();
create trigger conversations_touch before update on public.conversations for each row execute function private.touch_updated_at();
create trigger memories_touch before update on public.memories for each row execute function private.touch_updated_at();
