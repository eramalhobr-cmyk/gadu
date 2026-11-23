-- 3D Studio: salvar peças e versões (o histórico some ao fechar o app sem isto).
-- Migração ADITIVA: cria DUAS tabelas novas. Nenhuma tabela existente muda. Sem função, trigger nem objeto no schema private.
--
--   pecas_3d          a peça: título (do pedido), pedido original, valores atuais dos controles, datas
--   pecas_3d_versoes  cada código OpenSCAD que a IA devolveu (novo, ajuste ou correção), com o pedido que o gerou
--
-- Acesso: só a própria pessoa (user_id da sessão), RLS ligado, nada para anon. Versão ligada à peça por chave composta
-- (peca_id, user_id): é impossível pendurar versão na peça de outra pessoa, mesmo pelo banco.
-- O código nunca roda no servidor: só é guardado e devolvido ao aparelho da própria pessoa.
--
-- Rollback (apaga só as peças 3D salvas):
--   drop table public.pecas_3d_versoes;
--   drop table public.pecas_3d;

create table public.pecas_3d (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) between 1 and 120),
  pedido text not null check (char_length(btrim(pedido)) between 1 and 800),
  valores jsonb not null default '{}'::jsonb check (jsonb_typeof(valores) = 'object' and pg_column_size(valores) <= 8000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index pecas_3d_user_idx on public.pecas_3d (user_id, updated_at desc);

create table public.pecas_3d_versoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  peca_id uuid not null,
  modo text not null check (modo in ('novo', 'refinar', 'corrigir')),
  pedido text check (char_length(pedido) <= 800),
  scad text not null check (char_length(btrim(scad)) between 1 and 20000),
  created_at timestamptz not null default now(),
  constraint pecas_3d_versoes_peca_fk foreign key (peca_id, user_id) references public.pecas_3d (id, user_id) on delete cascade
);
create index pecas_3d_versoes_peca_idx on public.pecas_3d_versoes (user_id, peca_id, created_at desc);

alter table public.pecas_3d enable row level security;
alter table public.pecas_3d_versoes enable row level security;

revoke all on public.pecas_3d, public.pecas_3d_versoes from public, anon, authenticated;
grant select, insert, update, delete on public.pecas_3d, public.pecas_3d_versoes to authenticated;

create policy pecas_3d_select on public.pecas_3d for select to authenticated using ((select auth.uid()) = user_id);
create policy pecas_3d_insert on public.pecas_3d for insert to authenticated with check ((select auth.uid()) = user_id);
create policy pecas_3d_update on public.pecas_3d for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy pecas_3d_delete on public.pecas_3d for delete to authenticated using ((select auth.uid()) = user_id);

create policy pecas_3d_versoes_select on public.pecas_3d_versoes for select to authenticated using ((select auth.uid()) = user_id);
create policy pecas_3d_versoes_insert on public.pecas_3d_versoes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy pecas_3d_versoes_update on public.pecas_3d_versoes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy pecas_3d_versoes_delete on public.pecas_3d_versoes for delete to authenticated using ((select auth.uid()) = user_id);
