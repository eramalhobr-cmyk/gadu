-- Imitação mínima do Supabase para testes locais (NUNCA aplicar no banco remoto).
-- Papéis, schema auth, auth.users e auth.uid() lendo o "sub" do JWT como o Supabase faz.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant anon, authenticated, service_role to postgres;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;

-- Schema de extensões do Supabase (pgvector vive aqui).
create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Privilégios padrão que o Supabase dá no schema public (o controle real é a RLS).
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- No Supabase, funções novas em public nascem executáveis por anon, authenticated e service_role (além de PUBLIC).
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- Sessões do Supabase Auth (só o que os testes usam).
create table auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
