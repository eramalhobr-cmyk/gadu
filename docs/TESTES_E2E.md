# GaDu · Testes de interface (Playwright)

Atualizado em 22/11/2026 (suíte de celular emulado). Playwright é dependência oficial (`playwright` 1.63.0, versão fixa em `package.json` e `package-lock.json`).

## Suítes
| Suíte | Arquivo | Precisa de | Onde roda |
|---|---|---|---|
| Pública | `e2e/public.e2e.cjs` (8 testes) | `E2E_BASE` | **CI em todo PR** (job `e2e-public`) e local |
| **Celular (emulado)** | `e2e/mobile.e2e.cjs` (44 testes: 5 perfis × 8 verificações + 4 de instalabilidade) | `E2E_BASE` (Chromium e WebKit do Playwright) | **CI em todo PR** (job `e2e-public`, depois da pública), local e contra a produção (só leitura) |
| Com login | `e2e/auth.e2e.cjs` (14 testes) | `E2E_BASE` + `E2E_STATE` (arquivo de sessão) **ou** `E2E_EMAIL` + `E2E_PASSWORD` | local, contra servidor local ou produção, com o usuário de teste. Fora dos PRs (ver proposta abaixo) |

O que cobrem:
- **Pública:** home e login em 7 larguras, sem rolagem lateral e com alvos de 44 px; `/app` sem login vai para o login; `/api/chat` e `/api/usage` recusam com 401 antes de qualquer custo; as 12 rotas `/api/finance/*` recusam com 401 (branch de Finanças); CSP com nonce e `frame-ancestors 'none'`; tema claro sem erro de página.
- **Com login:** 7 larguras em 6 telas; menu do celular (tocar fora, Esc, Voltar, escolha); barra de baixo e tela Módulos; conteúdo acima da barra; temas; assistente (orbe, Voltar, alça, histórico compartilhado com a conversa completa); voz simulada (microfone negado, revisão da transcrição, limite de 20 s, interrupção, troca de tela); interruptores de Configurações; Tarefas e Projetos com fixtures, estado vazio e erro; menu recolhível e largura do painel no computador.

**Celular emulado (`npm run test:e2e:mobile`).** Perfis: Pixel 7 e Galaxy S9+ (320 px) do Playwright; 412x915 com o UA do Chrome e com o UA do Samsung Internet (Chromium, o mesmo motor do Samsung Internet); iPhone 14 (WebKit). Em home, login, convite inválido, offline e privacidade: sem rolagem lateral, alvos de toque de 44 px, viewport (`width=device-width, initial-scale=1, viewport-fit=cover`, sem `user-scalable=no`), campos com 16 px, teclado do campo de e-mail (`inputmode`, `autocapitalize`), área segura (`env(safe-area-inset-*)`) nas barras fixas e `100dvh`, `theme-color` claro e escuro, manifest e ícones (192, 512, maskable, tamanhos reais), service worker com escopo `/`, CSP sem bloqueios, tela offline guardada e exibida sem internet. Nos perfis Chromium, `Page.getInstallabilityErrors` (Chrome DevTools Protocol) tem de vir vazio e o manifest não pode ter avisos. O Lighthouse atual (13.x) não tem mais a categoria PWA nem `installable-manifest`; por isso a instalabilidade é testada pelo CDP.

**Limites da emulação:** é motor e tela de celular, não aparelho. Não cobre teclado virtual, microfone, voz, push, botão Voltar físico nem o Samsung Internet de verdade. No WebKit sobre `http://` local, o teste tira a diretiva `upgrade-insecure-requests` da CSP da resposta (o WebKit não isenta localhost) e, por isso, não faz a navegação offline (só confere o cache); contra a produção (https) nada é alterado. Roteiro humano: [CHECKLIST_CELULAR.md](CHECKLIST_CELULAR.md).

Regras:
- **Nada é pulado.** Se faltar variável, a suíte **falha** com a mensagem "Defina …". Teste pulado não conta como aprovado.
- **Sem IA paga:** `/api/chat` é simulado com `page.route`. Voz é simulada (`SpeechRecognition` falso).
- **Fixtures isoladas:** nos testes de Tarefas e Projetos, toda escrita no banco é bloqueada e as leituras vêm de dados de teste.
- **Sem dados reais:** só o usuário de teste, sem conteúdo pessoal.

## Banco: isolamento e riscos conhecidos
- `npm run test:db`: Postgres local descartável com **todas** as migrações (precisa do pgvector; sem ele, falha). Roda cota, orçamento, concorrência e o **isolamento entre pessoas em todas as tabelas do `public` (22, com as 4 de Finanças na branch `feat/financas-base`; o teste falha se uma tabela nova não estiver na suíte)**. Vai no CI (job `database`).
- `npm run audit:db`: o mesmo, mais `supabase/tests/audit/riscos_conhecidos.sql`, que diz CONFIRMADO ou NÃO REPRODUZIDO para cada risco conhecido. É informativo e não roda no CI.

## Como rodar
```bash
npm ci
npm run e2e:browsers          # só na primeira vez fora deste ambiente (baixa o Chromium e o WebKit do Playwright)
npm run build && npx next start -p 3100 &
E2E_BASE=http://127.0.0.1:3100 npm run test:e2e:public
E2E_BASE=http://127.0.0.1:3100 npm run test:e2e:mobile   # precisa também do WebKit (npm run e2e:browsers instala os dois)
E2E_BASE=http://127.0.0.1:3100 E2E_EMAIL=… E2E_PASSWORD=… npm run test:e2e:auth   # usuário de TESTE
```
O CI sobe o app com um endereço fictício do Supabase (`127.0.0.1:54321`) e uma chave pública fictícia: nenhum segredo, nenhum dado real.

## Proposta: testes com login no CI, com segurança (precisa de aprovação)
1. **Usuário isolado e dedicado ao CI** (`ci-e2e@…`, domínio de teste), criado pelo fluxo de convite, papel `member`, sem Google, sem dados, com teto mensal de IA US$ 0 ou mínimo (os testes não chamam IA). Diferente do usuário das capturas.
2. **Credenciais em um GitHub Environment** chamado `e2e-prod`, com `E2E_EMAIL` e `E2E_PASSWORD` como *environment secrets* e **revisor obrigatório** (o Eduardo aprova cada execução).
3. **Gatilhos sem PR:** `workflow_dispatch` e `push` na `main` (depois do merge). **Nunca** em `pull_request`, para que nenhum código de PR rode com o segredo. Sem `pull_request_target`.
4. **Alvo:** produção depois do deploy (ou o preview da `main` com o bypass de proteção da Vercel guardado no mesmo Environment).
5. **Higiene:** a sessão vai para um arquivo temporário apagado no fim (`e2e/login.cjs`); a senha nunca é impressa; `permissions: contents: read`; actions fixadas por SHA; logs sem cabeçalhos de sessão.
6. **Rotação:** trocar a senha do usuário de CI a cada 90 dias ou quando alguém sair do projeto; bloqueá-lo em Administração se houver suspeita.
