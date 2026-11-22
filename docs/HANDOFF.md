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
| Ciclo UX (UX-1, UX-2, UX-3 parte 1) | Cursor (Grok Bot) | — | **concluído e publicado** em 22/11 às 19:54 (PRs #34, #35, #36). Próximo de UX: resto do UX-3 e UX-4 |
| 3D-1 (conversa → OpenSCAD) | Claude Code | a definir pela sessão | começa em 22/11 por volta das 20:25 |

## A revisar por outra IA
Marque `[x]` quando revisar e anote quem revisou, a data e o resultado.
- [ ] **PR #22, segurança P1** (Claude Code): orçamento só no servidor, etapa 2 da cota, limite de tentativas no login. Conferir se as rotas novas não aceitam valor de custo vindo do cliente.
- [ ] **PR #24, Core "atenção hoje"** (Claude Code): conferir a deduplicação entre fontes e o interruptor `CORE_MVP`.
- [ ] **PR #26, Financeiro base** (Claude Code): migração, RLS e isolamento entre pessoas; conferir os arredondamentos de valores e o interruptor `FINANCE_ENABLED`.
- [ ] **PR #28/#29, celular** (Claude Code): o Voltar do Android com uma entrada por camada. A navegação offline no WebKit é limitação do Playwright, então conferir num iPhone de verdade.
- [ ] **PR #30, Metas** (Claude Code): migração `metas_base`, cálculo de ritmo e interruptor `GOALS_ENABLED`.
- [ ] **PR #32, plano** (Cursor/Grok Bot): conferir se as fases 3D-0 a 3D-3 e o ciclo UX-1 a UX-6 no ROADMAP batem com o pedido do Eduardo.
- [ ] **PR #34, UX-1 navegação** (Cursor/Grok Bot): microfone central (toque fala, segurar abre o painel), tela Mais, fim do menu sanfona, Configurações unificada (`?tab=perfil` e `?tab=integracoes` rolam até a parte certa). Conferir o Voltar do Android no aparelho.
- [ ] **PR #35, UX-2 Hoje** (Cursor/Grok Bot): `toActionItem` em `src/lib/core/format.ts` (só `tasks`/`reminders` ganham `ref`); Feito/Adiar/Desfazer gravam pelo cliente com RLS em `AttentionCard.tsx`. Conferir com dados reais; "Virar tarefa" de e-mail saiu do Hoje.
- [ ] **PR #36, UX-3 voz** (Cursor/Grok Bot): `ListenSheet.tsx` e a contagem de 3 s; `voiceSheetRef` no `onText` do reconhecedor em `GaduApp.tsx`. Conferir no Chrome Android e no Samsung Internet se o fim da fala dispara a contagem e se o microfone sempre fecha.
- [ ] **e2e com login** (`e2e/auth.e2e.cjs`): os testes novos de Mais, Hoje e tela de escuta foram escritos sem rodar (faltam credenciais de teste nesta máquina). Rodar com o usuário de teste e corrigir o que falhar.
- [ ] **Validação com login no aparelho** de tudo o que foi publicado em 22/11 (pendência humana, com o Eduardo).

## Diário (mais recente no topo)

### 22/11/2026 · 19:30–20:00 · Cursor (Grok Bot), ciclo UX
- **Fez e publicou:**
  - PR #33: passagem de bastão (`AGENTS.md`, `CLAUDE.md`, `docs/HANDOFF.md`, modelo de PR). Merge às 19:26.
  - PR #34, UX-1: barra de baixo Hoje · Conversa · microfone · Tarefas · Mais; tela Mais; sem menu sanfona; Configurações num lugar só; menu lateral simples. Merge às 19:41.
  - PR #35, UX-2: Hoje em 5 blocos, de cerca de 4,7 para 2,1 telas a 412 × 915; lista única com Feito/Adiar e Desfazer; `ref` em `/api/attention`. Merge às 19:48.
  - PR #36, UX-3 parte 1: tela de escuta em letra grande, envio sozinho em 3 s com Cancelar e conversa contínua. Merge às 19:54.
- **Evidências:**
  - CI verde nos 4 PRs;
  - deploy Vercel `success` pelos status do GitHub;
  - CSS novo conferido no site no ar;
  - capturas antes e depois, a 412 × 915 com dados fictícios, em `/workspace/gadu-review/ux-before` e `ux-after` (máquina do agente).
- **Como testar sem login:** uma página local `src/app/review/page.tsx`, que **não vai para o repositório** (está em `.git/info/exclude`), renderiza o `GaduApp` com dados fictícios. Build com `NEXT_PUBLIC_SUPABASE_URL=https://gadu-fake.example.com`; os scripts de Playwright em `/workspace/gadu-review/*.cjs` simulam o Supabase e as rotas.
- **Não mexeu** em arquivos do 3D: a frente 3D-1 é do Claude Code.
- **Ficou pela metade:**
  - do UX-3: confirmações faladas, respostas faladas mais curtas e opção de texto grande;
  - o e2e com login não foi rodado.
- **Próximo passo:** validar no aparelho com o Eduardo; depois o resto do UX-3 e o UX-4.

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
