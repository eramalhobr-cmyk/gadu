# ADR 0002 — Orçamento mensal de IA com reserva e reconciliação

- **Data:** 2026-11-13
- **Status:** proposta (PR em rascunho)
- **Relacionado:** achado P1 "custo mensal: verificação não é reserva atômica" (`docs/SECURITY_AUDIT_2026-11-12.md`); ADR 0001.

## Contexto
O chat lia `month_spend` antes de chamar a IA. Pedidos simultâneos passavam todos na leitura antes de o custo ser gravado e podiam estourar o teto. Além disso, modelos sem preço cadastrado eram contabilizados como US$ 0, e importação e resumo gravavam consumo sem verificar o teto.

## Decisão
- **Reserva antes, liquidação depois**: `reserve_ai_budget(kind, estimativa)` trava por pessoa (`pg_advisory_xact_lock`) e só reserva se gasto do mês + reservas abertas + estimativa ≤ teto. `settle_ai_budget` grava o consumo em `usage_events` e fecha a reserva **na mesma transação**; `release_ai_budget` libera quando a IA falha.
- **Estimativa limitada pela política** (`min_reserve_usd`/`max_reserve_usd`): quem chama não consegue reservar zero nem inflar sem limite.
- **Reservas vencem** (`reservation_ttl_seconds`, 10 min): reserva vencida já não conta; o agendador marca como expirada (`expire_ai_reservations`, só service role).
- **Teto global opcional** da conta (`global_monthly_limit_usd`), com trava global adquirida antes da trava da pessoa (ordem fixa, sem deadlock).
- **Política no banco** (`private.budget_policy`, semeada com US$ 20 = `MONTHLY_BUDGET_USD`) e teto individual (`private.user_budget`), fora da API.
- **Modelo desconhecido** passa a custar o preço mais caro da tabela (nunca zero).
- **Chat, resumo e importação** passam a reservar e liquidar. A ordem do chat é: limites por provedor (leitura) → reserva → cota diária (liberando a reserva se a cota negar) → IA → liquidação.
- **Transição**: sem a migração aplicada (`PGRST202`/`42883`), o app volta à verificação de leitura de hoje.

## Alternativas
1. `SELECT … FOR UPDATE` numa linha de saldo por pessoa: equivalente, mas exige linha pré-criada e saldo derivado mantido em sincronia.
2. Limite só no app (memória/Redis): não protege entre instâncias nem contra chamadas diretas.
3. Cobrar depois e aceitar estouro: contraria o teto como garantia.

## Consequências
- Um pedido grande pode ser negado mesmo com algum saldo, porque reserva o custo máximo estimado. A sobra é devolvida na liquidação.
- O custo real pode passar do reservado (sinal `over`), limitado pela margem entre a estimativa e o teto máximo por pedido.
- Stream cancelado antes de o provedor informar o uso: a reserva é liberada e o custo daquela resposta pode não ser registrado (lacuna já existente, agora documentada).
- Reconciliação com a fatura real dos provedores (Anthropic/Gateway) não está automatizada.
- `MONTHLY_BUDGET_USD` (env) fica só como transição; a fonte passa a ser `private.budget_policy`.
