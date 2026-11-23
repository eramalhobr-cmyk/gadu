# GaDu · Matriz de funcionalidades

Atualizada em 22/11/2026 (revisão geral: status dos PRs #22, #24, #26 e #30 corrigidos para publicados; 3D por fases; Casa adiada; antes: 14/11/2026, Sprint UX/UI v2.2, PR #16), a partir do código na `main` e de PRs abertos. Status:
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
| Cota diária atômica (150/dia, dia de Brasília) | implementado; etapa 2 (remover `consume_quota`) publicada em 22/11/2026 (PR #22) | — | `supabase/migrations/20261113120001_daily_quota_atomic.sql`, `20261122120002_seguranca_p1_restritiva.sql` | — |
| Teto mensal com reserva e reconciliação | implementado; reserva só pelo servidor e estimativa no cancelamento publicadas em 22/11/2026 (PR #22) | — | `src/lib/ai-budget.ts`, `src/lib/partial-cost.ts`, migrações `20261113140001` e `20261122120001` | validado no uso real (PR #6); S-01 e S-02 aguardam publicação |
| Limite de tentativas de login e convite (IP e e-mail) | implementado (PR #22, 22/11/2026) | P1 | `src/lib/rate-limit.ts`, `src/lib/client-ip.ts`, `20261122120001_seguranca_p1_aditiva.sql` | senhas vazadas: passo manual no painel |
| Bloqueio de pessoa encerra sessões; admin não bloqueia admin | implementado (PR #22, 22/11/2026) | P1 | `src/app/api/admin/people/route.ts`, `src/lib/admin-guard.ts` | S-05 (RLS por acesso) segue aberto |
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
| Assistente Universal em todas as telas, em três estados (compacto, rápido, completo) | implementado | — | `src/components/Assistant.tsx`, `GaduApp.tsx` | PR #12, três estados e largura ajustável no PR #16; validar nos aparelhos |
| Contexto do módulo e da tela enviado ao assistente | implementado | — | `src/lib/assistant-context.ts`, `src/app/api/chat/route.ts` | só rótulo validado; não amplia o acesso |
| Relacionar informações entre módulos (Core Contextual) | beta: fase 1 publicada (PR #24) | P1 | `docs/CORE_CONTEXTUAL.md`, `src/lib/core-context.ts` (tipos), `src/lib/core/` | só a primeira entrega (atenção hoje, escopo pessoal); organizações dependem do modelo de organizações (S-08) |
| Core: "O que merece minha atenção hoje?" no chat, com etiquetas e "Fontes" | beta (publicado em 22/11/2026, PR #24) | P1 | `src/lib/core/*`, `src/app/api/chat/route.ts`, `src/components/SourcesDetail.tsx`, `src/components/Assistant.tsx` | branch `feat/core-atencao-hoje`: testado localmente, não publicado; validar com pessoa logada |
| Core: cartão "Merece sua atenção" na tela Hoje (sem IA) | beta (publicado em 22/11/2026, PR #24) | P1 | `src/app/api/attention/route.ts`, `src/components/AttentionCard.tsx`, `src/components/TodayPage.tsx` | idem; conferir em celular (390 px) com dados reais |
| Interruptor de emergência `CORE_MVP=0` | beta (publicado em 22/11/2026, PR #24) | P1 | `src/lib/core/flag.ts`, `test/core-atencao.integration.test.ts` | ligado por padrão; precisa variável na Vercel para desligar |
| Transcrição de voz revisável e escuta com limite de 20 s | implementado | — | `GaduApp.tsx`, `SettingsPage.tsx` | PR #14; envio automático desligado por padrão e interrupção sem reabrir o microfone no PR #16; testes com voz simulada; validar nos aparelhos |

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
| Especificação de referência | implementado (documento) | — | `docs/FEATURE-FINANCAS.md` (PR #5 integrado) | seção "Implementação" diz o que existe |
| Tabelas `fin_itens`, `fin_item_meses`, `fin_gastos`, `fin_config` com RLS | beta (publicado em 22/11/2026, PR #26) | P1 | `supabase/migrations/20261122190001_financas_base.sql`, `supabase/tests/60_financas.test.sql`, `30_isolamento.test.sql` | branch `feat/financas-base`: testado localmente, **migração não aplicada**; aplicar exige aprovação |
| Contas fixas e receitas por mês, marcar pago, vínculos (cartão, segue, via reserva) | beta (publicado em 22/11/2026, PR #26) | P1 | `src/components/FinanceiroPage.tsx`, `src/app/api/finance/itens/*`, `src/lib/finance/{summary,pagamento}.ts` | idem; validar em celular com pessoa logada |
| Dia a dia: gastos por categoria e meio, editar e apagar | beta (publicado em 22/11/2026, PR #26) | P1 | `FinanceiroPage.tsx`, `src/app/api/finance/gastos/*` | sem teto por categoria (planejado) |
| Resumo do mês: receitas, contas, dia a dia, sobra, por categoria, sem dupla contagem do crédito | beta (publicado em 22/11/2026, PR #26) | P1 | `src/lib/finance/summary.ts`, `src/app/api/finance/resumo/route.ts` | sem saldo do banco nem acumulado do ano |
| Previsão até o próximo recebimento (dia 15 e dia 1) | beta (publicado em 22/11/2026, PR #26) | P2 | `src/lib/finance/previsao.ts`, `fin_config` | não é o fluxo de caixa completo |
| Perguntar ao GaDu sobre gastos e contas (fonte `finance` do Core, [F1]…, Fontes) | beta (publicado em 22/11/2026, PR #26) | P1 | `src/lib/core/finance.ts`, `src/lib/core/plan.ts`, `src/app/api/chat/route.ts` | sem IA extra; `CORE_MVP=0` desliga |
| Lançar gasto pela conversa (proposta que a pessoa confirma) | beta (publicado em 22/11/2026, PR #26) | P1 | `src/lib/finance/lancamento.ts`, `src/lib/meta.ts`, `src/components/GastoCard.tsx` | pela reserva/cota de sempre |
| Interruptor de emergência `FINANCE_ENABLED=0` | beta (publicado em 22/11/2026, PR #26) | P1 | `src/lib/finance/flag.ts`, `src/app/api/finance/_guard.ts`, `test/finance*.integration.test.ts` | ligado por padrão |
| Lançar por print, PDF de extrato e áudio; marcar pago por texto; log; "a confirmar" | planejado | P1 | — | fases 2 e 3 da especificação |
| Caixa, plano (reserva e quitação), simulador bruto → líquido, ano e exportação | planejado | P2 | — | simulador bruto → líquido é o próximo item |

## 5. Tarefas, agenda e memórias
| Funcionalidade | Status | Prioridade | Código | Dependências / próximos passos |
|---|---|---|---|---|
| Aba Hoje (painel em 3 colunas no desktop) | implementado | — | `src/components/TodayPage.tsx`, `src/app/api/today` | — |
| Tarefas (voz ou manual, prazo, prioridade, e-mail vira tarefa) | implementado | — | `src/components/TasksPanel.tsx`, tabela `tasks` | — |
| Projetos pessoais | implementado | — | `src/components/ProjectsPage.tsx` | — |
| Lembretes por voz e notificações (Web Push e Cron) | beta | P1 | `src/lib/push.ts`, `src/lib/push-client.ts`, `public/sw.js`, `src/app/api/cron/tick` | reinscrição, clique na rota e selo corrigidos no PR #28 (publicado em 22/11/2026; testado com service worker simulado); falta o Eduardo ligar as notificações no aparelho (docs/CHECKLIST_CELULAR.md) |
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
| Peça por conversa → OpenSCAD (WASM no navegador) → STL e 3MF comum (3D-1) | **desenvolvido e testado localmente** (Beta; `MODELING_3D_ENABLED=1`, desligado por padrão; não publicado) | P1 | `src/app/api/3d/generate/route.ts`, `src/lib/3d/*`, `src/components/studio3d/*`, `src/app/app/3d/page.tsx`, `public/vendor/openscad/*` | testar com a IA real; refino por voz e imagem; salvar versões (migração com aprovação) |
| 3MF "A1 PLA 0.4" (projeto do Bambu Studio) | função pronta (`injectIntoTemplate`), botão **desativado** | P1 | `src/lib/3d/threemf.ts` | modelo de projeto salvo pelo Eduardo (docs/FEATURE-3D.md) |
| Figura a partir de foto com modelos abertos gratuitos e reparo de malha (3D-2) | planejado | P2 | `docs/FEATURE-3D.md` | token do Hugging Face; limites diários do ZeroGPU; licenças |
| Envio direto para a A1 pela rede local (3D-3) | planejado | P3 | `docs/FEATURE-3D.md` | ponte local; depois |
| Busca de modelos gratuitos de terceiros e biblioteca | planejado | P3 | — | respeitar licenças |

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
| Casa inteligente (Tuya, Alexa, Google Home) | adiado (decisão do Eduardo, 22/11/2026) | — | ROADMAP do PR #1 | quando retomar: Home Assistant (`docs/CASA_INTELIGENTE.md`) |

## 10. Home pública, dashboard e experiência desktop/mobile
| Funcionalidade | Status | Prioridade | Código | Dependências / próximos passos |
|---|---|---|---|---|
| Home pública em `/` com botão Entrar | implementado | — | `src/app/page.tsx` | — |
| Avatar holográfico animado e ícone oficiais | implementado | — | `src/components/avatar-engine.ts`, `RobotFace.tsx`, `public/avatar`, `public/icons` | preservar (decisão oficial) |
| PWA instalável, tela offline, rascunho local | implementado | — | `public/manifest.webmanifest`, `public/sw.js`, `src/app/offline` | instalável verificado pelo CDP (emulado); falta instalar no aparelho |
| Guia, dicas e "Como funciona" | implementado | — | `src/app/app/guia`, `src/app/app/sobre`, `src/lib/tips.ts` | — |
| Design System com tokens centralizados | implementado (v2.3, etapa 2 publicada em 23/11/2026, PR #60) | P1 | `src/app/globals.css`, `src/app/v2.css`, `src/app/v2-pages.css`, `src/components/kit.tsx`, `docs/DESIGN_SYSTEM.md` | PR #10; etapa 2: estilos inline estáticos viraram utilitários, `Field` e `BackButton`, `v2.css` sem seletor repetido; falta juntar `globals.css` com `v2.css` |
| Arquitetura de módulos com status real | implementado | — | `src/lib/modules.ts`, `src/components/ModulePage.tsx` | PR #12; os módulos planejados só têm página de visão geral |
| Navegação por módulos (menu lateral; barra de baixo e folha de módulos) | substituído (UX-1, PR #34) | — | `GaduApp.tsx` | PR #12 |
| Hoje em 5 blocos (UX-2): "Falar com o GaDu", Agora, lista única "Merece sua atenção" (Core + metas + memórias) com Feito/Adiar e Desfazer, frases prontas, Ver tudo (lembretes abrem no lugar) | publicado (22/11/2026, PR #35) | — | `TodayPage.tsx`, `AttentionCard.tsx`, `src/lib/core/format.ts` (`toActionItem`), `src/app/api/attention/route.ts`, `src/app/ux.css` | validar Feito/Adiar com dados reais no aparelho |
| Voz em um toque (UX-3, parte 1): tela de escuta em letra grande, envio sozinho em 3 s com Cancelar/Corrigir, conversa contínua na tela | publicado (22/11/2026, PR #36) | — | `ListenSheet.tsx`, `GaduApp.tsx`, `src/app/ux.css` | validar no aparelho |
| Texto grande (UX-3): Normal, Grande (115%) e Maior (130%) em Configurações, aplicado pelo servidor (cookie `gadu_texto`), corpo de 16 px | publicado (22/11/2026, PR #38) | — | `src/lib/text-size.ts`, `src/app/layout.tsx`, `SettingsPage.tsx` (`TextSizeCard`), fontes em `calc(Npx * var(--ts, 1))` nos CSS | conferir cortes de texto com "Maior" no aparelho |
| Confirmações faladas (UX-3): o GaDu lê o que vai gravar e aceita "sim", "não" ou "muda para…"; tela com Sim/Não grandes; cartão único `ActionCard` | publicado (22/11/2026, PR #39; estado no app desde o PR #42) | — | `src/lib/voice-confirm.ts`, `ConfirmSheet.tsx`, `ActionCard.tsx`, `src/lib/chat-actions.ts`, `GaduApp.tsx` | validar reconhecimento do "sim" no Chrome Android e Samsung Internet |
| Respostas faladas curtas (UX-3): fala cerca de 20 s e "O resto está na tela"; opção em Configurações; briefing fala inteiro | publicado (22/11/2026, PR #39) | — | `src/lib/speech.ts` (`maxChars`, `SHORT_REPLY`), `src/lib/prompt.ts` | — |
| Linguagem simples e menos escolhas (UX-4): sem Beta, Plataforma, "via modelo" e [T1] à vista; Hoje com 1 ação principal e "Mais opções" | publicado (23/11/2026, PR #52) | — | `TodayPage.tsx`, `AttentionCard.tsx`, `GaduApp.tsx`, `Assistant.tsx`, `src/app/ux.css`, `test/linguagem.test.ts` | o selo "Beta" do 3D em Mais é da frente 3D |
| "Feito · Desfazer" em toda ação que grava (UX-4): aviso único `UndoToast`, 8 s, também nos cartões da conversa e por voz ("desfaz") | publicado (23/11/2026, PR #53) | — | `src/lib/undo.ts`, `UndoToast.tsx`, `ActionCard.tsx` (`capture`), `test/desfazer.test.ts` | apagar memória, gasto ou evento pela conversa não tem Desfazer (o cartão já pede o "sim"); gasto apagado volta com novo id |
| Erros claros (UX-4): catálogo `src/lib/errors.ts`, "Tentar de novo", erro falado e "tenta de novo" por voz | publicado (23/11/2026, PR #54) | — | `src/lib/errors.ts`, `GaduApp.tsx` (`failChat`), `ActionCard.tsx`, `test/erros.test.ts` | voz de verdade ainda não conferida no aparelho |
| Primeiro uso guiado e falado (UX-4): nome, microfone e voz, Google; pode pular; Voltar fecha; refazer em Configurações e por voz | publicado (23/11/2026, PR #55) | — | `Onboarding.tsx`, `src/lib/onboarding.ts`, `GaduApp.tsx`, `SettingsPage.tsx`, `test/primeiro-uso.test.ts` | preferência em `profiles.settings.onboarding` (sem migração); gravação real e voz no aparelho não conferidas |
| Padrão único de tela de módulo (UX-5): título e frase, uma ação principal, resumo, lista, vazio com frase de exemplo e "Falar com o GaDu" | publicado (23/11/2026, PR #58) | P1 | `src/components/kit.tsx` (`ModuleScreen`, `PrimaryAction`, `Summary`, `EmptyState`), `ProjectsPage.tsx`, `MetasPage.tsx`, `FinanceiroPage.tsx`, `MemoryPage.tsx`, `AgentsPage.tsx`, `TodayPage.tsx` (Lembretes) | Lembretes é um painel em Hoje, não uma tela; o "Falar" vem do `GaduApp` por contexto |
| Cartão de confirmação único (UX-5): conversa, tela de escuta e telas (apagar, arquivar, desconectar) | publicado (23/11/2026, PR #59) | P1 | `src/components/ConfirmCard.tsx`, `ActionCard.tsx`, `ConfirmSheet.tsx`, `src/lib/confirm-card.test.ts` | Memória (Descartar, Esquecer) segue com um toque só |
| Passagem de bastão entre IAs (AGENTS.md, HANDOFF, modelo de PR) | publicado (22/11/2026, PR #33) | — | `AGENTS.md`, `CLAUDE.md`, `docs/HANDOFF.md`, `.github/pull_request_template.md` | — |
| Temas claro e escuro | implementado | — | `src/lib/theme.ts`, `src/app/v2.css`, `src/app/layout.tsx` | PR #12; contraste AA medido nos dois temas (PR #14) |
| Painel Hoje, Conversa, Perfil e ajustes e home no desenho da v2 | implementado | — | `TodayPage.tsx`, `GaduApp.tsx`, `SettingsPage.tsx`, `src/app/page.tsx` | PR #12 |
| Projetos, Agentes, Memória, Admin, Guia e Agenda no desenho da v2 | implementado | — | `ProjectsPage.tsx`, `TasksPanel.tsx`, `AgendaView.tsx`, `AgentsPage.tsx`, `MemoryPage.tsx`, `AdminPage.tsx`, `src/app/v2-pages.css`, `kit.tsx` | PR #14; Admin sem verificação na tela (usuário de teste não é admin) |
| Menu com grupos recolhíveis; barra de baixo sem duplicação | substituído (UX-1, PR #34) | — | — | PR #14 |
| Navegação simples (UX-1): barra de baixo Hoje · Conversa · microfone · Tarefas · Mais; tela "Mais" só com o que funciona e "Em breve"; sem menu sanfona no celular; Configurações num lugar só (Perfil e Integrações abrem a mesma tela); Voltar do Android | publicado (22/11/2026, PR #34) | — | `GaduApp.tsx`, `ModulePage.tsx` (`ModulesHub`), `SettingsPage.tsx`, `src/lib/modules.ts` (`MAIN_VIEWS`, `canonicalView`), `src/app/ux.css` | substitui a navegação híbrida do PR #16; validar no aparelho |
| Menu lateral do computador: lista simples na ordem do celular, recolhível | publicado (22/11/2026, PR #34) | — | `GaduApp.tsx`, `src/app/ux.css` | substitui os grupos por área do PR #16 |
| Testes de interface automatizados (Playwright) | implementado | — | `e2e/public.e2e.cjs`, `e2e/auth.e2e.cjs` | PR #16; públicos no CI desde o PR #18; com login rodam fora dos PRs (proposta em docs/TESTES_E2E.md) |
| Metas (fase 1): metas por número, percentual, marcos ou tarefas; prazo, ritmo e progresso só com registros (data e origem) | beta (publicado em 22/11/2026, PR #30) | P2 | `supabase/migrations/20261122210001_metas_base.sql`, `src/lib/goals/*`, `src/app/api/goals/*`, `src/components/MetasPage.tsx` | migração aplicada na produção; validar com pessoa logada em aparelho |
| Metas no assistente: fonte `goals` do Core ([M1]…, Fontes) e atualização como proposta com confirmação | beta (publicado em 22/11/2026, PR #30) | P2 | `src/lib/core/goals.ts`, `src/lib/core/plan.ts` (`detectGoalsIntent`), `src/lib/meta.ts`, `src/components/MetaCard.tsx`, `src/app/api/chat/route.ts` | `GOALS_ENABLED=0` desliga tudo; `CORE_MVP=0` desliga a fonte e as propostas |
| Resumo de metas na tela Hoje (sem IA) | beta (publicado em 22/11/2026, PR #30) | P2 | `src/components/MetasHoje.tsx`, `src/app/api/goals/resumo/route.ts` | some com `GOALS_ENABLED=0` |
| Metas & Conquistas: conquistas, recomendações, indicadores de outros módulos, metas compartilhadas | planejado | P2 | `docs/METAS_CONQUISTAS.md` | fases 2 a 6 da especificação |
| Casa Inteligente (GaDu Casa) | adiado (decisão do Eduardo, 22/11/2026) | — | `src/lib/modules.ts` (catálogo), `docs/CASA_INTELIGENTE.md` | sem integração real; Home Assistant recomendado |
| Integração de saúde (Samsung Health, Health Connect) | planejado | P3 | `docs/INTEGRACOES_SAUDE.md` | PWA não lê esses dados; exige conector Android e aprovação |
| Logo novo (três movimentos) | bloqueado | P1 | — | aguardando o arquivo; hoje marca em texto |
| Acessibilidade (atalho de teclado, alvos de toque, foco) | implementado | — | `GaduApp.tsx`, `globals.css`, `src/app/ux.css` | PR #10; alvos de 44 px e contraste AA auditados em 360 a 1920 px (PR #14); **48 px no celular e em telas de toque desde o UX-4 (PR #44)** |
| Validação do PWA na Streaming Box do carro | planejado | P3 | ROADMAP do PR #1 | — |

## 11. Tudo por voz (matriz; princípio do Eduardo de 22/11/2026)
Tudo o que dá para fazer tocando no app precisa dar para fazer pela conversa, falando ou escrevendo. A IA só propõe; a pessoa confirma com um toque ou dizendo "sim". Regra em [AGENTS.md](../AGENTS.md), seção 8.1. Código: `src/lib/acoes.ts` (bloco `"acoes"`), `src/lib/acoes-resolver.ts`, `src/lib/chat-actions.ts`, `src/components/ActionCard.tsx`.

**UX-5 (23/11/2026):** toda tela de módulo vazia convida a falar: mostra uma frase de exemplo (só de ações que já existem nesta matriz) e o botão "Falar com o GaDu", que abre a tela de escuta num toque. Agentes: criar por voz continua lacuna, então o convite sugere "Quais agentes você me sugere?". A confirmação falada mostra o mesmo cartão da conversa.

| Módulo | Ação na tela | Pela conversa | Como | Lacuna / motivo |
|---|---|---|---|---|
| Tarefas | criar | sim | `"tarefas"` (cria na hora; cartão com Desfazer desde o PR #42) | — |
| Tarefas | concluir | sim | `tarefa_concluir` | — |
| Tarefas | adiar (mudar prazo) | sim | `tarefa_adiar` | — |
| Tarefas | cancelar (apagar) | sim | `tarefa_cancelar` (a tarefa vai para "cancelada"; dá para reabrir pela conversa) | — |
| Tarefas | reabrir (feita ou cancelada) | sim | `tarefa_reabrir` | — |
| Tarefas | editar título, prioridade, prazo, mudar de projeto | sim | `tarefa_editar` (só os campos que mudam; o projeto é achado pelo nome entre os da pessoa) | — |
| Lembretes | criar | sim | `"lembretes"` (cria na hora; cartão com Desfazer) | — |
| Lembretes | cancelar | sim | `lembrete_cancelar` | — |
| Lembretes | adiar (soneca) | sim | `lembrete_adiar` (novo horário em Brasília; vale também para lembrete já avisado, que volta a pendente) | — |
| Agenda | criar evento | sim | `"eventos"` (proposta) | — |
| Agenda | editar (título, horário, local) | sim | `evento_editar` (acha o evento na agenda de ontem a 45 dias; sem "fim" mantém a duração; evento de dia inteiro só muda título e local) | permissão: o escopo `calendar.events` que já pedimos para criar também edita e apaga; OAuth **não mudou**. Quem conectou sem esse escopo recebe "Falta permissão" e reconecta |
| Agenda | apagar evento | sim | `evento_apagar` (confirmação explícita; não dá para desfazer) | — |
| Finanças | lançar gasto | sim | `"gastos"` (proposta) | — |
| Finanças | marcar conta do mês como paga ("paguei a luz") | sim | `conta_paga` (com os vínculos de cartão e "segue") | — |
| Finanças | desmarcar paga | sim | `conta_desmarcar` (`PUT /api/finance/itens/:id/mes` com `pago:false`) | — |
| Finanças | mudar o valor do mês (só este mês ou até dezembro) | sim | `conta_valor` (valor maior que zero; zerar a conta do mês fica na tela) | — |
| Finanças | editar gasto (valor, categoria, descrição, forma de pagamento, dia) | sim | `gasto_editar` (acha pelo nome, valor e dia; se couber em mais de um, pede mais detalhe) | — |
| Finanças | apagar gasto | sim | `gasto_apagar` (confirmação explícita; não dá para desfazer) | — |
| Finanças | criar conta, configurar salário | **não** | — | lacuna |
| Metas | criar (número, percentual, marcos, tarefas) | sim | `meta_criar` | — |
| Metas | registrar progresso, concluir | sim | `meta_registrar`, `meta_concluir` (pelo nome) e `"metas"` (pela etiqueta [M1]) | — |
| Metas | adicionar marco, concluir marco | sim | `meta_marco`, `meta_marco_concluir` | — |
| Metas | criar tarefa da meta | sim | `meta_tarefa` (cria e vincula) | — |
| Metas | pausar, retomar, arquivar | sim | `meta_pausar`, `meta_retomar`, `meta_arquivar` (`PATCH /api/goals/:id` com `status`; arquivar não apaga nada e avisa que dá para restaurar em Metas) | — |
| Metas | editar título, alvo (meta numérica) e prazo | sim | `meta_editar` | — |
| Metas | apagar registro de progresso | **não** | — | lacuna |
| Projetos | criar | sim | `projeto_criar` | — |
| Projetos | editar nome e objetivo | sim | `projeto_editar` | — |
| Projetos | arquivar | sim | `projeto_arquivar` (grava o status `done` = "Concluído"; o banco não tem status "arquivado" e criar um exigiria migração) | — |
| Memória | guardar um fato ("lembre que…") | sim | `"memorias"` (fica pendente para revisão) | — |
| Memória | aprovar (uma ou todas as pendentes) | sim | `memoria_aprovar` | — |
| Memória | recusar (descartar pendente) | sim | `memoria_recusar` (confirmação explícita; não dá para desfazer) | — |
| Memória | esquecer ("esquece que eu…") | sim | `memoria_esquecer` (só memórias aprovadas; confirmação explícita; não dá para desfazer) | — |
| Agentes | criar, editar | **não** | — | lacuna |
| Configurações | tamanho do texto, conversa contínua, respostas curtas, resposta falada, tema | sim | `ajuste` | — |
| Configurações | voz e velocidade, termos bloqueados, limites de IA, notificações, conectar o Google | **não** | — | notificações e Google exigem um toque (regra do navegador e do OAuth); o resto é lacuna |
| Conversa | nova conversa | sim | `nova_conversa` (cartão + "sim": começar outra conversa limpa a tela no meio da resposta, então não é instantâneo; a anterior fica no histórico) | — |
| Navegação | "abre o Financeiro", "vai para Metas", "mostra minhas tarefas" | sim | `navegar` (abre na hora, sem confirmação e sem gravar; telas desligadas por interruptor não abrem; Admin e telas em desenvolvimento ficam de fora) | — |
| Desfazer | "desfaz", "volta atrás", "foi sem querer" | sim | comando local `parseUndoCommand` (`src/lib/undo.ts`): desfaz a última ação enquanto o aviso "Feito · Desfazer" está à mão; sem modelo e sem custo, então não é uma ação do bloco "acoes" | só vale nos 8 s do aviso |
| Erros | "tenta de novo" | sim | comando local `parseRetryCommand` (`src/lib/errors.ts`): reenvia a última mensagem que falhou; sem modelo | — |
| Primeiro uso | "me mostra o guia de novo" | sim | `guia` (abre o guia na hora, sem cartão e sem gravar; vale com Metas e Financeiro desligados) | — |
| Primeiro uso | pular, voltar e continuar passos do guia | **não** | — | são toques dentro do guia; o nome e o teste do microfone são falados ali dentro |
| Conversa | abrir conversa anterior | **não** | — | lacuna: o histórico é por data e título; falta uma busca por nome |
| 3D | gerar e ajustar peça | pela tela 3D | — | frente do Claude Code, que adiciona as próprias ações |
