# GaDu · Situação do projeto

Atualizado em 15/11/2026, depois do ciclo de Qualidade e Segurança (Claude Code). Fonte de verdade: o código na `main` e as evidências abaixo. Intenção e planejamento ficam no [ROADMAP.md](ROADMAP.md); o detalhe por funcionalidade fica em [docs/FEATURE_MATRIX.md](docs/FEATURE_MATRIX.md).

## Ambiente de produção (verificado em 14/11/2026)
| Item | Estado | Evidência |
|---|---|---|
| App | https://gadu-agent.vercel.app | Vercel, projeto `gadu-agent`, região `iad1` |
| Última publicação | commit `18f1071` (merge do PR #16, Sprint UX/UI v2.2) | deploy `dpl_DEQDkX2dCyP9tbdaHSit6HzniL6U`, `READY`; 16 testes de interface aprovados em produção; capturas reais com login em 390 e 1440 px, nos dois temas |
| Banco | Supabase `sa-east-1`, Postgres 17 | 9 migrações registradas; as últimas são `daily_quota_atomic` e `ai_budget_reservations` |
| Cota diária | `consume_daily_quota()`, limite 150 em `private.quota_policy` | teste com usuário temporário e rollback; **uso real**: 4 mensagens contadas em 12/11 (dia de Brasília) |
| Orçamento mensal | `reserve/settle/release_ai_budget`, teto US$ 20 em `private.budget_policy` | teste com usuário temporário e rollback (teto, idempotência, isolamento, permissões); **uso real**: 1 reserva liquidada pelo custo real e ligada ao consumo |
| Rollback do app | deploys `dpl_BSXyR5vex6zNB5F1Z9f9M6SCZAxJ` (PR #14, antes da v2.2), `dpl_HT87wCvBrfSDQjkJ7ANsfkuFAAPF` (PR #13, antes da v2.1), `dpl_DFKuhDx6…` (antes da v2, PR #11), `dpl_ELAhLL3G…` (PR #9), `dpl_CBrNxW8e…` (PR #6) | promover na Vercel |
| Usuário de teste | conta `teste-ui@example.com`, criada pelo fluxo de convite, com teto de US$ 2 por mês; sem dados pessoais | usada só para capturas e testes de tela; a senha não fica no repositório |
| Rollback do banco | orçamento: drop das funções novas, `public.ai_reservations`, `private.budget_policy`, `private.user_budget`; cota: drop de `consume_daily_quota()`, `private.user_quota`, `private.quota_policy` | as funções antigas (`month_spend`, `consume_quota`) continuam lá |
| Backups lógicos | `private.backup_usage_daily_20261113` (2 linhas), `private.backup_usage_events_20261113` (44 linhas) | apagar depois de estabilizar |

## Concluído (entregue e verificado)
- Base do assistente: login, conversa com streaming e contingência de motor, voz do aparelho, memória com aprovação, Hoje, agenda, lembretes, tarefas, projetos, agentes simples, busca por significado, convites e admin, guia e home pública.
- Marco Zero, segurança:
  - PR #2: chat fail closed.
  - PR #3: cota diária atômica.
  - PR #6: orçamento mensal com reserva atômica e reconciliação.
  - Todos em produção, validados no uso real.
- PR #9: mensagens de erro em português por situação, telas de erro próprias (erro, erro geral, 404), voz mais estável, e teto e reservas do mês visíveis em Ajustes.
- PR #10: Design System v1 (tokens únicos), menu lateral no computador, layouts para tablet e computador, acessibilidade (atalho de teclado, alvos de toque) e home alinhada. [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md).
- PR #12, UX/UI v2:
  - arquitetura de seis módulos com status real (Pessoal, Financeiro, Agent Office, Agent Office Studio, 3D Studio, Plataforma);
  - menu lateral por módulos no computador; barra de baixo com o assistente no centro e folha de módulos no celular;
  - Assistente Universal por voz e texto em qualquer tela, com contrato de contexto validado no servidor;
  - temas claro e escuro;
  - painel Hoje, Conversa, Perfil e ajustes e home pública redesenhados;
  - avatar animado, marca e arquivos de `public/avatar` preservados.
- PR #14, Sprint UX/UI v2.1:
  - paleta azul-marinho e grafite, com contraste AA medido;
  - menu com grupos recolhíveis;
  - Hoje por horário;
  - Conversa compacta com voz mais segura (limite de 20 s, transcrição revisável);
  - assistente alargável e compatível com o teclado;
  - todas as telas restantes redesenhadas;
  - home com a visão completa;
  - arquitetura do Core Contextual documentada.
- PR #18, Qualidade e Segurança (15/11):
  - Playwright como dependência oficial (versão fixa);
  - testes de interface separados em público (no CI, sem segredos) e com login (falham se faltar credencial, nunca são pulados);
  - regressão completa aprovada;
  - auditoria de segurança somente leitura com matriz de riscos;
  - plano do Core Contextual MVP.
- PR #16, Sprint UX/UI v2.2:
  - navegação híbrida no celular (barra de baixo, tela Módulos, menu da conta com o Voltar do Android);
  - menu do computador por área e recolhível;
  - assistente em três estados com largura ajustável;
  - voz mais segura (envio automático desligado por padrão, interrupção sem reabrir o microfone);
  - pendências da v2.1 fechadas;
  - Metas & Conquistas e Casa Inteligente como planejados, com especificação;
  - planejamento de saúde;
  - protótipo do Lovable avaliado;
  - 16 testes de interface com Playwright.
- Modelo de trabalho Fast Track (PR #4) e documentação central (PRs #7 e #8).

## Em andamento
| Trabalho | Estágio | Onde |
|---|---|---|
| Documentação Marco Zero (contexto mestre, auditoria, governança) | Rascunho, não integrado. O `DESIGN_SYSTEM.md` dele foi substituído pelo da `main` | PR #1 |
| Especificação de Finanças pessoais | Pronta para revisão, não integrada | PR #5 |

## Pendente
- Logo novo (três movimentos): aguardando o arquivo. Hoje a marca é o texto GaDu.
- Validar a voz, o assistente com o teclado aberto e o Voltar do Android em aparelhos de verdade (iPhone e Android).
- Levar os testes de interface (`npm run test:e2e`) para o CI, com um usuário de teste dedicado (pede segredo no GitHub: aprovação).
- Ver Administração e as telas com dados reais (o usuário de teste não é admin e está vazio).
- Etapa 2 da cota (remover `consume_quota(integer)`) e apagar os backups lógicos: alto risco, pede aprovação.
- Decidir o destino do usuário de teste e da liberação do host do Supabase no ambiente "Gadu".
- Auditoria completa de RLS e isolamento; administração de créditos por pessoa.
- Monitoramento e alerta de erro; testes de ponta a ponta automatizados.
- Módulos planejados, sem código: Financeiro, 3D Studio, Agent Office (além dos agentes), Agent Office Studio.

## Problemas conhecidos e riscos
Matriz completa, com evidências: [docs/SECURITY_AUDIT_2026-11-15.md](docs/SECURITY_AUDIT_2026-11-15.md).
- **S-01 (P1, custo):** uma pessoa logada pode liquidar a própria reserva com custo 0 pela API do Supabase e escapar do teto mensal (a cota diária continua valendo). Correção de alto risco, aguarda aprovação.
- **S-02 a S-09 (P2):** custo de resposta interrompida; limite de tentativas de login e senhas vazadas; bloqueio que não para o agendador nem o acesso direto ao banco; sem hierarquia de admin; função antiga `consume_quota` (ainda usada como contingência no chat); preparação para organizações; backup não confirmado.
1. A função antiga `consume_quota` ainda pode ser chamada por usuários logados e o chat ainda a usa como contingência (sai na etapa 2, S-07).
2. App em `iad1` (EUA) e banco em `sa-east-1` (São Paulo): latência extra a cada consulta. Avaliar `gru1`.
3. A proteção contra senhas vazadas está desligada no Supabase Auth.
4. O backup automático do plano Supabase não foi confirmado no painel.
5. O cruzamento de dados entre módulos, organizações ou clientes não existe: o contexto do assistente é só um rótulo, e o escopo é sempre o da própria pessoa.
6. A estabilidade da voz foi testada com uma síntese de voz simulada; falta confirmar nos aparelhos.

## Próximas prioridades (em ordem)
1. **Correções de segurança com aprovação** (fase 0 do Core): S-01 e S-02 (custo), S-03 (senhas vazadas e limite de tentativas), etapa 2 da cota (S-07), confirmação de backups (S-09).
2. **Core Contextual MVP, fase 1** (escopo pessoal, sem banco novo): [docs/CORE_CONTEXTUAL_MVP.md](docs/CORE_CONTEXTUAL_MVP.md).
3. Testes com login no CI, conforme a proposta em [docs/TESTES_E2E.md](docs/TESTES_E2E.md) (precisa de segredo no GitHub: aprovação).
4. Validação em aparelhos: [docs/VALIDACAO_APARELHOS.md](docs/VALIDACAO_APARELHOS.md).
5. Modelo de organizações e testes de isolamento entre organizações (S-08), antes do Agent Office.
6. Financeiro: revisar o PR #5 e começar a base (alto risco: banco).
7. Agent Office; depois Agent Office Studio e 3D Studio.
8. Observabilidade e créditos por pessoa.

## Ponto de retomada (para qualquer agente)
1. Leia `CLAUDE.md`, este arquivo, [docs/FAST_TRACK.md](docs/FAST_TRACK.md) e [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md). O handoff técnico está em `docs/CLAUDE_HANDOFF_2026-11-12.md`.
2. Confira o estado real: `git log origin/main -5`, PRs abertos no GitHub, o último deploy de produção na Vercel e `list_migrations` no Supabase.
3. Classifique o que vai fazer: baixo risco (UI, docs) segue o processo simplificado; alto risco (banco, auth, custo, permissões) exige aprovação explícita do Eduardo a cada passo.
4. Antes de subir: `npm run typecheck && npm test && npm run build`, mais `npm run test:db` quando houver SQL. Testes de interface: `npm run test:e2e:public` (vai no CI) e `npm run test:e2e:auth` com o usuário de teste ([docs/TESTES_E2E.md](docs/TESTES_E2E.md)). Para mudança visual, siga o roteiro de verificação do Design System (360, 390, 412, 768, 1024, 1440 e 1920 px).
5. Ao terminar: atualize este arquivo, o [CHANGELOG.md](CHANGELOG.md), o [ROADMAP.md](ROADMAP.md) e a [matriz](docs/FEATURE_MATRIX.md), e gere o "GaDu — Resumo para ChatGPT".
