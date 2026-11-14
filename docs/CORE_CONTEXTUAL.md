# Core Contextual do GaDu: arquitetura futura

Estado em 14/11/2026: **planejado**. Hoje existe só o contrato de contexto do Assistente Universal (`src/lib/assistant-context.ts`). Os tipos da etapa futura ficam em `src/lib/core-context.ts`, sem uso em produção. Nada aqui amplia o acesso atual.

## Objetivo
Permitir que o GaDu relacione informações entre módulos (tarefas, agenda, memória, projetos, financeiro, agentes, Studio, 3D Studio) para responder melhor. Exemplo: "tenho dinheiro para a viagem do projeto X na semana que vem?". O acesso deve continuar sempre limitado ao que a pessoa pode ver.

## O que já existe (implementado)
- O app envia `{ module, view }` em cada mensagem do assistente.
- O servidor valida (zod): a tela precisa pertencer ao módulo; campos extras são recusados com 400, antes de qualquer custo.
- O rótulo vira uma linha de contexto para o modelo. É uma **pista**, não um limite: a pessoa pode falar de qualquer assunto em qualquer tela.
- Os dados continuam vindo só das tabelas da própria pessoa (RLS por `user_id`). `scopesFor()` devolve sempre `["pessoal"]`.

## Princípios da etapa futura
1. **Identidade vem do servidor**: `user_id` sai da sessão (Supabase Auth), nunca do cliente.
2. **Contexto do cliente é só pista**: módulo, tela e item aberto ajudam a priorizar, mas nunca autorizam nada.
3. **Escopo explícito**: cada pedido ao Core resolve, no servidor, a lista de escopos permitidos (pessoal, organização X, cliente Y) a partir de vínculos gravados no banco, com RLS.
4. **Isolamento rigoroso**: dados de uma organização ou cliente nunca entram no contexto de outra. Cruzar organizações é proibido por padrão.
5. **Origem rastreável**: cada fato levado ao modelo carrega a fonte (tabela, id, módulo), para a resposta citar de onde veio.
6. **Aprovação para agir**: ler e relacionar é automático dentro do escopo; agir (criar, enviar, pagar, publicar) exige confirmação da pessoa e, em organizações, das pessoas com o papel exigido.
7. **Auditoria**: registrar quem pediu, quais escopos e fontes foram usados e quais ações foram aprovadas. Nunca registrar o conteúdo sensível em si.

## Fluxo previsto
```
Pedido (texto/voz + pista de tela)
  → servidor: sessão → user_id
  → resolver escopos (membros, organizações, clientes, papéis)  [RLS]
  → planejar fontes por módulo (só as dos escopos)
  → buscar fatos com origem (limite de volume e de custo)
  → montar o contexto (fatos + origem + pista de tela)
  → modelo responde e propõe ações
  → ações passam por aprovação → executam → auditoria
```

## Dependências antes de implementar
- Auditoria completa de RLS e isolamento (prioridade 1 do próximo ciclo).
- Modelo de dados de organizações, clientes, membros e papéis (Agent Office).
- Tabela de auditoria com retenção definida.
- Teto de custo por pedido do Core (orçamento com reserva já existe).
- Testes de isolamento entre pessoas, organizações e clientes no `test:db`.

## Fora de escopo até lá
Cruzar dados entre empresas ou clientes; usar contexto vindo do cliente como autorização; simular integrações que não existem.
