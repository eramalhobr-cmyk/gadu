-- Orçamento mensal de IA com reserva e reconciliação (achado P1 de docs/SECURITY_AUDIT_2026-11-12.md:
-- "verificação do teto não é reserva atômica"). Migração aditiva: não altera dados nem funções existentes.
--
-- Fluxo:
--   1. reserve_ai_budget(kind, estimativa): antes de chamar a IA. Trava por pessoa (advisory lock) e soma
--      gasto do mês + reservas abertas + estimativa; se passar do teto, nega. Senão grava a reserva.
--   2. settle_ai_budget(reserva, ...custo real): depois da resposta. Grava o consumo em usage_events e fecha
--      a reserva na MESMA transação (sem contar duas vezes, sem perder custo).
--   3. release_ai_budget(reserva): IA falhou ou foi cancelada antes de gerar custo.
--   4. expire_ai_reservations(): agendador (service role). Reservas vencidas já não contam no teto.
--
-- Rollback: drop das funções novas, de public.ai_reservations e das tabelas private.budget_policy e
-- private.user_budget. usage_events e month_spend() continuam como estão.

-- Política global (uma linha). Fora da API.
create table private.budget_policy (
  id boolean primary key default true check (id),
  monthly_limit_usd numeric(10, 2) not null check (monthly_limit_usd >= 0),
  min_reserve_usd numeric(10, 6) not null default 0.01 check (min_reserve_usd > 0),
  max_reserve_usd numeric(10, 6) not null default 1.00 check (max_reserve_usd > 0),
  reservation_ttl_seconds integer not null default 600 check (reservation_ttl_seconds between 60 and 86400),
  -- Teto somando todas as pessoas (proteção da conta). Nulo = sem teto global.
  global_monthly_limit_usd numeric(10, 2) check (global_monthly_limit_usd >= 0),
  updated_at timestamptz not null default now(),
  check (min_reserve_usd <= max_reserve_usd)
);
-- Igual ao MONTHLY_BUDGET_USD atual de produção (20).
insert into private.budget_policy (id, monthly_limit_usd) values (true, 20);

-- Teto individual (base da futura administração de créditos).
create table private.user_budget (
  user_id uuid primary key references auth.users (id) on delete cascade,
  monthly_limit_usd numeric(10, 2) not null check (monthly_limit_usd >= 0),
  updated_at timestamptz not null default now()
);

alter table private.budget_policy enable row level security;
alter table private.user_budget enable row level security;
revoke all on private.budget_policy, private.user_budget from public, anon, authenticated;

-- Reservas. A pessoa só lê as próprias; escrita apenas pelas funções abaixo.
create table public.ai_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('chat', 'summary', 'import')),
  amount_usd numeric(10, 6) not null check (amount_usd > 0),
  status text not null default 'reserved' check (status in ('reserved', 'settled', 'released', 'expired')),
  cost_usd numeric(10, 6) check (cost_usd >= 0),
  usage_event_id bigint references public.usage_events (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  closed_at timestamptz
);
create index ai_reservations_open_idx on public.ai_reservations (user_id, expires_at) where status = 'reserved';
create index ai_reservations_usage_event_idx on public.ai_reservations (usage_event_id);
alter table public.ai_reservations enable row level security;
create policy ai_reservations_select_own on public.ai_reservations for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.ai_reservations from public, anon, authenticated;

-- Início do mês em Brasília (mesma regra de month_spend()).
create function private.month_start() returns timestamptz
language sql stable set search_path = '' as $$
  select date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
$$;

create function public.reserve_ai_budget(p_kind text, p_estimate_usd numeric)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  pol private.budget_policy%rowtype;
  lim numeric;
  est numeric;
  spent numeric;
  held numeric;
  gspent numeric;
  gheld numeric;
  rid uuid;
begin
  if uid is null then
    return jsonb_build_object('allowed', false, 'reason', 'auth');
  end if;
  if p_kind is null or p_kind not in ('chat', 'summary', 'import') then
    return jsonb_build_object('allowed', false, 'reason', 'invalid');
  end if;
  select * into pol from private.budget_policy where id;
  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'monthly', 'spent', 0, 'reserved', 0, 'limit', 0);
  end if;

  -- Estimativa sempre dentro da faixa da política (não confia em quem chama).
  est := least(greatest(coalesce(p_estimate_usd, pol.max_reserve_usd), pol.min_reserve_usd), pol.max_reserve_usd);
  if p_estimate_usd is not null and (p_estimate_usd <> p_estimate_usd) then est := pol.max_reserve_usd; end if; -- NaN

  -- Serializa as reservas: primeiro a trava global (se houver teto global), depois a da pessoa. Ordem fixa evita deadlock.
  if pol.global_monthly_limit_usd is not null then
    perform pg_advisory_xact_lock(hashtextextended('gadu:budget:global', 0));
  end if;
  perform pg_advisory_xact_lock(hashtextextended('gadu:budget:' || uid::text, 0));

  lim := coalesce((select b.monthly_limit_usd from private.user_budget b where b.user_id = uid), pol.monthly_limit_usd);
  select coalesce(sum(u.cost_usd), 0) into spent from public.usage_events u where u.user_id = uid and u.created_at >= private.month_start();
  select coalesce(sum(r.amount_usd), 0) into held from public.ai_reservations r where r.user_id = uid and r.status = 'reserved' and r.expires_at > now();

  if lim <= 0 or spent + held + est > lim then
    return jsonb_build_object('allowed', false, 'reason', 'monthly', 'spent', spent, 'reserved', held, 'limit', lim);
  end if;

  if pol.global_monthly_limit_usd is not null then
    select coalesce(sum(u.cost_usd), 0) into gspent from public.usage_events u where u.created_at >= private.month_start();
    select coalesce(sum(r.amount_usd), 0) into gheld from public.ai_reservations r where r.status = 'reserved' and r.expires_at > now();
    if gspent + gheld + est > pol.global_monthly_limit_usd then
      return jsonb_build_object('allowed', false, 'reason', 'global', 'spent', spent, 'reserved', held, 'limit', lim);
    end if;
  end if;

  insert into public.ai_reservations (user_id, kind, amount_usd, expires_at)
  values (uid, p_kind, est, now() + make_interval(secs => pol.reservation_ttl_seconds))
  returning id into rid;

  return jsonb_build_object('allowed', true, 'reservation_id', rid, 'amount', est, 'spent', spent, 'reserved', held + est, 'limit', lim);
end;
$$;

create function public.settle_ai_budget(
  p_reservation uuid, p_provider text, p_model text, p_input_tokens integer, p_output_tokens integer, p_cost_usd numeric
)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  r public.ai_reservations%rowtype;
  ev bigint;
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;
  if p_cost_usd is null or p_cost_usd < 0 or p_cost_usd > 100 or p_cost_usd <> p_cost_usd then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if p_provider is null or p_provider not in ('anthropic', 'gateway', 'gemini') then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select * into r from public.ai_reservations where id = p_reservation and user_id = uid for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if r.status = 'settled' then
    return jsonb_build_object('ok', true, 'already', true, 'cost', r.cost_usd);  -- idempotente
  end if;
  if r.status = 'released' then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;
  -- 'reserved' ou 'expired' (resposta longa): registra o custo real.

  insert into public.usage_events (user_id, provider, model, kind, input_tokens, output_tokens, cost_usd)
  values (uid, p_provider, left(coalesce(p_model, 'desconhecido'), 80), r.kind, greatest(coalesce(p_input_tokens, 0), 0), greatest(coalesce(p_output_tokens, 0), 0), p_cost_usd)
  returning id into ev;

  update public.ai_reservations
     set status = 'settled', cost_usd = p_cost_usd, usage_event_id = ev, closed_at = now()
   where id = r.id;

  return jsonb_build_object('ok', true, 'cost', p_cost_usd, 'over', p_cost_usd > r.amount_usd);
end;
$$;

create function public.release_ai_budget(p_reservation uuid)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  n integer;
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;
  update public.ai_reservations
     set status = 'released', closed_at = now()
   where id = p_reservation and user_id = uid and status in ('reserved', 'expired');
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'released', n > 0);
end;
$$;

-- Agendador: marca reservas vencidas (elas já não contam no teto; isto só organiza e permite auditoria).
create function public.expire_ai_reservations()
returns integer
language sql volatile security definer set search_path = ''
as $$
  with done as (
    update public.ai_reservations set status = 'expired', closed_at = now()
     where status = 'reserved' and expires_at <= now()
    returning 1
  )
  select count(*)::int from done;
$$;

-- Situação do mês da própria pessoa (para a tela de Ajustes).
create function public.budget_status()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  lim numeric;
begin
  if uid is null then return null; end if;
  lim := coalesce((select b.monthly_limit_usd from private.user_budget b where b.user_id = uid), (select p.monthly_limit_usd from private.budget_policy p where p.id), 0);
  return jsonb_build_object(
    'spent', (select coalesce(sum(u.cost_usd), 0) from public.usage_events u where u.user_id = uid and u.created_at >= private.month_start()),
    'reserved', (select coalesce(sum(r.amount_usd), 0) from public.ai_reservations r where r.user_id = uid and r.status = 'reserved' and r.expires_at > now()),
    'limit', lim
  );
end;
$$;

revoke execute on function public.reserve_ai_budget(text, numeric) from public, anon;
revoke execute on function public.settle_ai_budget(uuid, text, text, integer, integer, numeric) from public, anon;
revoke execute on function public.release_ai_budget(uuid) from public, anon;
revoke execute on function public.budget_status() from public, anon;
revoke execute on function public.expire_ai_reservations() from public, anon, authenticated;
revoke execute on function private.month_start() from public, anon, authenticated;
grant execute on function public.reserve_ai_budget(text, numeric) to authenticated;
grant execute on function public.settle_ai_budget(uuid, text, text, integer, integer, numeric) to authenticated;
grant execute on function public.release_ai_budget(uuid) to authenticated;
grant execute on function public.budget_status() to authenticated;
grant execute on function public.expire_ai_reservations() to service_role;
