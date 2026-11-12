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
