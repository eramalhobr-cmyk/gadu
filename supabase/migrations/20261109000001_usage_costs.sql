-- Consumo de cada resposta, para mostrar o gasto do mês e aplicar o teto mensal.
alter table public.messages
  add column input_tokens integer check (input_tokens >= 0),
  add column output_tokens integer check (output_tokens >= 0),
  add column cost_usd numeric(10, 6) check (cost_usd >= 0);

-- Soma rápida do gasto do mês por pessoa.
create index messages_user_created_idx on public.messages (user_id, created_at desc);

-- Gasto da própria pessoa no mês corrente (horário de Brasília). RLS vale (security invoker).
create or replace function public.month_spend()
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(m.cost_usd), 0)
  from public.messages m
  where m.user_id = (select auth.uid())
    and m.created_at >= date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
$$;
revoke execute on function public.month_spend() from public, anon;
grant execute on function public.month_spend() to authenticated;
