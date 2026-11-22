-- Metas, base (fase 1 de docs/METAS_CONQUISTAS.md: metas pessoais com marcos, progresso com origem e vínculo com tarefas).
-- Migração ADITIVA: cria tabelas novas e UMA restrição de unicidade em tasks (id já é único; a restrição só habilita a chave composta).
-- O app de hoje não conhece estas tabelas (o módulo é ligado por GOALS_ENABLED, padrão ligado).
--
-- Tabelas (todas com user_id da sessão, RLS ligado, nada para anon):
--   goals            a meta: título, categoria, tipo de medição, valor inicial/alvo, prazo, situação, motivo
--   goal_progress    histórico de progresso: cada registro tem data, valor e ORIGEM (manual, conversa, tarefa). Sem registro = "sem dados"
--   goal_milestones  marcos (checklist) de uma meta
--   goal_tasks       vínculo meta ↔ tarefa (chave composta nos dois lados: só dados da mesma pessoa)
--
-- Decisões de modelo:
--   - O valor atual NÃO é uma coluna: é calculado dos registros (agregação 'soma' ou 'ultimo'), para nunca "inventar progresso".
--   - Vínculos por chave composta (id, user_id): é impossível ligar meta de uma pessoa à tarefa, marco ou registro de outra, mesmo pelo banco.
--   - Metas compartilhadas (família), conquistas e recomendações ficam para fases seguintes.
-- Sem função, sem trigger e sem objeto no schema private. updated_at é atualizado pelo app.
--
-- Rollback (apaga os dados de Metas; nenhuma outra tabela perde dado):
--   drop table public.goal_tasks;
--   drop table public.goal_milestones;
--   drop table public.goal_progress;
--   drop table public.goals;
--   alter table public.tasks drop constraint tasks_id_user_unique;

-- Habilita a chave estrangeira composta (task_id, user_id). id já é chave primária: a restrição nunca falha nem muda dado.
alter table public.tasks add constraint tasks_id_user_unique unique (id, user_id);

-- ---------------------------------------------------------------------------------------------------------
-- goals
-- ---------------------------------------------------------------------------------------------------------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) between 1 and 120),
  descricao text check (char_length(descricao) <= 600),             -- o "porquê" da meta (motivo / nota)
  categoria text not null default 'desenvolvimento' check (categoria in
    ('financeira', 'familiar', 'profissional', 'saude', 'desenvolvimento', 'educacao', 'personalizada')),
  categoria_nome text check (char_length(btrim(categoria_nome)) between 1 and 40),
  -- numerica: valor e unidade; percentual: 0 a 100; marcos: checklist; tarefas: tarefas vinculadas concluídas
  medicao text not null default 'numerica' check (medicao in ('numerica', 'percentual', 'marcos', 'tarefas')),
  unidade text check (char_length(btrim(unidade)) between 1 and 20),
  agregacao text not null default 'soma' check (agregacao in ('soma', 'ultimo')),  -- como os registros viram o valor atual
  valor_inicial numeric(14, 2) not null default 0 check (valor_inicial between -1000000000 and 1000000000),
  valor_alvo numeric(14, 2) check (valor_alvo between -1000000000 and 1000000000),
  inicio date not null default current_date,
  prazo date,
  status text not null default 'ativa' check (status in ('ativa', 'pausada', 'concluida', 'arquivada')),
  concluida_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint goals_categoria_nome check (categoria = 'personalizada' or categoria_nome is null),
  constraint goals_numerica_alvo check (medicao <> 'numerica' or (valor_alvo is not null and valor_alvo <> valor_inicial)),
  constraint goals_percentual_alvo check (medicao <> 'percentual' or (valor_inicial = 0 and valor_alvo = 100 and agregacao = 'ultimo')),
  constraint goals_unidade_so_numerica check (medicao = 'numerica' or unidade is null),
  constraint goals_prazo_depois_do_inicio check (prazo is null or prazo >= inicio),
  constraint goals_concluida_em check (status <> 'concluida' or concluida_em is not null)
);
create index goals_user_idx on public.goals (user_id, status, prazo);

-- ---------------------------------------------------------------------------------------------------------
-- goal_progress: histórico com origem. Uma linha = um registro (um incremento, na agregação 'soma'; uma medida, em 'ultimo').
-- ---------------------------------------------------------------------------------------------------------
create table public.goal_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null,
  valor numeric(14, 2) not null check (valor between -1000000000 and 1000000000),
  data date not null,
  origem text not null default 'manual' check (origem in ('manual', 'conversa', 'tarefa')),
  nota text check (char_length(nota) <= 200),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  constraint goal_progress_goal_fk foreign key (goal_id, user_id) references public.goals (id, user_id) on delete cascade
);
create index goal_progress_goal_idx on public.goal_progress (user_id, goal_id, data desc);

-- ---------------------------------------------------------------------------------------------------------
-- goal_milestones: marcos (checklist). Concluir marca a data; reabrir limpa.
-- ---------------------------------------------------------------------------------------------------------
create table public.goal_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null,
  titulo text not null check (char_length(btrim(titulo)) between 1 and 120),
  data_alvo date,
  ordem integer not null default 0 check (ordem between -100000 and 100000),
  concluido_em timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  constraint goal_milestones_goal_fk foreign key (goal_id, user_id) references public.goals (id, user_id) on delete cascade
);
create index goal_milestones_goal_idx on public.goal_milestones (user_id, goal_id, ordem);

-- ---------------------------------------------------------------------------------------------------------
-- goal_tasks: vínculo meta ↔ tarefa. As DUAS chaves são compostas com user_id: nem a meta nem a tarefa podem ser de outra pessoa.
-- ---------------------------------------------------------------------------------------------------------
create table public.goal_tasks (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null,
  task_id bigint not null,
  created_at timestamptz not null default now(),
  primary key (goal_id, task_id),
  constraint goal_tasks_goal_fk foreign key (goal_id, user_id) references public.goals (id, user_id) on delete cascade,
  constraint goal_tasks_task_fk foreign key (task_id, user_id) references public.tasks (id, user_id) on delete cascade
);
create index goal_tasks_user_task_idx on public.goal_tasks (user_id, task_id);

-- ---------------------------------------------------------------------------------------------------------
-- Acesso: só pessoas logadas, só as próprias linhas. anon não tem privilégio algum.
-- authenticated: SELECT, INSERT, UPDATE e DELETE (a RLS decide); sem TRUNCATE, REFERENCES e TRIGGER.
-- ---------------------------------------------------------------------------------------------------------
alter table public.goals enable row level security;
alter table public.goal_progress enable row level security;
alter table public.goal_milestones enable row level security;
alter table public.goal_tasks enable row level security;

revoke all on public.goals, public.goal_progress, public.goal_milestones, public.goal_tasks from public, anon, authenticated;
grant select, insert, update, delete on public.goals, public.goal_progress, public.goal_milestones, public.goal_tasks to authenticated;

create policy goals_select on public.goals for select to authenticated using ((select auth.uid()) = user_id);
create policy goals_insert on public.goals for insert to authenticated with check ((select auth.uid()) = user_id);
create policy goals_update on public.goals for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy goals_delete on public.goals for delete to authenticated using ((select auth.uid()) = user_id);

create policy goal_progress_select on public.goal_progress for select to authenticated using ((select auth.uid()) = user_id);
create policy goal_progress_insert on public.goal_progress for insert to authenticated with check ((select auth.uid()) = user_id);
create policy goal_progress_update on public.goal_progress for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy goal_progress_delete on public.goal_progress for delete to authenticated using ((select auth.uid()) = user_id);

create policy goal_milestones_select on public.goal_milestones for select to authenticated using ((select auth.uid()) = user_id);
create policy goal_milestones_insert on public.goal_milestones for insert to authenticated with check ((select auth.uid()) = user_id);
create policy goal_milestones_update on public.goal_milestones for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy goal_milestones_delete on public.goal_milestones for delete to authenticated using ((select auth.uid()) = user_id);

create policy goal_tasks_select on public.goal_tasks for select to authenticated using ((select auth.uid()) = user_id);
create policy goal_tasks_insert on public.goal_tasks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy goal_tasks_update on public.goal_tasks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy goal_tasks_delete on public.goal_tasks for delete to authenticated using ((select auth.uid()) = user_id);
