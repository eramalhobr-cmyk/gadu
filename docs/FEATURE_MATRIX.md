# GaDu · Matriz de funcionalidades

**Hoje, em revisão:** gráficos de despesas do mês e variação diária das ações acompanhadas. Os cartões levam aos módulos, que também podem ser abertos por voz. Dados ausentes são indicados na tela.


## Desktop, voz natural e investimentos · em revisão

- Hoje: grade com 1 a 3 colunas conforme largura útil.
- Voz: “liga a voz natural”, com confirmação, quando a opção estiver habilitada no servidor.
- Investimentos: “abre investimentos”, consulta de cotações e variação histórica.


**Agenda e voz, em revisão:** criar série diária, semanal, mensal ou anual pela conversa. Conferir frequência, intervalo e total no cartão ou pela voz, antes de gravar.


## Piloto de transcrição pelo AI Gateway

Estado: **no app desde 24/11/2026, opcional** (Ajustes → Transcrição na nuvem; desligada por padrão). Modelo `microsoft/mai-transcribe-2` com `openai/gpt-transcribe` de reserva (`TRANSCRIBE_MODELS`); `TRANSCRIBE_ENABLED=0` desliga para todos. Código em `src/lib/voz/*` e `src/app/api/voz/transcrever`. Falta validar no celular com voz real. [Plano, decisões e resultados](PILOTO_VOZ_GATEWAY.md).


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
| Insights: conflito de agenda, janela livre, atrasos, e-mail parado, com Aceitar/Ignorar | implementado (Aceitar/Ignorar em 23/11) | — | `src/lib/insights.ts`, `src/lib/percepcoes.ts`, `src/components/PercepcoesCard.tsx` | — |
| Regra de privacidade (dado sensível não sai nem é gravado) | implementado (detecção por dado em 23/11, Cursor) | — | `src/lib/privacy.ts` | CPF/CNPJ com DV, Luhn, agência e conta, chave Pix, senha com valor, tokens; saúde continua por palavra |
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
| Simulador de salário bruto → líquido (INSS progressivo com teto, IRRF com dependentes e desconto simplificado, redução da Lei 15.270/2025; tabelas de 2026) | beta (publicado em 23/11/2026, PR #63; ampliado e **publicado** em 23/11 às 19:09, PR #116, merge `ed9a20f`: outras deduções, benefícios, 13º, férias e voz sem modelo) | P1 | `src/lib/finance/{salario,salario-texto}.ts`, `src/components/SalarioSimulador.tsx` (aba "Salário"), `src/lib/{acoes,acoes-resolver,chat-actions}.ts` (`salario_simular`), `src/app/api/chat/route.ts` | empregado CLT; 13º e férias são estimativas (sem abono, venda de férias, 13º em parcelas); sem PLR; constantes e testes mudam a cada ano; `FINANCE_ENABLED=0` desliga; sem migração; validar com pessoa logada |
| Lançar gasto pela conversa (proposta que a pessoa confirma) | beta (publicado em 22/11/2026, PR #26) | P1 | `src/lib/finance/lancamento.ts`, `src/lib/meta.ts`, `src/components/GastoCard.tsx` | pela reserva/cota de sempre |
| Interruptor de emergência `FINANCE_ENABLED=0` | beta (publicado em 22/11/2026, PR #26) | P1 | `src/lib/finance/flag.ts`, `src/app/api/finance/_guard.ts`, `test/finance*.integration.test.ts` | ligado por padrão |
| Lançar por print, PDF de extrato e áudio; marcar pago por texto; log; "a confirmar" | planejado | P1 | — | fases 2 e 3 da especificação |
| Caixa, plano (reserva e quitação), simulador bruto → líquido, ano e exportação | planejado | P2 | — | simulador bruto → líquido é o próximo item |

## 5. Tarefas, agenda e memórias
| Funcionalidade | Status | Prioridade | Código | Dependências / próximos passos |
|---|---|---|---|---|
| Lista de compras (mercado): adicionar, marcar, reabrir, remover; sincronizada na conta | beta (publicado em 23/11/2026, PR #123) | P1 | `src/components/ListaComprasPage.tsx`, `src/app/api/lista-compras/*`, `supabase/migrations/20261124010001_lista_compras.sql` | `LISTA_COMPRAS_ENABLED=0` desliga; validar no aparelho |
| Agenda de filhos: fins de semana alternados, troca pontual, mudança a partir de uma data, feriados nacionais colados, consulta de data | beta (PR #126, 24/11; migração aplicada) | P1 | `src/lib/filhos/*`, `src/app/api/agenda-filhos/*`, `src/components/FilhosPage.tsx`, `supabase/migrations/20261124020001_agenda_filhos.sql` | `AGENDA_FILHOS_ENABLED=0` desliga; sem feriados estaduais/municipais nem férias escolares; validar no aparelho |
| Compras: pedidos e entregas lidos do Gmail (só leitura) | beta (publicado em 23/11/2026, PR #124) | P1 | `src/lib/compras/*`, `src/app/api/compras/route.ts`, `src/components/ComprasPage.tsx`, bloco [C1] no `/api/chat` | `COMPRAS_ENABLED=0` desliga; sem tabela; validar com Gmail real (formatos das lojas) |
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
| Ferramentas permitidas e teto por agente | implementado (23/11, Cursor) | — | `src/lib/agentes/ferramentas.ts`, `src/app/api/chat/route.ts`, `AgentsPage.tsx`, tabela `agent_uso` | orçamento com reserva (PR #6); teto do agente checado antes da reserva (mole sob concorrência) |
| Modelo próprio por agente | planejado | P2 | — | — |

## 7. Agent Office Studio (sites, aplicações web e PWAs)
| Funcionalidade | Status | Prioridade | Código | Dependências / próximos passos |
|---|---|---|---|---|
| Criação de sites, aplicações web e PWAs por agentes | planejado | P3 | — | Agent Office; sandbox de execução; sem app nativo Android/iOS nesta fase (decisão oficial) |

## 8. 3D Studio e impressão 3D
| Funcionalidade | Status | Prioridade | Código | Dependências / próximos passos |
|---|---|---|---|---|
| Peça por conversa → OpenSCAD (WASM no navegador) → STL e 3MF comum (3D-1) | publicado (PR #40) e **ligado em produção** em 23/11/2026 (`MODELING_3D_ENABLED=1`) | P1 | `src/app/api/3d/generate/route.ts`, `src/lib/3d/*`, `src/components/studio3d/*`, `src/app/app/3d/page.tsx`, `public/vendor/openscad/*` | refino por voz e imagem |
| Peças e versões salvas (lista "Suas peças", abrir, apagar, medidas guardadas; 30 versões por peça) e "abre a minha última peça" por voz | publicado em 23/11/2026 (PRs #78 e o deste branch), migração `pecas_3d` aplicada | P1 | `src/app/api/3d/pecas/**`, `src/lib/3d/pecas.ts`, `Studio3D.tsx`, `supabase/migrations/20261123140001_pecas_3d.sql` | testar no aparelho com login |
| Rodada de referência com IA real (10 peças, 23/11) e correções: prazo da IA, código cortado, altura = Z, texto em relevo, Nova peça, prévia à vista (PR #114); qualidade da 2ª rodada (Z total, medidas vs. malha, partes desconexas, parede/texto 1,2 mm, uma correção automática); Abrir no celular rola até a prévia, mostra pedido e versões; “abre a peça do chaveiro” | correções em `fix/3d-qualidade-ajustes` (desenvolvidas e testadas em unidade; e2e escrito) | P1 | `src/lib/3d/checks.ts`, `qualidade.ts`, `scad.ts`, `Studio3D.tsx`, `scripts/e2e-auth-local.sh` | 3ª rodada com IA real no navegador |
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
| Monitoramento e alerta de erro (captura completa no servidor, alerta por push com throttle, painel Saúde do sistema, voz) | desenvolvido e testado em 23/11/2026 (branch `feat/monitoramento-alerta-erro`); **migração `20261123200001` ainda não aplicada** | P1 | `src/lib/telemetria/{capturar,alerta,avisar,saude}.ts`, `src/lib/saude-voz.ts`, `src/app/api/admin/saude`, `AdminPage.tsx`, `supabase/migrations/20261123200001_alerta_erros.sql`, `docs/OBSERVABILIDADE.md` | aplicar a migração (aprovação do Eduardo); validar o push no aparelho; `TELEMETRIA_TOKEN` (issue diária) fica para o fim do roadmap |
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
| Telemetria de erros (`error_events`) | implementado (PR #76 migração; código no PR #80; captura ampliada, alerta por push e painel na branch `feat/monitoramento-alerta-erro`) | consulta por voz na seção 11 ("teve algum erro hoje?"); só leitura, não grava nada | `src/lib/telemetria/*`, `src/app/api/telemetria/erro`, `src/app/api/admin/{erros,saude}`, `src/app/api/cron/{tick,telemetria-resumo}`, `src/instrumentation.ts`, `.github/workflows/alerta-erros.yml`, `docs/OBSERVABILIDADE.md` | a issue diária precisa do segredo `TELEMETRIA_TOKEN` (passo do Eduardo, fim do roadmap); o alerta por push não precisa; `TELEMETRIA_ENABLED=0` desliga tudo |
| Testes de interface automatizados (Playwright) | implementado | — | `e2e/public.e2e.cjs`, `e2e/auth.e2e.cjs` | PR #16; públicos no CI desde o PR #18; **com login no CI desde 23/11/2026** (`.github/workflows/e2e-auth.yml`, `scripts/e2e-auth-local.sh`, Supabase local, sem credencial de produção; 17 de 17) |
| Metas (fase 1): metas por número, percentual, marcos ou tarefas; prazo, ritmo e progresso só com registros (data e origem) | beta (publicado em 22/11/2026, PR #30) | P2 | `supabase/migrations/20261122210001_metas_base.sql`, `src/lib/goals/*`, `src/app/api/goals/*`, `src/components/MetasPage.tsx` | migração aplicada na produção; validar com pessoa logada em aparelho |
| Metas no assistente: fonte `goals` do Core ([M1]…, Fontes) e atualização como proposta com confirmação | beta (publicado em 22/11/2026, PR #30) | P2 | `src/lib/core/goals.ts`, `src/lib/core/plan.ts` (`detectGoalsIntent`), `src/lib/meta.ts`, `src/components/MetaCard.tsx`, `src/app/api/chat/route.ts` | `GOALS_ENABLED=0` desliga tudo; `CORE_MVP=0` desliga a fonte e as propostas |
| Resumo de metas na tela Hoje (sem IA) | beta (publicado em 22/11/2026, PR #30) | P2 | `src/components/MetasHoje.tsx`, `src/app/api/goals/resumo/route.ts` | some com `GOALS_ENABLED=0` |
| Metas fase 2, projetos: ligar a meta a um projeto (tela da meta, conversa e fatos do Core "projetos ligados") | desenvolvido e testado em 23/11/2026 (PR `feat/metas-fase2-projetos`; migração `20261123170001` aplicada pelo Cursor) | P2 | `src/app/api/goals/[id]/projetos/*`, `src/lib/goals/load.ts` (`loadProjetos`), `src/components/MetasPage.tsx` (`PanelProjetos`), `src/lib/core/goals.ts` | some com `GOALS_ENABLED=0`; validar com pessoa logada |
| Metas & Conquistas: conquistas, recomendações, indicadores de outros módulos, metas compartilhadas | planejado | P2 | `docs/METAS_CONQUISTAS.md` | fases 2 a 6 da especificação |
| Casa Inteligente (GaDu Casa) | adiado (decisão do Eduardo, 22/11/2026) | — | `src/lib/modules.ts` (catálogo), `docs/CASA_INTELIGENTE.md` | sem integração real; Home Assistant recomendado |
| Integração de saúde (Samsung Health, Health Connect) | planejado | P3 | `docs/INTEGRACOES_SAUDE.md` | PWA não lê esses dados; exige conector Android e aprovação |
| Logo novo (três movimentos) | bloqueado | P1 | — | aguardando o arquivo; hoje marca em texto |
| Acessibilidade (atalho de teclado, alvos de toque, foco) | implementado | — | `GaduApp.tsx`, `globals.css`, `src/app/ux.css` | PR #10; alvos de 44 px e contraste AA auditados em 360 a 1920 px (PR #14); **48 px no celular e em telas de toque desde o UX-4 (PR #44)** |
| Validação do PWA na Streaming Box do carro | planejado | P3 | ROADMAP do PR #1 | — |

## 11. Tudo por voz (matriz; princípio do Eduardo de 22/11/2026)
Tudo o que dá para fazer tocando no app precisa dar para fazer pela conversa, falando ou escrevendo. A IA só propõe; a pessoa confirma com um toque ou dizendo "sim". Regra em [AGENTS.md](../AGENTS.md), seção 8.1. Código: `src/lib/acoes.ts` (bloco `"acoes"`), `src/lib/acoes-resolver.ts`, `src/lib/chat-actions.ts`, `src/components/ActionCard.tsx`.

**UX-5 (23/11/2026):** toda tela de módulo vazia convida a falar: mostra uma frase de exemplo (só de ações que já existem nesta matriz) e o botão "Falar com o GaDu", que abre a tela de escuta num toque. Agentes: o convite sugere "Cria um agente para me ajudar com os estudos" (ação `agente_criar`). A confirmação falada mostra o mesmo cartão da conversa.

**UX-7 G1 (23/11/2026):** modo voz imersivo. A escuta é tela cheia com o núcleo JARVIS reagindo ao som real; "modo voz" / "modo Jarvis" abre pela voz ou texto (comando local). Só apresentação.

**UX-7 M4 (23/11/2026):** resumo falado dos painéis. Botão "Ouvir" em cada painel; pela voz ou texto, "lê o resumo" lê o painel da tela e "mostra meu resumo de…" abre e fala os números (comando local, sem modelo). Só leitura.

**Painéis de resumo (23/11/2026, tema JARVIS):** Hoje (com o gasto do mês quando o Financeiro está ligado), Finanças, Metas, Tarefas e Agentes ganharam painel com números e gráficos (SVG/CSS) só de dados reais, com estado vazio. Pela voz ou texto, "mostra meu resumo de finanças" (ou de metas, tarefas, agentes, do dia) abre a tela e leva o painel para a vista, entendido no aparelho (sem modelo). Só leitura: não há ação nova de gravação.

**UX-7 M6 (23/11/2026):** paleta do computador (Ctrl+K) com telas, comandos, frases da tela e "perguntar ao GaDu", e microfone para falar; "recolhe o menu" / "expande o menu" pela voz ou texto no computador (comando local, sem modelo).

**UX-7 M5 (23/11/2026):** "o que posso dizer aqui". Toda tela tem o botão de balão no topo com 3 ou 4 frases de ações desta matriz; pela voz, "o que posso dizer aqui?" abre o mesmo cartão e lê exemplos (comando local, sem modelo). Tocar numa frase só leva o texto ao campo.

**E-mails e memórias (23/11/2026):** a triagem de e-mails (Merece sua atenção, Hoje, briefing e chat) obedece às memórias aprovadas ("e-mails da Vercel não são importantes; falhas de CI continuam relevantes"). Avisos críticos (segurança, cobrança) sempre aparecem; notificações automáticas ficam em baixa prioridade. "Isso não é importante" e "e-mails da Vercel não são importantes" funcionam por voz e texto (comando local, sem modelo) e pelo botão "Não é importante" do e-mail; cada um grava uma memória já aprovada. Sem migração. Arquivos: `src/lib/email-regras.ts`, `src/lib/core/sources/email.ts`, `src/app/api/email/nao-importante/route.ts`, `src/components/AttentionCard.tsx`.

**UX-7 G2 (23/11/2026):** navegação por intenção. "Abre finanças", "vai para as metas", "abre o 3D" e "volta" (tela anterior) funcionam por voz e por texto em qualquer tela, entendidos no aparelho (sem modelo). Frases que pedem conteúdo continuam com o GaDu.

**UX-7 (23/11/2026):** palco de voz. O avatar do GaDu fica grande na tela de escuta, na Conversa e no painel do assistente enquanto ele ouve, pensa ou fala, e reage ao som real. É só apresentação: não há ação nova a cobrir nesta matriz.

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
| Finanças | quanto fica líquido um salário de X (com dependentes, outras deduções e benefícios ditos) | sim, **comando local, sem modelo e sem custo de IA** | `pedidoSalario` + `calcularSalario` no `send()` do `GaduApp` (cartão `salario` e fala de `resumoSalario`, com 13º e férias); o `/api/chat` também responde sem chamar o modelo (curto-circuito). Pedido para guardar segue `salario_simular` | quem fala ouve o resumo na hora; o cartão tem o passo a passo e é só informação (fora da confirmação falada) |
| Finanças | guardar o líquido como salário do mês | sim | `salario_simular` com `salvar: true` (cartão + "sim"; grava na receita principal da própria pessoa pela rota `PUT /api/finance/itens/:id/mes`, com Desfazer; sem receita principal definida, só mostra o cálculo e avisa) | — |
| 3D Studio | abrir uma peça salva ("abre a minha última peça") | sim | `peca3d_abrir` (cartão com confirmação; abre `/app/3d?peca=`) | Cursor, 23/11 |
| Lista de compras | adicionar, marcar como comprado, reabrir, remover | sim | `lista_compra_adicionar`, `lista_compra_marcar`, `lista_compra_reabrir`, `lista_compra_remover` (um cartão por item, confirmação com toque ou "sim") | Codex, PR #123 (publicado) |
| Agenda de filhos | configurar e mudar a referência, trocar um ou vários fins de semana, desfazer a troca, mudar a alternância a partir de uma data e desfazer essa mudança; perguntar de quem é um fim de semana ou feriado | sim | `filhos_configurar` (antes era só na tela; corrigido em 24/11 a pedido do Eduardo), `filhos_troca` (vários num pedido viram um cartão só), `filhos_troca_desfazer`, `filhos_mudar`, `filhos_mudanca_remover`; cartão com confirmação e Desfazer. O bloco AGENDA DE FILHOS traz o calendário dos próximos sábados, também antes de configurar e quando a pessoa está na tela | Claude Code, 24/11 |
| Compras | ver pedidos e entregas ("quando chega meu pedido?") | sim (só leitura) | bloco Compras no `/api/chat` com [C1]… e Fontes; `navegar` com destino `compras`. Nada a gravar, então não há cartão | Claude Code, PR #124 (publicado) |
| Finanças | pôr, mudar ou tirar o teto de uma categoria; "quanto gastei com X este ano?" | sim | `teto_definir` (cartão com confirmação e Desfazer; grava pela rota `PUT/DELETE /api/finance/tetos`); a pergunta do ano é respondida com fatos somados no servidor (`/api/finance/ano` e Core `finance`), sem o modelo somar | Cursor, 23/11 |
| Finanças | criar conta, configurar a receita principal | sim | `conta_criar`, `receita_principal` (cartão com confirmação; criar tem Desfazer) | Cursor, 23/11 |
| Metas | criar (número, percentual, marcos, tarefas) | sim | `meta_criar` | — |
| Metas | registrar progresso, concluir | sim | `meta_registrar`, `meta_concluir` (pelo nome) e `"metas"` (pela etiqueta [M1]) | — |
| Metas | adicionar marco, concluir marco | sim | `meta_marco`, `meta_marco_concluir` | — |
| Metas | criar tarefa da meta | sim | `meta_tarefa` (cria e vincula) | — |
| Metas | ligar e desligar a meta de um projeto ("liga a meta de corrida ao projeto Saúde") | sim | `meta_projeto` (`POST`/`DELETE /api/goals/:id/projetos`; cartão com "sim"; **Desfazer** religa ou desliga; só meta e projeto da própria pessoa; vínculo repetido vira aviso) | — |
| Metas | reservar horários na agenda para a meta ("reserva 3 manhãs por semana para a meta de corrida") e liberar | sim | `meta_agenda` (o servidor escolhe dias e horários pulando compromissos; cartão mostra os horários; cria no Google só depois do "sim"; **Desfazer** libera os blocos; liberar um bloco pela tela da meta). Reservar não conta como progresso | Claude Code e Cursor, 23/11 |
| Hoje | aceitar ou ignorar uma percepção do dia ("passa as atrasadas para hoje", "ignora o aviso do e-mail", "reserva o foco na janela livre") | sim | `percepcao` (o servidor recalcula as percepções de hoje e tira as já respondidas; cartão com confirmação; Aceitar faz a ação do tipo; **Desfazer** volta só o que foi feito; "dia cheio" só ignora) | Cursor, 23/11 |
| Metas | pausar, retomar, arquivar | sim | `meta_pausar`, `meta_retomar`, `meta_arquivar` (`PATCH /api/goals/:id` com `status`; arquivar não apaga nada e avisa que dá para restaurar em Metas) | — |
| Metas | editar título, alvo (meta numérica) e prazo | sim | `meta_editar` | — |
| Metas | apagar registro de progresso ("apaga o último registro da corrida") | sim | `meta_registro_apagar` (o mais recente, ou pelo valor e data; cartão com "sim"; não tem Desfazer), PR do Cursor de 23/11 | — |
| Projetos | criar | sim | `projeto_criar` | — |
| Projetos | editar nome e objetivo | sim | `projeto_editar` | — |
| Projetos | arquivar | sim | `projeto_arquivar` (grava o status `done` = "Concluído"; o banco não tem status "arquivado" e criar um exigiria migração) | — |
| Memória | guardar um fato ("lembre que…") | sim | `"memorias"` (fica pendente para revisão) | — |
| Memória | aprovar (uma ou todas as pendentes) | sim | `memoria_aprovar` | — |
| Memória | recusar (descartar pendente) | sim | `memoria_recusar` (confirmação explícita; não dá para desfazer) | — |
| Memória | esquecer ("esquece que eu…") | sim | `memoria_esquecer` (só memórias aprovadas; confirmação explícita; não dá para desfazer) | — |
| Agentes | criar | sim | `agente_criar` (nome até 60, área da lista de Agentes, instruções até 4000; cartão com as instruções e "sim" falado; nome repetido avisa; "Feito · Desfazer" apaga o agente recém-criado (Cursor, 23/11)) | PR da branch `feat/voz-agentes`, Claude Code, 23/11 |
| Agentes | editar nome, área, instruções, ativar/desativar, ferramentas e teto | sim | `agente_editar` (só o que muda; ferramentas com `liberar`/`bloquear` e `teto` em US$ por mês, 0 tira o teto (Cursor, 23/11); instruções novas SUBSTITUEM as antigas e o cartão mostra o texto; a fala lê só um resumo; "Feito · Desfazer" volta nome, área, instruções e ativo de antes) | idem |
| Agentes | apagar | sim | `agente_apagar` (cartão pede confirmação; sem Desfazer, como na tela) | Claude Code, 24/11 |
| Configurações | tamanho do texto, conversa contínua, respostas curtas, resposta falada, tema | sim | `ajuste` | — |
| Configurações | enviar sozinho o que eu falar, transcrição na nuvem | sim | `ajuste` (`envio_automatico`, `transcricao_nuvem`), cartão com confirmação | Claude Code, 24/11 |
| Configurações | velocidade da fala ("fala mais devagar", "volta ao normal") e trocar a voz ("usa outra voz") | sim | `ajuste` (`velocidade`, `voz_trocar`), PR do Cursor de 23/11 | — |
| Configurações | termos bloqueados | sim | `termo_bloquear`, `termo_desbloquear` (cartão com confirmação e Desfazer) | Claude Code, 24/11 |
| Configurações | limites de IA, notificações, conectar o Google | **não** | `navegar` para Configurações | notificações e Google exigem um toque (regra do navegador e do OAuth); limites de IA são do administrador |
| Conversa | nova conversa | sim | `nova_conversa` (cartão + "sim": começar outra conversa limpa a tela no meio da resposta, então não é instantâneo; a anterior fica no histórico) | — |
| Saúde do sistema | "teve algum erro hoje?", "o que quebrou (hoje)?", "mostra/abre a saúde do sistema", "abre a administração" | sim | comando local `parseSaudeVoz` (`src/lib/saude-voz.ts`; `GET /api/admin/saude`): administrador abre a tela, leva o painel à vista e ouve o resumo real do dia ("Hoje houve 3 erros em 2 grupos…" ou "Nenhum erro registrado hoje."); quem não é administrador ouve "Isso é só para administrador." (a API responde 403); só leitura, sem modelo, sem cartão e sem custo; nunca fala e-mail, mensagem, token ou dado de pessoa | Claude Code, 23/11 |
| Navegação | "abre o Financeiro", "vai para Metas", "mostra minhas tarefas" | sim | `navegar` (abre na hora, sem confirmação e sem gravar; telas desligadas por interruptor não abrem; Admin e telas em desenvolvimento ficam de fora da ação da IA; por voz, só administrador abre Administração: "abre a administração" e "abre a saúde do sistema", comando local) | — |
| Desfazer | "desfaz", "volta atrás", "foi sem querer" | sim | comando local `parseUndoCommand` (`src/lib/undo.ts`): desfaz a última ação enquanto o aviso "Feito · Desfazer" está à mão; sem modelo e sem custo, então não é uma ação do bloco "acoes" | só vale nos 8 s do aviso |
| Erros | "tenta de novo" | sim | comando local `parseRetryCommand` (`src/lib/errors.ts`): reenvia a última mensagem que falhou; sem modelo | — |
| Primeiro uso | "me mostra o guia de novo" | sim | `guia` (abre o guia na hora, sem cartão e sem gravar; vale com Metas e Financeiro desligados) | — |
| Primeiro uso | pular, voltar e continuar passos do guia | **não** | — | são toques dentro do guia; o nome e o teste do microfone são falados ali dentro |
| Conversa | abrir conversa anterior ("abre a conversa sobre o condomínio") | sim | `conversa_abrir` (título, resumo ou busca por texto, só as da pessoa; cartão com "sim"), PR do Cursor de 23/11 | — |
| 3D | ajustar uma peça salva ("deixa o suporte 2 mm mais alto") | sim | `peca3d_ajustar` (cartão com o pedido e o aviso de que usa IA do 3D; confirmado, abre a peça e o 3D Studio faz o ajuste uma vez; o pedido vai pela sessão do navegador, não pela URL; desfazer = "Voltar uma versão" no Studio; desde o 3D-1b o render da peça vai junto do ajuste) | Cursor, 23/11 |
| 3D | gerar peça nova | sim | `peca3d_criar` (cartão com o pedido e o aviso de cota; o 3D Studio abre vazio e gera uma vez pelo fluxo normal, com a reserva e a cota do 3D) | Claude Code, 24/11 |
