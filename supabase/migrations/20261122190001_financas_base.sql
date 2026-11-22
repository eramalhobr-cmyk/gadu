-- Finanças, base (fase "Base" de docs/FEATURE-FINANCAS.md: Contas e Dia a dia). Migração ADITIVA: só cria tabelas novas.
-- Nada existente é alterado; o app de hoje não conhece estas tabelas (o módulo é ligado por FINANCE_ENABLED, padrão ligado).
--
-- Tabelas (todas com user_id da sessão, RLS ligado, nada para anon):
--   fin_itens       cadastro de contas fixas e receitas (uma linha por item, vale para todos os anos)
--   fin_item_meses  valor e estado (pago) de cada item em cada mês (uma linha por item, ano e mês)
--   fin_gastos      gastos do dia a dia
--   fin_config      uma linha por pessoa: dias de recebimento, receita principal, cartão principal
--
-- Decisão de modelo: NORMALIZADO (fin_itens + fin_item_meses) em vez de valores numeric[12] e pagos bool[12].
--   + CHECK por valor (valor > 0), mês 1-12 e índice (user_id, ano, mes) funcionam no banco; com array, nada disso vale por posição.
--   + Histórico por mês, "este e os próximos" e o simulador de salário futuro são INSERT/UPDATE de linhas, sem reescrever arrays.
--   + Meses sem linha = item não existe naquele mês (equivale ao 0 da especificação); troca de ano não exige migração.
--   - Mais linhas (no máximo 12 por item por ano), irrelevante na escala de uma pessoa.
--
-- Vínculos da especificação (§4.1) desde já, para evitar dupla contagem depois: cartao_id (item dentro da fatura de outro),
-- segue_id (item já descontado de uma receita), via_reserva (por mês) e nao_caixa. Todos os vínculos são chaves compostas
-- (id, user_id): é impossível apontar para o item de outra pessoa, mesmo pelo banco.
-- Sem função, sem trigger e sem objeto no schema private: o teste de CI que falha com função executável por PUBLIC/anon continua verde.
-- Atualização de updated_at: feita pelo app (sem trigger).
--
-- Rollback (apaga os dados de finanças; nenhuma outra tabela é tocada):
--   drop table public.fin_config;
--   drop table public.fin_gastos;
--   drop table public.fin_item_meses;
--   drop table public.fin_itens;

-- ---------------------------------------------------------------------------------------------------------
-- fin_itens: contas fixas (despesa) e receitas.
-- ---------------------------------------------------------------------------------------------------------
create table public.fin_itens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('despesa', 'receita')),
  grupo text not null default 'Geral' check (char_length(btrim(grupo)) between 1 and 40),
  nome text not null check (char_length(btrim(nome)) between 1 and 80),
  nota text check (char_length(nota) <= 300),
  ordem integer not null default 0 check (ordem between -100000 and 100000),
  dia smallint check (dia between 1 and 31),                 -- vencimento (despesa) ou entrada (receita)
  dia_estimado boolean not null default false,
  movivel boolean not null default false,                    -- pode ir para depois do salário (caixa, fase futura)
  nao_caixa boolean not null default false,                  -- receita que não passa pela conta (ex.: vale-alimentação)
  cartao_id uuid,                                            -- está dentro da fatura deste item: não soma de novo
  segue_id uuid,                                             -- já vem descontado desta receita: fica pago quando ela entra
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint fin_itens_cartao_fk foreign key (cartao_id, user_id) references public.fin_itens (id, user_id) on delete set null (cartao_id),
  constraint fin_itens_segue_fk foreign key (segue_id, user_id) references public.fin_itens (id, user_id) on delete set null (segue_id),
  constraint fin_itens_cartao_nao_proprio check (cartao_id is distinct from id),
  constraint fin_itens_segue_nao_proprio check (segue_id is distinct from id),
  constraint fin_itens_um_vinculo check (cartao_id is null or segue_id is null),
  constraint fin_itens_vinculo_so_despesa check (tipo = 'despesa' or (cartao_id is null and segue_id is null))
);
create index fin_itens_user_idx on public.fin_itens (user_id, tipo, grupo, ordem);

-- ---------------------------------------------------------------------------------------------------------
-- fin_item_meses: valor e estado de cada item em cada mês. Sem linha = o item não existe naquele mês.
-- ---------------------------------------------------------------------------------------------------------
create table public.fin_item_meses (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null,
  ano smallint not null check (ano between 2000 and 2100),
  mes smallint not null check (mes between 1 and 12),
  valor numeric(12, 2) not null check (valor > 0 and valor < 1000000000),
  pago boolean not null default false,
  via_reserva boolean not null default false,                -- pago com a reserva: conta como despesa, mas não sai da conta corrente
  nota text check (char_length(nota) <= 300),                -- o "porquê" de um valor diferente neste mês
  updated_at timestamptz not null default now(),
  primary key (item_id, ano, mes),
  constraint fin_item_meses_item_fk foreign key (item_id, user_id) references public.fin_itens (id, user_id) on delete cascade
);
create index fin_item_meses_user_idx on public.fin_item_meses (user_id, ano, mes);

-- ---------------------------------------------------------------------------------------------------------
-- fin_gastos: dia a dia.
-- ---------------------------------------------------------------------------------------------------------
create table public.fin_gastos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ano smallint not null check (ano between 2000 and 2100),
  mes smallint not null check (mes between 1 and 12),
  dia smallint not null check (dia between 1 and 31),
  valor numeric(12, 2) not null check (valor > 0 and valor < 1000000000),
  categoria text not null default 'Outros' check (char_length(btrim(categoria)) between 1 and 40),
  descricao text not null default '' check (char_length(descricao) <= 200),
  meio text not null default 'debito' check (meio in ('debito', 'pix', 'credito', 'reserva')),
  origem text not null default 'manual' check (origem in ('manual', 'conversa', 'voz', 'print', 'extrato')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Data existente (31/02 é recusado como violação de CHECK, sem erro de data). Só avalia quando mês e dia já estão na faixa.
  constraint fin_gastos_data_valida check (case when mes between 1 and 12 and dia between 1 and 31
    then make_date(ano, mes, 1) + (dia - 1) < make_date(ano + mes / 12, mes % 12 + 1, 1) else true end)
);
create index fin_gastos_user_idx on public.fin_gastos (user_id, ano, mes, dia);

-- ---------------------------------------------------------------------------------------------------------
-- fin_config: uma linha por pessoa. Base do simulador de salário futuro: recebimento no dia do adiantamento (padrão 15)
-- e o restante no dia 1 (padrão). Mudar o salário ou os dias é UPDATE; nada de migração.
-- ---------------------------------------------------------------------------------------------------------
create table public.fin_config (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  dia_adiantamento smallint not null default 15 check (dia_adiantamento between 1 and 31),
  dia_restante smallint not null default 1 check (dia_restante between 1 and 31),
  adiantamento_pct numeric(5, 2) not null default 0 check (adiantamento_pct between 0 and 100),  -- 0 = sem adiantamento
  receita_principal_id uuid,
  cartao_principal_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fin_config_receita_fk foreign key (receita_principal_id, user_id) references public.fin_itens (id, user_id) on delete set null (receita_principal_id),
  constraint fin_config_cartao_fk foreign key (cartao_principal_id, user_id) references public.fin_itens (id, user_id) on delete set null (cartao_principal_id)
);

-- ---------------------------------------------------------------------------------------------------------
-- Acesso: só pessoas logadas, só as próprias linhas. anon não tem privilégio algum.
-- authenticated: SELECT, INSERT, UPDATE e DELETE (a RLS decide); sem TRUNCATE, REFERENCES e TRIGGER.
-- ---------------------------------------------------------------------------------------------------------
alter table public.fin_itens enable row level security;
alter table public.fin_item_meses enable row level security;
alter table public.fin_gastos enable row level security;
alter table public.fin_config enable row level security;

revoke all on public.fin_itens, public.fin_item_meses, public.fin_gastos, public.fin_config from public, anon, authenticated;
grant select, insert, update, delete on public.fin_itens, public.fin_item_meses, public.fin_gastos, public.fin_config to authenticated;

create policy fin_itens_select on public.fin_itens for select to authenticated using ((select auth.uid()) = user_id);
create policy fin_itens_insert on public.fin_itens for insert to authenticated with check ((select auth.uid()) = user_id);
create policy fin_itens_update on public.fin_itens for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy fin_itens_delete on public.fin_itens for delete to authenticated using ((select auth.uid()) = user_id);

create policy fin_item_meses_select on public.fin_item_meses for select to authenticated using ((select auth.uid()) = user_id);
create policy fin_item_meses_insert on public.fin_item_meses for insert to authenticated with check ((select auth.uid()) = user_id);
create policy fin_item_meses_update on public.fin_item_meses for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy fin_item_meses_delete on public.fin_item_meses for delete to authenticated using ((select auth.uid()) = user_id);

create policy fin_gastos_select on public.fin_gastos for select to authenticated using ((select auth.uid()) = user_id);
create policy fin_gastos_insert on public.fin_gastos for insert to authenticated with check ((select auth.uid()) = user_id);
create policy fin_gastos_update on public.fin_gastos for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy fin_gastos_delete on public.fin_gastos for delete to authenticated using ((select auth.uid()) = user_id);

create policy fin_config_select on public.fin_config for select to authenticated using ((select auth.uid()) = user_id);
create policy fin_config_insert on public.fin_config for insert to authenticated with check ((select auth.uid()) = user_id);
create policy fin_config_update on public.fin_config for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy fin_config_delete on public.fin_config for delete to authenticated using ((select auth.uid()) = user_id);
