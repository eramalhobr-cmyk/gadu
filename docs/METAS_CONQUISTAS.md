# Metas & Conquistas

Estado em 14/11/2026: **Planejado**. Nada deste documento existe no app. Não há tabela, tela funcional nem meta de exemplo. Tudo aqui é **[Proposta]**, salvo quando indicado.

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

## Fora desta sprint
Banco, migrações, rotas e metas simuladas. Só documentação.
