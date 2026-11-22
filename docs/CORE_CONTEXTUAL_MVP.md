# Core Contextual MVP · plano de implementação (escopo pessoal)

Estado em 22/11/2026: **fase 1 parcial desenvolvida e testada localmente, não publicada** (branch `feat/core-atencao-hoje`): só a intenção "O que merece minha atenção hoje?" (ver [CORE_ATENCAO_HOJE.md](CORE_ATENCAO_HOJE.md)). O restante do plano continua planejado. Arquitetura geral em [CORE_CONTEXTUAL.md](CORE_CONTEXTUAL.md). Este plano só cobre o **escopo pessoal autorizado**: os dados da própria pessoa, já protegidos por RLS. Organizações e clientes ficam para depois da auditoria e do modelo de organizações (S-08 em [SECURITY_AUDIT_2026-11-15.md](SECURITY_AUDIT_2026-11-15.md)).

## Ponto de partida (o que já existe no código)
O `/api/chat` já monta um contexto pessoal, de forma espalhada (`src/app/api/chat/route.ts:160-212`):
- memórias aprovadas;
- histórico recente e conversas relacionadas;
- tarefas abertas e projetos ativos;
- busca por significado;
- agenda e e-mails do Google, quando o pedido pede;
- a linha de contexto da tela.

Falta:
- uma camada única e testável;
- a origem de cada fato;
- limite de volume;
- priorização pela tela;
- citação na resposta;
- registro de auditoria.

## Objetivo do MVP
Responder perguntas que cruzam módulos pessoais ("o que tenho de projeto X esta semana, entre tarefas e agenda?") com fatos que trazem origem, sem ampliar acesso e sem custo novo descontrolado.

## Regras que não mudam
1. A identidade vem da sessão (`auth.getUser()`); o escopo é resolvido **no servidor** e no MVP é sempre `[{ kind: "pessoal", userId }]`.
2. O contexto da tela (`{ module, view }`) **só prioriza** fontes; nunca autoriza nem amplia. Um teste garante que nenhum valor de `context` muda o escopo.
3. Todas as leituras usam o cliente com a sessão da pessoa (RLS ativo). **Proibido** usar a chave secreta no Core.
4. O Core lê e relaciona; **ações continuam propostas** que pedem aprovação (como hoje com eventos e memórias).
5. Os módulos planejados (Metas, Financeiro, Casa) não são fontes até existirem de verdade.

## Fases
| Fase | Entrega | Risco | Aprovação |
|---|---|---|---|
| 0 | **Pré-requisitos de segurança:** S-01 e S-02 (custo), S-03 (senhas vazadas), etapa 2 da cota (S-07). Testes de isolamento entre pessoas no `test:db` para todas as tabelas que viram fonte | Alto (banco, custo, auth) | sim, a cada passo |
| 1 | **(parcial, 22/11: atenção hoje feita; `memories`, `conversations` e a troca das consultas soltas do chat continuam planejadas)** **Camada `src/lib/core/`** só com código e sem banco novo: `resolveScopes(session)`, `plan(hint, message)`, `collect(scopes, plan)` com fontes `tasks`, `projects`, `reminders`, `memories`, `agenda` (Google) e `conversations`; cada fato vira `CoreFact` com `source: { table, id }` (tipos já em `src/lib/core-context.ts`). Limite de fatos e de caracteres por pedido. O `/api/chat` passa a usar o Core no lugar das consultas soltas, **sem mudar o resultado** (teste de equivalência) | Baixo a médio (só leitura, sob RLS) | Fast Track com testes completos, porque toca o chat |
| 2 | **Priorização pela tela e citação:** a tela aberta pesa na ordem das fontes; a resposta pode citar "(tarefa: …)"; a interface mostra "Fontes" num detalhe recolhível da mensagem | Baixo | Fast Track |
| 3 | **Auditoria sem conteúdo:** tabela `core_audit(user_id, at, scopes, sources[], actions[])`, com RLS de leitura da própria pessoa e retenção de 90 dias | Alto (tabela nova) | sim |
| 4 | **Novas fontes pessoais** quando os módulos existirem (Metas, Financeiro), cada uma com teste de isolamento | Alto (banco) | sim |
| 5 | **Organizações:** só depois de S-08 (modelo de organizações, políticas por vínculo, testes entre organizações) | Alto | sim |

## Fase 1 em detalhe (primeira entrega proposta)
- **Arquivos:**
  - `src/lib/core/scopes.ts`;
  - `src/lib/core/plan.ts`;
  - `src/lib/core/sources/*.ts`, uma por módulo;
  - `src/lib/core/collect.ts`;
  - `src/lib/core/format.ts`.
- **Orçamento de contexto:** no máximo N fatos (ex.: 40) e M caracteres (ex.: 6.000) por pedido. O excesso é cortado pela prioridade. Nenhuma chamada de IA nova; a busca por significado continua como hoje.
- **Testes:**
  - unitários: escopo sempre pessoal; `context` nunca altera o escopo; limites de volume; formato com origem;
  - integração com mocks: o chat continua montando o mesmo contexto de antes;
  - `test:db`: duas pessoas, cada uma só vê os próprios fatos em todas as fontes.
- **Aceite:**
  - CI verde;
  - nenhuma mudança de custo por mensagem (medida com `usage_events` do usuário de teste);
  - respostas iguais ou melhores em 10 perguntas de referência registradas, sem dados pessoais.
- **Rollback:** a troca é atrás de uma flag de servidor. **Decisão de 22/11:** `CORE_MVP` é ligado por padrão e `CORE_MVP=0` desliga (não há acesso às variáveis da Vercel agora, então o padrão desligado não seria viável); com `0`, o chat e a tela Hoje voltam ao comportamento anterior (teste de integração). A entrega de "atenção hoje" **não** substituiu as consultas soltas do chat: soma-se a elas só quando a intenção bate.

## Fora do MVP
Dados de outras pessoas, organizações ou clientes; contexto do cliente como autorização; ações automáticas sem aprovação; fontes de módulos planejados; integrações novas (Casa, saúde).
