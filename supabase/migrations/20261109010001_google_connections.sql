-- Fase 2: conexão com o Google (Agenda e Gmail, só leitura).
-- O token de renovação fica criptografado (AES-256-GCM) com uma chave que existe só no servidor.
create table public.google_connections (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  google_email text check (char_length(google_email) <= 320),
  scopes text not null default '' check (char_length(scopes) <= 2000),
  refresh_token_enc text not null check (char_length(refresh_token_enc) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_connections enable row level security;

create policy google_connections_select on public.google_connections for select to authenticated
  using (user_id = (select auth.uid()));
create policy google_connections_insert on public.google_connections for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy google_connections_update on public.google_connections for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy google_connections_delete on public.google_connections for delete to authenticated
  using (user_id = (select auth.uid()));

create trigger google_connections_touch before update on public.google_connections
  for each row execute function private.touch_updated_at();
