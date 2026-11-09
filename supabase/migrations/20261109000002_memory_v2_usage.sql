-- Consumo por provedor (conversa, resumos, importação), resumo das conversas e busca em português.

create table public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  provider text not null check (provider in ('anthropic', 'gateway', 'gemini')),
  model text not null check (char_length(model) <= 80),
  kind text not null default 'chat' check (kind in ('chat', 'summary', 'import')),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cost_usd numeric(10, 6) not null default 0 check (cost_usd >= 0),
  created_at timestamptz not null default now()
);
create index usage_events_user_created_idx on public.usage_events (user_id, created_at desc);
alter table public.usage_events enable row level security;
create policy usage_events_select on public.usage_events for select to authenticated using ((select auth.uid()) = user_id);
create policy usage_events_insert on public.usage_events for insert to authenticated with check ((select auth.uid()) = user_id);

-- Gasto do mês por provedor (horário de Brasília).
create or replace function public.month_spend_by_provider()
returns table (provider text, cost_usd numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select u.provider, coalesce(sum(u.cost_usd), 0)
  from public.usage_events u
  where u.user_id = (select auth.uid())
    and u.created_at >= date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
  group by u.provider;
$$;
revoke execute on function public.month_spend_by_provider() from public, anon;
grant execute on function public.month_spend_by_provider() to authenticated;

-- Gasto total do mês passa a vir dos eventos de consumo.
create or replace function public.month_spend()
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(u.cost_usd), 0)
  from public.usage_events u
  where u.user_id = (select auth.uid())
    and u.created_at >= date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
$$;

-- Resumo de cada conversa (memória v2) e busca.
alter table public.conversations
  add column summary text check (char_length(summary) <= 2000),
  add column summary_at timestamptz,
  add column message_count integer not null default 0 check (message_count >= 0);

alter table public.conversations
  add column search tsvector generated always as (
    to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(summary, ''))
  ) stored;
create index conversations_search_idx on public.conversations using gin (search);

alter table public.memories
  add column search tsvector generated always as (to_tsvector('portuguese', content)) stored;
create index memories_search_idx on public.memories using gin (search);

alter table public.messages
  add column search tsvector generated always as (to_tsvector('portuguese', content)) stored;
create index messages_search_idx on public.messages using gin (search);
