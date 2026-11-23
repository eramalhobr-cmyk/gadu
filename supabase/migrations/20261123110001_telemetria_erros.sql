-- Telemetria de erros (Tarefa 8a): registro gratuito dos erros do servidor e do cliente, só para o administrador ler.
-- Migração ADITIVA: cria UMA tabela nova. Nenhuma tabela existente muda.
--
-- Privacidade: a tabela NÃO guarda texto de mensagem, e-mail, IP, corpo de requisição nem conteúdo da pessoa.
-- Guarda só: de onde veio (servidor/cliente), a rota (sem query string), o nome e o código do erro, o status HTTP,
-- o local do código ("arquivo:linha", validado pelo servidor), a versão do deploy e uma impressão digital (hash) para agrupar iguais.
--
-- Acesso:
--   - Escrita: SÓ o servidor (service_role, pela rota /api/telemetria/erro e pelo registro de erros do servidor).
--     authenticated e anon não recebem nenhum privilégio de escrita (nem insert, nem update, nem delete).
--   - Leitura: SÓ administrador (members.role = 'admin' e access = 'active'). Pessoa comum não lê nem as próprias linhas.
-- user_id é a pessoa logada que gerou o erro (a rota exige sessão); apagar a conta apaga os registros (on delete cascade).
--
-- Rollback (apaga só os registros de erro):
--   drop table public.error_events;

create table public.error_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  origem text not null check (origem in ('servidor', 'cliente')),
  rota text not null check (char_length(rota) between 1 and 200 and rota !~ '[?#\s]'),
  nome text not null check (char_length(btrim(nome)) between 1 and 80),
  codigo text check (char_length(codigo) between 1 and 40),
  status integer check (status between 100 and 599),
  local_codigo text check (char_length(local_codigo) <= 200),
  versao text check (char_length(versao) <= 40),
  impressao text not null check (char_length(impressao) between 16 and 64)
);
create index error_events_created_idx on public.error_events (created_at desc);
create index error_events_impressao_idx on public.error_events (impressao, created_at desc);
create index error_events_user_idx on public.error_events (user_id, created_at desc);

alter table public.error_events enable row level security;

revoke all on public.error_events from public, anon, authenticated;
grant select on public.error_events to authenticated;
grant select, insert, delete on public.error_events to service_role;

-- Só administrador ativo lê. members tem a política "cada pessoa lê a própria linha", então a subconsulta funciona na sessão.
create policy error_events_select_admin on public.error_events for select to authenticated
  using (exists (
    select 1 from public.members m
    where m.user_id = (select auth.uid()) and m.role = 'admin' and m.access = 'active'
  ));
