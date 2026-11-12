# GaDu — plano de correção e testes automatizados
Data: 2026-11-12. **Proposta para aprovação; nenhuma correção funcional aplicada.**

## Ordem de execução

### PR 1 — P1: falhas de RPC devem bloquear consumo
**Escopo:** `src/app/api/chat/route.ts` e testes de rota/serviço.
- Verificar `error` e dados inválidos de `consume_quota`, `month_spend` e outras verificações obrigatórias.
- Falha de consulta deve retornar aviso claro e impedir chamada ao provedor (fail closed), com log sanitizado.
- Testes: quota=false, quota=null, quota RPC error, month_spend error/null/NaN, orçamento esgotado, orçamento disponível. Assert: nenhum provedor chamado em falhas.
- Critério de aceite: não é possível contornar verificações obrigatórias por indisponibilidade do banco; erros observáveis sem conteúdo sensível.

### PR 2 — P1: cota diária atômica e política confiável
**Escopo:** nova migração SQL, API e testes concorrentes; não editar migração já aplicada.
- Corrigir `consume_quota` para não incrementar acima do teto; o limite precisa ser controlado pelo servidor/política confiável, não por argumento arbitrário enviado diretamente pelo cliente.
- Rever semântica de consumo: quando reservar, quando contabilizar falhas e como tratar retries/idempotência.
- Testes SQL: primeiro uso, último uso permitido, tentativa excedente, limite zero, usuários distintos, 20 requisições simultâneas, chamadas RPC diretas com parâmetros manipulados e fuso do dia.
- Critério: nenhuma chamada excedente é autorizada; contagem e acesso permanecem consistentes.

### PR 3 — P1: orçamento mensal e concorrência
**Escopo:** desenho de reserva de orçamento/limite, novas funções ou tabelas, integração com streaming e reconciliação.
- Definir teto por usuário e teto global, reservas estimadas antes da chamada e liquidação pelo custo real depois, incluindo timeout/falha/cancelamento.
- Estimar tokens máximos e preço por modelo; estabelecer margem de segurança; registrar custo final e liberar reserva residual.
- Testes: 20 chamadas concorrentes, modelos com custos diferentes, stream interrompido, falha de provedor, retries, queda após reserva e reconciliação periódica.
- Critério: sem overspend não autorizado dentro da política definida; rastreabilidade e recuperação de reservas órfãs. Observar que custo externo pode ser apurado posteriormente, exigindo margem de segurança.

### PR 4 — P2: administração e privacidade
- Modelo de créditos concedidos, consumidos e saldo; custo real por usuário/provedor/modelo; limites e alertas.
- RLS: administrador enxerga apenas metadados de consumo autorizados; usuário só os próprios; sem acesso automático a conteúdo de conversas ou finanças.
- Testes de isolamento entre usuários, autorização de administrador e acesso negado.

### PR 5 — P2: Design System e UX
- Inventário de telas/tokens e componentes; revisão de jornadas.
- Testes em 390, 768, 1024 e 1440px; teclado, contraste, estados vazios, carregamento, erros, sem overflow horizontal; desktop usa área útil.
- Migrar componentes gradualmente sem reescrever telas em massa.

## Gate de cada PR
1. Diagnóstico reproduzido em ambiente isolado.
2. Mudança mínima, migration reversível quando possível, plano de rollback.
3. Testes unitários, integração e concorrência aplicáveis, typecheck e build.
4. Revisão de segurança, atualização de docs e handoff.
5. Aprovação explícita antes de merge, alteração remota ou deploy.

## Pendências para implementar
- Confirmar ambiente de teste e mecanismo de execução de testes SQL com Supabase local/isolado.
- Conferir funções RPC e migrações mais recentes para evitar regressões.
- Definir política de cobrança de mensagens falhadas e orçamento global vs individual.
- Priorizar PR 1 por ser a correção mais isolada, depois PR 2 e PR 3.

**Estado:** somente documentação, sem testes executados ou alterações de produção.
