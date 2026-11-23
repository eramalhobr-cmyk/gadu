-- Agentes com ferramentas permitidas e teto de gasto próprios (ROADMAP, Pessoal). Migração ADITIVA:
--   1. agents ganha 2 colunas com padrão que mantém o comportamento de hoje (todas as ferramentas, sem teto próprio);
--   2. uma restrição de unicidade (id, user_id) em agents (id já é chave primária: nunca falha, só habilita a chave composta);
--   3. tabela nova agent_uso (gasto do mês por agente), que SÓ o servidor grava, por uma função nova restrita ao service_role.
-- Nada existente muda: nenhuma política, função, gatilho ou coluna antiga. O teto global e as funções de orçamento
-- (server_reserve/settle/release_ai_budget) continuam iguais; o teto do agente é uma checagem a mais, antes da reserva.
--
-- Rollback:
--   drop function public.server_add_agent_usage(uuid, bigint, numeric);
--   drop table public.agent_uso;
--   alter table public.agents drop constraint agents_id_user_unique;
--   alter table public.agents drop column teto_mensal_usd, drop column ferramentas;

alter table public.agents
  add column ferramentas text[] not null default array['agenda', 'email', 'tarefas', 'lembretes', 'financas', 'metas', 'memoria', 'acoes']::text[],
  add column teto_mensal_usd numeric(8, 2);
alter table public.agents add constraint agents_ferramentas_validas
  check (ferramentas <@ array['agenda', 'email', 'tarefas', 'lembretes', 'financas', 'metas', 'memoria', 'acoes']::text[] and cardinality(ferramentas) <= 8);
alter table public.agents add constraint agents_teto_mensal_valido
  check (teto_mensal_usd is null or (teto_mensal_usd > 0 and teto_mensal_usd <= 100));
alter table public.agents add constraint agents_id_user_unique unique (id, user_id);

-- Gasto do mês por agente (mês = dia 1, horário de Brasília). Leitura: só a própria pessoa. Escrita: só o servidor.
create table public.agent_uso (
  user_id uuid not null references auth.users (id) on delete cascade,
  agent_id bigint not null,
  mes date not null check (extract(day from mes) = 1),
  custo_usd numeric(10, 6) not null default 0 check (custo_usd >= 0),
  mensagens integer not null default 0 check (mensagens >= 0),
  updated_at timestamptz not null default now(),
  primary key (agent_id, mes),
  constraint agent_uso_agent_fk foreign key (agent_id, user_id) references public.agents (id, user_id) on delete cascade
);
create index agent_uso_user_mes_idx on public.agent_uso (user_id, mes);

alter table public.agent_uso enable row level security;
revoke all on public.agent_uso from public, anon, authenticated;
grant select on public.agent_uso to authenticated;
create policy agent_uso_select on public.agent_uso for select to authenticated using ((select auth.uid()) = user_id);

-- Soma o custo de uma resposta ao mês do agente (atômico). Só o servidor (service_role) executa.
-- O agente precisa ser da pessoa (a chave composta recusa outro dono).
create function public.server_add_agent_usage(p_user uuid, p_agent bigint, p_cost_usd numeric)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.agents a where a.id = p_agent and a.user_id = p_user) then
    raise exception 'agente não pertence à pessoa' using errcode = 'foreign_key_violation';
  end if;
  insert into public.agent_uso (user_id, agent_id, mes, custo_usd, mensagens, updated_at)
  values (p_user, p_agent, date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date, greatest(coalesce(p_cost_usd, 0), 0), 1, now())
  on conflict (agent_id, mes) do update
    set custo_usd = public.agent_uso.custo_usd + excluded.custo_usd,
        mensagens = public.agent_uso.mensagens + 1,
        updated_at = now();
end $$;
revoke execute on function public.server_add_agent_usage(uuid, bigint, numeric) from public, anon, authenticated;
grant execute on function public.server_add_agent_usage(uuid, bigint, numeric) to service_role;
