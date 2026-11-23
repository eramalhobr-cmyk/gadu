# GaDu · Revisão cruzada para retomada no Codex — 23/11/2026

> **Natureza:** auditoria independente, sem alteração de código, banco, segredos ou produção. **Feito por (IA): ChatGPT (revisão)**. Não representar esta revisão como execução local do Codex.
>
> **Snapshot:** `main` em `5e39f4c60507952e15c0777f915c8a8391c71ed1` (merge #118); GitHub PRs abertos no momento da análise: #1, #115, #117, #119. Estado de branches/CI pode mudar; confira de novo antes de agir.

## 1. Processo obrigatório para a próxima IA

1. Ler `AGENTS.md` antes de qualquer alteração. Em seguida: `docs/HANDOFF.md` (Em andamento + A revisar por outra IA), `PROJECT_STATUS.md`, `ROADMAP.md`, `docs/FEATURE_MATRIX.md`, `DESIGN.md` e documentos da frente.
2. Executar `git fetch`, conferir a SHA real da `main`, `gh pr list`, branches ativas, status dos checks e eventuais revisões já registradas. **Não editar arquivos de uma frente ativa de outra IA**.
3. Separar **na main**, **em PR**, **migração aplicada em produção**, **testado automaticamente** e **validado em aparelho real**; jamais usar esses termos como sinônimos.
4. Para alterações pequenas e reversíveis: branch própria, testes, CI e PR. Para banco/RLS/auth/segredos/custos: plano, rollback e aprovação explícita antes de atos sensíveis. Não fazer merge só porque o CI está verde.
5. Toda função nova que escreve dados deverá oferecer operação pela conversa (voz/texto) e confirmação/Desfazer conforme `AGENTS.md` §8.1.

## 2. Situação funcional verificada por arquivos da main

- **Base e infraestrutura:** Next.js 16 / React 19, TypeScript, Supabase Auth/Postgres/RLS, Vercel, PWA, Vercel AI Gateway, cota diária e orçamento com reserva/liquidação/liberação no servidor. Interruptores para Core, Financeiro, Metas e 3D.
- **Pessoal:** Hoje, tarefas, agenda/Google, lembretes, conversas, memórias aprovadas, busca, projetos e briefings.
- **Core Contextual:** primeira entrega `atenção hoje` (tarefas, lembretes, agenda e e-mail) com escopo pessoal obtido da sessão; contexto de Finanças e Metas em caminhos específicos. **Não há escopo multiempresa funcional** (`src/lib/core/scopes.ts` só resolve `pessoal`).
- **Financeiro:** base Contas/Dia a dia, tetos, acumulado anual, ações pela conversa e simulador de salário bruto/líquido, 13º e férias. Revisar cálculos e interface com dados reais antes de promover a versão como plenamente validada.
- **Metas:** base, progresso, marcos, tarefas, vínculos com projetos e agenda; ações pela conversa.
- **3D Studio Beta:** geração OpenSCAD/WASM, prévia e exportação, verificações para A1, persistência de peças e versões, ajustes por voz. Há melhorias pendentes no PR #119.
- **Agent Office:** agentes individuais, ferramentas permitidas e teto por agente; **orquestração CEO, organizações e clientes ainda não operam**.
- **Design/voz:** UX-1 a UX-7, tema JARVIS, tema claro padrão, um microfone por tela, voz imersiva, controles de texto, ações com confirmação e Desfazer.
- **Planejados:** Casa Inteligente, Samsung Health (conector Android), Spotify API, Agent Office Studio. Não confundir plano com integração efetiva.

## 3. Revisões cruzadas dos PRs abertos

### PR #119 — 3D: **falha de CI reproduzida no log** (não integrar)

- PR: https://github.com/eramalhobr-cmyk/gadu/pull/119
- Head verificado: `e3853bdfe241fd20703aab65f00649aecff4d78a`.
- O job `e2e-auth` teve **27 testes aprovados e 1 falha**, em “3D Studio no celular: Abrir uma peça salva mostra a prévia, o pedido e as versões”. Erro: `page.evaluate: TypeError: Failed to parse URL from /api/3d/pecas`.
- Causa observável no teste `e2e/auth.e2e.cjs`: faz `const p = await page(PHONE)` e `p.evaluate(() => fetch('/api/3d/pecas'))` **antes** de navegar para `BASE`; a página ainda está em `about:blank`, sem base HTTP para URL relativa. O primeiro `p.goto(BASE + '/app/3d')` está mais abaixo. Isso explica a falha de preparação do teste, **não prova bug equivalente em produção**.
- Correção sugerida à IA responsável: navegar primeiro ao app autenticado; então criar a peça, adicionar a versão e executar as asserções. Repetir `e2e-auth` sem pular o cenário. Executar rodada de peças reais e revisar qualidade dimensional no aparelho após correção.
- Revisão GitHub enviada como **COMMENT**, sem aprovação nem alteração de branch.

### PR #115 — e-mails/Memórias: **comportamento possivelmente contrário à regra “manter”**

- PR: https://github.com/eramalhobr-cmyk/gadu/pull/115
- Head: `9171ded328e345589060b56e678065b312e5f56e`; checks consultados verdes.
- Em `src/lib/email-regras.ts`, o caso `regras.manter` devolve `importante` apenas se o Gmail já marcar `mail.important=true`. Caso contrário, devolve `normal`. `aplicarRegras` recalcula `important` e o painel de atenção privilegia crítico/importante.
- **Hipótese a testar:** memória aprovada “E-mails do GitHub são importantes”, mensagem automática GitHub com `important:false`; verificar se aparece no painel. Se “manter” significar destaque explícito, corrigir para `importante` mesmo sem selo Gmail e adicionar teste. Se não, esclarecer o contrato de produto.
- Garantir que avisos críticos não sejam silenciados e que preferência gravada pela voz siga confirmação adequada.
- Revisão GitHub enviada como **COMMENT**, sem merge.

### PR #117 — telemetria avançada: **alto risco de banco, não mergear sem gate**

- PR: https://github.com/eramalhobr-cmyk/gadu/pull/117
- Head: `10cc569a259bcf43365ca962e471f4290211038a`; checks consultados verdes.
- Migração `20261123200001_alerta_erros.sql`: `error_events.user_id` torna-se opcional, novas tabelas `error_alert_state` e `error_alert_dia` de escrita do serviço; app passa a enviar push para erros novos/picos e mostrar painel admin.
- Confirmar aprovação humana específica para aplicar a migração, snapshot/rollback e ordem correta de deploy. Conferir simultaneidade: duas ocorrências no mesmo grupo não podem produzir dois pushes; o teto diário deve resistir à corrida.
- Falta evidência de teste em aparelho real e teste visual autenticado específico do painel. Distinguir push imediato (não depende de `TELEMETRIA_TOKEN`) do resumo diário que requer o segredo configurado.
- Revisão GitHub enviada como **COMMENT**, sem merge ou aplicação da migração.

### PR #1 — contexto mestre legado

- https://github.com/eramalhobr-cmyk/gadu/pull/1 — antigo e aberto; **não integrar às cegas**, pois parte de sua documentação antecede a atual `AGENTS.md`, `HANDOFF.md` e o design JARVIS. Comparar diffs e reaproveitar apenas informações não presentes.

## 4. Documentação a reconciliar (sem perder histórico)

- `docs/HANDOFF.md`: é o diário da colaboração Claude/Cursor/Grok Bot e fonte de revisões cruzadas. Algumas entradas “Em andamento” e “A revisar por outra IA” estavam atrasadas frente aos últimos merges e PRs abertos.
- `PROJECT_STATUS.md`: o cabeçalho era anterior aos merges mais recentes, e a tabela de produção apresenta um snapshot histórico datado de 14/11; **não confundir esse snapshot com deploy de 23/11**.
- `ROADMAP.md`: cabeçalho ainda aponta revisão de 22/11; existem caixas de conclusão e frases históricas que não acompanham Finanças/Metas/3D no código atual.
- `docs/ARCHITECTURE.md`: contém referências antigas a branches Financeiro/Metas como não publicadas, embora essas bases constem da `main`.
- `CHANGELOG.md`: “Em aberto” contém itens antigos posteriormente entregues.
- **Ação recomendada:** depois de estabilizar os PRs #115/#117/#119, editar esses documentos em branch de documentação própria, separando estados `main`, `branch`, `produção` e `teste real`. **Não editar agora os arquivos do HANDOFF/ROADMAP/CHANGELOG**, porque esses três PRs também estão alterando esses arquivos; evitar conflito de trabalho simultâneo.

## 5. Prioridade de execução recomendada

1. **P0 — Fechar revisão cruzada:** corrigir falha do PR #119, acertar contrato de “manter” do PR #115, rever dependências e gate do PR #117. Nova verificação de CI e revisão de diffs após cada alteração.
2. **P0 — Operação segura:** decidir estratégia real de backup/restore no Supabase; proteção contra senhas vazadas; verificar produção logada e usuários bloqueados; revisar S-08 (organizações), tokens Google e privilégios do servidor.
3. **P1 — Teste real:** microfone, confirmação, Desfazer, teclado, botão Voltar e push no Chrome Android/Samsung Internet e iPhone; validar 3D, Finanças e Metas com dados autorizados.
4. **P1 — Core pessoal:** aprofundar consultas contextuais rastreáveis e disponibilidade das fontes, sem usar o hint de módulo/tela como autorização. Medir custo por interação.
5. **P2 — Mais funcionalidades:** completar Finanças/Metas/3D; só depois Agent Office multiempresa com isolamento e aprovação e Agent Office Studio. Casa continua adiada pelo roadmap; Samsung Health/Spotify dependem de conectores aprovados.

## 6. Registro desta entrega e próximo passo

- **Feito nesta revisão:** leitura da `main`, regras de agentes, handoff, roadmap, arquitetura, migrações, código relevante dos três PRs, checks e log da falha #119; revisões registradas diretamente nos três PRs.
- **Não feito:** alterações de código, merge, migração, deploy, acesso a dados de produção, testes físicos, execução local de `npm ci`/build. Não declarar essas atividades como realizadas.
- **Próximo agente:** conferir os estados dos PRs antes de atuar; pedir à IA dona de #119 e #115 para corrigir em suas próprias branches, e à frente de #117 para concluir a aprovação/migração em etapa isolada. Atualizar `docs/HANDOFF.md` quando os PRs concorrentes forem encerrados; adicionar referência a este documento e marcar o item de revisão cruzada.
