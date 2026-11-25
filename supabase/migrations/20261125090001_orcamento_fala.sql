-- Voz natural. Acrescenta speech ao orçamento; não altera registros existentes.
-- Rollback operacional: SPEECH_ENABLED=0 preserva o histórico de uso.
alter table public.usage_events drop constraint if exists usage_events_kind_check;
alter table public.usage_events add constraint usage_events_kind_check check (kind in ('chat', 'summary', 'import', 'transcribe', 'speech'));

alter table public.ai_reservations drop constraint if exists ai_reservations_kind_check;
alter table public.ai_reservations add constraint ai_reservations_kind_check check (kind in ('chat', 'summary', 'import', 'transcribe', 'speech'));

-- Mesma função da migração 20261122120001, com 'speech' na lista de tipos. Permissões são mantidas pelo
-- "create or replace"; reaplicadas abaixo por clareza.
create or replace function public.server_reserve_ai_budget(p_user uuid, p_kind text, p_estimate_usd numeric)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  pol private.budget_policy%rowtype;
  lim numeric;
  est numeric;
  spent numeric;
  held numeric;
  gspent numeric;
  gheld numeric;
  rid uuid;
begin
  if p_user is null then
    return jsonb_build_object('allowed', false, 'reason', 'auth');
  end if;
  if private.is_blocked(p_user) then
    return jsonb_build_object('allowed', false, 'reason', 'blocked');
  end if;
  if p_kind is null or p_kind not in ('chat', 'summary', 'import', 'transcribe', 'speech') then
    return jsonb_build_object('allowed', false, 'reason', 'invalid');
  end if;
  select * into pol from private.budget_policy where id;
  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'monthly', 'spent', 0, 'reserved', 0, 'limit', 0);
  end if;

  est := least(greatest(coalesce(p_estimate_usd, pol.max_reserve_usd), pol.min_reserve_usd), pol.max_reserve_usd);
  if p_estimate_usd is not null and (p_estimate_usd <> p_estimate_usd) then est := pol.max_reserve_usd; end if; -- NaN

  -- Mesma ordem de travas da versão antiga (global, depois a da pessoa): sem deadlock entre as duas.
  if pol.global_monthly_limit_usd is not null then
    perform pg_advisory_xact_lock(hashtextextended('gadu:budget:global', 0));
  end if;
  perform pg_advisory_xact_lock(hashtextextended('gadu:budget:' || p_user::text, 0));

  lim := coalesce((select b.monthly_limit_usd from private.user_budget b where b.user_id = p_user), pol.monthly_limit_usd);
  select coalesce(sum(u.cost_usd), 0) into spent from public.usage_events u where u.user_id = p_user and u.created_at >= private.month_start();
  select coalesce(sum(r.amount_usd), 0) into held from public.ai_reservations r where r.user_id = p_user and r.status = 'reserved' and r.expires_at > now();

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
  values (p_user, p_kind, est, now() + make_interval(secs => pol.reservation_ttl_seconds))
  returning id into rid;

  return jsonb_build_object('allowed', true, 'reservation_id', rid, 'amount', est, 'spent', spent, 'reserved', held + est, 'limit', lim);
end;
$$;
revoke execute on function public.server_reserve_ai_budget(uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.server_reserve_ai_budget(uuid, text, numeric) to service_role;
