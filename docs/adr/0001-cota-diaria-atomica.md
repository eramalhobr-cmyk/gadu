# ADR 0001 — Cota diária atômica com limite controlado pelo servidor

- **Data:** 2026-11-13
- **Status:** proposta (PR em rascunho, aguardando aprovação)
- **Relacionado:** achado P1 "cota diária não limita a contagem no banco" em `docs/SECURITY_AUDIT_2026-11-12.md` (PR #1); PR #2 (fail-closed do chat).

## Contexto
`consume_quota(p_limit)` (migração inicial) incrementava `usage_daily.messages` e só depois comparava com o limite. A contagem crescia além do teto, o limite vinha como argumento de uma função que qualquer usuário autenticado pode chamar, e o dia era o `current_date` do servidor (UTC), virando às 21h de Brasília. Teste local de concorrência: 40 chamadas simultâneas com limite 10 deixam a contagem em 40.

## Alternativas consideradas
1. **Corrigir só o SQL mantendo `p_limit`:** simples, mas mantém o limite sob controle de quem chama.
2. **Limite em variável de ambiente, conferido só no app:** não protege contra chamadas diretas à API do Supabase e não permite limite por pessoa.
3. **Política no banco (escolhida):** limite global em `private.quota_policy` e exceção por pessoa em `private.user_quota`, ambos fora da API pública; função sem argumentos que incrementa de forma condicional e atômica.

## Decisão
- Nova função `public.consume_daily_quota()` (security definer, `search_path=''`), sem argumentos, retorna `{"allowed","used","limit"}`.
- Incremento atômico com `INSERT … ON CONFLICT DO UPDATE … WHERE messages < limit`: a linha é travada e o `WHERE` é reavaliado na versão mais recente, então requisições simultâneas não passam do limite.
- Dia calculado em `America/Sao_Paulo`.
- Sem política configurada ou limite ≤ 0: nega (fail closed), sem gravar.
- No app, a cota é a **última** verificação antes de gravar: teto mensal e limites por provedor (só leitura) vêm antes, para uma mensagem bloqueada não gastar cota.
- Implantação em duas etapas: a função antiga continua até o app novo estar em produção; uma migração futura revoga e remove `consume_quota(integer)`.

## Consequências
- `DAILY_MESSAGE_LIMIT` (env) deixa de ser usado pelo chat. O limite passa a ser alterado em `private.quota_policy` (SQL, com aprovação) e, no futuro, pela administração de créditos.
- Abre caminho para cotas individuais (`private.user_quota`) sem mudar código.
- Ordem de implantação recomendada: aplicar a migração antes do deploy do app. Proteção de transição: se o app subir antes, a rota detecta "função não existe" (`PGRST202`/`42883`) e usa a função antiga com o limite do servidor, como hoje; qualquer outro erro continua bloqueando. O código de transição sai na etapa 2.
- Mensagens cujo provedor falhar depois de passar na cota continuam contando (definir política de devolução no PR de orçamento).
