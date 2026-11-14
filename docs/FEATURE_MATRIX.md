# GaDu · Matriz de funcionalidades

Atualizada em 14/11/2026 (Sprint UX/UI v2.1, PR #14), a partir do código na `main` e de PRs abertos. Status:
- **implementado**: na `main` e em produção.
- **beta**: em produção, mas parcial, dependente de passo manual ou sem validação real.
- **em desenvolvimento**: em branch ou PR.
- **planejado**: só em documento.
- **bloqueado**: depende de decisão ou recurso externo.

Prioridade: **P0** agora · **P1** próximo ciclo · **P2** depois · **P3** longo prazo. Nada que exista só em design, mockup ou plano aparece como implementado.

## 1. Assistente pessoal e conversacional
| Funcionalidade | Status | Prioridade | Código | Dependências / próximos passos |
|---|---|---|---|---|
| Conversa em streaming, com o motor que respondeu | implementado | — | `src/app/api/chat/route.ts`, `src/components/GaduApp.tsx` | — |
| Contingência de motor (Gateway Claude → Gemini) e limite por motor | implementado | — | `src/lib/llm/*` | — |
| Chat fail closed (cota, teto e limites ilegíveis bloqueiam) | implementado | — | `src/lib/chat-budget-guard.ts` | PR #2 |
| Cota diária atômica (150/dia, dia de Brasília) | implementado | — | `supabase/migrations/20261113120001_daily_quota_atomic.sql` | remover `consume_quota` na etapa 2 |
| Teto mensal com reserva e reconciliação | implementado | — | `src/lib/ai-budget.ts`, migração `20261113140001` | validado no uso real (PR #6) |
| Gastos, reservas e limite visíveis no app | implementado | — | `src/components/SettingsPage.tsx`, `src/app/api/usage/route.ts` | em Ajustes (PR #9); levar ao Hoje (P2) |
| Mensagens de erro em português e tela de erro própria | implementado | — | `src/lib/errors.ts`, `src/app/error.tsx`, `global-error.tsx`, `not-found.tsx` | PR #9 |
| Lista de conversas (abrir, buscar, apagar) | implementado | — | `src/components/ConversationsDrawer.tsx` | — |

## 2. Assistente universal de voz e texto
| Funcionalidade | Status | Prioridade | Código | Dependências / próximos passos |
|---|---|---|---|---|
| Apertar para falar, resposta falada frase a frase, interromper | implementado | — | `src/lib/speech.ts`, `GaduApp.tsx` | — |
| Botão de voz flutuante em todas as telas | implementado | — | `GaduApp.tsx` | — |
| Modo conversa (volta a ouvir) | beta | P1 | `GaduApp.tsx`, `src/lib/speech.ts` | estabilidade melhorada no PR #9 (testes com voz simulada); validar no iPhone e no Android |
| Voz natural paga (ElevenLabs/OpenAI) com teto | planejado | P2 | — | aprovação de custo |
| Conversa contínua com interrupção natural | planejado | P2 | — | voz paga |
| Assistente Universal em todas as telas (painel lateral e painel de baixo) | implementado | — | `src/components/Assistant.tsx`, `GaduApp.tsx` | PR #12; validar nos aparelhos |
| Contexto do módulo e da tela enviado ao assistente | implementado | — | `src/lib/assistant-context.ts`, `src/app/api/chat/route.ts` | só rótulo validado; não amplia o acesso |
| Relacionar informações entre módulos (Core Contextual) | planejado | P1 | `docs/CORE_CONTEXTUAL.md`, `src/lib/core-context.ts` (só tipos) | auditoria de RLS e isolamento; modelo de organizações |
| Transcrição de voz revisável e escuta com limite de 20 s | implementado | — | `GaduApp.tsx`, `SettingsPage.tsx` | PR #14; validar nos aparelhos |

## 3. Inteligência contextual e integração entre módulos
| Funcionalidade | Status | Prioridade | Código | Dependências / próximos passos |
|---|---|---|---|---|
| Memória com aprovação, importação de outras IAs | implementado | — | `src/components/MemoryPage.tsx`, `src/lib/importer.ts`, `src/app/api/memories/import` | — |
| Resumo automático de conversas (memória v2) | implementado | — | `src/app/api/chat/route.ts` | — |
| Busca por significado (pgvector) em memórias, conversas, tarefas e projetos | implementado | — | `src/app/api/search`, `src/lib/embeddings.ts`, `search_index` | — |
| Insights: conflito de agenda, janela livre, atrasos, e-mail parado | implementado | — | `src/lib/insights.ts` | — |
| Regra de privacidade (dado sensível não sai nem é gravado) | implementado | — | `src/lib/privacy.ts` | Presidio com regras brasileiras (P2) |
| Contexto entre módulos com permissões (Finanças, Office) | planejado | P2 | — | módulos ainda não existem |

## 4. Financeiro
| Funcionalidade | Status | Prioridade | Código | Dependências / próximos passos |
|---|---|---|---|---|
| Especificação de referência | em desenvolvimento | P1 | PR #5: `docs/FEATURE-FINANCAS.md` | revisão e merge |
| Contas, dia a dia, lançamento pela conversa, extratos, caixa, plano, simulador | planejado | P1 | — | tabelas `fin_*` com RLS (alto risco: banco) |

## 5. Tarefas, agenda e memórias
| Funcionalidade | Status | Prioridade | Código | Dependências / próximos passos |
|---|---|---|---|---|
| Aba Hoje (painel em 3 colunas no desktop) | implementado | — | `src/components/TodayPage.tsx`, `src/app/api/today` | — |
| Tarefas (voz ou manual, prazo, prioridade, e-mail vira tarefa) | implementado | — | `src/components/TasksPanel.tsx`, tabela `tasks` | — |
| Projetos pessoais | implementado | — | `src/components/ProjectsPage.tsx` | — |
| Lembretes por voz e notificações (Web Push e Cron) | beta | P1 | `src/lib/push.ts`, `src/app/api/cron/tick` | falta o Eduardo instalar o PWA no iPhone e ligar as notificações |
| Briefing da manhã e revisão da noite | beta | P1 | `src/lib/briefing.ts`, `src/app/api/cron/tick` | depende das notificações |
| Google: agenda e Gmail (só leitura) | implementado | — | `src/lib/google.ts`, `src/app/api/google/*` | — |
| Agenda visual semanal | implementado | — | `src/components/AgendaView.tsx` | — |
| Criar eventos pela voz | beta | P1 | `src/app/api/calendar/route.ts` | bloqueado até liberar a permissão `calendar.events` no Google Cloud e reconectar |
| Rascunhos de e-mail e foco na agenda com aprovação | planejado | P2 | — | — |

## 6. Agent Office e agentes especializados
| Funcionalidade | Status | Prioridade | Código | Dependências / próximos passos |
|---|---|---|---|---|
| Agentes simples (nome, área, instruções, memória própria, "conversar com o agente") | implementado | — | `src/components/AgentsPage.tsx`, tabela `agents` | — |
| Espaços Pessoal e Trabalho, hierarquia, CRM leve, orquestração, aprovações | planejado | P2 | `docs/PLANO-AGENTES.md` | isolamento multiusuário, organização e cliente (decisão oficial) |
| Ferramentas permitidas, modelo e teto por agente | planejado | P2 | — | orçamento com reserva (PR #6) |

## 7. Agent Office Studio (sites, aplicações web e PWAs)
| Funcionalidade | Status | Prioridade | Código | Dependências / próximos passos |
|---|---|---|---|---|
| Criação de sites, aplicações web e PWAs por agentes | planejado | P3 | — | Agent Office; sandbox de execução; sem app nativo Android/iOS nesta fase (decisão oficial) |

## 8. 3D Studio e impressão 3D
| Funcionalidade | Status | Prioridade | Código | Dependências / próximos passos |
|---|---|---|---|---|
| Busca de modelos gratuitos (respeitando licenças), biblioteca, geração de modelos imprimíveis, exportação para fatiador | planejado | P2 | descrito em `docs/PROJECT_CONTEXT.md` (PR #1, não integrado) | vem depois do GaDu Personal e antes do Agent Office |

## 9. Integrações, segurança e permissões
| Funcionalidade | Status | Prioridade | Código | Dependências / próximos passos |
|---|---|---|---|---|
| RLS com `(select auth.uid())` em todas as tabelas públicas | implementado | — | `supabase/migrations/*` | auditoria completa (P1) |
| CSP com nonce, HSTS, cabeçalhos de segurança | implementado | — | `src/proxy.ts` | — |
| Token do Google criptografado (AES-256-GCM) | implementado | — | `src/lib/crypto.ts` | — |
| Convites e admin sem acesso a conteúdo | implementado | — | `src/components/AdminPage.tsx`, `src/app/api/admin/*`, `src/lib/invites.ts` | — |
| Administração de créditos e consumo por pessoa | planejado | P1 | — | a base existe: `private.user_budget` (PR #6) |
| Testes no CI (unitários, integração, banco) | implementado | — | `.github/workflows/pr-checks.yml`, `scripts/test-db.sh` | testes de ponta a ponta no navegador (P1) |
| Monitoramento e alerta de erro | planejado | P1 | — | — |
| Casa inteligente (Tuya, Alexa, Google Home) | planejado | P3 | ROADMAP do PR #1 | — |

## 10. Home pública, dashboard e experiência desktop/mobile
| Funcionalidade | Status | Prioridade | Código | Dependências / próximos passos |
|---|---|---|---|---|
| Home pública em `/` com botão Entrar | implementado | — | `src/app/page.tsx` | — |
| Avatar holográfico animado e ícone oficiais | implementado | — | `src/components/avatar-engine.ts`, `RobotFace.tsx`, `public/avatar`, `public/icons` | preservar (decisão oficial) |
| PWA instalável, tela offline, rascunho local | implementado | — | `public/manifest.webmanifest`, `public/sw.js`, `src/app/offline` | — |
| Guia, dicas e "Como funciona" | implementado | — | `src/app/app/guia`, `src/app/app/sobre`, `src/lib/tips.ts` | — |
| Design System com tokens centralizados | implementado (v1) | P1 | `src/app/globals.css`, `docs/DESIGN_SYSTEM.md` | PR #10; etapa 2: migrar estilos inline e criar componentes compartilhados |
| Arquitetura de módulos com status real | implementado | — | `src/lib/modules.ts`, `src/components/ModulePage.tsx` | PR #12; os módulos planejados só têm página de visão geral |
| Navegação por módulos (menu lateral; barra de baixo e folha de módulos) | implementado | — | `GaduApp.tsx`, `src/app/v2.css` | PR #12 |
| Temas claro e escuro | implementado | — | `src/lib/theme.ts`, `src/app/v2.css`, `src/app/layout.tsx` | PR #12; contraste AA medido nos dois temas (PR #14) |
| Painel Hoje, Conversa, Perfil e ajustes e home no desenho da v2 | implementado | — | `TodayPage.tsx`, `GaduApp.tsx`, `SettingsPage.tsx`, `src/app/page.tsx` | PR #12 |
| Projetos, Agentes, Memória, Admin, Guia e Agenda no desenho da v2 | implementado | — | `ProjectsPage.tsx`, `TasksPanel.tsx`, `AgendaView.tsx`, `AgentsPage.tsx`, `MemoryPage.tsx`, `AdminPage.tsx`, `src/app/v2-pages.css`, `kit.tsx` | PR #14; Admin sem verificação na tela (usuário de teste não é admin) |
| Menu com grupos recolhíveis; barra de baixo sem duplicação | implementado | — | `GaduApp.tsx`, `src/app/v2.css` | PR #14 |
| Logo novo (três movimentos) | bloqueado | P1 | — | aguardando o arquivo; hoje marca em texto |
| Acessibilidade (atalho de teclado, alvos de toque, foco) | implementado | — | `GaduApp.tsx`, `globals.css` | PR #10; alvos de 44 px e contraste AA auditados em 360 a 1920 px (PR #14) |
| Validação do PWA na Streaming Box do carro | planejado | P3 | ROADMAP do PR #1 | — |
