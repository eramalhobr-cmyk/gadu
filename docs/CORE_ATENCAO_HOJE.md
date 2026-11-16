# Core Contextual · primeira entrega proposta: "O que merece minha atenção hoje?"

Estado em 16/11/2026: **proposta técnica para decisão. Nada implementado.** Faz parte da fase 1 de [CORE_CONTEXTUAL_MVP.md](CORE_CONTEXTUAL_MVP.md). O escopo é só pessoal: os dados da própria pessoa.

## O fluxo
Pergunta típica, por voz ou texto, em qualquer tela: "O que merece minha atenção hoje?", "Como está meu dia?", "O que está atrasado?".

```
Assistente (qualquer estado) → POST /api/chat { message, context: { module, view } }
  → servidor: sessão → user_id → acesso (accessOf)          [já existe]
  → limites: privacidade → teto por motor → reserva → cota  [já existe, fail closed]
  → Core.intent(message) = "atencao_hoje"?                  [novo, regra simples, sem IA]
      sim → Core.collect(scopes = [pessoal(user_id)], plan = atencao_hoje)
            → fatos com origem + lista de fontes indisponíveis
            → bloco de contexto estruturado para o modelo
  → modelo responde citando as origens; ações continuam propostas  [já existe]
```

## Dados consultados (todos já existem; nenhuma tabela nova)
| Fonte | Consulta | Onde o acesso é autorizado | Limite |
|---|---|---|---|
| Tarefas | `tasks` abertas: atrasadas (`due_date < hoje`), de hoje e de prioridade alta sem prazo | cliente com a **sessão da pessoa** → RLS `tasks_all` (`user_id = auth.uid()`) | 15 itens |
| Projetos | nome dos projetos ligados a essas tarefas (`projects(name)`) | mesma sessão → RLS `projects_all` | só os referidos |
| Lembretes | `reminders` pendentes até o fim do dia (Brasília) | mesma sessão → RLS `reminders_select` | 10 itens |
| Agenda | Google Calendar de hoje (`events(token, início do dia, fim do dia)`), sem os recusados | token cifrado em `google_connections` (RLS por pessoa), aberto só no servidor (`accessToken`), escopo `calendar.readonly` | 12 eventos |
| Privacidade | termos bloqueados de `profiles.settings` e `isSensitive` | mesma sessão → RLS `profiles_select` | — |

**Não entram:** e-mails (só se a pergunta pedir), memórias, módulos planejados (Metas, Financeiro, Casa), dados de outras pessoas. **Proibido:** chave secreta do Supabase no Core; qualquer escopo derivado do `context` enviado pelo cliente.

## Como a resposta indica a origem
- Cada fato vira um `CoreFact` com `{ module, source: { table, id }, text }` (tipos em `src/lib/core-context.ts`).
- O bloco enviado ao modelo numera os fatos: `[T1] Tarefa atrasada desde 12/11: …`, `[A1] Agenda 14:00–15:00: …`, `[L1] Lembrete 18:00: …`.
- O modelo é instruído a citar as etiquetas. O app mostra "Fontes: 2 tarefas, 1 compromisso" sob a resposta, e cada item abre a tela de origem (Tarefas, Agenda).
- Fatos com termo bloqueado ou sensível entram como "(omitido pela regra de privacidade)", sem conteúdo.

## Dados ausentes ou indisponíveis
| Situação | Comportamento |
|---|---|
| Google não conectado | a agenda fica fora; a resposta diz "Sua agenda não está conectada" e oferece Conectar. Nada é inventado |
| Google com erro ou acesso revogado | "Não consegui ler a agenda agora"; segue com tarefas e lembretes |
| Sem tarefas nem lembretes | "Nada pendente para hoje" e uma sugestão real (planejar a semana), sem fatos fictícios |
| Banco indisponível | o chat já falha fechado antes (limites ilegíveis); o Core não é chamado |
| Muitos itens | corta pela prioridade (atrasadas, hoje, alta prioridade, eventos próximos) e informa "e mais N" |

O Core devolve sempre `{ facts, unavailable: ["agenda"] }`. O texto da resposta reflete o que faltou.

## Critérios de aceite
1. Com dados sintéticos (2 tarefas atrasadas, 1 de hoje, 1 lembrete, 2 eventos), a resposta menciona cada um com etiqueta de origem e não menciona nada além disso.
2. Sem Google conectado, a resposta diz isso explicitamente e não cita agenda.
3. Termo bloqueado em uma tarefa não aparece no contexto enviado ao modelo (teste no bloco gerado).
4. O custo por mensagem não aumenta além do texto extra do contexto (no máximo cerca de 6.000 caracteres); nenhuma chamada de IA nova.
5. `context` enviado pelo cliente com qualquer valor não altera os escopos (teste unitário).
6. A flag de servidor `CORE_MVP` desligada mantém o chat exatamente como hoje (teste de integração).

## Testes de isolamento
- **Banco (`npm run test:db`):** a suíte `30_isolamento.test.sql` já prova, em todas as 18 tabelas, que B não lê, altera, apaga nem insere em nome de A. Acrescentar a consulta exata do Core (`tasks` + `projects(name)` + `reminders`) executada como B, que deve devolver só os itens de B.
- **Unitários:** `resolveScopes` devolve só `pessoal(user_id da sessão)`; `plan` não aceita escopo vindo do cliente; o formatador omite termos bloqueados.
- **Integração (`test/chat-route.integration.test.ts`, com mocks):** com a sessão de A, o contexto montado contém só fatos de A; ids de outra pessoa enviados no corpo continuam virando `null`.
- **Interface (`e2e/auth.e2e.cjs`, com `/api/chat` simulado):** a resposta mostra "Fontes" e os links levam às telas certas.

## Sequência curta de implementação (depois da decisão)
1. **Pré-requisito de segurança aprovado:** S-01 (custo) corrigido. Ele não bloqueia a leitura, mas a entrega não deve aumentar o uso enquanto o teto pode ser contornado.
2. `src/lib/core/` com `scopes.ts`, `plan.ts` (intenção "atenção hoje" por regra), `sources/tasks.ts`, `sources/reminders.ts`, `sources/agenda.ts` e `format.ts`, mais os testes unitários.
3. Ligar no `/api/chat` atrás de `CORE_MVP=1`, com o teste de integração e o teste de banco da consulta.
4. "Fontes" na interface, com o teste de interface.
5. Publicar com a flag desligada; ligar para o usuário de teste; validar; ligar para todos.

## Decisão pedida
- Aprovar esta primeira entrega (só leitura, escopo pessoal, sem tabela nova, atrás de flag)?
- Mostrar "Fontes" já na primeira versão ou só a citação no texto?
- Exigir a correção do S-01 antes, como proposto?
