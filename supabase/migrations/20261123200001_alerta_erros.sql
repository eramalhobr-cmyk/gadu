-- Monitoramento e alerta de erro (P1). Migração ADITIVA: não apaga, não renomeia, não revoga nada que já existe.
--
-- 1) error_events.user_id deixa de ser obrigatório: erro de cron ou de sistema (sem sessão) também é registrado.
--    Só AFROUXA a restrição. O FK e o on delete cascade continuam valendo quando houver user_id
--    (UUID que não existe em auth.users continua recusado).
-- 2) error_alert_state: uma linha por impressão digital (grupo de erro) com as datas da primeira e da última ocorrência
--    e do último alerta. É o que impede spam de push (1 por grupo a cada 6 h).
-- 3) error_alert_dia: um "vale" por alerta enviado no dia (fuso de Brasília), chave (dia, vaga). A vaga é tomada com
--    insert; a chave primária impede duas execuções de tomarem a mesma. É o teto de pushes de erro por dia.
--
-- As duas tabelas novas são de SISTEMA: sem user_id e sem dado pessoal (só hash, datas e contadores).
-- Escrita: SÓ service_role. Leitura: só pelo servidor (a API de admin já usa a chave de serviço); authenticated e anon
-- não recebem nenhum privilégio. RLS ligado, sem política (nega tudo a quem não é service_role, que ignora RLS).
-- Por isso não há política restritiva S-05: ninguém autenticado insere, altera ou apaga nestas tabelas.
--
-- Rollback (só remove o que esta migração criou; o afrouxamento do user_id é seguro de manter):
--   drop table public.error_alert_dia;
--   drop table public.error_alert_state;

alter table public.error_events alter column user_id drop not null;

create table public.error_alert_state (
  impressao text primary key check (char_length(impressao) between 16 and 64),
  primeira_vez timestamptz not null default now(),
  ultima_vez timestamptz not null default now(),
  ultimo_alerta timestamptz,
  alertas integer not null default 0 check (alertas >= 0)
);
create index error_alert_state_ultima_idx on public.error_alert_state (ultima_vez desc);

create table public.error_alert_dia (
  dia date not null,
  vaga smallint not null check (vaga between 1 and 50),
  created_at timestamptz not null default now(),
  primary key (dia, vaga)
);

alter table public.error_alert_state enable row level security;
alter table public.error_alert_dia enable row level security;

revoke all on public.error_alert_state from public, anon, authenticated;
revoke all on public.error_alert_dia from public, anon, authenticated;
grant select, insert, update, delete on public.error_alert_state to service_role;
grant select, insert, delete on public.error_alert_dia to service_role;
