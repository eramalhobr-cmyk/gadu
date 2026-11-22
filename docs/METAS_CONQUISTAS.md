# Metas & Conquistas

Estado em 22/11/2026: **Beta, fase 1 **publicada** em 22/11/2026 às 18:33 (Brasília), PR #30, merge `901e27d`. CI verde (verify, e2e-public, database). Migração `metas_base` aplicada na produção antes do merge (só aditiva); conferido: `goals`, `goal_progress`, `goal_milestones` e `goal_tasks` com RLS, 4 políticas cada, `anon` sem SELECT. Deploy de produção da Vercel concluído; home 200, `/api/goals` sem sessão 401, `/api/health` ok; e2e público contra a produção 9/9. `GOALS_ENABLED` não definida na Vercel (ligado por padrão). **Não verificado:** tela Metas, resumo do Hoje e propostas no chat com pessoa logada e em aparelho.** O que existe está em "Fase 1: o que foi implementado" no fim deste documento. O resto é **[Proposta]**. Não há meta, conquista ou medalha de exemplo na interface.

## Objetivo
Um espaço para definir, organizar e acompanhar objetivos de vida.

**Diferencial:** o GaDu não é só uma lista de metas. Ele transforma a meta em plano executável (marcos, tarefas, compromissos), acompanha indicadores reais, percebe atrasos e propõe ajustes, sempre com a aprovação da pessoa.

## Categorias
| Categoria | Exemplos |
|---|---|
| Financeiras | Reserva de emergência, quitar dívida, juntar para viagem |
| Familiares | Jantar semanal em família, viagem com os filhos |
| Profissionais | Certificação, promoção, lançar o próprio negócio |
| Saúde e bem-estar | Caminhar 8 mil passos, dormir 7 h, chegar a um peso |
| Desenvolvimento pessoal | Ler 12 livros, meditar, aprender um hobby |
| Educação | Concluir curso, aprender idioma |
| Personalizadas | Criadas pela pessoa, com nome e cor próprios |

## Estrutura de uma meta
| Campo | Descrição |
|---|---|
| Nome e descrição | O que é e por que importa |
| Categoria | Uma das acima |
| Tipo de objetivo | Quantitativo (número e unidade) ou qualitativo (critério de conclusão) |
| Situação inicial | Valor ou estado de partida, com data |
| Resultado desejado | Valor ou estado final |
| Início e prazo | Datas |
| Marcos | Etapas com data e critério |
| Indicadores | O que medir, unidade, fonte (manual, módulo, conector) |
| Frequência de acompanhamento | Diária, semanal, mensal |
| Progresso real | Só a partir de registros com origem |
| Tarefas e projetos | Vínculos com o módulo Pessoal |
| Compromissos | Eventos de agenda ligados à meta |
| Recomendações do GaDu | Sugestões registradas, aceitas ou recusadas |

### Modelo de dados futuro (sem SQL, apenas proposta)
| Tabela | Campos principais |
|---|---|
| `goals` | id, user_id, nome, descricao, categoria, tipo (quantitativo/qualitativo), valor_inicial, valor_alvo, unidade, criterio_conclusao, inicio, prazo, frequencia, status (ativa, pausada, concluída, abandonada), criado_em |
| `goal_categories` | id, user_id, nome, cor (só personalizadas) |
| `goal_milestones` | id, goal_id, user_id, titulo, data_alvo, criterio, concluido_em |
| `goal_indicators` | id, goal_id, user_id, nome, unidade, fonte (manual, financeiro, agenda, tarefas, saude), agregacao (soma, média, último) |
| `goal_progress` | id, indicator_id, user_id, valor, medido_em, origem (tabela, id, conector), registrado_por (pessoa ou conector) |
| `goal_links` | id, goal_id, user_id, tipo (tarefa, projeto, evento), ref_id |
| `goal_recommendations` | id, goal_id, user_id, texto, motivo, status (proposta, aceita, recusada), criado_em |
| `goal_shares` | id, goal_id, owner_user_id, shared_with_user_id, permissao (ver, contribuir), aceito_em, revogado_em |

**RLS:**
- Toda tabela com `user_id`; política `(select auth.uid()) = user_id`.
- Leitura por terceiros só com linha ativa em `goal_shares` (aceita e não revogada).
- `goal_progress` vindo de conector é gravado pelo servidor, com `origem` obrigatória.

## Integração com outros módulos
Sempre pelo Core Contextual ([CORE_CONTEXTUAL.md](CORE_CONTEXTUAL.md)): escopo resolvido no servidor, fatos com origem, aprovação para agir.

| Módulo | Uso | Situação do módulo |
|---|---|---|
| Financeiro | Saldo da reserva, gasto por categoria como indicador | Planejado |
| Agenda | Reservar horários para a meta; checar conflitos | Leitura do Google já disponível |
| Tarefas e Projetos | Quebrar marcos em tarefas; progresso por tarefas concluídas | Disponível |
| Saúde | Passos, sono, peso, exercícios como indicadores | Só via conector autorizado; ver [INTEGRACOES_SAUDE.md](INTEGRACOES_SAUDE.md) |
| Memória | Lembrar a motivação da meta | Disponível (com aprovação) |

Regras:
- O GaDu lê os dados de outro módulo **só** se a pessoa ligou aquele indicador àquela fonte.
- Criar tarefa, evento ou ajuste de meta é ação: precisa de confirmação.

### Metas compartilhadas (família)
- Compartilhar é sempre explícito: a dona escolhe a meta, a pessoa e a permissão.
- Quem recebe precisa aceitar.
- Nada é exposto automaticamente: dados de saúde e finanças de uma pessoa nunca aparecem para outra só porque estão no mesmo grupo.
- Em meta conjunta, cada pessoa contribui com os próprios registros; o total mostra a soma, e o detalhe por pessoa só aparece se cada uma permitir.
- Revogar é imediato e apaga o acesso, não os dados da dona.

## Como o GaDu vai ajudar
**Criar meta a partir de conversa**
> Pessoa: quero juntar 10 mil até dezembro do ano que vem.
> GaDu: São cerca de 13 meses. Dá uns R$ 770 por mês. Quer que eu crie a meta com marcos trimestrais e um lembrete mensal?

**Acompanhar**
> Pessoa: como estão minhas metas?
> GaDu: "Ler 12 livros": 7 de 12, no ritmo. "Caminhar 8 mil passos": você registrou só 3 dias nesta semana. Quer ajustar a meta ou marcar caminhadas na agenda?

**Detectar atraso e propor ajuste**
> GaDu: A meta "Certificação" tem prova em 6 semanas e 2 de 5 módulos feitos. Sugiro 3 blocos de estudo de 1 h por semana. Posso reservar na agenda?

**Sem dados**
> GaDu: Não tenho registros de sono desde o dia 3. Quer anotar agora ou conectar uma fonte?

## Regras para não inventar progresso
1. Progresso só vem de registro com origem (manual, módulo ou conector). Sem registro, o GaDu diz "sem dados".
2. Nada de estimativa apresentada como medição. Projeções aparecem marcadas como projeção.
3. Cada número citado na conversa leva a fonte e a data da medição.
4. Conector com falha ou revogado: o indicador fica "sem atualização desde X", nunca "zerado" nem "mantido".
5. Recomendações ficam registradas; a meta só muda se a pessoa aceitar.
6. Nada de metas, conquistas ou medalhas de exemplo na interface.
7. Tom de apoio, sem culpa. Metas de saúde não viram conselho médico.

## Conquistas
- Marco concluído, meta concluída, sequência de acompanhamento (ex.: 4 semanas seguidas).
- Só a partir de dados reais. Sem pontos ou ranking entre pessoas.

## Fases e dependências
| Fase | Entrega | Depende de |
|---|---|---|
| 0 | Este documento; módulo "Planejado" | — |
| 1 | Metas pessoais com marcos e progresso manual | Tabelas com RLS e testes de isolamento (alto risco) |
| 2 | Vínculo com tarefas, projetos e agenda | Fase 1; ações com confirmação |
| 3 | Recomendações e detecção de atraso | Core Contextual (escopo e origem); teto de custo |
| 4 | Indicadores do Financeiro | Módulo Financeiro |
| 5 | Indicadores de saúde por conector | [INTEGRACOES_SAUDE.md](INTEGRACOES_SAUDE.md); consentimento específico |
| 6 | Metas compartilhadas na família | Modelo de grupos e membros com RLS |

## Fase 1: o que foi implementado (22/11/2026)
Aprovada pelo Eduardo (inclusive banco). Nomes de tabela seguem a proposta em inglês (`goals`, `goal_*`), coerentes com o modelo acima.

**Banco** (`supabase/migrations/20261122210001_metas_base.sql`, só aditiva, rollback no topo):
| Tabela | Conteúdo |
|---|---|
| `goals` | título, descrição (o porquê), categoria (as 6 da especificação + personalizada com nome), medição (`numerica`, `percentual`, `marcos`, `tarefas`), unidade, agregação (`soma` ou `ultimo`), valor inicial e alvo, início, prazo, situação (`ativa`, `pausada`, `concluida`, `arquivada`) |
| `goal_progress` | um registro por linha: valor, data e **origem** (`manual`, `conversa`, `tarefa`), nota |
| `goal_milestones` | marcos (checklist) com data de conclusão |
| `goal_tasks` | vínculo meta ↔ tarefa; chave composta `(id, user_id)` nos dois lados (e `unique (id, user_id)` em `tasks`) |
- RLS `(select auth.uid()) = user_id` em 4 políticas por tabela, só `authenticated`, nada para `anon`; sem função nem trigger.
- Meta de uma pessoa não referencia tarefa, marco ou registro de outra, nem pelo banco.
- Sem tabelas de conquistas, recomendações, categorias ou compartilhamento (fases futuras).

**Decisões:**
- **O valor atual não é coluna.** É calculado dos registros (`soma`: início + registros; `ultimo`: medida mais recente). Sem registro, a interface diz "Sem registros", nunca "0%" como medição (regra 1 e 2).
- Meta que diminui (82 kg para 75 kg) é aceita; percentual é sempre 0 a 100 com `ultimo`.
- Metas por marcos e por tarefas não recebem valor: o progresso vem dos marcos concluídos ou das tarefas concluídas (canceladas não contam).
- **Ritmo:** compara a fração feita com a fração do tempo passado entre início e prazo, com tolerância de 5 pontos: "no ritmo" ou "atrasada"; prazo passado é "prazo vencido"; meta atingida pede conclusão manual. O que precisa por dia e por semana é **projeção** e aparece como tal.
- Origem `tarefa` existe no banco, mas nenhum código a grava ainda; o cliente só envia `manual` ou `conversa`.
- Hábito simples não entrou nesta fatia.
- Arquivar não apaga; apagar só registros (para corrigir engano) e marcos.

**Código:** `src/lib/goals/` (cálculo, números pt-BR, zod, leitura, interruptor), `src/app/api/goals/*`, tela `MetasPage.tsx`, resumo no Hoje `MetasHoje.tsx` (1 a 3 metas atrasadas, vencidas ou com prazo em até 7 dias; sem IA), cartão `MetaCard.tsx`.

**Assistente:** fonte `goals` do Core (`src/lib/core/goals.ts`) por intenção simples, sem IA extra: "como estão minhas metas", "minha meta de leitura" (fatos [M1]…, data do último registro, Fontes com link para Metas). Atualizações ("corri 5 km hoje", "registra 2 livros na meta de leitura", "conclui a meta X") são **propostas**: o modelo escolhe a meta pela etiqueta, o servidor resolve o id real, e só grava quando a pessoa toca em Confirmar (rota com a sessão). Meta com termo bloqueado ou dado sensível aparece omitida e não pode ser atualizada pela conversa. Tudo continua sob limites, reserva, cota e liquidação (fail closed).

**Interruptores (servidor, ligados por padrão):** `GOALS_ENABLED=0` esconde a tela e o resumo do Hoje e desliga rotas, fonte do Core e propostas; `CORE_MVP=0` desliga a fonte do Core e, por depender dela, as propostas de atualização.

**Testes:** `supabase/tests/70_metas.test.sql` e o isolamento (30) nas 4 tabelas; unitários em `src/lib/goals` e `src/lib/core/goals.test.ts`; integração `test/goals.integration.test.ts` e `test/goals-chat.integration.test.ts`; e2e público (13 rotas 401).

**Limitações:** nada publicado nem validado com pessoa logada ou em aparelho; Android Voltar não trata o detalhe da meta como camada própria (há botão Voltar na página); sem conquistas, recomendações, hábito, projetos e agenda, indicadores de outros módulos nem metas compartilhadas.

## Fora desta fatia
Fases 2 a 6 da tabela acima.
