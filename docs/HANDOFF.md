# GaDu · Diário de bordo entre IAs

Este é o caderno de passagem de bastão entre as IAs que programam o GaDu (Claude Code, Codex, Cursor/Grok Bot e outras). Regras em [AGENTS.md](../AGENTS.md).

**Como usar**
- **Ao começar:**
  1. leia a última entrada, a seção "Em andamento" e a lista "A revisar por outra IA";
  2. revise os itens abertos que vieram de **outra** IA;
  3. marque cada item revisado com a data e o resultado.
- **Ao terminar** (ou se a sessão for interrompida), escreva uma entrada nova **no topo** do diário com:
  - data e hora de Brasília;
  - IA;
  - o que fez;
  - PRs;
  - o que ficou pela metade;
  - próximo passo.
- Horários sempre no fuso de Brasília (UTC-3).

## Em andamento (atualize ao começar e ao terminar)
| Frente | IA | Branch | Situação |
|---|---|---|---|
| UX-1 navegação e UX-2 tela Hoje | Cursor (Grok Bot) | `feat/ux-navegacao` e seguintes | em andamento, começou em 22/11 às 19:30 |
| 3D-1 (conversa → OpenSCAD) | Claude Code | a definir pela sessão | começa em 22/11 por volta das 20:25 |

## A revisar por outra IA
Marque `[x]` quando revisar e anote quem revisou, a data e o resultado.
- [ ] **PR #22, segurança P1** (Claude Code): orçamento só no servidor, etapa 2 da cota, limite de tentativas no login. Conferir se as rotas novas não aceitam valor de custo vindo do cliente.
- [ ] **PR #24, Core "atenção hoje"** (Claude Code): conferir a deduplicação entre fontes e o interruptor `CORE_MVP`.
- [ ] **PR #26, Financeiro base** (Claude Code): migração, RLS e isolamento entre pessoas; conferir os arredondamentos de valores e o interruptor `FINANCE_ENABLED`.
- [ ] **PR #28/#29, celular** (Claude Code): o Voltar do Android com uma entrada por camada. A navegação offline no WebKit é limitação do Playwright, então conferir num iPhone de verdade.
- [ ] **PR #30, Metas** (Claude Code): migração `metas_base`, cálculo de ritmo e interruptor `GOALS_ENABLED`.
- [ ] **PR #32, plano** (Cursor/Grok Bot): conferir se as fases 3D-0 a 3D-3 e o ciclo UX-1 a UX-6 no ROADMAP batem com o pedido do Eduardo.
- [ ] **Validação com login no aparelho** de tudo o que foi publicado em 22/11 (pendência humana, com o Eduardo).

## Diário (mais recente no topo)

### 22/11/2026 · 19:30 · Cursor (Grok Bot)
- **Fez:** criou este sistema de passagem de bastão: [AGENTS.md](../AGENTS.md) (regras para qualquer IA), `CLAUDE.md` apontando para ele, este diário e o modelo de PR com "Feito por (IA)" e "Revisar".
- **PRs:** este PR de documentação.
- **Próximo passo:** UX-1 (navegação) e UX-2 (tela Hoje) do ROADMAP, em PRs pequenos.

### 22/11/2026 · 19:12 · Cursor (Grok Bot), revisão do plano
- **Fez:**
  - leu todos os `.md`;
  - fez uma revisão de experiência a 412 × 915, numa cópia local com dados simulados;
  - escreveu o plano do 3D por fases ([docs/FEATURE-3D.md](FEATURE-3D.md)) e o ciclo UX-1 a UX-6 no ROADMAP;
  - registrou a Casa Inteligente como adiada.
- **PRs:** #32 (merge às 19:12), #31 (registro da publicação de Metas, merge às 18:37).
- **Ficou pela metade:** nada.
- **Próximo passo:** UX-1/UX-2 (Cursor) e 3D-1 (Claude Code).

### 22/11/2026 · 14:00–18:33 · Claude Code (passos 1 a 4 do plano aprovado pelo Eduardo)
- **Fez e publicou:**

  | Entrega | Código | Registro da publicação |
  |---|---|---|
  | Segurança e custo P1 | PR #22 (merge às 14:54) | PR #23 (14:59) |
  | Core "atenção hoje" | PR #24 (15:42) | PR #25 (15:46) |
  | Financeiro base | PR #26 (16:44) | PR #27 (16:48) |
  | Correções do celular | PR #28 (17:19) | PR #29 (17:58, que também ajustou um teste de banco) |
  | Metas fase 1 | PR #30 (18:33) | — |

- **Autoria:** conferida pelo trailer `Co-Authored-By: Claude` nos commits dos PRs #22 a #30. Os PRs #31 e #32 não têm o trailer e foram feitos pelo Cursor/Grok Bot.
- **Ficou pela metade:**
  - validação com login em aparelho de verdade;
  - senhas vazadas no painel do Supabase e S-09 (backups no plano Free).
- **Próximo passo:** revisar a lista acima e seguir o ROADMAP (UX e 3D).
