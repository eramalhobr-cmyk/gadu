# GaDu — auditoria aprofundada de segurança e rastreabilidade (parcial)
Data: 2026-11-12. Inspeção estática de migrações iniciais, acesso, proxy, chat, uso, busca e administração. Não houve testes, execução de SQL, acesso a segredos ou produção.

## Achados prioritários
### P1 — cota diária não limita a contagem no banco
Em `supabase/migrations/20261108000001_init.sql`, `consume_quota(p_limit)` incrementa `usage_daily.messages` via upsert e **depois** retorna `n <= p_limit`. Quando o limite é ultrapassado, a função retorna falso, mas a contagem continua crescendo. Além disso, `p_limit` é argumento de função exposta a usuários autenticados; a aplicação usa limite do servidor, mas chamadas diretas podem passar outros valores. Recomenda-se tornar o limite uma política controlada pelo servidor, garantir incremento condicional atômico, adicionar testes de concorrência e validar comportamento de erros de RPC. Não alterar migração já aplicada: criar migração nova após aprovação.

### P1 — custo mensal: verificação não é reserva atômica
`src/app/api/chat/route.ts` consulta `month_spend` antes de chamar o modelo. Pedidos simultâneos podem passar no teste antes de o custo das respostas ser persistido. O teto mensal não deve ser tratado como garantia rígida sem mecanismo de reserva/limite concorrente. Desenhar solução que suporte streaming, falhas e reconciliação de custos.

### P1 — erro de RPC precisa ser tratado explicitamente
A rota de chat verifica `okQuota === false`, mas não trata explicitamente `error` retornado pela RPC. Se a consulta falhar e `data` vier null, a execução pode prosseguir. O mesmo vale para a consulta de gasto mensal. Adotar comportamento fail-closed para verificações críticas, com erro amigável e observabilidade sem dados sensíveis.

### P2 — privacidade por regex é defesa parcial
`src/lib/privacy.ts` contém padrões para documentos, cartões, chaves e termos sensíveis. Isso não garante detecção de todos os dados pessoais, de saúde ou financeiros. Rever política de classificação, minimização, consentimento e testes com falsos positivos/negativos antes do GaDu Finance.

### P2 — visão administrativa de créditos é incompleta
`/api/usage` apresenta custos próprios e saldo agregado do AI Gateway; `/api/admin/people` apresenta membros e contagens, não o custo por pessoa. Especificar métricas de crédito concedido, consumido, saldo, custo real e cota, preservando isolamento de conteúdo.

### P2 — UX e Design System necessitam validação
`src/components/ui.tsx` apresenta componentes básicos; inventariar `globals.css`, navegação e páginas para determinar tokens, componentes duplicados, acessibilidade e experiência desktop.

## Controles observados
- `src/proxy.ts` aplica CSP, renova sessão e protege rotas selecionadas.
- `src/lib/access.ts` verifica acesso e papel administrativo.
- Migrações iniciais habilitam RLS e usam `auth.uid()` em políticas de tabelas de usuário.
- Convites armazenam hash de token; endpoints administrativos usam checagem de papel e validação Zod.
- `search_similar` utiliza invoker e filtro de usuário.
Esses controles são observados no código, **não** uma garantia de que as políticas foram implantadas corretamente.

## Próximas verificações
1. Inventariar todas as migrações, políticas, funções RPC e rotas com service role; construir testes multiusuário de isolamento.
2. Reproduzir em ambiente de testes os cenários de falha de RPC e requisições simultâneas, sem tocar produção.
3. Inspecionar persistência do custo após streaming, tratamento de erro e recuperação de cotas.
4. Matriz de rastreabilidade do roadmap por funcionalidade, arquivo e teste; não converter checklist histórico automaticamente em status verificado.
5. Testes de interface em 390, 768, 1024 e 1440px e inventário de componentes.
6. Propor PRs pequenos de correção com migrações novas, rollback e evidências, sujeitos à aprovação.

## Estado
**Auditoria parcial; nenhuma exploração confirmada; não foram feitas mudanças funcionais.** Prioridades P1 indicam risco de desenho e falhas potenciais identificadas estaticamente, a validar por testes.
