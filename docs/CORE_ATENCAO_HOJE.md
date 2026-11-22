# Core Contextual · primeira entrega proposta: "O que merece minha atenção hoje?"

Estado em 22/11/2026: **aprovada pelo Eduardo, desenvolvida, testada e publicada** (PR #24, merge `215edab`; evidências em "Publicação" ao fim). O texto abaixo é a proposta original; as decisões e o que mudou na implementação estão em "Decisões tomadas e estado". Faz parte da fase 1 de [CORE_CONTEXTUAL_MVP.md](CORE_CONTEXTUAL_MVP.md). O escopo é só pessoal: os dados da própria pessoa.

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

## Decisões tomadas e estado (22/11/2026)
Decisões do Eduardo: **aprovar a entrega** como proposta (só leitura, escopo pessoal, sem tabela nova); **mostrar "Fontes" já na primeira versão**; **S-01 corrigido antes** (PR #22, publicado).

### O que foi implementado
- `src/lib/core/`: `scopes.ts` (escopo sempre `pessoal(user_id da sessão)`; o `context` do cliente é ignorado), `plan.ts` (intenção por regra, sem IA), `sources/{tasks,reminders,agenda,email}.ts`, `collect.ts`, `format.ts`, `flag.ts`, `privacy.ts`, `google-adapter.ts`. Retorna `{ facts, unavailable, more }`.
- Etiquetas: `[T1]` tarefas, `[L1]` lembretes, `[A1]` agenda, `[E1]` e-mails, numeradas por prioridade.
- Limites: tarefas 15, lembretes 10, agenda 12, e-mails 5; no máximo 30 fatos e 6.000 caracteres no bloco. Corte por prioridade (atrasadas, de hoje, lembretes, próximos compromissos, prioridade alta sem prazo, e-mails importantes, resto) com "e mais N".
- Chat (`/api/chat`): com a intenção e a flag ligada, o bloco entra no contexto, com instrução de citar etiquetas e de dizer o que está indisponível. Nenhuma chamada de IA extra; reserva, cota e liquidação intactas. O servidor envia o evento `sources` e a interface mostra "Fontes" (detalhe recolhível, com link para Tarefas, Agenda ou Hoje, e Gmail em nova aba). As Fontes não são gravadas no histórico.
- Tela Hoje: cartão "Merece sua atenção" (`/api/attention`, zod, 401 sem sessão), sem IA, com estado vazio honesto, aviso do que está indisponível, "Conectar Google" e botão "Perguntar ao GaDu".
- Flag: `CORE_MVP=0` (também `false`, `off`) volta chat e Hoje ao comportamento anterior; **ligado por padrão**.

### Frases que ativam (regra, sem IA)
"O que merece minha atenção hoje", "como está meu dia", "o que está atrasado", "o que falta hoje", "o que é mais importante hoje", "priorizar meu dia" e variações com ou sem acento. Outras mensagens seguem o caminho de sempre.

### Diferenças em relação à proposta
- **E-mail entra** (a proposta dizia "só se a pergunta pedir"): decisão posterior do Eduardo, de forma enxuta: até 5 não lidos das últimas 48 h, importantes primeiro, só remetente e assunto (nunca o corpo nem o trecho), apenas se o escopo `gmail.readonly` já está concedido (lido de `google_connections.scopes`, sem pedir acesso novo). Sem escopo: "indisponível". Nenhuma escrita no Gmail.
- **Agenda e e-mail sem duplicar:** com o Core ativo na intenção, o chat não executa o caminho antigo do Google (que também lia agenda e e-mail); só se pedir a semana. Perde-se, nessa pergunta, o bloco "Insights de hoje" do caminho antigo (conflitos, janela livre). Se o Core falhar, o chat volta ao caminho antigo.
- **Lembretes:** só `pending`, até o fim do dia e de até 48 h atrás (lembrete muito antigo não é atenção de hoje).
- **Projetos:** entram só como o nome embutido nas tarefas (`projects(name)`), sem consulta própria.
- **Defesa em profundidade:** além da RLS, toda consulta filtra `user_id` da sessão.

### Por que ligado por padrão e como desligar
Não há acesso às variáveis da Vercel nesta etapa; um padrão desligado exigiria mudar a variável para a entrega funcionar. Por isso fica **ligado**, e o desligamento é o interruptor de emergência `CORE_MVP=0` (criar a variável na Vercel e reimplantar). Alternativa sem variável: reverter o deploy pela Vercel (rollback listado em PROJECT_STATUS.md).

### Testes (executados localmente em 22/11/2026)
- Unitários (`src/lib/core/*.test.ts`): intenção, escopo (nenhum `context` altera), limites, formato, privacidade, e-mail ausente e sem escopo, Google desconectado.
- Integração (`test/core-atencao.integration.test.ts`): chat com e sem flag; sessão de A só com fatos de A (e B só de B), com `context` e ids de outra pessoa no corpo; Google desconectado; sem chamada de IA extra; ordem limites → reserva → cota; sem chave secreta no Core; `/api/attention` (401, 400 por zod, `enabled:false`).
- Banco (`supabase/tests/50_core_atencao.test.sql`): as consultas do Core como B devolvem só itens de B, com e sem o filtro por `user_id`. A consulta é a tradução em SQL da consulta do PostgREST (não executa o PostgREST).
- e2e público: `/api/attention` responde 401 sem sessão.
- **Não executado:** interface com login em celular (390 px), Google e Gmail reais, produção.

### Critérios de aceite × estado
1. Dados sintéticos citados com etiqueta: coberto nos testes de integração.
2. Sem Google: diz explicitamente: coberto.
3. Termo bloqueado fora do bloco: coberto (bloco e Fontes).
4. Sem chamada de IA nova, bloco até 6.000 caracteres: coberto.
5. `context` não altera escopo: coberto.
6. `CORE_MVP=0` mantém o chat: coberto (integração).

### Pendências
Validar com pessoa logada em celular e medir o custo por mensagem; fase 2 (prioridade pela tela) e fase 3 (auditoria sem conteúdo, alto risco).

## Publicação (22/11/2026)
- PR #24 integrado em 22/11/2026 às 15:42 (Brasília), merge commit `215edab0d7d879e3483d0a6d77539609ce95f39c`. CI verde: `verify`, `e2e-public`, `database`.
- Deploy de produção da Vercel: `success`.
- Produção: home 200; `/api/attention` sem sessão 401 (rota nova no ar); `/api/health` ok.
- e2e público (7 testes) contra a produção: 7 passaram.
- Nenhuma migração.
- `CORE_MVP` não está definida na Vercel, então o recurso está ligado por padrão (`CORE_MVP=0` desliga).
- **Não verificado:** tela Hoje e Fontes com pessoa logada; Gmail e agenda reais; voz no aparelho; custo por mensagem medido.
