# GaDu · Changelog

Cada entrada diz em que estágio a mudança está: **desenvolvido** (código em branch), **testado** (testes automáticos ou verificação executada, descrita na entrada), **publicado** (na `main` e em produção na Vercel, com migrações aplicadas quando houver). Datas são as do commit. Antes de 12/11 o histórico foi reconstruído a partir do `git log` e do ROADMAP; o que não tem evidência registrada aparece como "verificação não registrada".

## Em aberto (não publicado)
- **PR #6 · Orçamento mensal com reserva e reconciliação.** Desenvolvido e testado: 32 testes unitários, 14 de integração e `test:db` (31 checks SQL e concorrência, 20 reservas simultâneas de US$ 0,25 com teto de US$ 1,00 → exatamente 4), typecheck, build e CI verdes. **Não publicado**: migração `20261113140001_ai_budget_reservations.sql` não aplicada, aguardando aprovação. Arquivos: `supabase/migrations/20261113140001_ai_budget_reservations.sql`, `src/lib/ai-budget.ts`, `src/lib/chat-budget-guard.ts`, `src/lib/pricing.ts`, `src/app/api/chat/route.ts`, `src/app/api/memories/import/route.ts`, `src/app/api/cron/tick/route.ts`, `supabase/tests/20_ai_budget.test.sql`, `docs/adr/0002-orcamento-com-reserva.md`.
- **PR #5 · Especificação de Finanças pessoais** (`docs/FEATURE-FINANCAS.md`). Só documentação, não integrada.
- **PR #1 · Marco Zero: contexto mestre, Design System, auditoria de segurança.** Só documentação, rascunho.

## 2026-11-13 · `fcf7415` · Documentação central (PR #7)
- Novos `PROJECT_STATUS.md`, `CHANGELOG.md` e `docs/FEATURE_MATRIX.md`.
- `ROADMAP.md` ganha uma visão por módulo, com prioridade, status, dependências e próximos passos.
- `docs/ARCHITECTURE.md` atualizado com o fluxo real do chat, a cota e as decisões oficiais.
- `CLAUDE.md` passa a apontar para a documentação central e para as decisões vigentes.
- **Publicado** (só documentação, merge `fcf7415`).

## 2026-11-12 · `c6bbb30` · GaDu Fast Track (PR #4)
- `docs/FAST_TRACK.md`, seção no `CLAUDE.md`, item "Modelo de trabalho" no ROADMAP.
- **Publicado** (só documentação; deploy `dpl_2vUKHfMwytwdzztYpVXhQkb34RhN` `READY`).

## 2026-11-12 · `d18286f` · Cota diária atômica (PR #3)
- Corrige três problemas da cota antiga:
  - a contagem passava do limite;
  - o limite vinha do cliente;
  - o dia virava às 21h de Brasília, porque usava UTC.
- Banco: `private.quota_policy` (150), `private.user_quota` e `public.consume_daily_quota()`.
- App: o chat chama a função nova sem enviar limite; a cota é a última verificação. Na transição, se a função não existir, usa a antiga.
- Testes: unitários, integração e `test:db` local, inclusive 40 chamadas simultâneas com limite 10 → 10; CI com job de banco.
- **Publicado**:
  - backup de `usage_daily` em `private.backup_usage_daily_20261113`;
  - migração aplicada (registrada como `20261113004434 daily_quota_atomic`);
  - deploy `dpl_31Q3Q78PKHySMqB6FqdkRgk5icHn` `READY`;
  - verificação em produção com usuário temporário e rollback: limite respeitado, `anon` sem acesso, política ilegível para usuários.
- Falta o teste real com login.

## 2026-11-12 · `6ae6bac` · Chat fail closed (PR #2)
- Se a cota, o teto mensal ou os limites por motor não puderem ser validados, o chat não chama a IA e não grava nada.
- Arquivos: `src/lib/chat-budget-guard.ts`, `src/app/api/chat/route.ts`, `test/chat-route.integration.test.ts`, `.github/workflows/pr-checks.yml`.
- Testes: unitários e integração da rota; contra a `main` anterior, 4 de 8 testes falhavam, o que comprova a correção.
- **Publicado** (deploy `dpl_6tjFxWQV76zyfARx4mBZCtMa7GWu` `READY`; smoke test sem login → 401; funções do banco verificadas com usuário temporário).

## 2026-11-09 · `475ad50` · Home pública
- Home aberta em `/` (avatar animado, funções, um dia com o GaDu, arquitetura, botão Entrar). `src/app/page.tsx`.
- Publicado. Verificação não registrada além do deploy.

## 2026-11-09 · `df6b8cf` · Avatar oficial animado e ícone
- `src/components/avatar-engine.ts`, `RobotFace.tsx`, `public/avatar/*`, `public/icons/*`; plano `docs/PLANO-AGENTES.md`.
- Publicado.

## 2026-11-09 · `5df9543`, `1c2225f`, `775d5a3` · Guia, dicas e "Como funciona"
- `/app/guia`, `/app/sobre`, `HelpNav.tsx`, `TipCard.tsx`, `src/lib/tips.ts`.
- Publicado.

## 2026-11-09 · `b75b53a` · Agenda visual, voz flutuante, busca por significado, convites e admin
- Agenda semanal com criação de eventos por voz.
- Botão de voz em todas as telas.
- Busca por significado: pgvector e `search_index`, indexados pelo agendador.
- Convites (`members`, `invites`) e área Admin.
- Publicado. A criação de eventos depende de você liberar a permissão `calendar.events` no Google.

## 2026-11-09 · `4aa6330` · Correção ao abrir o app
- Publicado.

## 2026-11-09 · `d3d6f24`, `0557f40`, `40523b1` · Tarefas, projetos, agentes e Hoje em painel
- Tabelas `tasks`, `projects`, `agents`, com RLS.
- Publicado.

## 2026-11-09 · `ba5d7c9` · Hoje, lembretes por voz e briefing da manhã
- `reminders`, `push_subscriptions`, `daily_briefings`, Web Push e Vercel Cron a cada minuto.
- Publicado.

## 2026-11-09 · `20b07b4`, `570b210` · Google (agenda e Gmail, só leitura) e páginas legais
- Publicado. Primeira conexão real registrada no ROADMAP.

## 2026-11-09 · `fc47bef`, `3a135be`, `3fe3a83`, `68b6598`, `b54ab3b` · Fase 1
- Limites por motor, lista de conversas, memória v2 (resumos), importação de memórias, voz configurável.
- Login com senha, gasto do mês e teto mensal.
- Correção do microfone.
- Publicado.

## 2026-11-08 · `85454e7` → `241c28a` · MVP
- Conversa por voz e texto, memória com aprovação, login, motor pelo Vercel AI Gateway.
- Publicado (primeira resposta real registrada no ROADMAP).
