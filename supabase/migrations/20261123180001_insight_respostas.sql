-- Percepções do briefing com Aceitar/Ignorar (ROADMAP, Pessoal: `insights`). Migração ADITIVA: 1 tabela nova, nada existente muda.
-- As percepções (atrasos, conflito na agenda, e-mail importante parado, janela livre, dia cheio) continuam calculadas sem IA
-- em src/lib/insights.ts, a cada leitura; aqui fica só a RESPOSTA da pessoa a cada tipo, por dia, para o GaDu não insistir.
-- Nenhum conteúdo de e-mail, evento ou tarefa é guardado: só dia, tipo e decisão.
--
-- Acesso: só a própria pessoa, RLS ligado, nada para anon. S-05: quem está bloqueado não insere nem altera (can_write),
-- mas lê e apaga as próprias linhas.
--
-- Rollback: drop table public.insight_respostas;

create table public.insight_respostas (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dia date not null,
  tipo text not null check (tipo in ('conflito', 'livre', 'atrasadas', 'email', 'cheio')),
  decisao text not null check (decisao in ('aceita', 'ignorada')),
  created_at timestamptz not null default now(),
  primary key (user_id, dia, tipo)
);

alter table public.insight_respostas enable row level security;

revoke all on public.insight_respostas from public, anon, authenticated;
grant select, insert, update, delete on public.insight_respostas to authenticated;

create policy insight_respostas_select on public.insight_respostas for select to authenticated using ((select auth.uid()) = user_id);
create policy insight_respostas_insert on public.insight_respostas for insert to authenticated with check ((select auth.uid()) = user_id);
create policy insight_respostas_update on public.insight_respostas for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy insight_respostas_delete on public.insight_respostas for delete to authenticated using ((select auth.uid()) = user_id);

-- S-05: quem está bloqueado não insere nem altera.
create policy insight_respostas_ativo_insert on public.insight_respostas as restrictive for insert to authenticated with check ((select public.can_write()));
create policy insight_respostas_ativo_update on public.insight_respostas as restrictive for update to authenticated using ((select public.can_write())) with check ((select public.can_write()));
