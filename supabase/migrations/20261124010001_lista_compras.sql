-- Lista de mercado pessoal. Migração aditiva.
-- Reversão preservando dados: LISTA_COMPRAS_ENABLED=0 e retorno ao deploy anterior.
create table public.lista_compras_itens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null check (nome = btrim(nome) and char_length(nome) between 1 and 120),
  -- Chave em minúsculas para o alfabeto latino usado em português, inclusive quando o cluster usa locale C.
  nome_chave text generated always as (
    lower(translate(nome, 'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞŸ', 'àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ') collate "C")
  ) stored,
  comprado boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index lista_compras_nome_por_pessoa
  on public.lista_compras_itens (user_id, nome_chave);
create index lista_compras_ordem
  on public.lista_compras_itens (user_id, comprado, created_at desc, id);

alter table public.lista_compras_itens enable row level security;
revoke all on public.lista_compras_itens from public, anon, authenticated;
grant select, insert, update (comprado), delete on public.lista_compras_itens to authenticated;

create policy lista_compras_select on public.lista_compras_itens
  for select to authenticated using (user_id = (select auth.uid()));
create policy lista_compras_insert on public.lista_compras_itens
  for insert to authenticated with check (user_id = (select auth.uid()) and (select public.can_write()));
create policy lista_compras_update on public.lista_compras_itens
  for update to authenticated using (user_id = (select auth.uid()) and (select public.can_write()))
  with check (user_id = (select auth.uid()));
create policy lista_compras_delete on public.lista_compras_itens
  for delete to authenticated using (user_id = (select auth.uid()));
