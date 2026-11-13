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
