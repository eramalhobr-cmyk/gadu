-- Cota diária atômica, com limite controlado pelo servidor e dia de Brasília.
-- Corrige o achado P1 de docs/SECURITY_AUDIT_2026-11-12.md:
--   1. consume_quota(p_limit) incrementava a contagem mesmo depois do teto;
--   2. o limite vinha como argumento (chamável direto por qualquer usuário autenticado);
--   3. o "dia" era current_date do servidor (UTC), virando às 21h de Brasília.
--
-- Implantação em duas etapas (sem janela de quebra):
--   Etapa 1 (esta migração): cria a política e a função nova; a antiga continua disponível
--     para a versão do app que ainda está em produção.
--   Etapa 2 (migração futura, depois do deploy do app novo): revogar e remover consume_quota(integer).
--
-- Rollback: `drop function public.consume_daily_quota(); drop table private.user_quota; drop table private.quota_policy;`
-- e voltar o app para consume_quota. Nenhum dado existente é alterado ou apagado.

-- Política global (uma única linha). Fica no schema private: não é exposta pela API.
create table private.quota_policy (
  id boolean primary key default true check (id),
  daily_limit integer not null check (daily_limit >= 0),
  updated_at timestamptz not null default now()
);
-- Valor igual ao DAILY_MESSAGE_LIMIT atual de produção.
insert into private.quota_policy (id, daily_limit) values (true, 150);

-- Exceção por pessoa (base para a futura administração de créditos). Também só no schema private.
create table private.user_quota (
  user_id uuid primary key references auth.users (id) on delete cascade,
  daily_limit integer not null check (daily_limit >= 0),
  updated_at timestamptz not null default now()
);

-- Defesa extra: RLS ligada e nenhuma política para usuários; só o dono do banco e o service role leem.
alter table private.quota_policy enable row level security;
alter table private.user_quota enable row level security;
revoke all on private.quota_policy, private.user_quota from public, anon, authenticated;

-- Consome uma mensagem da cota do dia da própria pessoa, sem nunca passar do limite.
-- Atomicidade: o UPDATE do ON CONFLICT trava a linha e reavalia o WHERE na versão mais recente,
-- então requisições simultâneas não ultrapassam o limite.
-- Retorno: {"allowed": bool, "used": int, "limit": int}.
create function public.consume_daily_quota()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  lim integer;
  n integer;
begin
  if uid is null then
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
    -- Conflito com a linha do dia já no limite: nada foi incrementado.
    select d.messages into n from public.usage_daily d where d.user_id = uid and d.day = today;
    return jsonb_build_object('allowed', false, 'used', coalesce(n, lim), 'limit', lim);
  end if;

  return jsonb_build_object('allowed', true, 'used', n, 'limit', lim);
end;
$$;

revoke execute on function public.consume_daily_quota() from public, anon;
grant execute on function public.consume_daily_quota() to authenticated;

comment on function public.consume_daily_quota() is
  'Cota diária atômica (dia de Brasília, limite em private.quota_policy/private.user_quota). Substitui consume_quota(integer).';
