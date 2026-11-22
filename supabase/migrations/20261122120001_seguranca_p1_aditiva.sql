-- Segurança P1, etapa 1 de 2 (ADITIVA e compatível com o app que está em produção hoje).
-- Auditoria: docs/SECURITY_AUDIT_2026-11-15.md (S-01, S-03, S-04, S-05).
--
-- O que esta migração faz (nada é removido nem revogado aqui):
--   1. Funções de orçamento SÓ DO SERVIDOR: server_reserve/settle/release_ai_budget(p_user, ...). Recebem o
--      user_id da sessão (validada pelo servidor) e só o service_role executa. As antigas continuam como estão
--      até a etapa 2 (20261122120002), que revoga o execute delas.
--   2. server_settle_ai_budget grava o custo REAL mesmo que a reserva já tenha sido liquidada com custo menor
--      (grava a diferença) ou liberada. Idempotente: repetir a mesma liquidação não duplica.
--   3. Acesso: quem tem members.access <> 'active' não reserva orçamento nem consome cota (função nova e
--      consume_daily_quota), e é ignorado por index_backlog (agendador).
--   4. Limite de tentativas por IP e por e-mail: private.rate_limits + public.auth_rate_limit_hit (service_role).
--   5. server_revoke_user_sessions: encerra as sessões de alguém ao bloquear (auth.admin.signOut do supabase-js
--      exige o JWT da pessoa, não o id).
--
-- Pode ser aplicada ANTES do deploy do app novo: o app de hoje não chama nada daqui e as funções alteradas
-- (consume_daily_quota, index_backlog) mantêm assinatura e retorno.
--
-- Rollback (sem perda de dados; as tabelas de consumo e reservas não são tocadas):
--   drop function public.server_reserve_ai_budget(uuid, text, numeric);
--   drop function public.server_settle_ai_budget(uuid, uuid, text, text, integer, integer, numeric);
--   drop function public.server_release_ai_budget(uuid, uuid);
--   drop function public.auth_rate_limit_hit(text, text, integer, integer);
--   drop function public.server_revoke_user_sessions(uuid);
--   drop table private.rate_limits;
--   drop function private.is_blocked(uuid);   -- depois de restaurar consume_daily_quota e index_backlog
--   e recriar consume_daily_quota() e index_backlog(int) com as definições das migrações 20261113120001 e
--   20261110120001.

-- Bloqueado = existe linha em members com acesso diferente de 'active'. Quem entra só pela lista do servidor
-- (ALLOWED_EMAILS) e não tem linha continua com acesso, igual a src/lib/access.ts.
create function private.is_blocked(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.members m where m.user_id = p_user and m.access <> 'active')
$$;
revoke execute on function private.is_blocked(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Orçamento: versões do servidor (recebem o user_id, não usam auth.uid()).
-- ---------------------------------------------------------------------------------------------------------
create function public.server_reserve_ai_budget(p_user uuid, p_kind text, p_estimate_usd numeric)
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
  if p_kind is null or p_kind not in ('chat', 'summary', 'import') then
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

-- Liquida pelo custo real. O servidor é a fonte de verdade do custo: por isso grava mesmo se a reserva estiver
-- liberada ou expirada, e completa a diferença se ela já tiver sido liquidada com um valor menor.
create function public.server_settle_ai_budget(
  p_user uuid, p_reservation uuid, p_provider text, p_model text, p_input_tokens integer, p_output_tokens integer, p_cost_usd numeric
)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  r public.ai_reservations%rowtype;
  ev bigint;
  diff numeric;
begin
  if p_user is null then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;
  if p_cost_usd is null or p_cost_usd < 0 or p_cost_usd > 100 or p_cost_usd <> p_cost_usd then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if p_provider is null or p_provider not in ('anthropic', 'gateway', 'gemini') then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select * into r from public.ai_reservations where id = p_reservation and user_id = p_user for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;

  if r.status = 'settled' then
    diff := p_cost_usd - coalesce(r.cost_usd, 0);
    if diff > 0 then
      insert into public.usage_events (user_id, provider, model, kind, input_tokens, output_tokens, cost_usd)
      values (p_user, p_provider, left(coalesce(p_model, 'desconhecido'), 80), r.kind, greatest(coalesce(p_input_tokens, 0), 0), greatest(coalesce(p_output_tokens, 0), 0), diff);
      update public.ai_reservations set cost_usd = p_cost_usd where id = r.id;
      return jsonb_build_object('ok', true, 'already', true, 'cost', p_cost_usd, 'adjusted', diff);
    end if;
    return jsonb_build_object('ok', true, 'already', true, 'cost', r.cost_usd);  -- idempotente
  end if;

  -- 'reserved', 'expired' ou 'released': registra o custo real.
  insert into public.usage_events (user_id, provider, model, kind, input_tokens, output_tokens, cost_usd)
  values (p_user, p_provider, left(coalesce(p_model, 'desconhecido'), 80), r.kind, greatest(coalesce(p_input_tokens, 0), 0), greatest(coalesce(p_output_tokens, 0), 0), p_cost_usd)
  returning id into ev;

  update public.ai_reservations
     set status = 'settled', cost_usd = p_cost_usd, usage_event_id = ev, closed_at = now()
   where id = r.id;

  return jsonb_build_object('ok', true, 'cost', p_cost_usd, 'over', p_cost_usd > r.amount_usd);
end;
$$;

create function public.server_release_ai_budget(p_user uuid, p_reservation uuid)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  n integer;
begin
  if p_user is null then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;
  update public.ai_reservations
     set status = 'released', closed_at = now()
   where id = p_reservation and user_id = p_user and status in ('reserved', 'expired');
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'released', n > 0);
end;
$$;

revoke execute on function public.server_reserve_ai_budget(uuid, text, numeric) from public, anon, authenticated;
revoke execute on function public.server_settle_ai_budget(uuid, uuid, text, text, integer, integer, numeric) from public, anon, authenticated;
revoke execute on function public.server_release_ai_budget(uuid, uuid) from public, anon, authenticated;
grant execute on function public.server_reserve_ai_budget(uuid, text, numeric) to service_role;
grant execute on function public.server_settle_ai_budget(uuid, uuid, text, text, integer, integer, numeric) to service_role;
grant execute on function public.server_release_ai_budget(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------------------------------------
-- Cota diária: igual à versão anterior, mais a recusa de quem não está ativo (S-05).
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.consume_daily_quota()
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  lim integer;
  n integer;
begin
  if uid is null or private.is_blocked(uid) then
    return jsonb_build_object('allowed', false, 'used', 0, 'limit', 0);
  end if;

  select coalesce(
    (select q.daily_limit from private.user_quota q where q.user_id = uid),
    (select p.daily_limit from private.quota_policy p where p.id),
    0  -- sem política configurada: fecha (fail closed)
  ) into lim;

  if lim <= 0 then
    select d.messages into n from public.usage_daily d where d.user_id = uid and d.day = today;
    return jsonb_build_object('allowed', false, 'used', coalesce(n, 0), 'limit', lim);
  end if;

  insert into public.usage_daily as d (user_id, day, messages)
  values (uid, today, 1)
  on conflict (user_id, day) do update
    set messages = d.messages + 1
    where d.messages < lim
  returning d.messages into n;

  if n is null then
    select d.messages into n from public.usage_daily d where d.user_id = uid and d.day = today;
    return jsonb_build_object('allowed', false, 'used', coalesce(n, lim), 'limit', lim);
  end if;

  return jsonb_build_object('allowed', true, 'used', n, 'limit', lim);
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Agendador: a indexação ignora quem não está ativo (S-04). Mesma assinatura e mesmo retorno.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.index_backlog(lim int default 40)
returns table (user_id uuid, kind text, ref_id bigint, content text)
language sql stable security definer set search_path = ''
as $$
  (select m.user_id, 'memory', m.id, '[' || m.area || '] ' || m.content
     from public.memories m
     left join public.search_index s on s.user_id = m.user_id and s.kind = 'memory' and s.ref_id = m.id
    where m.status = 'approved' and (s.id is null or s.updated_at < m.updated_at)
      and not private.is_blocked(m.user_id)
    limit lim)
  union all
  (select c.user_id, 'conversation', c.id, coalesce(c.title, '') || ': ' || c.summary
     from public.conversations c
     left join public.search_index s on s.user_id = c.user_id and s.kind = 'conversation' and s.ref_id = c.id
    where c.summary is not null and (s.id is null or s.updated_at < c.summary_at)
      and not private.is_blocked(c.user_id)
    limit lim)
  union all
  (select t.user_id, 'task', t.id, t.title || coalesce(' — ' || t.notes, '')
     from public.tasks t
     left join public.search_index s on s.user_id = t.user_id and s.kind = 'task' and s.ref_id = t.id
    where t.status <> 'cancelled' and (s.id is null or s.updated_at < t.updated_at)
      and not private.is_blocked(t.user_id)
    limit lim)
  union all
  (select p.user_id, 'project', p.id, p.name || coalesce(': ' || p.goal, '') || coalesce('. ' || p.next_steps, '')
     from public.projects p
     left join public.search_index s on s.user_id = p.user_id and s.kind = 'project' and s.ref_id = p.id
    where (s.id is null or s.updated_at < p.updated_at)
      and not private.is_blocked(p.user_id)
    limit lim);
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Limite de tentativas (S-03): janela fixa por balde e chave. A chave chega já com hash (nunca e-mail ou IP puro).
-- ---------------------------------------------------------------------------------------------------------
create table private.rate_limits (
  bucket text not null check (bucket in ('password_ip', 'password_email', 'otp_ip', 'otp_email', 'verify_ip', 'verify_email', 'invite_ip', 'invite_token')),
  key_hash text not null check (char_length(key_hash) between 16 and 128),
  window_start timestamptz not null,
  hits integer not null default 0 check (hits >= 0),
  primary key (bucket, key_hash, window_start)
);
create index rate_limits_window_idx on private.rate_limits (window_start);
alter table private.rate_limits enable row level security;
revoke all on private.rate_limits from public, anon, authenticated;

-- Conta uma tentativa e diz se ainda está dentro do limite.
-- Retorno: {"allowed": bool, "hits": int, "limit": int, "retry_after": segundos até a janela virar}.
create function public.auth_rate_limit_hit(p_bucket text, p_key_hash text, p_limit integer, p_window_seconds integer)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  ws timestamptz;
  n integer;
begin
  if p_bucket is null or p_key_hash is null or char_length(p_key_hash) not between 16 and 128
     or p_limit is null or p_limit < 1 or p_window_seconds is null or p_window_seconds not between 10 and 86400 then
    raise exception 'parametros invalidos' using errcode = '22023';
  end if;
  ws := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into private.rate_limits as r (bucket, key_hash, window_start, hits)
  values (p_bucket, p_key_hash, ws, 1)
  on conflict (bucket, key_hash, window_start) do update set hits = r.hits + 1
  returning r.hits into n;

  -- Limpeza ocasional de janelas antigas (1% das chamadas).
  if random() < 0.01 then
    delete from private.rate_limits where window_start < now() - interval '2 days';
  end if;

  return jsonb_build_object(
    'allowed', n <= p_limit,
    'hits', n,
    'limit', p_limit,
    'retry_after', greatest(1, ceil(extract(epoch from (ws + make_interval(secs => p_window_seconds) - now()))))::int
  );
end;
$$;
revoke execute on function public.auth_rate_limit_hit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.auth_rate_limit_hit(text, text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------------------------------------
-- Encerrar as sessões de uma pessoa (ao bloquear). Só o servidor.
-- ---------------------------------------------------------------------------------------------------------
create function public.server_revoke_user_sessions(p_user uuid)
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  n integer;
begin
  if p_user is null then return 0; end if;
  delete from auth.sessions where user_id = p_user;  -- os refresh tokens saem junto (cascata do Auth)
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.server_revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.server_revoke_user_sessions(uuid) to service_role;
