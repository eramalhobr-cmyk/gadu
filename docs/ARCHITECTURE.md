# Arquitetura

Atualizado em 13/11/2026. Estado real da `main` (`c6bbb30`). O que ainda está em PR aparece marcado.

```
Celular / computador (PWA instalável, offline com rascunho)
  │  HTTPS
  ▼
Vercel · projeto gadu-agent · região iad1 · funções sem estado (Next.js 16, App Router)
  ├─ src/proxy.ts ......... sessão, CSP com nonce, bloqueio de rotas
  ├─ /  ................... home pública;  /app ... app (Hoje, Conversa, Projetos, Agentes, Perfil)
  ├─ /api/chat ............ privacidade → limites (fail closed) → cota → contexto → roteador → streaming → grava
  ├─ /api/cron/tick ....... Vercel Cron a cada minuto: lembretes, briefing, revisão da noite, indexação
  ├─ /api/google/* ........ OAuth com PKCE, só leitura (agenda e Gmail); /api/calendar cria eventos com confirmação
  ├─ /api/search .......... busca por significado (pgvector)
  ├─ /api/admin, /api/invite  convites e admin (sem acesso a conteúdo)
  └─ /api/health .......... saúde
  │
  ├──► Supabase · sa-east-1 · Postgres 17 + Auth · RLS em todas as tabelas públicas
  │      schema private (fora da API): quota_policy, user_quota (+ budget_policy, user_budget no PR #6)
  └──► Vercel AI Gateway (token OIDC automático): Claude → Gemini (contingência); embeddings
```

## Fluxo do chat (`src/app/api/chat/route.ts`)
1. Login obrigatório (401 sem sessão) e validação do corpo com zod.
2. Regra de privacidade (`src/lib/privacy.ts`): dado sensível não é enviado nem gravado.
3. Limites, todos **fail closed** (`src/lib/chat-budget-guard.ts`). Se o valor não puder ser lido, a IA não é chamada e nada é gravado.
   - Gasto por motor (`month_spend_by_provider`): motor acima do limite fica de fora desta resposta.
   - Teto mensal (`month_spend`). No PR #6, troca por **reserva** (`reserve_ai_budget`), liquidada pelo custo real (`settle_ai_budget`) ou liberada (`release_ai_budget`).
4. Cota diária (`consume_daily_quota()`), a última verificação: mensagem bloqueada antes não gasta cota. Na transição, se a função não existir, usa `consume_quota(limite do servidor)`.
5. Conversa, memórias aprovadas, busca por significado e Google quando o assunto pede.
6. Roteador de motores (`src/lib/llm/router.ts`) com streaming NDJSON.
7. Gravação do consumo (`usage_events`) e resumo em segundo plano.

## Banco
Tabelas públicas, todas com `user_id` e RLS:
- `profiles`, `conversations`, `messages`, `memories`;
- `usage_daily`, `usage_events`;
- `google_connections`, `push_subscriptions`, `reminders`, `daily_briefings`, `daily_pushes`;
- `projects`, `agents`, `tasks`;
- `members`, `invites`, `search_index`.

Migrações versionadas em `supabase/migrations/AAAAMMDDHHMMSS_nome.sql`, nunca editadas depois de aplicadas. O registro no Supabase usa a hora da aplicação, por isso o número não bate com o nome do arquivo. Testes de banco locais: `npm run test:db`, um Postgres temporário com imitação mínima do Supabase, testes SQL e de concorrência; nunca conecta no remoto.

## Decisões técnicas
- **Sem estado no servidor.** Todo estado fica no Postgres; a Vercel escala horizontalmente.
- **Isolamento por pessoa no banco.** RLS com `(select auth.uid()) = user_id`. Funções `security definer` com `search_path = ''` e permissões mínimas (`anon` sem acesso).
- **Limites no servidor, nunca no cliente.** O limite diário fica em `private.quota_policy`; o app não envia limite ao banco. Atomicidade com `INSERT … ON CONFLICT … WHERE` (cota) e advisory locks (orçamento, no PR #6). ADRs: `docs/adr/0001-cota-diaria-atomica.md`; `0002` no PR #6.
- **Fail closed em custo.** Sem conseguir validar limites, não há chamada paga.
- **Migrações em duas etapas** quando trocam algo em uso: cria o novo, publica o app, remove o antigo.
- **Adaptadores de modelo.** `src/lib/llm/*`: um provedor novo é um arquivo novo. Independência de provedor de IA.
- **Streaming de ponta a ponta** e **cache de prompt** (parte estável em cache, memória e data em bloco separado).
- **Voz no aparelho.** Reconhecimento e síntese do navegador, sem custo. A voz paga futura não muda o servidor de conversa.
- **Memória com aprovação.** O modelo propõe; só o que a pessoa aprova volta ao contexto.

## Decisões de produto vigentes (oficiais, 13/11/2026)
1. A grafia do produto é **GaDu**.
2. O logo original aprovado e o avatar holográfico animado são preservados.
3. Experiências desktop e mobile modernas e responsivas: mobile first, com desktop próprio, não apenas ampliado.
4. O assistente universal permite voz e texto em qualquer módulo.
5. A inteligência conecta informações de diferentes funcionalidades, respeitando contexto e permissões. Hoje: só o rótulo de módulo e tela (`src/lib/assistant-context.ts`), escopo sempre pessoal. Etapa futura (Core Contextual, planejada): [CORE_CONTEXTUAL.md](CORE_CONTEXTUAL.md), com tipos em `src/lib/core-context.ts`.
6. O Agent Office suporta múltiplos usuários, organizações e clientes, com isolamento rigoroso.
7. O Agent Office Studio prioriza aplicações web, sites e PWAs, sem desenvolvimento nativo Android/iOS nesta fase.
8. O roadmap distingue claramente funcionalidades atuais e futuras.
9. Modelo de trabalho: GaDu Fast Track (`docs/FAST_TRACK.md`).
10. Módulos e status vêm de uma fonte única (`src/lib/modules.ts`): Disponível, Beta (parcial), Em desenvolvimento, Planejado. Nenhuma tela mostra dado inventado para módulo que não existe.

## Resiliência e contingência
| Falha | O que acontece |
|---|---|
| Motor principal fora | O roteador tenta o próximo: Gateway Claude → Gemini |
| Limites ilegíveis (banco ou rede) | Chat bloqueia com aviso; nada é gravado (fail closed) |
| Cota do dia esgotada | Aviso com o limite real; volta à meia-noite de Brasília |
| Rede cai antes da resposta | O app tenta de novo uma vez; se falhar, a mensagem volta para o rascunho |
| Sem internet | O PWA abre a tela offline; o rascunho fica no aparelho |
| Deploy com problema | Promover o deploy anterior na Vercel (rollback instantâneo) |

## Escala e pontos de atenção
- Pronto para várias pessoas: convites no banco, índices por `user_id`, limites por pessoa (`private.user_quota`; `private.user_budget` no PR #6).
- App em `iad1` e banco em `sa-east-1`: cada consulta cruza o continente. Avaliar mover as funções para `gru1`.
- O próximo gargalo previsível é a cota de IA por conta; resolve-se com tetos por pessoa (PR #6) e um teto global.
