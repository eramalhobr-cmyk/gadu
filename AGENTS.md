# GaDu · regras para qualquer IA (Claude Code, Codex, Cursor e outras)

Leia este arquivo **antes de tocar no código**. Ele vale para toda IA que trabalhar no GaDu. O Codex lê o `AGENTS.md` sozinho; o Claude Code chega aqui pelo `CLAUDE.md`.

## 1. Primeira tarefa ao assumir
1. Leia [docs/HANDOFF.md](docs/HANDOFF.md): a última sessão, o que ficou pela metade e a lista **"A revisar por outra IA"**.
2. **Revise o que a IA anterior fez** (os PRs dos itens abertos da lista): leia o diff, rode os testes e anote no HANDOFF o que conferiu, o que achou e o que corrigiu. Só então comece trabalho novo.
3. Leia [PROJECT_STATUS.md](PROJECT_STATUS.md) (situação e ponto de retomada) e a parte do [ROADMAP.md](ROADMAP.md) do que vai fazer.
4. Antes de criar uma branch, confira se outra IA está trabalhando em paralelo (seção "Em andamento" do HANDOFF e `gh pr list`). Não mexa nos arquivos da frente da outra IA.

## 2. Stack
- Next.js 16 (App Router), React 19, TypeScript. Node 22 no CI.
- Supabase (Postgres 17 + pgvector, região `sa-east-1`, projeto "Gadu"), com RLS em toda tabela.
- Vercel (projeto `gadu-agent`, produção https://gadu-agent.vercel.app), com deploy automático a cada merge na `main`.
- IA pelo AI Gateway da Vercel. Há cota diária e teto mensal no servidor (`consume_daily_quota`, `reserve/settle/release_ai_budget`).
- PWA (service worker em `public/sw.js`). A voz usa a voz do aparelho.
- Documentação em português do Brasil.

## 3. Como rodar as verificações
Antes de abrir um PR, tudo precisa passar:
```bash
npm ci
npm run typecheck          # tsc --noEmit
npm run test:unit          # node --test (src/lib/**)
npm run test:integration   # node --test (test/*.test.ts)
npm run build              # next build
bash scripts/test-db.sh    # Postgres local temporário + pgvector: todas as migrações, cota, orçamento, isolamento entre pessoas
```
- Testes de interface: `npm run e2e:browsers` uma vez, depois suba o app (`npx next start -p 3100`) e rode `E2E_BASE=http://127.0.0.1:3100 npm run test:e2e:public` e `npm run test:e2e:mobile`. Os testes com login (`test:e2e:auth`) rodam no workflow `e2e-auth.yml` contra um Supabase local do runner, sem credenciais de produção ([docs/TESTES_E2E.md](docs/TESTES_E2E.md)).
- O CI (`.github/workflows/pr-checks.yml`) roda os jobs `verify`, `e2e-public` e `database`. Um PR **só de documentação** não dispara o CI sozinho: rode-o à mão com `gh workflow run pr-checks.yml --ref <branch>`.

## 4. Branch, PR e publicação
- Uma branch por entrega: `feat/…`, `fix/…`, `docs/…`, `chore/…`, `test/…`. Nunca commite direto na `main`.
- PRs pequenos. Título e descrição em português, seguindo o modelo `.github/pull_request_template.md`, **com o campo "Feito por (IA)"** preenchido.
- Commits no padrão `tipo(área): descrição em português`.
- Merge só com o CI verde. Depois do merge, confira o deploy da Vercel pelos status do GitHub (`gh api repos/eramalhobr-cmyk/gadu/commits/<sha>/status`) e abra o site no ar.
- Processo por risco ([docs/FAST_TRACK.md](docs/FAST_TRACK.md)):
  - **Baixo risco** (interface, textos, docs, funções reversíveis): CI verde e conferência no ar.
  - **Alto risco** (banco, autenticação, permissões, credenciais, segurança, custo): testes completos, plano de rollback e aprovação explícita do Eduardo a cada passo sensível.
  - Na dúvida, trate como alto risco.

## 5. Banco de dados (Supabase)
- Migrações em `supabase/migrations/AAAAMMDDHHMMSS_nome.sql`. **Nunca edite uma migração já aplicada.**
- **Primeiro só adicionar:** crie tabelas e colunas novas sem apagar nem renomear as antigas. A remoção vem depois, num passo separado e aprovado.
- Toda tabela nova tem `user_id`, RLS com `(select auth.uid())` e teste de isolamento entre pessoas em `scripts/test-db.sh`.
- Aplique no Supabase de produção só com aprovação explícita. Registre a migração aplicada em PROJECT_STATUS.

## 6. Interruptores de emergência (variáveis na Vercel)
Ficam ligados por padrão. Com valor `0`, a função é desligada sem novo deploy de código:
- `CORE_MVP=0`: o chat e a tela Hoje voltam ao comportamento anterior ao Core ([src/lib/core/flag.ts](src/lib/core/flag.ts)).
- `FINANCE_ENABLED=0`: esconde o Financeiro e desliga as rotas `/api/finance/*` ([src/lib/finance/flag.ts](src/lib/finance/flag.ts)).
- `GOALS_ENABLED=0`: esconde Metas e o resumo do Hoje e desliga `/api/goals/*` ([src/lib/goals/flag.ts](src/lib/goals/flag.ts)).
- Função nova e arriscada ganha um interruptor igual (exemplo planejado: `STUDIO3D_ENABLED`).

## 7. Segurança
- **Nunca commite segredos**: chaves, tokens, senhas e arquivos `.env`. As chaves ficam só na Vercel e no servidor; o cliente usa apenas a chave pública do Supabase.
- Toda rota valida a entrada com zod e exige sessão (401 sem login). Rotas de admin conferem o papel no servidor.
- Nenhum dado pessoal (nomes reais, e-mails, valores) no código, nos testes ou na documentação. Os testes usam dados fictícios.
- Nada do empregador de ninguém entra no app.
- Chamada de IA paga só passa pela cota e pelo orçamento do servidor (fail closed).
- Detalhes: [docs/SECURITY.md](docs/SECURITY.md).

## 8. Interface
- Celular primeiro: teste a 390 px e a 412 × 915 antes do computador.
- Textos em português do Brasil, com frases curtas e linguagem simples (o GaDu precisa servir até quem não é digital).
- Botão Voltar do Android: cada camada aberta (painel, folha, tela de escuta) ocupa uma entrada no histórico. Não quebre esse comportamento; o e2e mobile cobre isso.
- Tokens e componentes: [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md).
- Antes de desenhar ou mudar uma tela: [DESIGN.md](DESIGN.md) (princípios, tokens dos dois temas, movimento, piso de qualidade e processo com crítica). Guias de terceiros só em texto, revisados e com licença, em [docs/design/](docs/design/README.md): nunca instalar skills de design nem rodar instaladores ou scripts delas.

## 8.1 Tudo por voz (obrigatório para toda função nova)
Princípio do Eduardo (22/11/2026): **tudo no GaDu precisa poder ser feito pela conversa, falando ou escrevendo; a conversa com a IA é o centro do app.**
- Toda função nova que grava ou muda algo na tela **sai no mesmo PR com a ação pela conversa**: um tipo no bloco `"acoes"` ([src/lib/acoes.ts](src/lib/acoes.ts): validação e regra no prompt), a resolução de nomes para ids só entre os itens da própria pessoa ([src/lib/acoes-resolver.ts](src/lib/acoes-resolver.ts)), o cartão e a execução ([src/lib/chat-actions.ts](src/lib/chat-actions.ts) e [src/components/ActionCard.tsx](src/components/ActionCard.tsx)) e a pergunta da confirmação falada (`actionQuestion`).
- A IA **só propõe**; quem grava é a pessoa, com um toque ou dizendo "sim" (confirmação falada). Nada é gravado no servidor a partir da resposta do modelo, exceto o que já era assim (lembretes, tarefas e memórias pendentes), e esses ganham **Desfazer**.
- **Testes obrigatórios:** unitário da validação, do cartão e da pergunta; integração do `/api/chat` mostrando que a ação só acha itens da sessão (nunca de outra pessoa), respeita o interruptor do módulo e os termos bloqueados e não grava nada antes da confirmação.
- Atualize a matriz **"Tudo por voz"** em [docs/FEATURE_MATRIX.md](docs/FEATURE_MATRIX.md) (seção 11). Se uma ação não puder ser feita por voz (por exemplo, a permissão de notificação, que o navegador exige que seja um toque), registre lá o motivo.
- Uma frente com IA própria (exemplo: o 3D, do Claude Code) adiciona as próprias ações seguindo o mesmo padrão.

## 9. Depois de cada entrega (obrigatório)
Atualize, no mesmo PR ou num PR de docs logo depois:
- [ROADMAP.md](ROADMAP.md): marque o checklist.
- [CHANGELOG.md](CHANGELOG.md): diga se a entrega está desenvolvida, testada ou publicada, com o commit e a evidência.
- [PROJECT_STATUS.md](PROJECT_STATUS.md): situação e ponto de retomada.
- [docs/FEATURE_MATRIX.md](docs/FEATURE_MATRIX.md): status por funcionalidade, com os arquivos.
- [docs/HANDOFF.md](docs/HANDOFF.md): nova entrada no diário (data e hora de Brasília, IA, o que fez, PRs, o que ficou pela metade, próximo passo). Inclua na lista "A revisar por outra IA" o que precisa de um segundo olhar.

Só registre teste ou publicação que foi executado de fato.

## 10. Se a sessão for interrompida
Por exemplo, quando a cota da IA acaba. Antes de parar:
- faça commit e push do que estiver pronto na branch, mesmo que incompleto, com `wip:` no título do commit;
- escreva no HANDOFF onde parou e qual é o próximo passo exato.

A próxima IA continua dali.
