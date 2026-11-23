-- Finanças: tetos por categoria do dia a dia (limite mensal; aviso a 80% e 100% no Financeiro, no Hoje e pela conversa).
-- Migração ADITIVA: cria UMA tabela nova. Nenhuma tabela existente muda. Sem função, trigger nem objeto no schema private.
--
--   fin_tetos  uma linha por pessoa e categoria: valor mensal do teto. Vale para todos os meses até ser mudado ou apagado.
--
-- Acesso: só a própria pessoa (user_id da sessão), RLS ligado, nada para anon. Segue o S-05 (20261123150001): quem está
-- bloqueado não insere nem altera (políticas restritivas com public.can_write()), mas lê e apaga os próprios dados.
-- Os totais do ano até hoje NÃO têm tabela: são calculados no servidor a partir de fin_gastos.
--
-- Rollback (apaga só os tetos):
--   drop table public.fin_tetos;

create table public.fin_tetos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  categoria text not null check (char_length(btrim(categoria)) between 1 and 40),
  valor numeric(12, 2) not null check (valor > 0 and valor < 1000000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, categoria)
);

alter table public.fin_tetos enable row level security;

revoke all on public.fin_tetos from public, anon, authenticated;
grant select, insert, update, delete on public.fin_tetos to authenticated;

create policy fin_tetos_select on public.fin_tetos for select to authenticated using ((select auth.uid()) = user_id);
create policy fin_tetos_insert on public.fin_tetos for insert to authenticated with check ((select auth.uid()) = user_id);
create policy fin_tetos_update on public.fin_tetos for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy fin_tetos_delete on public.fin_tetos for delete to authenticated using ((select auth.uid()) = user_id);

-- S-05: quem está bloqueado não insere nem altera.
create policy fin_tetos_ativo_insert on public.fin_tetos as restrictive for insert to authenticated with check ((select public.can_write()));
create policy fin_tetos_ativo_update on public.fin_tetos as restrictive for update to authenticated using ((select public.can_write())) with check ((select public.can_write()));
