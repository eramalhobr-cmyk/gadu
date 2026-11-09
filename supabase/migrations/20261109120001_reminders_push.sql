-- Fase 2: lembretes, notificações no celular (Web Push) e briefing diário.

create table public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null check (char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  device text check (char_length(device) <= 120),
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create table public.reminders (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 300),
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'done', 'cancelled')),
  origin text not null default 'Você' check (char_length(origin) <= 40),
  conversation_id bigint references public.conversations (id) on delete set null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index reminders_due_idx on public.reminders (due_at) where status = 'pending';
create index reminders_user_due_idx on public.reminders (user_id, due_at);
create index reminders_conversation_idx on public.reminders (conversation_id);

-- Um briefing por pessoa por dia (gravado só pelo agendador do servidor).
create table public.daily_briefings (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.push_subscriptions enable row level security;
alter table public.reminders enable row level security;
alter table public.daily_briefings enable row level security;

create policy push_subscriptions_select on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy push_subscriptions_insert on public.push_subscriptions for insert to authenticated with check (user_id = (select auth.uid()));
create policy push_subscriptions_update on public.push_subscriptions for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy push_subscriptions_delete on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));

create policy reminders_select on public.reminders for select to authenticated using (user_id = (select auth.uid()));
create policy reminders_insert on public.reminders for insert to authenticated with check (user_id = (select auth.uid()));
create policy reminders_update on public.reminders for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy reminders_delete on public.reminders for delete to authenticated using (user_id = (select auth.uid()));

create policy daily_briefings_select on public.daily_briefings for select to authenticated using (user_id = (select auth.uid()));
