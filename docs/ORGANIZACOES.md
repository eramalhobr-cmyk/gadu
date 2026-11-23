# GaDu · Organizações (S-08): desenho

Estado: **desenho, sem código de produção** (23/11/2026, Claude Code). Nenhuma migração foi criada ou aplicada. Responde ao S-08 da [auditoria de 15/11](SECURITY_AUDIT_2026-11-15.md) e à decisão 6 de [ARCHITECTURE.md](ARCHITECTURE.md) ("o Agent Office suporta múltiplos usuários, organizações e clientes, com isolamento rigoroso").

**Pré-requisito:** o S-05 (escrita por acesso, [PR em rascunho](SECURITY_AUDIT_2026-11-23.md)) deve estar aplicado antes da etapa 1. Organização sem isso herdaria o furo de a pessoa bloqueada ainda gravar.

## 1. Para que serve (e para que não serve)

- **Serve para:** o Eduardo (ou outra pessoa) separar e compartilhar o que é de um **negócio próprio, da família ou de um projeto em grupo**, com gente que ele convida. Hoje tudo é de uma pessoa só (`user_id`).
- **Não serve para empregador.** A regra do projeto continua: nada do emprego de ninguém entra no GaDu (cada pessoa bloqueia termos em Ajustes). Organização é para o que a pessoa é dona ou combinou compartilhar.
- **Privado por padrão.** Memórias, conversas, Financeiro e Metas continuam **sempre pessoais**, mesmo para quem está numa organização. Só o que a pessoa decidir marcar como da organização é compartilhado, e só nas tabelas liberadas na etapa 3.

## 2. Como está hoje

| Peça | Hoje | Problema para multiempresa |
|---|---|---|
| Dados | `user_id` em toda tabela; RLS `user_id = (select auth.uid())` | não há como dividir dados entre pessoas |
| Acesso | `members` (`role` member/admin, `access` active/blocked), global da instância | "admin" é admin de **tudo** |
| Convites | `invites.created_by`, sem organização | convite entra na instância, não numa organização |
| Servidor | chave secreta (ignora a RLS) em convite, administração, agendador, orçamento | o filtro por pessoa é código; por organização também seria |
| Custo | teto por pessoa (`private.user_budget`) e global (`budget_policy`) | quem paga a IA de uma organização? |

## 3. Modelo

Duas tabelas novas na etapa 1; o resto entra em etapas aditivas. Nomes em inglês, como nas demais tabelas de acesso.

```
organizations   id uuid pk, name text (1..80), created_by uuid → auth.users, created_at, archived_at null
memberships     org_id → organizations, user_id → auth.users, role text, status text, invited_by, created_at
                pk (org_id, user_id)
```

**Papéis dentro da organização** (independentes de `members.role`, que continua sendo "operador da instância"):

| Papel | Pode |
|---|---|
| `owner` | tudo; apagar/arquivar a organização; mudar papéis; sempre há pelo menos 1 |
| `admin` | convidar e remover `member` e `viewer`; ver e editar o que é da organização |
| `member` | criar e editar o que é da organização; ler o que os outros marcaram como da organização |
| `viewer` | só ler o que é da organização |

`status`: `active` ou `removed` (não apaga a linha, para auditoria; quem está `removed` perde o acesso na hora).

**Sem organização "pessoal" automática.** O escopo pessoal é `org_id is null`. Evita criar uma organização para cada pessoa e mantém tudo que existe hoje igual.

## 4. RLS (regras)

Princípios, os mesmos de [AGENTS.md](../AGENTS.md) seção 5 e do [SECURITY.md](SECURITY.md):

1. RLS ligado em toda tabela nova, políticas só `to authenticated`, `(select auth.uid())` em toda comparação, `WITH CHECK` em toda escrita.
2. **Funções auxiliares `SECURITY DEFINER`** com `search_path = ''`, `stable`, executáveis só por `authenticated` e `service_role` (nunca `PUBLIC` nem `anon`; o teste `40_seguranca_p1` já falha se alguma sobrar):
   - `private.org_role(p_org uuid) → text`: o papel ativo da pessoa na organização, ou `null`.
   - `private.is_org_member(p_org uuid, p_min text) → boolean`: papel ativo igual ou acima de `p_min`.
   Elas existem para evitar recursão de política (`memberships` consultando `memberships`) e para a regra ficar num lugar só. Como as políticas chamam a função como `authenticated`, as versões usadas em política ficam em `public` (como `public.can_write()` do S-05) com `revoke ... from public, anon`.
3. **Escrita também exige `public.can_write()`** (S-05): quem está bloqueado na instância não grava em organização nenhuma.

Políticas da etapa 1:

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `organizations` | quem é membro ativo | só pela função `public.create_organization(name)` (cria a organização e o `owner` na mesma transação; sem política de insert direto) | `owner` (nome, arquivar) | ninguém (arquiva) |
| `memberships` | a própria linha **e** as linhas da mesma organização para `admin`/`owner` | só por funções (`invite`, `accept`): nunca direto | `owner`/`admin` mudam papel e `status`, nunca o próprio papel para cima; `owner` único não sai | ninguém (usa `status = 'removed'`) |

Regras que o banco impõe por restrição, não por código do app:
- último `owner` não pode ser removido nem rebaixado (gatilho);
- `admin` não altera `owner`; ninguém se promove;
- `memberships` com chave composta e `on delete cascade` de `organizations` e de `auth.users`.

## 5. Dados compartilhados (etapa 3)

Coluna **nova e opcional** `org_id uuid null` nas tabelas liberadas, mais `visibilidade text not null default 'privada' check (visibilidade in ('privada','organizacao'))`. Tabelas liberadas, em ordem: `projects`, `tasks`, `agents`; depois `clients` (CRM leve, ROADMAP 6.2). **Nunca:** `memories`, `conversations`, `messages`, `fin_*`, `goal*`, `google_connections`, `push_subscriptions`, `reminders`.

Política de leitura (esboço): `user_id = (select auth.uid()) or (visibilidade = 'organizacao' and org_id is not null and public.is_org_member(org_id, 'viewer'))`.
Política de escrita (esboço): dono edita sempre o que criou, desde que, se `org_id` vier, seja membro ativo (`member` ou acima); `admin` edita o da organização. `org_id` só pode apontar para organização em que a pessoa é membro: **chave composta** `(org_id, user_id) → memberships (org_id, user_id)`, o mesmo padrão de `goal_progress`.

Efeito de segurança: linhas existentes (`org_id is null`) **não mudam de dono nem de visibilidade**. A migração é só `add column`.

## 6. Servidor e custo

- **Chave secreta:** toda consulta de organização feita com `supabaseAdmin` (agendador, convite, administração) filtra por `org_id` **no código e tem teste de integração** mostrando que a organização B não aparece na A. Regra: nenhuma consulta de tabela com `org_id` sem filtro com a chave secreta.
- **Administração:** `/api/admin/*` hoje é da instância. Ganha uma versão por organização (`/api/org/:id/...`) que confere `is_org_member(org, 'admin')` no servidor. A tela de admin da instância continua só para `members.role = 'admin'` e **não** vê dados de organização (só contagens).
- **Convites:** `invites` ganha `org_id` e `org_role` **opcionais** (colunas novas, nulas = convite de instância como hoje). Aceitar um convite com `org_id` cria a `membership` no mesmo passo que hoje cria `members`.
- **Custo:** nada muda no começo: cada pessoa continua com a própria cota diária e o próprio teto mensal (`consume_daily_quota`, `server_reserve_ai_budget`); uso de IA em contexto de organização conta na **pessoa que pediu**. Um teto por organização (`private.org_budget`) é decisão do Eduardo, só se alguém além dele passar a pagar.
- **Agendador e notificações:** continuam por pessoa. Aviso "da organização" é fase futura.
- **Interruptor:** `ORGS_ENABLED` (ligado só por decisão do Eduardo; desligado: sem tela, `/api/org/*` devolve 404 e a RLS segue valendo). Padrão da casa, igual a `FINANCE_ENABLED`.

## 7. Migração em etapas (todas aditivas)

Cada etapa é um PR pequeno; só tabelas, colunas, funções e políticas **novas**. Nada é apagado, renomeado ou restringido nas tabelas que existem. **Toda migração é alto risco:** PR em rascunho, teste em `scripts/test-db.sh`, rollback escrito, aprovação do Eduardo antes de aplicar, e o Cursor aplica pelo MCP.

| Etapa | O que entra | Teste obrigatório | Rollback |
|---|---|---|---|
| 0 | S-05 aplicado (`can_write()`) | já escrito | `drop` das políticas restritivas |
| 1 | `organizations`, `memberships`, funções de papel, `create_organization`, gatilho do último dono, RLS | A não vê a organização de B; `viewer` não escreve; removida perde o acesso na hora; último dono fica; bloqueada não grava; anon nada | `drop table memberships, organizations`; `drop function ...` |
| 2 | Convite com `org_id` opcional (`alter table invites add column`) | convite de instância continua igual; aceitar cria `membership`; convite vencido ou usado não cria | `alter table invites drop column` |
| 3 | `org_id` + `visibilidade` em `projects` (depois `tasks`, `agents`) com as políticas novas | linha antiga continua só do dono; membro lê só o marcado `organizacao`; `org_id` de organização alheia é recusado; cascata ao sair da organização | `drop column`, `drop policy` |
| 4 | App: seletor de organização, ações pela conversa (regra 8.1: `org_criar`, `org_convidar`, `org_remover`, `projeto_compartilhar`), `ORGS_ENABLED`, chat e Core filtrando por `org_id` | integração do `/api/chat` mostrando que a ação só acha itens da organização da sessão, respeita o interruptor e não grava antes do "sim" | desligar `ORGS_ENABLED` |
| 5 | `clients` (CRM leve) na organização | isolamento entre organizações e entre pessoas | `drop table clients` |

Cada etapa só começa depois de a anterior estar aplicada e validada em produção com uma pessoa de teste.

## 8. Testes de isolamento (matriz mínima, na etapa 1 e repetida nas seguintes)

Pessoas: A (`owner` da org 1), B (`member` da org 1), C (`viewer` da org 1), D (`owner` da org 2), E (sem organização), F (bloqueada, `member` da org 1).

| Tentativa | Esperado |
|---|---|
| D lê/escreve a org 1 ou os dados dela | nada |
| E lê qualquer org | nada |
| C (viewer) escreve | recusado |
| B (member) muda o papel de alguém | recusado |
| B se promove a `admin` | recusado |
| A rebaixa ou remove o último `owner` | recusado |
| F (bloqueada) escreve na org 1 | recusado (S-05) |
| membro removido lê | nada, na mesma hora |
| `org_id` da org 2 em linha de B | recusado |
| `service_role` com filtro de org | só a org pedida |
| apagar a org 1 | cascata em `memberships`; dados pessoais de A, B, C **intactos** |

## 9. Riscos e perguntas para o Eduardo

1. **Precisa disso agora?** O GaDu é pessoal hoje. A etapa 1 é barata, mas as etapas 3 a 5 mexem em tabelas centrais. Sugestão: só começar quando houver uma segunda pessoa que vai **dividir** dados (não só usar o app com os próprios).
2. **Quem paga a IA** de uma organização? Hoje: cada pessoa a própria cota.
3. **Papel de admin da instância × owner da organização:** o desenho mantém separados (o admin da instância não lê dados da organização). Confirmar.
4. **Empregador:** organização é só para negócio próprio, família e grupos escolhidos. Há risco de alguém criar uma organização do trabalho; a regra de termos bloqueados por pessoa continua valendo e **o texto da interface precisa deixar isso claro** (etapa 4).
5. **Dados que já existem** continuam pessoais; compartilhar um projeto existente é uma ação explícita (`projeto_compartilhar`), com confirmação e Desfazer.
6. **Privacidade (LGPD):** quem sai da organização leva os dados que são só dele (`org_id is null`); o que ele marcou como da organização fica com a organização. A regra precisa estar escrita na tela antes de convidar alguém.

## 10. Fora de escopo

Cobrança, plano por organização, SSO, auditoria de leitura, organizações dentro de organizações, e qualquer integração corporativa. Casa Inteligente segue adiada ([CASA_INTELIGENTE.md](CASA_INTELIGENTE.md)).
