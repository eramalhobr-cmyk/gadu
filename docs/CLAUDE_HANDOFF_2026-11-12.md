# Handoff para Claude Code — 2026-11-12

## Situação confirmada
- PR #1 (rascunho): documentação, governança, design system e auditorias: https://github.com/eramalhobr-cmyk/gadu/pull/1
- PR #2 (rascunho): correção fail-closed do chat: https://github.com/eramalhobr-cmyk/gadu/pull/2
- Branch de implementação: `fix/chat-quota-rpc-fail-closed-20261112`, baseada em `main`.
- Nenhum PR foi integrado ou implantado por este trabalho. Os testes **não foram executados** pelo ChatGPT.
- PR #2 altera `src/app/api/chat/route.ts`, cria `src/lib/chat-budget-guard.ts` e `src/lib/chat-budget-guard.test.ts`.

## Objetivo imediato
Validar e corrigir eventuais problemas do PR #2, rodar `npm test`, `npm run typecheck`, `npm run build` e testes de integração que simulem RPC com erro, null, quota=false e gasto acima do limite. Não fazer merge ou deploy sem aprovação explícita. Se houver conflito com PR #1, preservar as alterações e explicar.

## Sequência posterior
1. Corrigir cota diária atômica e política de limite confiável via nova migração, com testes de concorrência.
2. Implementar reserva/reconciliação do orçamento mensal com streaming e concorrência.
3. Testar RLS e isolamento multiusuário, privacidade e administração de créditos.
4. Auditar UX e Design System mobile-first com desktop dedicado.
5. Reconciliar roadmap com código real e documentar GaDu Personal, Finance, 3D Studio e Agent Office.

## Governança
O GitHub é a fonte oficial; `AGENTS.md`, `CLAUDE.md`, `docs/PROJECT_CONTEXT.md`, `docs/DEVELOPMENT_HANDOFF.md`, `docs/SECURITY_AUDIT_2026-11-12.md` e `docs/REMEDIATION_TEST_PLAN.md` estão propostos no PR #1. Ler o conteúdo do PR #1 sem presumir que já está em main. Não modificar produção, Vercel, Supabase remoto, credenciais ou permissões sem autorização explícita. Toda mudança em branch e PR.

---

## Validação pelo Claude Code — 2026-11-13

### Executado (ambiente isolado, Node 22.23, sem acesso a produção)
| Comando | Resultado |
|---|---|
| `npm ci` | ok |
| `npm test` na versão original do PR | 25/25 ok |
| `npm run typecheck` na versão original | ok |
| `npm run build` na versão original | ok |
| `npm test` após os ajustes (unitários + integração) | 28/28 unitários ok · 8/8 integração ok |
| `npm run typecheck` após os ajustes | ok |
| `npm run build` após os ajustes | ok |
| Testes de integração contra a rota de **main** (sem a correção) | 4/8 falham: confirma o risco fail-open em produção |

### Lacunas encontradas na versão original e corrigidas nesta branch
1. **Limites por provedor (Ajustes) falhavam aberto:** erro em `month_spend_by_provider` virava "sem gasto" e o provedor era chamado. Agora `checkProviderSpend` bloqueia em erro, resposta não-lista ou linha inválida.
2. **Exceção de rede do Supabase** (promessa rejeitada) caía no `catch` genérico: não chamava o provedor, mas com mensagem errada e sem registro. Agora `safeRpc` converte exceção em erro e a decisão fail-closed vale para todos os casos.
3. **Texto numérico em notação científica** (`"1e-7"`) era tratado como inválido e bloqueava por engano. Agora é aceito; negativos, `NaN` e `Infinity` continuam bloqueando.
4. **Ordem das verificações:** o gasto por provedor era lido depois de criar a conversa. Agora teto mensal e gasto por provedor são lidos juntos, **antes de qualquer gravação**; bloqueio não deixa conversa vazia.

### Arquivos alterados nesta etapa
- `src/lib/chat-budget-guard.ts`: `safeRpc`, `checkProviderSpend`, validação monetária comum.
- `src/lib/chat-budget-guard.test.ts`: novos casos (notação científica, exceções, gasto por provedor).
- `src/app/api/chat/route.ts`: `safeRpc` nas 3 RPCs obrigatórias; verificação por provedor antes de gravar.
- `test/chat-route.integration.test.ts`: integração da rota real com Supabase e provedor simulados (8 cenários).
- `test/alias-hooks.mjs`, `test/register-alias.mjs`: resolução de `@/` e extensões só para testes.
- `package.json`: `npm test` = `test:unit` + `test:integration` (o CI do PR roda os dois).

### Cenários cobertos pela integração (o provedor não pode ser chamado e nada é gravado)
- Falha de comunicação com o Supabase (exceção) na cota, no teto mensal e no gasto por provedor.
- RPC com erro, resposta nula ou tipo inválido.
- Cota diária esgotada (`false`).
- Teto mensal atingido e valores inválidos (`"abc"`, negativo).
- Linha inválida no gasto por provedor.
- Provedor acima do limite fica de fora (`skip`), os outros seguem.
- Caminho feliz chama o provedor uma única vez.

### Riscos e pendências (fora do escopo do PR #2, para os próximos PRs)
- **Cota ainda é consumida antes do teto mensal:** se o teto bloquear, a mensagem conta na cota do dia. Resolver junto da cota atômica (PR de cota).
- **`consume_quota` usa `current_date` do servidor (UTC):** o "dia" vira às 21h de Brasília. Corrigir no PR de cota.
- **`p_limit` vindo do cliente** e incremento acima do teto: continuam como na auditoria (P1), sem alteração neste PR.
- **Concorrência do orçamento:** verificação antes da chamada não é reserva (P1). PR de orçamento.
- **Outros pontos que leem `month_spend_by_provider` falhando aberto:** `src/app/api/memories/import/route.ts` (extração com modelo barato) e o resumo de conversa. Risco baixo de custo; tratar no PR de orçamento.
- Testes SQL e de concorrência exigem Supabase local/isolado; não executados.

### Próxima atividade recomendada
PR de **cota diária atômica**: nova migração que (a) não incrementa acima do limite, (b) tira o limite do argumento do cliente (limite controlado pelo servidor), (c) usa o dia de Brasília, (d) testes de concorrência em Supabase local. Exige aprovação antes de aplicar no banco remoto.

---

## Etapa 2 — Cota diária atômica (Claude Code, 2026-11-13)

Branch `fix/daily-quota-atomic-20261113`, **empilhada sobre o PR #2** (mesma rota do chat). PR em rascunho com base no branch do PR #2; ao integrar o PR #2, mudar a base para `main`. Nada aplicado no banco remoto, sem merge, sem deploy.

### O que foi feito
- **Migração nova** `supabase/migrations/20261113120001_daily_quota_atomic.sql` (não edita migração aplicada):
  - `private.quota_policy` (limite global, semeado com 150 = valor atual de produção) e `private.user_quota` (exceção por pessoa), fora da API, com RLS ligada e sem privilégios para `anon`/`authenticated`.
  - `public.consume_daily_quota()` sem argumentos: incremento condicional atômico, nunca passa do limite, dia de Brasília, fail closed sem política ou com limite ≤ 0. Retorna `{"allowed","used","limit"}`.
  - `consume_quota(integer)` **mantida** nesta etapa para não quebrar a versão em produção.
- **App:** `src/app/api/chat/route.ts` chama `consume_daily_quota()` sem enviar limite; a cota passou a ser a **última** verificação (teto mensal e limites por provedor antes), então mensagem bloqueada não gasta cota; o aviso usa o limite real do banco.
- **Guard:** `checkDailyQuota` aceita só o objeto `{"allowed": bool, "used": int ≥ 0, "limit": int ≥ 0}` coerente; qualquer outra resposta bloqueia.
- **Testes de banco locais:** `scripts/test-db.sh` (`npm run test:db`) sobe um Postgres temporário, aplica `supabase/tests/00_supabase_shim.sql` (papéis e `auth.uid()` como no Supabase) e as migrações, roda `supabase/tests/10_daily_quota.test.sql` e testes de concorrência com conexões paralelas. Apaga tudo no final; nunca conecta no remoto.
- **CI:** job `database` no workflow do PR roda `test:db` no Postgres do runner (sem segredos); o CI também dispara para `supabase/**`, `test/**` e `scripts/**`.
- **ADR:** `docs/adr/0001-cota-diaria-atomica.md`.

### Testes executados e resultados (local, Postgres 16, Node 22)
| Suite | Resultado |
|---|---|
| `npm run test:unit` | 28/28 ok |
| `npm run test:integration` (rota real, Supabase e IA simulados) | 10/10 ok |
| `npm run test:db`: SQL | 21/21 ok |
| `npm run test:db`: concorrência | 6/6 ok |
| `npm run typecheck` / `npm run build` | ok / ok |
| Prova de falha do script (asserção alterada de propósito) | script sai com erro |

Casos SQL: primeiro uso, último permitido, excedente (negado e contagem parada no limite), usuários distintos, limite individual menor/maior, limite zero sem gravar, sem usuário, sem política (fecha), dia de Brasília, função sem argumento de limite, `authenticated` sem acesso à política, `anon` sem execução, usuário não zera nem insere contagem (RLS), função antiga mantida.

Concorrência: 40 chamadas simultâneas do mesmo usuário com limite 10 → **10 permitidas, contagem 10**; dois usuários disputando ao mesmo tempo (25 + 25) → 10 e 10. Comparação com a função de produção, mesmo cenário: **contagem 40**.

Integração nova: cota não é consumida quando o teto mensal ou os limites por provedor bloqueiam; o app não envia limite ao banco.

### Plano de implantação (precisa de aprovação a cada passo)
1. Integrar o PR #2.
2. **Aplicar a migração `20261113120001` no Supabase** (aditiva; não altera dados nem a função antiga).
3. Só então integrar este PR e publicar o app. **Se o app subir antes da migração, o chat fica bloqueado para todos** (fail closed).
4. Depois do app estável: migração da etapa 2 revogando e removendo `consume_quota(integer)`.

**Rollback:** reverter o app (a função antiga continua existindo). Se for preciso desfazer o banco: `drop function public.consume_daily_quota(); drop table private.user_quota; drop table private.quota_policy;`.

### Riscos e pendências
- **Ordem de implantação** acima é obrigatória.
- `DAILY_MESSAGE_LIMIT` deixa de valer para o chat; mudar o limite passa a ser `update private.quota_policy …` (com aprovação) até existir tela de administração.
- Na virada para o dia de Brasília, a contagem do dia da implantação pode zerar ou continuar (efeito único, inofensivo).
- Mensagem que passa na cota e falha no provedor continua contando: definir devolução no PR de orçamento.
- O shim imita o Supabase, mas não é o Supabase: validar a migração num projeto de testes ou branch do Supabase antes da produção, se possível.
- Etapa 2 (remover `consume_quota`) ainda não escrita.

### Próxima atividade recomendada
PR de **orçamento mensal com reserva e reconciliação** (P1), reaproveitando `scripts/test-db.sh` para testes de concorrência, e tratando junto a devolução de cota em falha do provedor e as leituras de gasto por provedor da importação de memórias e do resumo.

### Resposta à revisão do ChatGPT no PR #3 (2026-11-13)
| Ponto da revisão | Tratamento |
|---|---|
| 1. Limite inicial | **Confirmado**: `DAILY_MESSAGE_LIMIT` em produção = **150** (variável não secreta, lida na Vercel sem alterar nada). A migração semeia 150. A mudança de env para tabela continua **pendente de aprovação** do Eduardo. |
| 2. Supabase real (staging) | **Pendente de decisão**: exige criar um branch ou projeto de staging no Supabase (custo/permissão). Não foi feito. Recomendado antes da produção. |
| 3. Ordem do rollout e deploy inesperado | **Mitigado no código**: se o app novo subir antes da migração, o banco responde "função não existe" (`PGRST202`/`42883`) e a rota usa `consume_quota(limite do servidor)`, como hoje, em vez de bloquear todos. Qualquer outro erro continua fail closed. Roteiro abaixo. |
| 4. Função antiga chamável / abuso | Mantida só na transição. Chamá-la direto não contorna a verificação do app (a rota usa a função nova), mas permite inflar a própria contagem. **Etapa 2**: revogar `EXECUTE` e remover logo após o deploy estável. Limite reduzido abaixo do uso: testado (nega, mantém contagem). Mudança de política durante a corrida: cada chamada lê o limite na hora; no máximo uma decisão usa o valor anterior (READ COMMITTED). Retries: cada nova requisição consome 1; não há idempotência por requisição (avaliar no PR de orçamento junto da devolução em falha do provedor). |
| 5. Outros consumos | Verificado no código: **importação de memórias** (`/api/memories/import`) e **resumo de conversa** (em segundo plano após o chat) **não passam pela cota diária**. Usam o modelo barato e respeitam limites por provedor, mas a leitura do gasto por provedor ainda falha aberta. Busca por significado (embeddings no agendador) também não tem cota por pessoa. Tratar no PR de orçamento. |
| Contrato `used > 0` | **Feito**: resposta positiva exige `used ≥ 1` e `used ≤ limit`; teste unitário. |

Testes após os ajustes: unitários 30/30, integração 12/12 (inclui a transição e "outros erros continuam bloqueando"), banco SQL 24/24, concorrência 6/6, typecheck e build ok.

#### Roteiro de implantação (cada passo com aprovação)
1. Integrar o PR #2 em `main` (a Vercel publica sozinha) e verificar o chat em produção.
2. Validar a migração `20261113120001` em staging do Supabase (se aprovado).
3. Aplicar a migração em produção. A versão antiga do app segue usando `consume_quota`. Conferir: `select public.consume_daily_quota()` como usuário de teste; `select * from private.quota_policy` = 150.
4. Mudar a base do PR #3 para `main`, integrar e deixar a Vercel publicar.
5. Monitorar por 24h: logs da Vercel sem `chat quota validation unavailable` e sem o aviso de transição `consume_daily_quota ausente`; `usage_daily` nunca acima do limite.
6. Etapa 2: migração revogando `EXECUTE` e removendo `consume_quota(integer)`, junto com a remoção do código de transição.

**Rollback operacional:** reverter o app primeiro (a função antiga continua no banco). Só depois, se necessário, remover a função nova e as tabelas de política. Nunca remover `consume_quota` antes de o app novo estar estável.
**Deploy automático inesperado** (PR #3 integrado antes da migração): o código de transição mantém o chat funcionando com a função antiga; aplicar a migração em seguida.

---

## Etapa 3 — Orçamento mensal com reserva e reconciliação (Claude Code, 2026-11-13)

Branch `fix/monthly-budget-reservation-20261113`, **empilhada sobre o PR #3**. PR em rascunho. Nada aplicado no banco remoto.

### O que foi feito
- **Migração** `supabase/migrations/20261113140001_ai_budget_reservations.sql` (aditiva):
  - `private.budget_policy` (teto de US$ 20 = valor atual; reserva mínima de 0,01, máxima de 1,00; TTL de 10 min; teto global opcional) e `private.user_budget`;
  - `public.ai_reservations` (RLS: cada um lê as próprias; escrita só pelas funções);
  - `reserve_ai_budget`, `settle_ai_budget`, `release_ai_budget`, `budget_status` (authenticated) e `expire_ai_reservations` (service role).
- **App:**
  - `src/lib/ai-budget.ts`: reservar, liquidar e liberar.
  - `checkReservation` no guard.
  - Chat: limites por provedor → reserva → cota (libera se a cota negar) → IA → liquidação; liberação garantida no `finally`.
  - Resumo de conversa e importação de memórias também reservam e liquidam. A importação passou a falhar fechado sem o gasto por provedor.
  - Agendador expira reservas vencidas.
  - Modelo sem preço deixa de custar zero.
  - Transição automática para a leitura antiga se a migração não estiver aplicada.
- **ADR:** `docs/adr/0002-orcamento-com-reserva.md`.

### Testes (local, Postgres 16, Node 22)
| Suite | Resultado |
|---|---|
| Unitários | 32/32 ok |
| Integração da rota do chat | 14/14 ok |
| SQL cota | 24/24 ok |
| SQL orçamento | 31/31 ok |
| Concorrência | 10/10 ok |
| typecheck / build | ok / ok |

**Concorrência:**
- Teto de US$ 1,00, 20 reservas simultâneas de US$ 0,25 → **exatamente 4**, total reservado 1,00.
- Teto global ocupado por uma pessoa → reservas de outras pessoas negadas.
- Teto global livre, duas pessoas disputando ao mesmo tempo → 4 no total.

Também corrigi o próprio `scripts/test-db.sh`: uma contagem ausente podia passar como sucesso. Agora conta como falha.

### Implantação (alto risco, cada passo com aprovação)
Depois de PR #2 e PR #3 em produção:
1. Aplicar `20261113140001`.
2. Conferir `select public.budget_status()` como usuário e `select * from private.budget_policy`.
3. Integrar este PR.
4. Monitorar `ai_reservations` (reservas abertas sem liquidar, `over`) por 24h.

Se o app subir antes da migração, a transição mantém a verificação de hoje.

**Rollback:** reverter o app. Depois, se necessário, remover as funções novas, `ai_reservations` e as tabelas de política.

### Riscos e pendências
- Stream cancelado antes de o provedor informar o uso: custo daquela resposta pode não ser registrado.
- Reconciliação automática com a fatura real dos provedores não implementada.
- `MONTHLY_BUDGET_USD` passa a valer só na transição; mudar o teto será `update private.budget_policy` até existir a tela de administração.
- Limites por provedor (Ajustes) continuam por leitura, não por reserva.
- Embeddings do agendador não passam pelo orçamento por pessoa (custo muito baixo).

### Próxima atividade recomendada
Implantar PR #2 → migração da cota → PR #3 → migração do orçamento → este PR. Em paralelo, entregas de baixo risco para uso diário: tela de gasto e limites a partir de `budget_status()`, e polimento de voz e conversa.

## Implantação Fast Track — 13/11/2026 (Claude Code, autorizada pelo Eduardo)

| Etapa | Ação | Resultado |
|---|---|---|
| 1 | PR #2 com merge na `main` (`6ae6bac`); deploy da Vercel `READY` | Home 200, `/api/chat` sem login → 401, sem erros nos logs. RPCs usadas pelo código (`consume_quota`, `month_spend`, `month_spend_by_provider`) testadas com usuário temporário em transação desfeita |
| 2 | Cópia de `usage_daily` em `private.backup_usage_daily_20261113` (2 linhas, somas iguais; RLS ligada, sem acesso de `anon`/`authenticated`) e aplicação de `20261113120001_daily_quota_atomic` (registrada no Supabase como `daily_quota_atomic`) | Usuário temporário (transação desfeita): 1/150 e 2/150 permitidos; com limite individual 2, a 3ª chamada foi negada sem incrementar (contagem 2); sem usuário → negado. `anon` não executa; `authenticated` não lê a política. SECURITY DEFINER com `search_path=''`. `usage_daily` idêntica ao backup |
| 3 | Base do PR #3 trocada para `main`, merge (`d18286f`), deploy `READY` | Smoke test ok, sem erros nos logs. **Falta o teste real de chat com login (Eduardo)** |
| 4 | PR #4: conflito no `ROADMAP.md` resolvido (mantidas as duas seções), merge (`c6bbb30`) | Só documentação |
| 5 | PR #6: `main` integrada ao branch, base trocada para `main`; continua em rascunho | 32 unitários, 14 de integração, `test:db` (SQL + concorrência), typecheck e build ok. Dependências conferidas no banco remoto (somente leitura): `usage_events` com `kind` em chat/summary/import e `provider` em anthropic/gateway/gemini, como a migração espera. Nada aplicado |

Supervisor de segurança do Supabase depois da migração: só os avisos esperados (tabelas private com RLS e sem políticas, de propósito; `consume_quota` antiga executável, que sai na etapa 2; proteção de senhas vazadas desligada no Auth, item antigo).

Rollback disponível:
- App: promover na Vercel o deploy anterior (`dpl_6tjFxWQV…` para antes do PR #3, `dpl_VQszN7E9…` para antes do PR #2).
- Banco: `drop function public.consume_daily_quota(); drop table private.user_quota; drop table private.quota_policy;`. A função antiga continua lá.

Pendências:
- Teste real do chat pelo Eduardo. Depois: conferir `usage_daily` de hoje (dia de Brasília) subindo 1 por mensagem.
- Etapa 2 da cota, depois de 24h estável: revogar e remover `consume_quota(integer)` e o código de transição.
- Apagar `private.backup_usage_daily_20261113` depois de estabilizar.
- PR #6: aprovação do Eduardo para aplicar `20261113140001` e fazer o merge.
