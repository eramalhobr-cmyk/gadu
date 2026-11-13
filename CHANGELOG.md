# GaDu · Changelog

Cada entrada diz em que estágio a mudança está: **desenvolvido** (código em branch), **testado** (testes automáticos ou verificação executada, descrita na entrada), **publicado** (na `main` e em produção na Vercel, com migrações aplicadas quando houver). Datas são as do commit. Antes de 12/11 o histórico foi reconstruído a partir do `git log` e do ROADMAP; o que não tem evidência registrada aparece como "verificação não registrada".

## Em aberto (não publicado)
- **PR #5 · Especificação de Finanças pessoais** (`docs/FEATURE-FINANCAS.md`). Só documentação, não integrada.
- **PR #1 · Marco Zero: contexto mestre, auditoria de segurança, governança.** Só documentação, rascunho. O `DESIGN_SYSTEM.md` dele foi substituído pelo da `main` (PR #10).

## 2026-11-13 · `883ea23` · UX/UI v2 (PR #12)
- **Módulos** (`src/lib/modules.ts`, `ModulePage.tsx`): seis módulos com status real; módulo planejado abre uma página que diz que ele ainda não existe.
- **Navegação** (`GaduApp.tsx`, `src/app/v2.css`): menu lateral por módulos no computador; no celular, barra de baixo com o assistente no centro e folha de módulos.
- **Assistente Universal** (`Assistant.tsx`): voz e texto em qualquer tela, com a mesma conversa. Painel lateral no computador, painel de baixo expansível no celular.
- **Contrato de contexto** (`src/lib/assistant-context.ts`, `src/app/api/chat/route.ts`): rótulo de módulo e tela, validado no servidor; inválido é recusado com 400 antes de qualquer custo; não amplia o acesso.
- **Temas claro e escuro** (`src/lib/theme.ts`, `layout.tsx`): cookie `gadu_theme`; cores antigas viraram tokens.
- **Telas redesenhadas**: painel Hoje (`TodayPage.tsx`), Conversa, Perfil e ajustes (`SettingsPage.tsx`), home pública (`src/app/page.tsx`). Memória virou tela própria.
- Preservados: avatar animado, marca GaDu e `public/avatar`.
- Testado:
  - 45 testes unitários e 16 de integração (7 novos), typecheck, build e CI;
  - navegador com sessão autenticada de um usuário de teste, local e em produção, em 1440 e 390 px, nos dois temas, sem rolagem horizontal.
- **Publicado**: deploy `dpl_ENVExSFmz4Wq1BLn6drKSreuQc5j` `READY`. Em produção, o assistente respondeu pelo painel no computador e no celular e informou corretamente a tela ("módulo Pessoal, tela Tarefas e projetos").
- Não incluído: redesenho de Projetos, Agentes, Memória, Admin, Guia e Agenda (usam os temas, com o desenho anterior); cruzamento de dados entre módulos ou clientes; validação da voz nos aparelhos.

## 2026-11-13 · `fd77f84` · Design System v1, menu lateral e responsividade (PR #10)
- Tokens únicos em `:root` (`src/app/globals.css`): espaço, raio, texto, movimento, camadas, toque, gradiente holográfico.
- Computador (1024+): menu lateral fixo (`.side` em `src/components/GaduApp.tsx`), cabeçalho com o título da tela, sem o menu de baixo.
- Conversa no computador: avatar em 38%, leitura centralizada (máx. 760 px).
- Hoje: 2 colunas (700 a 1279 px) e 3 colunas (1280 px ou mais).
- Celular: logo no cabeçalho, conteúdo livre da voz flutuante, ☰ vira "Menu" (`ConversationsDrawer.tsx`).
- Acessibilidade: atalho "Pular para o conteúdo", alvos de toque de 40 px. Home com topo alinhado.
- Corrigido:
  - erro de hidratação na voz em Ajustes (`SettingsPage.tsx`);
  - seta dos itens de Ajuda fora do lugar.
- Novo `docs/DESIGN_SYSTEM.md`.
- Testado: capturas em 390, 768, 1024 e 1440 px (prévia local com dados fictícios para as telas do app), teclado, alvos de toque, console sem erro de hidratação, `npm test`, typecheck, build e CI.
- **Publicado**: deploy `dpl_H9wxTBkNm1uEKHvNTJV57dWP5q1R` `READY`; smoke test em produção ok.

## 2026-11-13 · `758286c` · Erros em português, telas de erro e voz mais estável (PR #9)
- `src/lib/errors.ts`: mensagens do chat por situação (sem internet, 429, 5xx, 504, 413) e do microfone; 4xx não repete a tentativa.
- Telas próprias: `src/app/error.tsx`, `global-error.tsx`, `not-found.tsx` (`ErrorScreen.tsx`).
- Voz (`src/lib/speech.ts`):
  - "terminou" só depois da resposta inteira;
  - prazo por trecho (iPhone sem aviso de fim);
  - despertador no Chrome;
  - voz presa limpa ao começar;
  - um microfone por vez;
  - o modo conversa volta a ouvir mesmo sem voz na resposta.
- Ajustes: teto e reservas do mês vindos de `budget_status()`, com valor disponível (`src/app/api/usage/route.ts`).
- Testado: 8 testes novos (`errors.test.ts`, `speech.test.ts` com síntese simulada); 40 unitários e 14 de integração; typecheck, build e CI. **Falta confirmar a voz nos aparelhos.**
- **Publicado**: deploy `dpl_ELAhLL3G7DMh3hfQSQKAhZ4Uu3rF` `READY`; página 404 conferida em produção.

## 2026-11-13 · `9e9351a` · Orçamento mensal com reserva e reconciliação (PR #6)
- Migração `20261113140001_ai_budget_reservations.sql`: `private.budget_policy` (US$ 20), `private.user_budget`, `public.ai_reservations` (RLS), `reserve/settle/release/expire_ai_reservations`, `budget_status`.
- App: o chat, o resumo e a importação reservam antes e liquidam pelo custo real; o agendador expira reservas vencidas.
- Testado:
  - 32 testes unitários, 14 de integração e `test:db` (31 checks SQL e concorrência: 20 reservas simultâneas de US$ 0,25 com teto de US$ 1,00 → exatamente 4);
  - em produção, com usuário temporário e rollback: teto, idempotência, liberação, isolamento entre pessoas, permissões.
- **Publicado**:
  - backup `private.backup_usage_events_20261113` (44 linhas, somas iguais);
  - migração aplicada (registro `ai_budget_reservations`);
  - deploy `dpl_CBrNxW8eLPRPTQ6tjFP2ba9iTrU1` `READY`;
  - **uso real**: 1 reserva liquidada e ligada ao consumo.

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
- Teste real com login feito pelo Eduardo: 4 mensagens contadas em 12/11 (dia de Brasília).

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
