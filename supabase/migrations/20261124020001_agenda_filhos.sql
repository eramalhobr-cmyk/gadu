-- Agenda de filhos: fins de semana alternados. Migração aditiva (aprovada pelo Eduardo em 23/11/2026).
-- Nada de nome, idade ou dado das crianças: só datas e de quem é o fim de semana.
-- Reversão preservando dados: AGENDA_FILHOS_ENABLED=0 e retorno ao deploy anterior.

-- Referência: um sábado em que as crianças ficam com a pessoa. Daí em diante, alterna a cada semana.
create table public.filhos_agenda_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ancora date not null check (extract(isodow from ancora) = 6),
  inicio text not null default 'sexta' check (inicio in ('sexta', 'sabado')),
  fim text not null default 'domingo' check (fim in ('domingo', 'segunda')),
  -- Feriado na sexta ou na segunda colado ao fim de semana fica com quem tem o fim de semana.
  feriado_segue boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Ajustes: "troca" muda só aquele fim de semana; "recorrencia" recomeça a alternância a partir daquele sábado.
create table public.filhos_agenda_ajustes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('troca', 'recorrencia')),
  data date not null check (extract(isodow from data) = 6),
  comigo boolean not null,
  created_at timestamptz not null default now(),
  unique (user_id, tipo, data)
);

alter table public.filhos_agenda_config enable row level security;
alter table public.filhos_agenda_ajustes enable row level security;
revoke all on public.filhos_agenda_config from public, anon, authenticated;
revoke all on public.filhos_agenda_ajustes from public, anon, authenticated;
grant select, insert, update (ancora, inicio, fim, feriado_segue, updated_at), delete on public.filhos_agenda_config to authenticated;
grant select, insert, update (comigo), delete on public.filhos_agenda_ajustes to authenticated;

create policy filhos_config_select on public.filhos_agenda_config
  for select to authenticated using (user_id = (select auth.uid()));
create policy filhos_config_insert on public.filhos_agenda_config
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy filhos_config_update on public.filhos_agenda_config
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy filhos_config_delete on public.filhos_agenda_config
  for delete to authenticated using (user_id = (select auth.uid()));

create policy filhos_ajustes_select on public.filhos_agenda_ajustes
  for select to authenticated using (user_id = (select auth.uid()));
create policy filhos_ajustes_insert on public.filhos_agenda_ajustes
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy filhos_ajustes_update on public.filhos_agenda_ajustes
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy filhos_ajustes_delete on public.filhos_agenda_ajustes
  for delete to authenticated using (user_id = (select auth.uid()));

-- S-05: conta bloqueada não insere nem altera (apagar continua permitido).
create policy filhos_agenda_config_ativo_insert on public.filhos_agenda_config as restrictive for insert to authenticated with check ((select public.can_write()));
create policy filhos_agenda_config_ativo_update on public.filhos_agenda_config as restrictive for update to authenticated using ((select public.can_write())) with check ((select public.can_write()));
create policy filhos_agenda_ajustes_ativo_insert on public.filhos_agenda_ajustes as restrictive for insert to authenticated with check ((select public.can_write()));
create policy filhos_agenda_ajustes_ativo_update on public.filhos_agenda_ajustes as restrictive for update to authenticated using ((select public.can_write())) with check ((select public.can_write()));
