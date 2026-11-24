# GaDu · Changelog

Cada entrada diz em que estágio a mudança está: **desenvolvido** (código em branch), **testado** (testes automáticos ou verificação executada, descrita na entrada), **publicado** (na `main` e em produção na Vercel, com migrações aplicadas quando houver). Datas são as do commit. Antes de 12/11 o histórico foi reconstruído a partir do `git log` e do ROADMAP; o que não tem evidência registrada aparece como "verificação não registrada".

## Em aberto (não publicado)
- **Metas fase 2, etapa 2a: projetos ligados à meta** (branch `feat/metas-fase2-projetos`) · **desenvolvido e testado** em 23/11/2026 (Claude Code): rotas `POST /api/goals/:id/projetos` e `DELETE /api/goals/:id/projetos/:projectId` (zod, sessão, `GOALS_ENABLED`, RLS e chave composta), painel "Projetos ligados" na tela da meta, ação por voz `meta_projeto` (cartão, pergunta falada, **Desfazer**), fatos do Core ("projetos ligados: …", nome bloqueado omitido). Sem migração nova (a `20261123170001` já está aplicada). Testes: unitários (validação, cartão, pergunta), integração das rotas e do `/api/chat` (isolamento A x B, interruptor, termo bloqueado, nada gravado antes de confirmar). Publicação e merge: ver a entrada do HANDOFF.
- **Metas fase 2, etapa 1: migração `20261123170001_metas_fase2.sql`** (`goal_projects` e `goal_events`, só aditiva, RLS e S-05) · **desenvolvida e testada** em 23/11/2026 (Claude Code): `bash scripts/test-db.sh` verde (isolamento, 70_metas, 85_s05 com 46 políticas). **NÃO aplicada em produção**: precisa do Cursor via MCP. O código (voz e telas) vem depois.
- **3D-1 · 3D Studio (Beta): conversa → OpenSCAD → STL e 3MF** (branch `feat/3d-1-openscad`, 4 commits `feat(3d)`, de 22/11/2026) · **publicado** em 22/11/2026 às 20:55 (Brasília), PR #40, merge `6d87a5f`, CI verde (verify, e2e-public, database), deploy de produção da Vercel concluído. No ar: `/api/3d/generate` sem sessão 401, `/vendor/openscad/render-worker.js` 200 com a CSP própria, e2e público contra a produção 10/10. `MODELING_3D_ENABLED` não definida na Vercel: o 3D está **desligado** em produção até o Eduardo ligar. Interruptor `MODELING_3D_ENABLED` (desligado por padrão). Rota `/api/3d/generate` com o pipeline de custo do chat (reserva → cota → IA → liquidação, fail closed); OpenSCAD WASM (GPL, sem modificações) como componente separado em `public/vendor/openscad/`, só num Web Worker, com CSP própria sem rede (as páginas não mudaram); visualizador three.js, controles deslizantes, verificações da A1, STL e 3MF; 3MF "A1 PLA 0.4" pronto mas desativado até o Eduardo enviar o projeto. Pacotes: `three` 0.187.0 (MIT), `@types/three` (dev); `openscad-wasm-prebuilt` 1.2.0 (GPL-2.0-or-later) só como arquivo copiado. Sem migração. **Evidências (máquina local):** `npm run typecheck`; `test:unit` 198/198 (inclui o OpenSCAD WASM real compilando um cubo em Node); `test:integration` 143/143; `npm run build`; `scripts/test-db.sh` ok; e2e público 10/10 e mobile 44/44 contra `next start`; renderização conferida em Chromium real a 412 × 915 e 1440 × 1000 com a IA simulada (mexer num controle re-renderiza sem chamar a rota). **Não testado:** IA real (custo), WebKit/iPhone, e2e com login (`E2E_3D=1`), Samsung Internet.
- **PR #5 · Especificação de Finanças pessoais** (`docs/FEATURE-FINANCAS.md`): integrada em 22/11/2026 (merge `ff8fff0`); ver a entrada de publicação do PR #26.
- **PR #1 · Marco Zero: contexto mestre, auditoria de segurança, governança.** Só documentação, rascunho. O `DESIGN_SYSTEM.md` dele foi substituído pelo da `main` (PR #10).

## 2026-11-23 · Monitoramento e alerta de erro · desenvolvido e testado
- **Feito por:** Claude Code (código) e Cursor (Grok Bot) (revisão, testes e publicação). O Claude Code começou a implementação e parou no limite de 5 h (18:47, Brasília); o Cursor concluiu a revisão e os testes.
- Captura do servidor unificada em `capturarErroServidor` (rotas de API, IA, 3D e cron, inclusive erro tratado que responde 500/502/504; sem sessão, `user_id` nulo depois da migração). Continua a captura do navegador (error boundary, `onerror`, `unhandledrejection`, com limite de taxa).
- Agrupamento pela impressão digital que já existia. Detector de privacidade (`isSensitive`, PR #94) + e-mail em tudo o que é gravado, enviado ou falado; nunca guarda mensagem, token, e-mail ou corpo.
- Alerta ao administrador **pelo push que o app já tem**, sem `TELEMETRIA_TOKEN`: grupo novo (primeira vez ou depois de 7 dias) ou pico (5+ vezes em 15 min). Throttle: 1 aviso por grupo a cada 6 h e no máximo 4 por dia (Brasília). Rede de segurança e retenção de 30 dias no cron `tick`.
- Painel **Saúde do sistema** na Administração (estilo JARVIS, só dados reais): totais de 24 h e 7 dias, servidor × cliente, erros por dia e grupos recentes.
- Voz, sem modelo: “teve algum erro hoje?”, “o que quebrou?”, “abre a saúde do sistema”. Quem não é administrador ouve “Isso é só para administrador.”
- **Migração aditiva** `20261123200001_alerta_erros.sql`: `error_events.user_id` deixa de ser obrigatório; tabelas `error_alert_state` e `error_alert_dia` (só o servidor escreve, RLS ligado, sem dado pessoal). Sem ela, o app segue: erro sem sessão não grava e o alerta se cala.
- **Testes:** unitários (sanitização, agrupamento, decisão de alerta, throttle, voz, payload do push) e integração (captura, push só para admin ativo, 403 para não admin, falha do banco não derruba a rota); `scripts/test-db.sh` com `81_alerta_erros.test.sql`.
- A issue diária com `TELEMETRIA_TOKEN` continua opcional, no fim do roadmap.

## 2026-11-23 · Triagem de e-mails obedece às memórias aprovadas · desenvolvido e testado
- **Feito por:** Claude Code (revisado pelo Cursor/Grok Bot). **Bug:** "Merece sua atenção" mostrava e-mails automáticos (falhas de deploy da Vercel, notificações do GitHub) mesmo depois de a pessoa aprovar uma memória dizendo que não são importantes. A triagem é determinística (sem IA) e só olhava o rótulo IMPORTANT do Gmail; as memórias só entravam no prompt do chat.
- **Correção:** módulo puro `src/lib/email-regras.ts` lê as memórias aprovadas (só as que falam de e-mail ou notificação) e extrai o que silenciar e o que manter (serviços, domínios, endereços, remetente, tópicos como deploy, CI, newsletter). Ordem: aviso crítico (segurança, cobrança) sempre aparece; "manter" vence; "silenciar" vira baixa prioridade; notificação automática (noreply, ferramentas de desenvolvimento, assunto de deploy/build) é baixa por padrão; o resto segue o Gmail. Aplicado na fonte de e-mail do Core (só crítico e importante entram; some o "E-mail não lido" de enchimento), em `/api/today`, no briefing do cron, no chat (`[baixa prioridade: motivo]`) e nas percepções. O Gmail agora também guarda o endereço do remetente (`fromEmail`).
- **Ensinar por voz ou toque:** botão "Não é importante" no e-mail do cartão e comando local "isso não é importante" / "e-mails da Vercel não são importantes" (sem modelo). `POST /api/email/nao-importante` grava uma memória **já aprovada** ("Regra de e-mail", área Preferências) com o cliente da sessão (RLS e S-05; 403 se a política negar). Sem migração, sem chave secreta.
- **Por voz:** quando "isso não é importante" vem da voz, a confirmação também é falada (ajuste do Cursor na revisão).
- **Sem lista velha:** o cartão refaz a lista quando o app volta para a frente (PWA aberto em segundo plano) e o service worker passou para `gadu-v7`, limpando caches antigos de arquivos (as rotas `/api` nunca foram guardadas).
- **Correção extra:** o chat lia as 80 memórias **mais antigas**; agora lê as 80 mais novas, em ordem cronológica.
- **Evidências (máquina local):** `npx tsc --noEmit`; `npm test` (unitários 419/419, integração 250/250, com os testes novos de `email-regras` e do Core); `next build`; `node --check e2e/auth.e2e.cjs`. O e2e novo (regra por texto cria memória sem chamar o modelo) **não foi executado** aqui (precisa do Supabase local do CI). Sem Google real: classificação conferida só com dados fictícios.

## 2026-11-23 · Simulador de salário: outras deduções, benefícios, 13º, férias e voz sem custo · **publicado**
- **Publicado** em 23/11/2026 às 19:09 (Brasília), PR #116, merge `ed9a20f`; CI verde (verify, e2e-public, database, e2e com login). Deploy de produção da Vercel (`gadu-agent`) concluído; conferido: `/api/health` 200, `/api/finance/resumo` 401 sem sessão, e o CSS de produção com `.sal-diga` (a frase “Diga: quanto fica líquido um salário de 12 mil?”). Sem migração.
- **Feito por:** Claude Code (código); Cursor / Grok Bot (revisão, testes de novo, merge). Entradas novas (outras deduções e benefícios), estimativas de 13º e férias + 1/3 (pagamentos separados, mesma função), testes com os exemplos 2 a 5 da Receita (INSS dado, via `calcularIrrf`) e o caso de R$ 12.000,00, tela com painel HUD, barra de composição e botão Ouvir, e o pedido "quanto fica líquido um salário de 12 mil?" respondido sem modelo no cliente (`GaduApp.send`) e no `/api/chat` (sem reserva e sem cota).
- **Verificação local (antes do merge):** `npm run typecheck`, `npm run test:unit` (420/420), `npm run test:integration` (257/257) e `npm run build` (env falsa). Não rodei e2e localmente (o CI rodou, inclusive e2e com login). Tela em aparelho e a frase por voz com pessoa logada seguem pendentes.

## 2026-11-23 · 3D: correções da rodada de referência com IA real · desenvolvido e testado
- **Feito por:** Cursor (Grok Bot). Tempo da IA no 3D (maxDuration 120 s, prazo de 105 s, sem raciocínio interno, 504 com mensagem clara), código cortado detectado (`scadIncompleto`) com uma nova tentativa automática mais curta, "altura" sempre no eixo Z no prompt, texto em relevo funcionando (fontes Liberation Sans, OFL, no worker do OpenSCAD), "Nova peça" limpa a caixa de texto, a prévia volta à vista depois de gerar ou ajustar, mensagens de erro com o código. **Testado:** `test:unit` 410/410 (inclui o OpenSCAD WASM real com `text("ESCRITÓRIO")`), `test:integration` 257/257, `tsc`; `conferir.ts` nos 16 códigos salvos da rodada: os 2 cortados são pegos pelo `scadIncompleto`, chaveiro e placa ganham o relevo. **Não testado:** nova rodada com a IA real no navegador.

## 2026-11-23 · UX-7 G1 · Modo voz imersivo (JARVIS) · desenvolvido e testado

## 2026-11-23 · UX-7 G3 · Design system v2 com testes visuais · publicado
- **Publicado:** PR #113, merge `4ca2a83` em 23/11/2026 17:46 (Brasília); CI verde; `/design` responde 404 em produção, como previsto.
- **Feito por:** Cursor (Grok Bot). Vitrine `/design` com tokens, tipografia, ações, gráficos dos painéis e o núcleo de voz (números de exemplo marcados como tal; **404 em produção**, abre só com `GADU_DESIGN_PAGE=1`). Testes visuais novos no CI (`e2e/visual.e2e.cjs`, job `e2e-public`): contraste WCAG dos tokens nos dois temas, sem rolagem lateral, alvos de 44 px e comparação de pixels com `e2e/visual-baseline/` (até 2%), feita no próprio navegador, **sem dependência nova**. Capturas sobem como artefato `gadu-visual`. Ver `docs/DESIGN_SYSTEM.md` ("Design system v2").
- **Evidências (máquina local):** typecheck; build; `npm run test:e2e:visual` 6/6 (contraste claro e escuro; vitrine 390 e 1440 nos dois temas).

## 2026-11-23 · UX-7 G1 · Modo voz imersivo (JARVIS) · publicado
- **Publicado** em 23/11/2026 às 17:39 (Brasília), PR #112, merge `f6751ab`; CI verde (verify, e2e-public, database, e2e com login).
- **Feito por:** Cursor (Grok Bot). A tela de escuta virou tela cheia (celular e computador) com o **núcleo JARVIS**: o avatar no centro de três anéis e um espectro de 60 traços que crescem com o **nível real da voz** (`voice-level.ts`: microfone no computador, trechos reconhecidos no celular, palavras faladas pela voz do aparelho). Sem sinal, só uma respiração baixa; nada de volume inventado. Selo de estado em HUD (Ouvindo / Pensando / Falando). Os anéis do avatar da Conversa agora também reagem (`--lvl`). Um laço por quadro escreve só a variável CSS (sem re-render). "Reduzir movimento" para os giros; alto contraste usa as cores do sistema.
- **Voz (sem modelo):** "modo voz", "abre o modo de voz", "ativa o modo Jarvis", "modo imersivo" abrem a escuta.
- **Evidências (máquina local):** typecheck; `nivel-visual.test.ts` (nível real × respiração, espectro, rótulos, frases); build; e2e com login novo "modo voz imersivo (G1)" (tela cheia, 60 traços, selo "Ouvindo", `--lvl` entre 0 e 1). Capturas em `/workspace/gadu-review/g1/`.

## 2026-11-23 · UX-7 M4 · Resumo falado dos painéis · publicado
- **Publicado** em 23/11/2026 às 17:35 (Brasília), PR #111, merge `aad5d97`; CI verde (verify, e2e-public, database, e2e com login). Antes dele, o gasto do mês no Hoje: PR #110 às 17:34, merge `768a363`.
- **Feito por:** Cursor (Grok Bot). Cada painel (Hoje, Finanças, Metas, Tarefas, Agentes) tem o botão **Ouvir** (44 px), que fala em uma ou duas frases o que o gráfico mostra, só com os números reais (`src/lib/painel-fala.ts`). Funciona mesmo com a voz das respostas desligada, porque foi pedido no toque. Finanças ganhou a linha de tendência do dia a dia no ano.
- **Voz (sem modelo, sem custo):** "lê o resumo" / "me fala o resumo" lê o painel da tela atual (sem painel, avisa e sugere a frase); "mostra meu resumo de finanças" por voz agora abre, rola e **fala os números** quando eles chegam (até 3 s; senão só confirma).
- **Evidências (máquina local):** typecheck; `painel-fala.test.ts` (frases com e sem dados, "lê o resumo" sem sequestrar outros pedidos); build; e2e com login novo "resumo falado dos painéis (M4)" (Ouvir fala o resumo, 44 px, sem chamar o modelo). Capturas em `/workspace/gadu-review/m4/`.
- **Ícone:** `som` desenhado no próprio `ui.tsx` (traço, sem pacote novo).

## 2026-11-23 · Plano do Spotify (tocar o Update Diário do dia) · só documentação
- **Feito por:** Cursor (Grok Bot). `docs/PLANO-SPOTIFY.md` com as regras de 2026 do Spotify (Development Mode, Premium, allowlist de 5, PKCE, redirect HTTPS), Connect × Web Playback SDK no Galaxy S26 Ultra, link como reserva, segurança dos tokens, comandos de voz, esforço e riscos. Nada implementado.

## 2026-11-23 · Painéis de resumo e gráficos (tema JARVIS) · publicado
- **Publicado** em 23/11/2026 às 17:14 (Brasília), PR #108, merge `432ebeb`; CI verde (verify, e2e-public, database, e2e com login), deploy da Vercel com sucesso e CSS novo (`gkpi-row`, `gring-fg`, `pnl-grid`) conferido no site.
- **Depois (PR seguinte):** Hoje ganhou o indicador "Gasto no mês" (contas pagas + dia a dia, de quanto está previsto), só com o Financeiro ligado.
- **Feito por:** Cursor (Grok Bot). Painéis com números e gráficos leves (SVG e CSS, sem biblioteca nova: `src/components/charts.tsx`, `src/app/paineis.css`, `src/lib/painel.ts`), **só com dados reais** e estado vazio quando não há registro ("–", nunca 0% inventado): **Hoje** (compromissos que faltam, o que pede atenção, tarefas abertas e feitas hoje), **Finanças** (contas pagas em anel, gasto do dia a dia por mês no ano, gasto × teto das 4 categorias mais perto do limite), **Metas** (anéis de progresso das metas ativas, cada um abre a meta), **Tarefas** (abertas, atrasadas, feitas em 7 dias, barra feitas × abertas e feitas por dia) e **Agentes** (ativos, gasto do mês por agente a partir de `agent_uso`, gasto × teto). Cada gráfico tem nome acessível com os números e tabela escondida para leitores de tela.
- **Voz:** "mostra meu resumo de finanças", "resumo das tarefas", "me mostra o painel das metas", "resumo dos agentes", "resumo do dia": abre a tela e leva o painel para a vista, sem modelo e sem custo (`parseNavIntent` com `painel: true`); por voz o GaDu diz "Mostrando o resumo de…".
- **Evidências (máquina local):** typecheck; `painel.test.ts` e `nav-intent.test.ts` (frases do resumo); `design-system.test.ts`; build; e2e com login novo "painéis de resumo (G2)" (frase abre o painel, sem chamar o modelo, sem NaN/undefined). Capturas 390 e 1440 nos dois temas em `/workspace/gadu-review/paineis/`.

## 2026-11-23 · Tema JARVIS (direção G2, escolhida pelo Eduardo às 16:33) · publicado
- **Publicado** em 23/11/2026 às 17:03 (Brasília), PR #107, merge `04b963f`; CI verde (verify, e2e-public, database, e2e com login).
- **Feito por:** Cursor (Grok Bot). Novo `src/app/jarvis.css` (carregado por último): HUD holográfico ciano/âmbar nos dois temas, **claro como padrão** e escuro como opção (cookie `gadu_theme` respeitado). Avatar como **núcleo** com dois anéis (marcas de mostrador e arco âmbar/ciano) que giram devagar e param com "reduzir movimento"; painéis com **cantos em colchete**; títulos de seção, horários e números em **fonte mono**; grade fina e linhas de varredura fracas (somem em alto contraste); botões com cantos cortados. **Barra de baixo flutuante de vidro** (estrutura da direção E), mesmos itens e ordem (Hoje, Conversa, microfone, Tarefas, Mais). Ajustes do Eduardo: (1) sem traço por cima do microfone nem do item atual; (2) **microfone sólido**, em relevo, com sombra, brilho e estado de toque (afunda ao apertar), **por cima da barra e do conteúdo** (`z-index`), e o conteúdo ganha folga embaixo para nada ficar escondido. `theme-color` e manifest: claro `#eef4f9`, escuro `#050f1a`. Ícones: os atuais (traço fino) mantidos; nenhum pacote novo.
- **Voz:** "muda para o tema escuro" / "volta para o tema claro" continuam valendo (ação `ajuste/tema`).
- **Evidências (máquina local):** typecheck; `theme.test.ts`; build; e2e com login novo "tema JARVIS (G2)" (microfone com `z-index` 3, preenchido, sem traço, barra arredondada, área rolável termina acima do microfone); `mobile.e2e` com as cores novas. Capturas de todas as telas a 390 e 1440 px: antes `/workspace/gadu-review/jarvis/antes-claro/` e `antes-escuro/`, depois `/workspace/gadu-review/jarvis/depois-claro/` e `depois-escuro/`.

## 2026-11-23 · UX-7 · Computador: paleta Ctrl+K e menu compacto por voz (M6) · publicado
- **Publicado** em 23/11/2026 às 16:34 (Brasília), PR #106, merge `4bce889`; CI verde (verify, e2e-public, database, e2e com login).
- **Feito por:** Cursor (Grok Bot). **Ctrl+K** (⌘K no Mac), ou o campo "Ir, fazer ou perguntar…" no topo, abre uma paleta com um campo só: telas ("agen", "abre fin"), comandos (falar com o GaDu, nova conversa, assistente, recolher/expandir o menu, tema, guia), as frases da tela atual (do M5) e, por último, **"Perguntar ao GaDu"** com o texto digitado (as navegações locais do G2 continuam valendo). O botão de microfone da paleta troca para a voz (abre a tela de escuta). Setas, Enter e Esc; telas desligadas não aparecem. **Voz:** "recolhe o menu" e "expande o menu" no computador (no celular, "abre o menu" continua abrindo o Mais). O menu compacto (só ícones) já existia; agora também pela paleta e pela voz. Sem modelo e sem custo.
- **Evidências (máquina local):** typecheck; `paleta.test.ts` (ordem e filtro, "abre fin" → Financeiro, tela desligada, perguntar sempre por último, comando do menu, atalho); build; e2e com login novo "paleta Ctrl+K e menu compacto (UX-7 M6)" (Ctrl+K → Agenda, recolher pela paleta, expandir por texto no assistente, Esc, nenhuma chamada a `/api/chat`). Capturas: antes `/workspace/gadu-review/ux6/antes-m6/`, depois `/workspace/gadu-review/ux6/depois-m6/` (`1440-ctrlk*.png`, `1440-menu-compacto*.png`; 390 px sem mudança).

## 2026-11-23 · UX-7 · "O que posso dizer aqui" em todas as telas (M5) · publicado
- **Publicado** em 23/11/2026 às 16:11 (Brasília), PR #104, merge `475dec9`; CI verde (verify, e2e-public, database, e2e com login), deploy da Vercel com sucesso e CSS novo (`say-pop`) conferido no site.
- **Feito por:** Cursor (Grok Bot). Botão de balão no topo de todas as telas (celular e computador) abre um cartão com 3 ou 4 frases da tela atual, todas de ações que já existem (`src/lib/o-que-dizer.ts`). Tocar numa frase leva o texto ao campo para conferir antes de enviar (fora da Conversa, abre o assistente da tela); nada é executado sozinho. **Voz:** "o que posso dizer aqui?", "o que eu posso falar nesta tela", "comandos de voz" abrem o mesmo cartão e, se veio por voz com a fala ligada, o GaDu lê três exemplos. Sem modelo e sem custo. Esc fecha.
- **Evidências (máquina local):** typecheck; `o-que-dizer.test.ts` (frases reconhecidas e recusadas, telas existentes, frase falada); build; e2e com login novo "o que posso dizer aqui (UX-7 M5)" (botão, frase vai ao campo, pedido por texto, Esc, nenhuma chamada a `/api/chat`). Capturas: antes `/workspace/gadu-review/ux6/antes-m5/`, depois `/workspace/gadu-review/ux6/depois-m5/` (390 e 1440 px; `*-dizer.png` com o cartão aberto).

## 2026-11-23 · UX-7 · Navegação por intenção: "abre finanças", "volta" (G2) · publicado
- **Publicado** em 23/11/2026 às 16:00 (Brasília), PR #105, merge `5c69be1`; CI verde (verify, e2e-public, database, e2e com login).
- **Feito por:** Cursor (Grok Bot). Frases curtas de navegação são entendidas no próprio aparelho, sem modelo e sem custo (`src/lib/nav-intent.ts`): "abre finanças", "vai para as metas", "me leva para minhas tarefas", "abre o 3D", "entra nas configurações", "volta pra tela de hoje", e "volta"/"tela anterior" (volta à tela visitada antes; pilha de até 20). Por voz, o GaDu confirma falando ("Abrindo Financeiro.", "Voltando para Hoje."). Telas desligadas (Financeiro, Metas, 3D sem permissão) seguem para o GaDu como antes. Pedidos que não são só navegação ("abre a conversa sobre a viagem", "abre minha última peça") continuam indo ao modelo; "volta atrás" continua sendo "desfaz" quando há algo para desfazer. A ação `navegar` do modelo continua valendo.
- **Evidências (máquina local):** typecheck; `nav-intent.test.ts` (frases de abrir e voltar, frases que não podem ser sequestradas, pilha, frase falada); build; e2e com login novo "navegação por intenção (UX-7 G2)" (abre a Agenda e volta à Conversa sem chamar `/api/chat`). Capturas: antes `/workspace/gadu-review/ux6/antes-g2/` (a frase ia ao modelo e ficava "Pensando"), depois `/workspace/gadu-review/ux6/depois-g2/` (abre a Agenda na hora), 390 e 1440 px.

## 2026-11-23 · UX-7 · DESIGN.md e guias de design revisados (R6/M1) · desenvolvido
- **Feito por:** Cursor (Grok Bot), pela regra de segurança do Eduardo para skills de design. `DESIGN.md` na raiz (produto, princípios, tokens claro/escuro, movimento, piso de qualidade, processo). Em `docs/design/`, só texto, copiado sem edição e fixado no commit revisado: Anthropic `frontend-design` (Apache-2.0), rubrica de crítica do Impeccable (Apache-2.0, com NOTICE), diretrizes de interface da Vercel Labs (MIT) e padrões de animação do Emil Kowalski (MIT). Recusados e registrados: a skill do Impeccable (scripts, CLI, hooks), a skill `web-design-guidelines` da Vercel (passo com `curl`). Nada instalado, nenhum script rodado. Primeira crítica com a rubrica em `docs/design/critica-2026-11-23.md` (Hoje, Conversa, Mais). `docs/DESIGN_SYSTEM.md` atualizado para o claro como padrão; AGENTS.md aponta para o `DESIGN.md`.
- **Evidências:** leitura integral dos 4 arquivos copiados e varredura por comandos e rede, registradas em `docs/design/README.md` com SHA-256. Só documentação.

## 2026-11-23 · 3D-1b: o render da peça vai junto de cada ajuste · desenvolvido e testado
- **Feito por:** Cursor (Grok Bot), aprovado pelo Eduardo às 15:01. No ajuste ("Pedir uma mudança" e o ajuste por voz `peca3d_ajustar`), o Studio captura o visualizador (JPEG, lado maior de 512 px) e manda junto; a rota `/api/3d/generate` confere o tipo pelo cabeçalho real e o tamanho (até 300 KB; inválido = 400 antes de qualquer custo), soma a imagem na estimativa da reserva e segue o pipeline de sempre (limites → reserva → cota → IA → liquidação). Peça nova e correção de erro continuam só com texto. Sem render pronto ou sem WebGL, vai só o código. O ajuste por voz espera o render da peça aberta ficar pronto.
- **Custo extra estimado:** ~350 tokens de entrada por imagem de 512 × 512 (regra w·h/750) → **≈ US$ 0,000035 por ajuste** no Haiku 5.5 (US$ 0,10 por milhão); a reserva conta 400 tokens (≈ US$ 0,00004). Mesmo com o modelo mais caro da tabela (Opus 5.5, US$ 4/M) seria ≈ US$ 0,0014.
- **Evidências (máquina local):** `render-imagem.test.ts`, integração da rota (imagem e nota vão à IA, ordem de custo igual, reserva maior com imagem, imagem falsa/grande/fora do ajuste = 400 sem custo, cota esgotada libera a reserva), `test/studio3d-imagem.test.ts`. **Não testado:** IA real (as 10 peças de referência esperam o OK de gasto do Eduardo), aparelho.

## 2026-11-23 · UX-7 · Motores de rosto antigos apagados · publicado
- **Publicado** em 23/11/2026 às 15:20 (Brasília), PR #102, merge `cd657cb`; CI verde (verify, e2e-public, database, e2e com login) e deploy da Vercel conferido no site.
- **Feito por:** Cursor (Grok Bot). Apagados `brain-engine.ts`, `head-engine.ts`, `bot-engine.ts`, o desenho de `robot-engine.ts` (fica só o tipo `FaceMode`), os componentes `RobotFace` e `Mind`, o ouvinte de ponteiro que só servia a eles e o CSS `.mind`: cerca de 550 linhas sem uso. O avatar oficial (ilustração + `avatar-engine.ts`) não muda. Sem voz nova (é limpeza).
- **Evidências (máquina local):** typecheck; `test:unit`; build; avatar conferido na Conversa, no Hoje e na escuta.

## 2026-11-23 · UX-7 · Um microfone só no celular · publicado
- **Publicado** em 23/11/2026 às 15:16 (Brasília), PR #101, merge `1dfff09`; CI verde (verify, e2e-public, database, e2e com login) e deploy da Vercel conferido no site.
- **Feito por:** Cursor (Grok Bot). Abaixo de 1024 px (com a barra de baixo), o microfone central é o único em repouso: o do campo de mensagem some e volta quando a pessoa está escrevendo (ditado para revisar, que respeita "Enviar sozinho" desligado) e sempre que vira "Parar" (ouvindo ou respondendo). No computador nada muda. Texto da Conversa vazia: "Fale pelo microfone ou escreva abaixo." Só CSS e uma classe `idle` no botão; sem ação de voz nova (é o próprio gesto de falar).
- **Evidências (máquina local):** typecheck; build; e2e com login: teste novo "um microfone só no celular" e os testes de voz do campo passam a focar o campo antes. Capturas: `/workspace/gadu-review/ux6/depois-um-mic/` (antes: `/workspace/gadu-review/tema/depois-claro/390-conversa.png`).

## 2026-11-23 · Tema claro por padrão, sem superfícies escuras sobrando, e ícone do app com fundo claro · publicado
- **Publicado** em 23/11/2026 às 15:11 (Brasília), PR #99, merge `c19ad1c`; CI verde (verify, e2e-public, database, e2e com login) e deploy da Vercel conferido no site.
- **Feito por:** Cursor (Grok Bot), pedido do Eduardo (14:47). Sem escolha salva, o GaDu abre no **tema claro**; quem escolheu o escuro continua no escuro (cookie `gadu_theme`). O menu lateral do computador e o palco da Conversa deixam de forçar o escuro (`on-dark`) e seguem o tema. Barra do sistema (`theme-color`) e barra de status do iPhone seguem o tema em uso, não a preferência do aparelho (`generateViewport`/`generateMetadata` no layout; `applyTheme` atualiza na hora). Ícones do app (192, 512, maskable e apple-touch) com fundo claro e a arte atual num cartão arredondado; manifest com `background_color`/`theme_color` claros (abertura do app no Android); service worker `gadu-v6` para trocar os ícones guardados. Configurações mostram Claro primeiro ("Padrão"). Voz: a ação `ajuste`/`tema` já existia ("muda para o tema escuro"); o prompt ganhou os exemplos.
- **Evidências (máquina local):** typecheck; `test:unit` (novo `theme.test.ts`); build; e2e público 10/10 e mobile 44/44 contra `next start` (claro por padrão, cookie escuro respeitado, uma `theme-color` por tema, manifest com fundo claro). Auditoria visual de 12 telas do app, escuta, login, home e offline a 390 e 1440 px, nos dois temas: `/workspace/gadu-review/tema/` (antes `antes-claro/`, depois `depois-claro/` e `depois-escuro/`, ícones `antes-*.png` e `depois-*.png`). **Não testado:** instalação real no Android/iPhone (o ícone já instalado só muda ao reinstalar ou quando o sistema atualizar).

## 2026-11-23 · UX-7 · Hoje em três faixas: Agora, Depois e Progresso · publicado
- **Publicado** em 23/11/2026 às 15:04 (Brasília), PR #97, merge `cdc37b9`; CI verde (verify, e2e-public, database, e2e com login) e deploy da Vercel conferido no site.
- **Feito por:** Cursor (Grok Bot). A tela Hoje passa a ter três faixas: **Agora** (saudação, próximo compromisso, lista do que pede atenção), **Depois** (o que ainda vem hoje: compromissos e lembretes em linha do tempo, mais as percepções do dia) e **Progresso** (anel com a fração das tarefas de hoje feitas e as metas que pedem atenção, com barra). Cada faixa tem uma frase para dizer ("O que tenho mais tarde hoje?", "Como estou nas minhas metas?") que vai para a conversa. No computador, Depois e Progresso ficam lado a lado. `src/lib/hoje-faixas.ts` (funções puras, com testes). Sem migração, sem rota nova (usa `/api/today`, `/api/goals/resumo` e a contagem de tarefas concluídas hoje, com RLS).
- **Evidências (máquina local):** typecheck; `test:unit`; build; e2e com login ampliado (as três faixas e o anel de progresso). Capturas: antes `/workspace/gadu-review/ux6/antes/*-hoje*.png`, depois `/workspace/gadu-review/ux6/depois-hoje/`.

## 2026-11-23 · 3D: ajustar peça por voz · desenvolvido e testado
- **Feito por:** Cursor (Grok Bot). Ação `peca3d_ajustar` ("deixa o suporte 2 mm mais alto", "arredonda as bordas da minha última peça"): o resolvedor acha a peça só entre as da pessoa (e só com `MODELING_3D_ENABLED=1`), o cartão mostra o pedido e avisa que usa IA do 3D; confirmado, guarda o pedido na sessão do navegador (`src/lib/3d/ajuste-voz.ts`, validade de 2 min, só para a mesma peça) e abre `/app/3d?peca=…`, onde o Studio faz o ajuste uma vez pela rota de sempre (reserva, cota, liquidação). Desfazer: "Voltar uma versão" no Studio. Sem migração.
- **Evidências (máquina local):** testes unitários (validação, resolvedor com isolamento e termo bloqueado, cartão e pergunta falada, `lerAjuste`) e a suíte inteira. **Não testado:** IA real e aparelho.

## 2026-11-23 · Privacidade: dado sensível brasileiro por dado, não por palavra · desenvolvido e testado
- **Feito por:** Cursor (Grok Bot). `src/lib/privacy.ts`: bloqueia o **dado** (CPF e CNPJ com dígitos verificadores; CPF/CNPJ formatado sempre; cartão pelo Luhn; agência e conta com número; chave Pix com a palavra Pix por perto (e-mail, telefone, chave aleatória); Pix copia e cola; senha, PIN e CVV com valor; RG, CNH e passaporte com número; chaves `sk-`, `ghp_`, `AKIA`, JWT e "token: …"). Falar de "senha", "cpf", "Pix", "cartão de crédito", "imposto de renda" ou "extrato bancário" deixa de bloquear a conversa. Saúde continua por palavra (laudo, prontuário, diagnóstico e exame médico). Sem serviço novo.
- **Evidências (máquina local):** `test:unit` 362 (casos que bloqueiam e que passam), `test:integration` 245 (`finance-chat`: a descrição "senha do wifi" sem valor agora fica; com valor, some). Sem voz nova: é uma regra, não uma função.

## 2026-11-23 · UX-7 · Ligações visíveis e Mapa do GaDu · publicado
- **Publicado** em 23/11/2026 (PR #96, merge `b9632e7`, 14:42, Brasília): CI verde (verify, e2e-public, database, e2e-auth); deploy de produção da Vercel concluído e conferido no ar (CSS novo servido em `gadu-agent.vercel.app`).
- **Feito por:** Cursor (Grok Bot). Tarefas e projetos ligados a uma meta ativa ou pausada mostram um selo com o nome da meta (`src/lib/ligacoes.ts` com testes; `src/components/links.tsx` lê `goal_tasks`/`goal_projects` com RLS; só com `GOALS_ENABLED`). No Guia, a seção **Mapa do GaDu** (`src/components/GaduMap.tsx`): conversa e voz no centro, nós que abrem cada tela e a lista das ligações, cada uma com o que dizer (frases das ações que já existem: `meta_projeto`, `meta_tarefa`, `meta_agenda`, `navegar`…). Sem ação de voz nova: as ligações já se fazem falando. Sem migração.
- **Evidências (máquina local):** typecheck; `test:unit` (ligações); build; e2e com login novo (mapa no Guia, sem rolagem lateral). Capturas em `/workspace/gadu-review/ux6/depois-ligacoes/`.

## 2026-11-23 · UX-7 · Mais e menu agrupados por áreas · publicado
- **Publicado** em 23/11/2026 (PR #95, merge `26c83f2`, 14:37, Brasília): CI verde (verify, e2e-public, database, e2e-auth); deploy de produção da Vercel concluído e conferido no ar (CSS novo servido em `gadu-agent.vercel.app`).
- **Feito por:** Cursor (Grok Bot). Tela Mais (celular) e menu lateral (computador) com os mesmos grupos: Meu dia, Vida, Agentes e criação, Conta e ajuda (`NAV_GROUPS`/`navGroups` em `src/lib/modules.ts`, com teste). Cada grupo mostra um exemplo do que dizer ("Diga: “Quanto gastei este mês?”"); os blocos mostram números (metas ativas ou atrasadas, projetos ativos, memórias a revisar). O 3D (Beta) aparece no menu do computador quando `MODELING_3D_ENABLED=1`; o catálogo passa o 3D Studio de "planejado" para "parcial". Ir a qualquer tela por voz já existia (ação `navegar`).
- **Evidências (máquina local):** typecheck; `test:unit`; build; e2e com login ampliado (grupos em Mais e no menu). Capturas em `/workspace/gadu-review/ux6/depois-mais/` (antes: `/workspace/gadu-review/ux6/antes/*-mais.png`).

## 2026-11-23 · UX-7 · Palco de voz: o avatar do GaDu grande quando ele ouve, pensa e fala · publicado
- **Publicado** em 23/11/2026 (PR #93, merge `d88bfcf`, 14:32, Brasília): CI verde (verify, e2e-public, database, e2e-auth); deploy de produção da Vercel concluído e conferido no ar (CSS novo servido em `gadu-agent.vercel.app`).
- **Feito por:** Cursor (Grok Bot). Tela de escuta com o avatar animado no topo (tela cheia no celular); Conversa do celular com o avatar de até 190 px quando vazia ou em voz, que encolhe ao digitar; palco do computador de 340 px (420 px em voz); no painel do assistente, o avatar animado cresce para 136 px (celular) ou 168 px (computador) enquanto ouve, pensa ou fala. O avatar reage ao som de verdade: `src/lib/voice-level.ts` (nível, suavização, decaimento), `src/lib/mic-meter.ts` (volume do microfone só no computador e só com a permissão já dada; nada é gravado nem enviado), cada trecho reconhecido e cada palavra falada (`onboundary`). Sem sinal, a animação de antes. CSS próprio do ciclo em `src/app/ux7.css`. Sem migração, sem ação nova de voz (só apresentação).
- **Evidências (máquina local):** typecheck; `test:unit` (inclui `voice-level.test.ts`); `test:integration`; build; e2e com login novo "palco de voz (UX-7)". Capturas antes e depois a 390 e 1440 px em `/workspace/gadu-review/ux6/antes` e `/workspace/gadu-review/ux6/depois-palco` (máquina do Grok Bot). **Não testado:** aparelho real (medidor do microfone e `onboundary` variam por navegador).

## 2026-11-23 · Agentes com ferramentas e teto de gasto próprios · desenvolvido e testado
- **Feito por:** Cursor (Grok Bot). Migração aditiva `20261123190001_agentes_ferramentas_teto` (PR #91, **aplicada** em 23/11 às 14:16, versão `20261123171612`; conferido: colunas `agents.ferramentas` e `teto_mensal_usd` com CHECKs, `agent_uso` com RLS e só a política de leitura da dona, `authenticated` só SELECT, `anon` sem acesso, `server_add_agent_usage` só para `service_role`). Código: `src/lib/agentes/ferramentas.ts`; no `/api/chat`, o teto do agente é checado **antes** da reserva, da cota e da IA (com teto e sem ler o gasto, bloqueia), as ferramentas desligadas não entram no contexto nem viram cartão, e o custo de cada resposta soma no mês do agente pelo servidor; tela Agentes com "Ferramentas e teto" e "Gasto este mês"; voz `agente_editar` com `liberar`, `bloquear` e `teto` (Desfazer volta o anterior).
- **Teto do agente é "mole":** duas mensagens ao mesmo tempo podem passar um pouco do teto (a checagem é antes, a soma é depois). O teto do mês da conta e o global continuam atômicos.
- **Evidências (máquina local):** typecheck; `test:unit` 359; `test:integration` 245 (inclui `test/agentes-ferramentas.integration.test.ts`: bloqueio antes da reserva, fail closed, soma só pelo servidor, agente de B não vale para A, contexto e cartões sem as ferramentas desligadas, e-mail não lido sem a ferramenta). **Não testado:** IA real, aparelho.

## 2026-11-23 · Percepções com Aceitar/Ignorar (Hoje, voz, briefing) · desenvolvido e testado
- **Feito por:** Cursor (Grok Bot). Migração aditiva `insight_respostas` (PR #89) e código: painel "O GaDu percebeu" na tela Hoje, ação por voz `percepcao`, rotas `POST /api/insights` e `/api/insights/desfazer`, filtro do que já foi respondido no briefing e no chat.
- **Evidências (máquina local):** typecheck; `test:unit` 351; `test:integration` 239 (inclui `test/insights.integration.test.ts`: 401, zod estrito, B não mexe no que é de A, Desfazer exato); `scripts/test-db.sh` ok. **Não testado:** Google real, aparelho.

## 2026-11-23 · Metas fase 2: agenda da meta · desenvolvido e testado
- **Feito por:** Claude Code (rascunho) e Cursor (Grok Bot) (revisão, testes, docs, PR), depois que o Claude Code atingiu o limite de uso. Ação por voz `meta_agenda` com horários escolhidos pelo servidor, pulando compromissos; cartão com os horários; eventos criados no Google só depois do "sim" (escopo `calendar.events`, já existente); Desfazer libera os blocos; painel "Agenda da meta" com Liberar. Reservar não conta como progresso. Migração `metas_fase2` aplicada às 13:11.
- **Evidências (máquina local):** `npm run typecheck`, `test:unit`, `test:integration` (inclui `test/goals-agenda.integration.test.ts`: 401, `GOALS_ENABLED=0`, B não reserva nem libera em meta de A, desfazer parcial). **Não testado:** Google real, aparelho.

## 2026-11-23 · Agentes por voz com Desfazer · desenvolvido e testado
- **Feito por:** Cursor (Grok Bot). Regra UX-4 ("Feito · Desfazer" em toda ação que grava): criar agente pela conversa agora pode ser desfeito (apaga o agente recém-criado; conversas ligadas ficam sem agente) e editar volta nome, área, instruções e ativo de antes. Sem migração. Teste `test/desfazer.test.ts` cobre as duas ações.

## 2026-11-23 · Finanças: teto por categoria e acumulado do ano · desenvolvido e testado
- **Feito por:** Cursor (Grok Bot). Migração aditiva `20261123160001_fin_tetos` (PR #81) e código (`feat/fin-tetos-app`): aba "Tetos e ano" no Financeiro, aviso na tela Hoje a partir de 80%, `GET/PUT/DELETE /api/finance/tetos`, `GET /api/finance/ano`, voz `teto_definir` com confirmação e Desfazer, perguntas "quanto gastei … este ano" respondidas com fatos somados no servidor.
- **Evidências (máquina local):** `npm run typecheck`; `test:unit` e `test:integration` verdes (inclui `test/finance-tetos.integration.test.ts`); `scripts/test-db.sh` ok. **Não testado:** no aparelho, com a IA real.

## 2026-11-23 · Tudo por voz: criar e editar agentes · desenvolvido e testado
- **Feito por:** Claude Code. "Cria um agente para as finanças da casa" e "muda as instruções do Mentor", "desativa o agente de estudos": ações `agente_criar` e `agente_editar` (cartão que mostra as instruções, "sim" falado, nome repetido e área fora da lista avisam). Só agentes da própria pessoa; termos bloqueados valem para nome e instruções. A frase de exemplo do estado vazio de Agentes agora usa a ação nova.
- **Testes:** unit 334, integração 221 após o rebase (agentes de outra pessoa nunca viram cartão, nada gravado antes de confirmar, termo bloqueado), build, e2e.
- **Sobrou:** apagar agente por voz (matriz, seção 11).

## 2026-11-23 · Telemetria de erros: rota, captura, Admin e alerta · desenvolvido e testado
- **Feito por:** Claude Code. Registro gratuito dos erros do servidor e do navegador na tabela `error_events` (sem mensagem nem dado pessoal), lista no Admin e alerta diário por issue do GitHub. Interruptor `TELEMETRIA_ENABLED`. docs/OBSERVABILIDADE.md traz também o que a Vercel dá de graça (logs de 1 h no Hobby, 1 dia no Pro).
- **Testes:** unit 322, integração 214 (401, user_id da sessão, campo extra recusado, limite 30/10 min, tabela ausente, interruptor, Admin só admin, token do resumo), build, e2e público 10/10 e mobile 44/44.

## 2026-11-23 · e2e com login no CI contra Supabase local · desenvolvido e testado
- **Feito por:** Claude Code. Workflow `e2e-auth.yml` (PR, diário às 06:00 de Brasília e manual) + `scripts/e2e-auth-local.sh`: `supabase start` no runner, usuário de teste com senha aleatória, app apontando para o banco local, `npm run test:e2e:auth`. **Sem credenciais de produção.** 17 de 17 no CI.
- **Correções que o teste com banco de verdade achou:** `connect-src` da CSP aceita `http`/`ws` só para Supabase em localhost (`src/lib/csp-connect.ts`); `.link-btn` com 44 px (o "Pular o guia" tinha 40 px no desktop); testes de guia e de Hoje atualizados (UX-4).
- **Testes:** unit 307, integração 196, build, e2e público 10/10 e mobile 44/44 locais; `e2e-auth` 17/17 no CI.

## 2026-11-23 · Telemetria de erros: migração da tabela `error_events` · desenvolvido e testado (não aplicada)
- **Feito por:** Claude Code. Migração aditiva `20261123110001_telemetria_erros.sql`: só o servidor escreve, só administrador lê, sem texto de mensagem nem dados pessoais. Aplicada depois pelo Cursor (MCP).
- **Testes:** `bash scripts/test-db.sh` passou (novo `80_telemetria.test.sql` e a tabela em `30_isolamento`).

## 2026-11-23 · 3D: peças e versões salvas · publicado
- **Feito por:** Cursor (Grok Bot), pedido do Eduardo às 10:54 (o histórico sumia ao fechar o app).
- Cada peça gerada fica salva com as últimas 30 versões e as medidas dos controles; "Suas peças" na tela 3D (abrir, apagar, nova peça); "abre a minha última peça" pela conversa, com confirmação.
- **Migração aditiva** `20261123140001_pecas_3d` (PR #78), aplicada pelo MCP; RLS só da própria pessoa. Também aplicada a `20261123110001_telemetria_erros` (PR #76, do Claude Code).
- **Testes:** `supabase/tests/90_pecas_3d.test.sql` e `30_isolamento`; `src/lib/3d/pecas.test.ts`; `test/studio3d-pecas.integration.test.ts` (401, interruptor, isolamento, 30 versões, cascata); voz em `acoes`, `chat-actions` e `acoes-resolver`.

## 2026-11-23 · 3D Studio (Beta) ligado em produção
- O Eduardo definiu `MODELING_3D_ENABLED=1` na Vercel por volta das 09:37 (Brasília) e fez o redeploy. Sem mudança de código. Registrado por Cursor (Grok Bot).

## 2026-11-23 · Tudo por voz: criar conta ou receita e definir a receita principal · desenvolvido e testado
- **Feito por:** Cursor (Grok Bot).
- "Cria uma conta de água de 90 reais todo dia 10" ou "adiciona a receita de aluguel": cartão "Conta nova" (grupo, valor, dia; "todo mês" vale até dezembro) que usa a mesma rota da tela (`POST /api/finance/itens`) e tem Desfazer. "Meu salário principal é o da empresa": acha a receita da própria pessoa e define como principal (`PUT /api/finance/config`), com Desfazer que volta a anterior. Termos bloqueados e `FINANCE_ENABLED=0` respeitados.
- **Testes:** `acoes.test.ts`, `chat-actions.test.ts`, `test/finance-chat.integration.test.ts` (receita de outra pessoa nunca, nada gravado antes de confirmar); integração 195/195.

## 2026-11-23 · Tudo por voz: apagar um registro de progresso de meta · desenvolvido e testado
- **Feito por:** Cursor (Grok Bot).
- "Apaga o último registro da meta de corrida" ou "aquele de 5 km de ontem foi engano": acha o registro da própria pessoa (o mais recente, ou pelo valor e data) e mostra o cartão "Apagar registro?" com "sim" falado; usa a rota `DELETE /api/goals/:id/progresso/:pid` da tela. Sem Desfazer (o cartão avisa). `GOALS_ENABLED=0` desliga.
- **Testes:** `acoes.test.ts`, `chat-actions.test.ts`, `test/goals-chat.integration.test.ts` (registro de outra pessoa nunca aparece, nada apagado antes do "sim", interruptor); integração 194/194.

## 2026-11-23 · Tudo por voz: abrir uma conversa anterior pela conversa · desenvolvido e testado
- **Feito por:** Cursor (Grok Bot), enquanto a cota do Claude Code estava esgotada.
- "Abre a conversa sobre o condomínio" acha, entre as conversas da própria pessoa, a do título ou resumo (ou a mais recente na busca por texto) e mostra o cartão "Abrir esta conversa?" com "sim" falado; a conversa atual fica no histórico. Não acha: aviso "Ela pode estar no Histórico". Termos bloqueados não aparecem. Nada é gravado.
- **Testes:** `acoes.test.ts`, `chat-actions.test.ts`, `acoes-resolver.test.ts` (só conversas da pessoa, nada de outra) e `test/goals-chat.integration.test.ts`; typecheck; integração 193/193.

## 2026-11-23 · Tudo por voz: velocidade da fala e trocar a voz pela conversa · desenvolvido e testado
- **Feito por:** Cursor (Grok Bot), enquanto a cota do Claude Code estava esgotada.
- "Fala mais devagar", "fala mais rápido", "volta a velocidade normal" e "usa outra voz" viram o cartão de ajuste com "sim" falado (`ajuste` com `velocidade` de 0,7 a 1,6 ou relativo, de 0,15 em 0,15; `voz_trocar` passa para a próxima voz em português do aparelho). Vale neste aparelho, como em Configurações; nada é gravado no servidor.
- **Testes:** casos novos em `acoes.test.ts`, `chat-actions.test.ts` e `test/goals-chat.integration.test.ts` (valor fora do intervalo é descartado, nada gravado); typecheck; integração 192/192.

## 2026-11-23 · S-05 (resto): pessoa bloqueada não insere nem altera dados pelo banco · **aprovado pelo Eduardo (11:17) e aplicado**
- **Feito por:** Claude Code (migração e testes, PR #74) e Cursor (Grok Bot: mudança pedida pelo Eduardo, conferência e aplicação em produção).
- Mudança do Eduardo: quem está bloqueado **pode apagar** os próprios dados; só insert e update exigem `public.can_write()`. 20 tabelas (inclui `pecas_3d` e `pecas_3d_versoes`), 40 políticas restritivas + 2 de `reminders` (conversa própria). Migração renomeada para `20261123150001` (depois de `pecas_3d`). Teste `supabase/tests/85_s05_escrita_por_acesso.test.sql`.
- **Antes de aplicar:** produção sem políticas restritivas nem nomes em conflito; gatilhos só de `updated_at` e de vínculo; 0 lembretes com conversa de outra pessoa; ensaio numa transação desfeita (usuário de teste ativo grava, bloqueado recebe 42501; nada ficou).
- **Aplicada em produção às 11:31 (Brasília)**; conferido depois: 42 políticas restritivas, nenhuma de delete, contas ativas gravam normalmente.

## 2026-11-23 · S-05 (resto): RLS de escrita por acesso (Claude Code) · rascunho (histórico)
- Migração `20261123150001_s05_escrita_por_acesso.sql`: `public.can_write()` e políticas **restritivas** de insert, update e delete em 18 tabelas (pessoa bloqueada não grava e ainda lê), mais `reminders.conversation_id` só da própria pessoa. Rollback no cabeçalho, executado no teste.
- **Testes (Postgres local):** `scripts/test-db.sh` inteiro verde, com `supabase/tests/85_s05_escrita_por_acesso.test.sql`. **Não aplicado no Supabase de produção.**

## 2026-11-23 · Auditoria de RLS e escrita por acesso (Claude Code) · publicado (só documentação)
- `docs/SECURITY_AUDIT_2026-11-23.md`: inventário das 26 tabelas de `public` e das funções, matriz "pessoa bloqueada tenta gravar" (18 tabelas aceitam insert, update e delete), sondagem de chaves entre pessoas (achado: `reminders.conversation_id` aceita conversa de outra pessoa) e recomendações. Medido em Postgres local descartável; **nada foi aplicado no Supabase de produção**.

## 2026-11-23 · Revisão cruzada (Claude Code): busca por significado voltava sempre desligada (PR `fix/revisao-cursor-busca-balde`) · desenvolvido e testado
- **Feito por:** Claude Code, revisando os PRs do Cursor (#32, #34 a #36, #65, #67 a #70).
- **Achado real no #65:** o balde `search_user` não consta no `CHECK` de `private.rate_limits`; o banco recusava o insert e, como o limite é fail closed, `/api/search` nunca chamava os embeddings. Agora usa o balde permitido `verify_email` com chave própria (`search-user`). Sem migração.
- **Teste:** `test/search-limit.integration.test.ts` ganhou um caso que lê o `CHECK` da migração e confere o balde usado.

## 2026-11-23 · Revisão cruzada: limite de custo na busca por significado (PR fix/revisao-antigos-busca) · desenvolvido e testado
- **Feito por:** Cursor (Grok Bot), na revisão do PR #22 (Claude Code).
- `/api/search` chamava os embeddings pagos do AI Gateway a cada busca, sem cota nem limite. Agora conta por pessoa (hash do id) na tabela de janelas do limite de tentativas: até 60 buscas por 10 minutos; acima disso, ou sem o contador, **não chama a IA** (fail closed) e a tela de Memória segue com a busca por texto. Sem migração.
- **Testes:** `test/search-limit.integration.test.ts` (3 casos); typecheck; 294 unitários e 191 de integração, 0 falhas.

## 2026-11-23 · Financeiro: simulador de salário bruto → líquido · **publicado** (Claude Code) (PR #63, branch `feat/financas-simulador`)
- **Novo:** `src/lib/finance/salario.ts`, cálculo puro em centavos (INSS progressivo faixa a faixa com teto de R$ 8.475,55; IRRF com dedução por dependente e desconto simplificado de R$ 607,20 quando mais vantajoso; redução da Lei 15.270/2025; imposto de até R$ 10 não retido). Tabelas de 2026 conferidas nas fontes oficiais (INSS: Portaria Interministerial MPS/MF nº 13, de 09/01/2026; Receita Federal: tabela mensal 2026; Planalto: Lei 15.270/2025), citadas no código e em `docs/FEATURE-FINANCAS.md`. Aba "Salário" no Financeiro (`SalarioSimulador.tsx`) com passo a passo, fontes e "Salvar como salário do mês" (com Desfazer).
- **Por voz (regra 8.1):** ação `salario_simular` no bloco "acoes". "Quanto fica líquido um salário de 8 mil?": o servidor reconhece o pedido (`pedidoSalario`), calcula, põe o resultado no contexto do modelo ("use só estes números") e manda o cartão; o valor e os dependentes do cartão são os ditos pela pessoa, não os repetidos pelo modelo. Com `salvar`, o cartão pede confirmação e grava o líquido na receita principal do mês (sem receita principal, só mostra o cálculo e avisa). Sem migração.
- **Evidência (máquina local):** typecheck; unit 294 (8 testes de faixas contra valores de referência calculados à parte em Decimal, mais texto, ação, cartão, resolver); integração 188 (7 novos: contexto com o cálculo, cartão sem gravar, dependentes, receita principal só da própria pessoa, interruptor, custo por limites → reserva → cota → IA); build; `scripts/test-db.sh` ok; e2e público e mobile contra `next start`; capturas a 390 e 1440 em `/workspace/gadu-review/ux-after/` (40 a 43) com dados fictícios (R$ 8.000 → R$ 6.040,64; PUT do salvar conferido). **Publicação:** PR #63, merge `e7c3d5d` em 23/11/2026 às 09:07 (Brasília), CI verde (verify, e2e-public, database), status do commit `success` (Vercel), `/login` 200 e `/api/finance/resumo` 401 sem sessão no ar. **Não testado:** IA real (o modelo respeitar "não calcule" e usar a ação), login no Supabase real, aparelho.

## 2026-11-23 · UX-5: consistência entre módulos (PRs A a C) · **publicado** (Claude Code)
- **PR A #58** `feat/ux5-padrao-modulo`, merge `a70152a` às 08:03: padrão único de tela de módulo (título e frase, uma ação principal, resumo, lista, vazio com frase de exemplo e "Falar com o GaDu") em Tarefas, Projetos, Metas, Financeiro, Memória, Agentes e no painel Lembretes. Saíram "Perguntar ao GaDu" do topo de Metas e Financeiro, o painel "Pela voz" de Tarefas e o "Criar do zero" de Agentes.
- **PR B #59** `feat/ux5-cartao-unico`, merge `8f637ac` às 08:13: `ConfirmCard`/`CardFrame` (`src/components/ConfirmCard.tsx`) como cartão único: `ActionCard`, `ConfirmSheet` (a tela de escuta mostra o mesmo cartão) e os pedidos de apagar, arquivar e desconectar de Projetos, Agentes, Metas, Financeiro, Conversas e Configurações. Teste novo `src/lib/confirm-card.test.ts`.
- **PR C #60** `feat/ux5-design-system-2`, merge `a211d40` às 08:44: 67 estilos inline estáticos viraram utilitários com tokens; `Field` e `BackButton`; `v2.css` e `globals.css` sem seletor repetido no nível de cima; `docs/DESIGN_SYSTEM.md` 2.3. Teste novo `src/lib/design-system.test.ts`.
- **Verificado de fato (em cada PR):** typecheck, unit (273 → 276 → 278), integração 181, build, e2e público 10/10 e mobile 44/44 contra `next start`; CI verde (verify, e2e-public, database) e status do commit `success` na `main`; `/login` 200 depois de cada merge. No PR C, comparação dos estilos computados de 15.277 elementos (14 telas, 5 larguras de 412 a 1700 px) da `main` contra a branch: 0 diferenças. Capturas a 412 × 915 e 1440 em `/workspace/gadu-review/ux-after/` (30 a 90). Sem migração; `scripts/test-db.sh` não rodou (o job `database` do CI passou).
- **Não verificado:** nada com login no Supabase real e nada no aparelho.

## 2026-11-23 · UX-4, PR D: primeiro uso guiado e falado em 3 passos · **publicado** (PR #55, merge `36a41fb`, 07:29) (branch `feat/ux4-primeiro-uso`)
- **Feito por:** Claude Code.
- **Novo:** `Onboarding` (`src/components/Onboarding.tsx`, regras em `src/lib/onboarding.ts`): passo 1, nome (grava `profiles.display_name`); passo 2, testar a voz do GaDu e o microfone (mostra o que ouviu); passo 3, conectar o Google (pelo fluxo que já existe; se já conectado, só conclui). O GaDu **fala** cada passo (se a voz está ligada; "Ouvir de novo" para quem o navegador só deixa falar depois de um toque). Pode ser **pulado** a qualquer momento; **Voltar do Android fecha** (uma camada no histórico, como as outras). Abre sozinho só para **pessoa nova** (sem a marca do guia e sem nenhuma dica vista); quem passa pelo guia não vê as dicas soltas de cada tela. **Refazer:** Configurações → Ajuda → "Ver o guia de primeiro uso" e por voz.
- **Por voz (regra 8.1):** ação nova `guia` no bloco "acoes" ("me mostra o guia de novo", "como o GaDu funciona?"): abre o guia na hora, sem cartão e sem gravar (como `navegar`); resolvida sem ler o banco; pergunta falada "Abro o guia?" caso venha como cartão.
- **Preferência:** `profiles.settings.onboarding = { v, status: done|skipped, at }`, como `tips` e `blocked`. **Sem migração.**
- **Evidência:** typecheck; unit (`onboarding.test.ts` novo, `guia` em `acoes`, `chat-actions`, `acoes-resolver`); integração (`test/primeiro-uso.test.ts`; `guia` em `goals-chat`: sem leitura nem gravação, vale com Metas e Financeiro desligados); build; e2e público e mobile; capturas a 412 × 915 em `ux-after/30` a `32` (passos 1 a 3, erro ao salvar o nome), com Voltar do Android fechando, Pular e refazer por Configurações conferidos no navegador com dados fictícios. **Não testado:** gravação real do nome e da marca (a máquina não tem login no Supabase), fala e microfone de verdade no aparelho, e o e2e com login novo (escrito sem rodar; os testes com login agora pulam o guia sozinhos).
- **Publicação:** PR #55, merge `36a41fb` em 23/11/2026 às 07:29 (Brasília), CI verde (verify, e2e-public, database), deploy da Vercel `success`, `/login` 200.

## 2026-11-23 · UX-4, PR C: erros claros, com o que fazer agora · **publicado** (PR #54, merge `a79578f`, 07:18) (branch `feat/ux4-erros`)
- **Feito por:** Claude Code.
- **Novo:** catálogo único de mensagens em `src/lib/errors.ts` (`MSG`, `loadFailed`, `actionFailed`, `chatFailure`, `spokenFailure`, `parseRetryCommand`, `RETRY_LABEL`); as telas (Configurações, Tarefas, Hoje, Projetos, Agentes, Metas, Financeiro, Memória, Agenda, Conversas, Administração e cartões) deixaram de escrever a frase à mão. Sem internet na conversa: "Sem internet. Sua mensagem ficou guardada." com o botão **Tentar de novo** (a mensagem fica no campo de texto), no painel e na Conversa; cartão com erro mostra o motivo e o botão vira "Tentar de novo".
- **Por voz:** quem está falando **ouve** o erro (mais "Para repetir, diga: tenta de novo"), e dizer ou escrever "tenta de novo" reenvia a última mensagem que falhou, sem IA; falha de cartão na confirmação falada fala o motivo; erros do microfone também são falados (menos "não ouvi nada"). A faixa sem internet agora diz "suas mensagens ficam guardadas".
- **Evidência:** typecheck; testes unitários (`errors.test.ts`: toda frase do catálogo é curta, em português e diz o que fazer; `voice-confirm.test.ts`) e de integração (`test/erros.test.ts`: nenhuma tela repete as frases soltas); build; e2e público e mobile; capturas a 412 × 915 em `ux-after/28` e `29` (modo avião no navegador: aviso, rascunho guardado, "tenta de novo" reenvia). Sem migração. **Não testado:** voz de verdade (fala do erro) no aparelho e erros com Supabase real.
- **Publicação:** PR #54, merge `a79578f` em 23/11/2026 às 07:18 (Brasília), CI verde (verify, e2e-public, database), deploy da Vercel `success`, `/login` 200.

## 2026-11-23 · UX-4, PR B: "Feito · Desfazer" em toda ação que grava · **publicado** (PR #53, merge `850f01b`, 07:09) (branch `feat/ux4-desfazer`)
- **Feito por:** Claude Code.
- **Novo:** um aviso só, `UndoToast` (montado uma vez em `GaduApp`), com a lógica em `src/lib/undo.ts` (8 s; um aviso novo troca o anterior; erro de desfazer avisa). Usado por: lista "Merece sua atenção", Tarefas (concluir, reabrir, remover), lembretes do Hoje (feito, cancelar), Revisão do dia (amanhã, feito, sem prazo, tudo para amanhã), Financeiro (conta paga, gasto apagado recria o gasto), Metas (pausar, retomar, concluir, reabrir, arquivar, marco), Memória (aprovar) e **cartões da conversa** (tarefa feita/cancelada/reaberta/adiada/editada, lembrete adiado/cancelado, memória aprovada, projeto arquivado, conta paga/desmarcada, marco, mudança de status da meta, gasto e evento criados). O app guarda o estado anterior antes de gravar.
- **Por voz:** dizer ou escrever "desfaz" (também "desfazer isso", "volta atrás", "foi sem querer") desfaz a última ação enquanto o aviso está à mão; resolvido no app, sem modelo e sem custo (`parseUndoCommand`).
- **Sem Desfazer, de propósito:** apagar memória, apagar gasto ou evento pela conversa e nova conversa (o cartão já pede o "sim"). Sem migração.
- **Evidência:** typecheck; unit 259/259 (`undo.test.ts` novo, 8 testes); integração 172/172 (`test/desfazer.test.ts` novo); build; e2e público 10/10; capturas a 412 × 915 em `ux-after/26` e `27` (Feito → Desfazer devolve o item à lista; "desfaz" digitado na conversa desfaz sem abrir bolha nem chamar a IA). **Não testado:** com Supabase real e login; o Desfazer dos cartões da conversa só foi lido e tipado, não executado no navegador.
- **Publicação:** PR #53, merge `850f01b` em 23/11/2026 às 07:09 (Brasília), CI verde (verify, e2e-public, database), deploy da Vercel `success`, `/login` 200.

## 2026-11-23 · UX-4, PR A: linguagem simples e menos escolhas · **publicado** (PR #52, merge `ed64dc0`, 06:57) (branch `feat/ux4-linguagem`)
- **Feito por:** Claude Code.
- **Mudou:** sem rótulos "Beta", "Pessoal", "Agent Office" e "Plataforma" no cabeçalho de Metas, Financeiro, Tarefas, Projetos, Agenda, Memória, Agentes e Administração; a bolha do GaDu mostra só "GaDu" (o modelo vai para o título) e esconde as etiquetas [T1]/[M1] do texto (continuam em "Fontes"); a dica da Conversa não diz mais "Beta"; Hoje fica com 1 ação principal ("Falar com o GaDu") e 1 secundária ("Começar o dia"), e "Peça com um toque" e "Ver tudo" passam para "Mais opções" (recolhido); o botão repetido "Perguntar ao GaDu" saiu da lista de atenção; a versão do app fica em "Detalhes" em Configurações; texto de custo sem "tokens". Só interface, sem ação nova pela conversa (nada grava) e sem migração.
- **Fora:** o selo "Beta" da entrada do 3D em Mais (frente 3D, desligada em produção).
- **Evidência:** typecheck; unit 251/251; integração 168/168 (`test/linguagem.test.ts` novo); build; e2e público 10/10 e mobile 44/44; capturas a 412 × 915 em `/workspace/gadu-review/ux-after/20` a `25`.
- **Publicação:** PR #52, merge `ed64dc0` em 23/11/2026 às 06:57 (Brasília), CI verde (verify, e2e-public, database), deploy da Vercel `success`, `/login` 200.

## 2026-11-23 · Tudo por voz, PR D: memória, nova conversa e navegação · **publicado** (PR #50, merge `4a7f9c3`, 06:32)
- **Feito por:** Claude Code.
- **Novo pela conversa:** `memoria_aprovar` (uma ou todas as pendentes), `memoria_recusar` e `memoria_esquecer` (cartão + "sim"; apagar avisa que não dá para desfazer; só acham memórias da própria pessoa e do estado certo), `nova_conversa` (cartão + "sim") e `navegar` ("abre o Financeiro", "vai para Metas", "mostra minhas tarefas": abre a tela **na hora, sem cartão e sem gravar**; Financeiro e Metas desligados pelos interruptores não abrem; Admin e telas em desenvolvimento não abrem pela conversa). O app separa a navegação dos cartões em `splitNavegacao` (`src/lib/chat-actions.ts`) e trata `nova_conversa` e a atualização do contador de memórias em `cardOp` (`GaduApp.tsx`).
- **Publicação:** PR #50, merge `4a7f9c3` em 23/11/2026 às 06:32 (Brasília), CI verde (verify, e2e-public, database), deploy da Vercel `success`, `/login` 200.
- **Evidência:** typecheck; unit 251/251; integração 165/165 (2 testes novos em `goals-chat`); build; e2e público 10/10 e mobile 44/44. Sem migração. **Não testado:** navegar e conversa nova **no navegador** (o e2e com login não roda aqui), nem a IA real.
- **Publicação do PR C (registrada aqui):** PR #49, merge `d3c9955` em 23/11/2026 às 06:14 (Brasília), CI verde (verify, e2e-public, database), deploy da Vercel `success`, `/login` 200.

## 2026-11-23 · Tudo por voz, PR C: metas (pausar, retomar, arquivar, editar) e projetos (editar, arquivar) · **publicado** (PR #49, merge `d3c9955`, 06:14)
- **Feito por:** Claude Code.
- **Novo pela conversa (cartão + "sim" falado; nada é gravado antes):** `meta_pausar`, `meta_retomar`, `meta_arquivar` (nada é apagado), `meta_editar` (título, alvo só em meta numérica, prazo), `projeto_editar` (nome, objetivo) e `projeto_arquivar`. As metas respeitam `GOALS_ENABLED`; o projeto não depende dele. Gravações pelas mesmas rotas e consultas das telas (`PATCH /api/goals/:id`; `projects` pela sessão, com RLS).
- **Decisão:** "arquivar projeto" grava o status `done` ("Concluído"), porque a tabela só tem `active`, `paused` e `done`; um status "arquivado" exigiria migração e não foi feito.
- **Evidência:** typecheck; unit 246/246; integração 163/163 (3 testes novos em `goals-chat`: cartões sem gravar, isolamento entre pessoas, interruptor e termo bloqueado); build; e2e público 10/10 e mobile 44/44. Sem migração. **Não testado:** IA real.
- **Publicação do PR B (registrada aqui):** PR #48, merge `7db56d4` em 23/11/2026 às 06:02 (Brasília), CI verde (verify, e2e-public, database), deploy da Vercel `success`, `/login` 200 e `DELETE /api/calendar/:id` sem sessão = 401 no ar.

## 2026-11-23 · Tudo por voz, PR B: finanças (conta e gasto) e agenda (editar e apagar evento) · **publicado** (PR #48, merge `7db56d4`, 06:02)
- **Feito por:** Claude Code.
- **Novo pela conversa (cartão + "sim" falado; nada é gravado antes):** `conta_desmarcar`, `conta_valor` (este mês ou até dezembro), `gasto_editar`, `gasto_apagar`, `evento_editar`, `evento_apagar`. Apagar tem confirmação explícita ("não dá para desfazer" no cartão e na pergunta falada). Gasto: valor, nome e dia ajudam a achar; se couber em mais de um, o GaDu pede mais detalhe em vez de escolher. Finanças desligado (`FINANCE_ENABLED=0`) não gera cartão de conta nem de gasto.
- **Agenda:** o escopo OAuth atual (`calendar.events`, já pedido para criar evento) permite editar e apagar, então **o OAuth não mudou**. Rotas novas `PATCH` e `DELETE /api/calendar/:id` (sessão, zod estrito, token da própria pessoa) e `updateEvent`/`deleteEvent` em `src/lib/google.ts`. O servidor lê a agenda (ontem a 45 dias) só para achar o evento pelo nome.
- **Evidência:** typecheck; unit 242/242; integração 160/160 (4 testes novos em `finance-chat`, `calendar-write.integration.test.ts` novo); build; e2e público 10/10 e mobile 44/44; rota nova sem sessão = 401 contra `next start`. Sem migração. **Não testado:** Google real (evento de verdade) e IA real.
- **Publicação do PR A (registrada aqui):** PR #47, merge `3eed4eb` em 23/11/2026 às 05:49 (Brasília), CI verde (verify, e2e-public, database), deploy da Vercel `success`, site no ar (`/login` 200).

## 2026-11-23 · Tudo por voz, PR A: tarefas (cancelar, reabrir, editar) e lembretes (adiar) · **publicado** (PR #47, merge `3eed4eb`, 05:49)
- **Feito por:** Claude Code.
- **Novo pela conversa (proposta com cartão e "sim" falado; nada é gravado antes):** `tarefa_cancelar`, `tarefa_reabrir`, `tarefa_editar` (título, prioridade, prazo, projeto pelo nome) e `lembrete_adiar` ("me lembra daqui a 1 hora", "adia para amanhã às 9"). Nomes só entre os itens da própria pessoa (sessão + `user_id`); título bloqueado não vira cartão. As gravações são as mesmas consultas das telas, com a sessão e a RLS. Sem migração.
- **Evidência:** typecheck; unit 235/235; integração 152/152 (3 testes novos: cartões sem gravar, isolamento entre pessoas, interruptores desligados); build; e2e público 10/10 e mobile 44/44 contra `next start`. `scripts/test-db.sh` não rodou (sem mudança de banco).

## 2026-11-23 · Revisão dos PRs de 22/11 e correção da confirmação falada · **testado** (PR de `fix/revisao-23-11`)
- **Feito por:** Claude Code.
- **Corrige:** o "sim" falado com negação ou pausa ("claro que não", "sim, espera") não grava mais; "muda para…" num item que o servidor já criou (lembrete) agora o desfaz em vez de duplicar.
- **Revisão (sem bug real):** #38, #42, #44 e a parte de segurança e custo do #40 (3D-1).
- **Evidência:** typecheck, unit 229/229, integração 149/149, build, e2e público e mobile contra `next start`. Sem migração.

## 2026-11-22 · UX-4 (começo) · Alvos de toque de 48 px no celular (PR #44, merge `a881411`) · **publicado**
- **Feito por:** Cursor (Grok Bot).
- **Estágio:** **publicado** em 22/11/2026 às 21:26 (Brasília), PR #44, merge `a881411`. CI verde (verify, e2e-public, database); deploy Vercel `success`; `--touch:48px` conferido no CSS do site no ar.
- No celular (até 1023 px) e em telas de toque, `--touch` passa de 44 para 48 px, e botões pequenos, chips, abas (inclusive as de Metas, que tinham 36 px), botões redondos, campos e o "Pular para o conteúdo" seguem o mínimo de 48 px. O computador com mouse não muda. Só CSS (`src/app/ux.css`).
- **Testes executados (22/11/2026):** auditoria com Playwright a 412 × 915 em 11 telas (Hoje, Conversa, Tarefas, Mais, Configurações, Financeiro, Metas, Projetos, Memória, Agenda, Lembretes): de 70 alvos abaixo de 48 px para 0 (os 6 restantes são as caixas escondidas dos interruptores, cujo alvo é a linha inteira), sem rolagem lateral; typecheck; 228 unitários e 149 de integração; build; e2e mobile 44/44 e público 10/10 contra `next start`.

## 2026-11-22 · Tudo por voz: ações de todos os módulos pela conversa, com confirmação (PR #42, merge `61334a1`) · **publicado**
- **Feito por:** Cursor (Grok Bot). Pedido do Eduardo às 20:43: "tudo no GaDu precisa poder ser feito por voz ou pela conversa".
- **Estágio:** **publicado** em 22/11/2026 às 21:11 (Brasília), PR #42, merge `61334a1`. CI verde (verify, e2e-public, database); deploy Vercel `success` (status do GitHub). Ainda não validado com pessoa logada em aparelho nem com a IA real.
- **O que a conversa passa a fazer (sempre como proposta; a pessoa confirma com um toque ou dizendo "sim"):** criar meta (número, percentual, marcos ou tarefas); registrar progresso e concluir meta pelo nome; adicionar e concluir marco; criar tarefa da meta; concluir e adiar tarefa; cancelar lembrete; marcar a conta do mês como paga ("paguei a luz"); criar projeto; ajustes do aparelho (tamanho do texto, conversa contínua, respostas curtas, resposta falada, tema). Tarefa anotada pela conversa vira cartão com **Desfazer**.
- **Como:** bloco de controle `"acoes"` com validação estrita (`src/lib/acoes.ts`, regras no prompt estável); o servidor resolve os nomes para ids só entre os itens da pessoa, com o cliente da sessão e `user_id` (`src/lib/acoes-resolver.ts`), respeitando `GOALS_ENABLED`, `FINANCE_ENABLED` e os termos bloqueados; o que não acha vira aviso. As gravações são as mesmas rotas e consultas das telas, com a sessão da pessoa. Sem migração.
- **Correção junto:** o estado dos cartões passou a morar no app, então a confirmação falada funciona mesmo quando o cartão não está à vista no painel do celular.
- **Testes executados (22/11/2026):** `npm run typecheck`; `npm test` 228 unitários e 149 de integração, 0 falhas (novos `acoes.test.ts`, `acoes-resolver.test.ts`, casos em `chat-actions.test.ts`, 4 em `goals-chat` e 2 em `finance-chat`, incluindo isolamento entre pessoas e interruptores); `npm run build`; Playwright a 412 × 915 com voz simulada (criar meta, conta paga, concluir tarefa, texto Maior, Desfazer da tarefa, toque no cartão sem voz).
- **Lacunas registradas** na matriz "Tudo por voz" (docs/FEATURE_MATRIX.md, seção 11). Regra nova para toda função: [AGENTS.md](AGENTS.md), seção 8.1.

## 2026-11-22 · UX-3 · Confirmações faladas e respostas faladas curtas (PR #39, merge `87ab3bf`) · **publicado**
- **Feito por:** Cursor (Grok Bot).
- **Estágio:** **publicado** em 22/11/2026 às 20:59 (Brasília), PR #39, merge `87ab3bf` (refeito sobre a `main` depois do PR #40, com o CI verde de novo). CI verde (verify, e2e-public, database); deploy Vercel `success`; CSS novo (`confirm-sheet`) conferido no site no ar.
- **Confirmações faladas:** quando a mensagem foi falada e a voz da resposta está ligada, o GaDu lê o que vai gravar (gasto, meta, evento, lembrete) e espera "sim", "não" ou "muda para…". Tela com a pergunta em letra grande e botões Sim/Não grandes; sem resposta, pergunta de novo e depois deixa o cartão; Voltar e Esc fecham sem gravar. Lembrete criado vira cartão com Desfazer.
- **Respostas faladas curtas:** fala cerca de 20 s e diz "O resto está na tela"; opção em Configurações › Voz (ligada por padrão); o briefing fala inteiro; o prompt pede a resposta direta em 1 ou 2 frases primeiro.
- **Código:** `src/lib/voice-confirm.ts`, `src/lib/chat-actions.ts`, `ActionCard.tsx` (substitui `EventCard`, `GastoCard` e `MetaCard`), `ConfirmSheet.tsx`, `Speaker.maxChars` em `src/lib/speech.ts`.
- **Testes executados:** typecheck; `npm test` 184 unitários e 126 de integração, 0 falhas; build; Playwright com voz simulada (sim grava, não apaga o lembrete, "muda para 60 reais" reenvia, silêncio desiste, toque em Sim, Voltar, resposta longa resumida, opção desligada fala tudo).

## 2026-11-22 · UX-3 · Texto grande em Configurações (PR #38, merge `ba3c6c5`) · **publicado**
- **Feito por:** Cursor (Grok Bot).
- **Estágio:** **publicado** em 22/11/2026 às 20:43 (Brasília), PR #38, merge `ba3c6c5`. CI verde; deploy Vercel `success`; CSS novo (`data-texto`, `--ts`) conferido no site no ar.
- Opção **Tamanho do texto** (Normal, Grande 115%, Maior 130%), aplicada pelo servidor (cookie `gadu_texto`) sem piscar. Todas as fontes do CSS viraram `calc(Npx * var(--ts, 1))`; corpo de 16 px no normal e textos secundários acima de 16 px no Grande e no Maior.
- **Testes executados:** typecheck; `npm test` 167 + 126, 0 falhas; build; Playwright a 412 × 915 (corpo 18,4 px e 20,8 px, sem rolagem lateral, a escolha sobrevive ao recarregar).

## 2026-11-22 · Passagem de bastão entre IAs (PR #33, merge `0b1c707`) · só documentação
- `AGENTS.md` (regras para qualquer IA), `CLAUDE.md` apontando para ele, diário `docs/HANDOFF.md` e modelo de PR com "Feito por (IA)" e "Revisar". Feito pelo Cursor (Grok Bot). Integrado em 22/11/2026 às 19:26 (Brasília), com CI verde rodado manualmente.

## 2026-11-22 · UX-3 (primeira parte) · Voz em um toque: tela de escuta com letra grande e envio sozinho em 3 s (PR #36, merge `b7b2320`) · **publicado**
- **Feito por:** Cursor (Grok Bot).
- **Estágio:** **publicado** em 22/11/2026 às 19:54 (Brasília), PR #36, merge `b7b2320`. CI verde (verify, e2e-public, database); deploy Vercel `success` (status do GitHub); CSS novo conferido no site no ar. Ainda não validado com pessoa logada em aparelho.
- **Um toque para falar:** o microfone central e o botão "Falar com o GaDu" abrem a **tela de escuta**:
  - "Estou ouvindo…" e a transcrição ao vivo em letra grande (26 px);
  - botão grande de parar;
  - quando a pessoa termina de falar, aparece "Enviando em 3…", com **Enviar agora**, **Cancelar** e **Corrigir o texto**;
  - depois do envio, a resposta aparece no painel do assistente (ou na Conversa).
  - Antes eram 3 toques: abrir o painel, tocar no microfone pequeno e tocar em Enviar.
- **Conversa contínua** (mãos-livres) liga e desliga na própria tela de escuta. É a mesma preferência de Configurações.
- **Voltar do Android e Esc** fecham a tela de escuta e param o microfone. Tocar e segurar o microfone continua abrindo o painel para escrever. Sem reconhecimento de voz no navegador, o toque abre o lugar de escrever.
- O microfone dentro da Conversa e do painel continua como antes: o texto fica no campo para revisar, a menos que "Enviar sozinho" esteja ligado.
- **Testes executados (22/11/2026):**
  - `npm run typecheck` ok;
  - `npm test`: 165 unitários e 126 de integração, 0 falhas;
  - `npm run build` ok;
  - Playwright local com reconhecimento de voz simulado: fala final, contagem e envio sozinho com a resposta no painel; Cancelar não envia; Voltar e Esc fecham; Parar para o microfone; o interruptor de conversa contínua grava a preferência.
  - Novo teste no `e2e/auth.e2e.cjs` (não rodado: exige credenciais).
- **Falta no UX-3:** confirmações faladas ("sim", "não", "muda para…"), respostas faladas mais curtas e a opção de texto grande (115% a 130%) em Configurações.

## 2026-11-22 · UX-2 · Tela Hoje curta: 5 blocos, "Falar com o GaDu" e uma lista só com Feito/Adiar (PR #35, merge `0e26745`) · **publicado**
- **Feito por:** Cursor (Grok Bot).
- **Estágio:** **publicado** em 22/11/2026 às 19:48 (Brasília), PR #35, merge `0e26745`. CI verde (verify, e2e-public, database); deploy Vercel `success` (status do GitHub); CSS novo conferido no site no ar. Ainda não validado com pessoa logada em aparelho.
- **Hoje em 5 blocos:**
  1. saudação com o botão grande **"Falar com o GaDu"** e a ação do momento;
  2. "Agora", com o próximo compromisso ou um convite para conectar o Google;
  3. **uma lista única "Merece sua atenção"**;
  4. "Peça com um toque", com 3 frases prontas;
  5. "Ver tudo": tarefas, compromissos, lembretes e Mais, todos tocáveis. Os lembretes abrem aqui mesmo, com "+ Novo".
- **Rolagem:** a 412 × 915, com dados fictícios, caiu de cerca de 4,7 telas (3.765 px) para cerca de 2,1 telas (1.663 px).
- **Lista única:** junta o Core (tarefas, lembretes, compromissos e e-mails), as metas que pedem atenção e as memórias para revisar.
  - Tarefas e lembretes têm **Feito** e **Adiar** (para amanhã) no próprio item, com aviso **"Desfazer"** por 6 s.
  - Saíram os blocos duplicados "Precisa de atenção" (tarefas, compromissos, lembretes e e-mails), "Suas metas", "Recomendações" e o catálogo "Módulos do GaDu".
- **API:** `/api/attention` passa a mandar `ref` (tabela e id) só em tarefas e lembretes da própria pessoa. A gravação continua pelo cliente com a sessão (RLS), como já era no Hoje.
- **Letra e toque:** no Hoje, corpo com no mínimo 16 px e botões de 48 px (antes havia 15 textos de 11 px).
- Tocar no título do topo volta ao começo da tela.
- **Testes executados (22/11/2026):**
  - `npm run typecheck` ok;
  - `npm test`: 165 unitários e 126 de integração, 0 falhas; o teste de integração de `/api/attention` passou a conferir `ref`;
  - `npm run build` ok;
  - Playwright num app local com dados fictícios: Feito, Desfazer, Adiar de tarefa e de lembrete gravam e revertem; a lista de lembretes abre pelo número; nenhum alvo abaixo de 48 px e nenhum texto abaixo de 16 px no conteúdo, salvo a data e os números grandes.
  - Novo teste no `e2e/auth.e2e.cjs` (não rodado: exige credenciais).
- **Fica para depois:** "Virar tarefa" a partir de um e-mail (o e-mail abre no Gmail pela lista); janelas livres da agenda (as antigas "Recomendações") pelo chat ("Priorizar meu dia").

## 2026-11-22 · UX-1 · Navegação simples: microfone no centro, "Mais" no lugar de Módulos, sem menu lateral no celular (PR #34, merge `2c8e98f`) · **publicado**
- **Feito por:** Cursor (Grok Bot).
- **Estágio:** **publicado** em 22/11/2026 às 19:41 (Brasília), PR #34, merge `2c8e98f`. CI verde (verify, e2e-public, database); deploy Vercel `success` (status do GitHub); CSS novo conferido no site no ar. Ainda não validado com pessoa logada em aparelho.
- **Barra de baixo (celular):** Hoje · Conversa · **microfone grande** · Tarefas · Mais.
  - Um toque no microfone fala com o GaDu de qualquer tela: abre o painel já escutando. Sem reconhecimento de voz no navegador, abre o campo de escrever.
  - Tocar e segurar abre o painel para escrever.
  - Durante a resposta, o toque para.
- **"Mais"** substitui "Módulos":
  - blocos grandes só com o que funciona: Agenda, Financeiro, Metas, Projetos, Memória, Agentes, Conversas anteriores, Configurações, Administração (só para administradores) e Ajuda;
  - planejados numa linha "Em breve", sem selos "Beta" ou "Planejado".
- **Menu sanfona do celular removido.** A conta fica em Mais › Configurações. Saiu também o botão duplicado de abrir o assistente no topo do celular.
- **Configurações num lugar só:** perfil, aparência e voz, conexões, custos, conta e privacidade, e ajuda. `?tab=perfil` e `?tab=integracoes` continuam válidos e abrem a mesma tela, já na parte certa.
- **Menu lateral do computador:** lista simples na mesma ordem do celular, sem grupos recolhíveis e sem planejados (ficam em "Em breve").
- **Nomes únicos:** Conversa, Memória, Configurações. Saiu o rótulo de módulo ("Pessoal", "Plataforma") acima do título.
- **Testes executados (22/11/2026, nesta máquina):**
  - `npm run typecheck` ok;
  - `npm test`: 165 unitários e 126 de integração, 0 falhas;
  - `npm run build` ok;
  - conferência com Playwright a 412 × 915 num app local com dados fictícios: microfone abre o painel, Voltar fecha, histórico pelo Mais, Perfil e Integrações abrem Configurações, tocar e segurar abre o painel.
  - O e2e com login (`e2e/auth.e2e.cjs`) foi atualizado para Mais e o microfone, mas não foi rodado: exige credenciais, como antes.
- **Capturas:** `/workspace/gadu-review/ux-before/` e `/workspace/gadu-review/ux-after/` (máquina do agente, fora do repositório).

## 2026-11-22 · Revisão geral do plano: 3D por fases, ciclo de UX com voz primeiro, Casa adiada · só documentação
- **Estágio:** só documentação, sem mudança de código nem de banco.
- **3D Studio:** especificação 3D-0 em [docs/FEATURE-3D.md](docs/FEATURE-3D.md) e fases no ROADMAP: 3D-1 (conversa → OpenSCAD WASM em Web Worker → three.js, controles deslizantes, verificações para a A1, STL, 3MF comum e 3MF "A1 PLA 0.4" a partir de um projeto-modelo do Bambu Studio), 3D-2 (figura a partir de foto com TRELLIS.2 ou Hunyuan3D-2.1 no Hugging Face ZeroGPU, reparo de malha) e 3D-3 (envio direto para a A1, depois). Sem serviço pago por geração.
- **UX:** novo ciclo "voz primeiro e uso simples" (UX-1 a UX-6) no ROADMAP, a partir de revisão do código e de capturas a 412 × 915 (telas com login num app local com dados simulados).
- **Casa Inteligente:** adiada por decisão do Eduardo; quando retomar, Home Assistant.
- **Correções de documentação:** PROJECT_STATUS e prioridades revisados; na matriz, itens dos PRs #22, #24, #26, #28 e #30 que ainda apareciam como "em desenvolvimento" ou "não publicado" agora estão como publicados; seção de Metas do ROADMAP sem a branch antiga.

## 2026-11-22 · Metas, base (PR #30, merge `901e27d`) · **publicado**

- Publicação: **publicada** em 22/11/2026 às 18:33 (Brasília), PR #30, merge `901e27d`. CI verde (verify, e2e-public, database). Migração `metas_base` aplicada na produção antes do merge (só aditiva); conferido: `goals`, `goal_progress`, `goal_milestones` e `goal_tasks` com RLS, 4 políticas cada, `anon` sem SELECT. Deploy de produção da Vercel concluído; home 200, `/api/goals` sem sessão 401, `/api/health` ok; e2e público contra a produção 9/9. `GOALS_ENABLED` não definida na Vercel (ligado por padrão). **Não verificado:** tela Metas, resumo do Hoje e propostas no chat com pessoa logada e em aparelho.
- **Estágio:** desenvolvido e testado localmente. Sem push, sem PR, sem migração aplicada em serviço remoto. Aprovado pelo Eduardo (inclusive tabelas novas).
- **Banco:** migração `20261122210001_metas_base.sql` (`goals`, `goal_progress`, `goal_milestones`, `goal_tasks`; RLS, chaves compostas, CHECKs; só aditiva, com uma restrição `unique (id, user_id)` em `tasks`; rollback no topo).
- **App:** cálculo de progresso e ritmo (`src/lib/goals/`), API `/api/goals/*`, tela Metas (Beta, mobile first), resumo no Hoje, fonte `goals` do Core e atualização como proposta com confirmação, `GOALS_ENABLED=0`.
- **Executado nesta máquina (22/11/2026), com commits na branch:** `npm run typecheck` ok; `npm test`: unitários 165 e integração 126, 0 falhas; `npm run build` ok; `bash scripts/test-db.sh` todos passaram (usuário normal, Postgres 17 + pgvector); `npm run test:e2e:public` 9/9 e `npm run test:e2e:mobile` 44/44 contra `next start` local (Supabase fictício); conferência visual em 390 px e no tema claro com prévia temporária, já removida.
- **Não testado:** com pessoa logada, em aparelho real, em produção; nenhuma chamada a IA real. `test:e2e:auth` não foi rodado (exige credenciais); o teste foi ajustado para Metas como Beta.
- **Limitações:** sem conquistas, recomendações, hábito, vínculo com projetos e agenda, indicadores de outros módulos e metas compartilhadas. Detalhe em [docs/METAS_CONQUISTAS.md](docs/METAS_CONQUISTAS.md).

## 2026-11-22 · Publicação do PR #28 (validação de uso diário no celular) · **publicado**
- PR #28 integrado em 22/11/2026 às 17:19 (Brasília), merge `97f4d642ebe695286ceaabc80d83b05cf47b304d`. CI verde: `verify`, `e2e-public` (com a suíte mobile) e `database`. Deploy de produção na Vercel: `success`.
- **Verificado em produção (só leitura):** `sw.js` com cache `gadu-v5`; `/icons/badge-96.png` 200; e2e público 8/8; suíte mobile 43/44 antes do ajuste do teste (falha só a navegação offline no WebKit, limitação do Playwright, investigada na entrada seguinte do ajuste, commit `89ec767`) e 44/44 com o ajuste rodando localmente contra a produção.
- **Não testado em aparelho real.** Os itens de [docs/CHECKLIST_CELULAR.md](docs/CHECKLIST_CELULAR.md) seguem pendentes com o Eduardo. O commit `89ec767` (ajuste do teste e docs) está só na branch `fix/mobile-offline-webkit`, sem push.

## 2026-11-22 · Validação de uso diário no celular (branch `fix/mobile-validacao`) · desenvolvido e testado localmente / emulado (publicado no PR #28, ver acima)
- **Estágio na época:** desenvolvido e testado localmente, com celular **emulado** (depois publicado no PR #28). Sem migração. Nenhum teste em aparelho de verdade foi feito; o que falta está em [docs/CHECKLIST_CELULAR.md](docs/CHECKLIST_CELULAR.md).
- **Bugs corrigidos (commits `76701d9` e `f741e6c` + docs):**
  - **Voltar do Android:** havia uma só entrada de histórico para qualquer número de camadas. Com assistente e menu abertos, o 1º Voltar fechava o menu e o 2º saía da tela. Agora há uma entrada por camada (`src/lib/overlay-history.ts`, usada em `GaduApp.tsx`), sem corrida entre fechar pela interface e o `popstate`, e o endereço da tela é reacertado depois.
  - **Voz falada:** frase longa sem pontuação era falada de uma vez (o Chrome do Android corta falas longas): agora o texto vira trechos de até 170 caracteres (`splitForSpeech`). O "despertador" pause/resume rodava também no Android, onde `pause()` cancela a fala: agora só no Chrome do computador. Vozes são consultadas no primeiro toque (`voiceschanged`), e voltar do segundo plano retoma a fala pausada.
  - **Reconhecimento de voz:** não é oferecido em HTTP puro; construtor que falha não derruba o app; `service-not-allowed` (Samsung Internet) ganhou mensagem própria; o microfone para ao ir para o segundo plano, ao bloquear a tela e ao sair do app.
  - **Notificações:** a assinatura que expira agora é refeita (`pushsubscriptionchange`) e a velha só é apagada depois de salvar a nova; o clique foca a janela e depois leva à rota (só rotas do próprio app, inclusive `//` recusado); selo da barra de status monocromático (`public/icons/badge-96.png`, antes era o ícone colorido, que o Android mostra como quadrado branco); Ajustes explica permissão negada e iOS sem suporte (`src/lib/push-client.ts`); `Notification` indefinido não quebra. `sw.js` passou a `gadu-v5`.
  - **CSP na tela offline:** a página `/offline` era estática e tinha 11 scripts bloqueados pela CSP (sem nonce); agora é dinâmica. Achado pela suíte nova; **a produção atual ainda tem o problema**.
  - **Alvos de toque:** o link "← GaDu" de Privacidade e Termos tinha 14 px de altura; agora 48 px.
  - **Campos e toque:** `enterkeyhint`, `autocomplete`, `autocapitalize`/`autocorrect` no login, mensagem e buscas; `touch-action: manipulation`, sem destaque cinza no toque, `text-size-adjust`; o campo em foco é mantido à vista quando o teclado abre.
  - Já estavam corretos e foram só verificados: viewport (`width=device-width, initial-scale=1, viewport-fit=cover`, sem bloquear zoom), `theme-color` claro e escuro, `100dvh`, `env(safe-area-inset-*)`, campos de 16 px, manifest completo (id, escopo, ícones 192, 512 e maskable), `Service-Worker-Allowed`, `manifest-src` e `worker-src` na CSP.
- **Testes novos:** `src/lib/overlay-history.test.ts` (7), mais casos em `speech.test.ts`, `errors.test.ts`, `src/lib/push-client.test.ts` (5), `test/sw.integration.test.ts` (6, service worker em ambiente simulado) e `e2e/mobile.e2e.cjs` (44 testes; `npm run test:e2e:mobile`), incluído no job `e2e-public` do CI (instala o WebKit também; `npm run e2e:browsers` agora instala os dois).
- **Executado nesta máquina (22/11/2026):** `npm run typecheck` ok; `npm test`: unitários 143 e integração 100, 0 falhas; `npm run build` ok; `bash scripts/test-db.sh` todos passaram (usuário normal); `npm run test:e2e:public` 8/8; `npm run test:e2e:mobile` 44/44 contra `next start` local (rodado 3 vezes, estável).
- **Produção (só leitura, `https://gadu-agent.vercel.app`, código ainda sem estas correções):** `test:e2e:mobile` 24 de 44. As 20 falhas são as mesmas 4 verificações nos 5 perfis: alvo de 14 px em Privacidade, campo de e-mail sem `autocapitalize`, destaque cinza no toque e CSP bloqueando scripts da tela offline; todas corrigidas aqui. Manifest, ícones, service worker, viewport, área segura e campos de 16 px passam; `getInstallabilityErrors` vazio nos 4 perfis Chromium. Lighthouse 13.6 (mobile, `/login`): local desempenho 95, acessibilidade 100, boas práticas 100, SEO 63; produção 93, 100, 100, 63. O SEO baixo é `is-crawlable` e é de propósito (o app é privado e usa `noindex`). O Lighthouse 13 não tem a categoria PWA nem `installable-manifest`; a instalabilidade foi verificada pelo CDP.
- **WebKit offline (investigado, só GET em produção):** a falha do iPhone 14 em produção vinha de `setOffline` do Playwright WebKit, que corta a rede antes do service worker (até recurso do cache do SW falha); não é bug do `sw.js`. O teste agora só confere o cache no WebKit e avisa no log; conferir no iPhone real. Detalhes em `docs/TESTES_E2E.md`.
- **Emulado:** motor Chromium e WebKit com perfil de celular (tela, UA, toque); UA do Samsung Internet sobre Chromium; offline, service worker e instalabilidade do Chromium de verdade; histórico, fala, reconhecimento e push com objetos simulados.
- **Não verificável sem aparelho:** teclado virtual real, microfone e reconhecimento, vozes e corte de falas no Chrome do Android, push de verdade, Voltar físico e gesto, instalação pelo menu, Samsung Internet real, iPhone real (iOS 16.4+ instalado), desempenho e bateria. O "despertador" só no desktop e o comportamento de `pause()` no Android seguem a documentação e relatos conhecidos do Chrome, não foram observados em aparelho.

## 2026-11-22 · `41eb3ed` · Finanças, base: Contas e Dia a dia (PR #26) · publicado
- **Publicado.** PR #26 integrado em 22/11/2026 às 16:44 (Brasília), merge commit `41eb3edd7caaf640675f970f2dd2457dd942c8bf`. CI do PR verde: `verify`, `e2e-public`, `database`. Antes, o PR #5 (especificação) foi atualizado com a `main` e integrado às 15:49 (Brasília), merge `ff8fff0`.
- **Migração aplicada na produção antes do merge** (só aditiva): `financas_base`, versão `20261122194404`. Conferido: as 4 tabelas `fin_*` com RLS ligada, 4 políticas cada, `anon` sem SELECT. Assessor de segurança do Supabase sem avisos novos.
- **Deploy de produção da Vercel:** `success`.
- **Produção:** home 200; `/api/finance/resumo` sem sessão 401; `/api/health` ok.
- **e2e público** (8 testes) contra a produção: 8 passaram.
- **Flags:** `FINANCE_ENABLED` e `CORE_MVP` não estão definidas na Vercel, então o recurso está ligado por padrão.
- **Não verificado em produção:** tela Financeiro e lançamento pela conversa com pessoa logada, em aparelho.
- Detalhes do desenvolvimento e dos testes locais na entrada a seguir.

## 2026-11-22 · Finanças, base: desenvolvimento (branch `feat/financas-base`) · desenvolvido e testado localmente
- **Desenvolvido.** Primeira fatia da especificação (aprovada pelo Eduardo, inclusive as tabelas novas com RLS). Publicada na entrada acima (PR #26). Nome do arquivo na época: `20261122190001_financas_base.sql`; na produção a migração está registrada como `20261122194404`.
- **Banco (aditiva):** `supabase/migrations/20261122190001_financas_base.sql` cria `fin_itens`, `fin_item_meses`, `fin_gastos` e `fin_config`; `user_id` da sessão, RLS ligado, 16 políticas só para `authenticated` com `(select auth.uid()) = user_id`, `anon` sem nenhum privilégio, `authenticated` sem TRUNCATE/REFERENCES/TRIGGER, CHECKs (valor > 0, mês 1-12, dia 1-31, data existente, `meio`, `tipo`, `origem`), índices por `(user_id, ano, mes)`, vínculos por chave composta, sem função nem trigger. Rollback comentado no topo.
- **Código:** `src/lib/finance/` (resumo, vínculos, previsão, lançamento, schemas, flag); `src/app/api/finance/*` (resumo, itens, valor/pago por mês, gastos, config); `src/lib/core/finance.ts` (fonte `finance` do Core); `FinanceiroPage.tsx` e `GastoCard.tsx`; módulo Financeiro de "planejado" para Beta; `/api/chat` entende perguntas financeiras e propõe lançamentos.
- **Comportamento:** perguntas sobre gastos e contas injetam o bloco `[F1]…` com "Fontes" para o Financeiro, sem IA extra; "gastei 45 no mercado no pix" só gera uma proposta, que a pessoa confirma antes de gravar (a gravação é pela rota, com a sessão dela). Custo continua pelos limites, reserva, cota diária e liquidação (fail closed). Termos bloqueados e dado sensível viram "(omitido pela regra de privacidade)".
- **Flags:** `FINANCE_ENABLED=0` esconde a tela e desliga rotas, fonte do Core e proposta de gasto (ligado por padrão); `CORE_MVP=0` desliga só a fonte `finance`. Nenhuma variável foi criada na Vercel.
- **Testes executados localmente:** `npm run typecheck` ok; `npm test` (unitários 124, integração 94, 0 falhas); `npm run build` ok; `bash scripts/test-db.sh` todos passaram (inclui `60_financas.test.sql` e o isolamento A x B agora em 22 tabelas, com verificação de que toda tabela do `public` está na suíte); e2e público 8 de 8 contra `next start` local (inclui as 12 rotas `/api/finance/*` com 401 sem sessão). Tela conferida em 390 px (escuro e claro) e 1280 px com dados fictícios interceptados: sem rolagem lateral, sem alvo abaixo de 40 px, sem erro no console.
- **Não verificado:** a migração em um Supabase real; a tela com pessoa logada e dados reais; teste de interface com login (`e2e/auth.e2e.cjs` foi ajustado para o Financeiro Beta, mas não rodou); voz e lançamento por voz no aparelho; custo por mensagem.
- **Limitações:** sem teto por categoria, saldo do banco, caixa, acumulado do ano, print/PDF/áudio dedicado, log nem regras de classificação; simulador bruto → líquido é o próximo item (não implementado).

## 2026-11-22 · `215edab` · Core Contextual: "O que merece minha atenção hoje?" (PR #24) · publicado
- **Publicado.** PR #24 integrado em 22/11/2026 às 15:42 (Brasília), merge commit `215edab0d7d879e3483d0a6d77539609ce95f39c`. CI do PR verde: `verify`, `e2e-public`, `database`.
- **Deploy de produção da Vercel:** `success`.
- **Produção:** home 200; `/api/attention` sem sessão 401 (rota nova no ar); `/api/health` ok.
- **e2e público** (7 testes) contra a produção: 7 passaram.
- **Migrações:** nenhuma.
- **Flag:** `CORE_MVP` não está definida na Vercel, então o recurso está ligado por padrão.
- **Não verificado:** tela Hoje e Fontes com pessoa logada; Gmail e agenda reais; voz no aparelho; custo por mensagem medido.
- Detalhes do desenvolvimento e dos testes locais na entrada a seguir.

## 2026-11-22 · Core Contextual: desenvolvimento (branch `feat/core-atencao-hoje`) · desenvolvido e testado localmente
- **Desenvolvido.** Primeira entrega do Core, aprovada pelo Eduardo: escopo pessoal, só leitura, sem banco novo e sem migração. Publicada na entrada acima (PR #24).
- **Código:** `src/lib/core/` (`scopes`, `plan`, `collect`, `format`, `flag`, `privacy`, `google-adapter`, fontes `tasks`, `reminders`, `agenda`, `email`); `/api/chat` injeta o bloco do Core quando a intenção é "atencao_hoje" e envia o evento `sources`; rota nova `/api/attention` (zod, sessão obrigatória); `AttentionCard` na tela Hoje; `SourcesDetail` ("Fontes") no assistente e na Conversa.
- **Comportamento:** nenhuma chamada de IA nova; custo continua pela reserva, cota diária e liquidação já existentes (fail closed). Core usa só o cliente da sessão (RLS); termos bloqueados e dado sensível viram "(omitido pela regra de privacidade)". Gmail: até 5 não lidos das últimas 48 h, só remetente e assunto, e só com o escopo `gmail.readonly` já concedido; senão vai para "indisponível". Com o Core ligado e a intenção, o chat não lê o Google duas vezes (o caminho antigo só roda se pedir a semana).
- **Flag:** `CORE_MVP=0` desliga (chat e Hoje voltam ao comportamento anterior). Ligado por padrão porque não há acesso às variáveis da Vercel agora; para desligar em produção será preciso criar a variável lá.
- **Testes executados localmente:** `npm run typecheck` ok; `npm test` (unitários 76, integração 67, 0 falhas); `npm run build` ok; `bash scripts/test-db.sh` todos passaram (inclui `50_core_atencao.test.sql`: consulta do Core como B só devolve itens de B); e2e público 7 de 7 contra `next start` local (inclui `/api/attention` 401 sem sessão).
- **Não verificado:** tela Hoje e "Fontes" em celular (390 px) com pessoa logada e dados reais; Gmail e Calendar reais; comportamento em produção.

## 2026-11-22 · `cc85040` · Segurança P1 / fase 0 do Core (PR #22) · publicada
- **Publicado.** PR #22 integrado em 22/11/2026 às 14:54 (Brasília), merge commit `cc850400ff982d2463cf750de539fa194b04b5b6`. CI do PR verde: `verify`, `e2e-public`, `database`.
- **Migrações aplicadas no Supabase de produção:** aditiva antes do deploy (versão `20261122175405`, `seguranca_p1_aditiva`); restritiva depois do deploy (versão `20261122175542`, `seguranca_p1_restritiva`).
- **Deploy da Vercel** (`gadu-agent`) do merge commit: "Deployment has completed". Site: home 200, `/app` redireciona para `/login`, `/api/chat` sem sessão 401, `/api/health` ok.
- **Prova de que o código novo está no ar:** uma tentativa de login com e-mail fictício gerou linhas em `private.rate_limits` (`password_ip` e `password_email`).
- **Conferido no banco depois da restritiva:** `consume_quota` não existe; `authenticated` sem EXECUTE em `settle_ai_budget`; sem INSERT em `usage_events`; `anon` com 0 privilégios de tabela em `public`; `consume_daily_quota` e `budget_status` continuam para `authenticated`.
- **Assessor de segurança do Supabase:** avisos de SECURITY DEFINER de 6 para 2 (`budget_status` e `consume_daily_quota`, intencionais). Senhas vazadas continua desligado (passo manual).
- **e2e público** (6 testes) contra a produção: 6 passaram.
- **Não verificado:** chat com uma pessoa logada em produção (e2e com login precisa de credenciais); encerramento de sessões ao bloquear em produção.
- **S-09 pendente:** plano Supabase da organização é Free (sem backups automáticos baixáveis nem PITR); depende de decisão do Eduardo (plano Pro ou dump lógico agendado).
- Detalhes do desenvolvimento (código, migrações, testes locais) na entrada a seguir.

## 2026-11-22 · Segurança P1: desenvolvimento (branch `fix/seguranca-p1`)
(S-01, S-02, S-03 parcial, S-04, S-05 parcial, S-06, S-07, S-10, S-11, S-12). Desenvolvido e testado localmente; publicação na entrada acima.
  - **Migrações** (nunca editou uma antiga): `20261122120001_seguranca_p1_aditiva.sql` (funções `server_*` de orçamento só para `service_role`, tabela e função do limite de tentativas, `server_revoke_user_sessions`, recusa de quem não está ativo em `consume_daily_quota` e `index_backlog`; compatível com o app de hoje) e `20261122120002_seguranca_p1_restritiva.sql` (revoga as funções antigas de orçamento, remove `consume_quota`, fecha insert em `usage_events`, tira `anon` do schema `public`). Ordem: aditiva → deploy → restritiva. Cada uma com rollback no topo.
  - **Código:** orçamento pelo cliente do servidor com o id da sessão (`src/lib/ai-budget.ts`); estimativa no cancelamento (`src/lib/partial-cost.ts`); chat sem contingência de cota; limite de tentativas (`src/lib/rate-limit.ts`, `client-ip.ts`) em `/api/auth/*` e `/api/invite/accept`, com 429 em português e fail open se o contador cair; agendador ignora bloqueados; bloqueio encerra sessões e protege admins (`src/lib/admin-guard.ts`; a tela de admin mostra a mensagem de recusa); proxy com 503 sem configuração.
  - **Testes:** `test:db` com `40_seguranca_p1.test.sql`, `compat/aditiva_compat.sql` (roda entre as duas migrações), corrida de 20 liquidações simultâneas e testes de cota e orçamento migrados para as funções do servidor; integração para chat (fail closed sem `consume_quota`, liquidação no servidor, `already`, estimativa no cancelamento), limite de tentativas, bloqueio de admin, agendador e proxy. A imitação do Supabase ganhou privilégios padrão de função e `auth.sessions`.
  - **Executado localmente** (Postgres 17 com pgvector, usuário normal): `bash scripts/test-db.sh` aprovado (303 verificações `ok`, 0 falhas); `GADU_AUDIT=1` mostra S-01, S-03 (contador), S-04, S-05 (custo e cota), S-07, S-10 e S-12 como CORRIGIDO e S-05 (escrita direta em tabelas) como AINDA PRESENTE; `npm run typecheck`; `npm test` (54 unitários e 51 de integração, 0 falhas); `npm run build`. Não há script de lint no projeto. Testes de interface (`test:e2e`) e CI do GitHub **não foram executados** nesta etapa.
  - **Docs:** `docs/SEGURANCA_P1_MANUAL.md` (ordem de implantação, conferências, senhas vazadas, backups, RPO e RTO, ensaio de restauração, Vercel Firewall), status por S-xx na auditoria, `PROJECT_STATUS.md` e `ROADMAP.md`.
  - **Não executado na época do desenvolvimento:** encerramento de sessão no Auth real (testado só com imitação). Depois, na publicação, foram aplicadas as migrações; o painel do Supabase e da Vercel não foi alterado.

## 2026-11-16 · `b992422` · Isolamento e preparação do Core (PR #20)
- **Banco de teste completo:** `scripts/test-db.sh` aplica **todas** as 9 migrações, em ordem, inclusive a de pgvector. Antes eram 5. Sem pgvector, o teste falha em vez de pular tabelas. O shim ganhou o schema `extensions`.
- **Isolamento entre pessoas** (`supabase/tests/30_isolamento.test.sql`, com dados sintéticos):
  - 18 tabelas: leitura própria; sem leitura, alteração, exclusão ou inserção na outra pessoa; nada sem login; linhas intactas;
  - vínculos cruzados (tarefa, mensagem e conversa com dono diferente);
  - a pessoa não muda o próprio papel ou acesso;
  - `search_similar` só com os próprios itens;
  - funções do agendador recusadas.
- **Auditoria em execução** (`npm run audit:db`, `supabase/tests/audit/riscos_conhecidos.sql`): S-01, S-05, S-07, S-10 e S-12 confirmados localmente. Nada muda no banco de produção.
- **CI:** o job `database` instala o pgvector e passa a rodar o isolamento em todo PR.
- **Docs novos:** `docs/CORE_ATENCAO_HOJE.md` (proposta para decisão) e `docs/ROTEIRO_ANDROID.md`. Atualizados: auditoria (verificação em execução), testes, status e roadmap.
- Testado:
  - `npm run test:db`: 218 verificações, todas aprovadas (cota, orçamento, concorrência, isolamento);
  - `npm run audit:db`: 5 de 5 riscos confirmados;
  - typecheck, testes unitários e de integração, build;
  - testes de interface públicos (clone limpo) e com login (servidor local).
- **CI no GitHub** (run 43865196515): `verify`, `e2e-public` (6 aprovados, 0 pulados) e `database` aprovados. O `database` usou Postgres 18 com pgvector, aplicou as 9 migrações e passou no isolamento das 18 tabelas.
- **Publicado**: deploy `dpl_93GgJbNyQZH6AVPDyPZp11UUtJEx` `READY`. Sem mudança no app. Depois do deploy, em produção com o usuário de teste: 6 + 14 testes de interface aprovados, 0 pulados.

## 2026-11-15 · `4669181` · Qualidade e Segurança (PR #18; ajuste no PR #19)
- **Testes de interface:**
  - Playwright 1.63.0 como dependência oficial (versão fixa, lockfile atualizado);
  - suíte dividida em `e2e/public.e2e.cjs` (6 testes, sem login e sem segredos) e `e2e/auth.e2e.cjs` (14 testes, usuário de teste), com funções comuns em `e2e/helpers.cjs` e login por variável de ambiente em `e2e/login.cjs`;
  - **nada é pulado:** faltando variável, a suíte falha;
  - scripts novos: `test:e2e:public`, `test:e2e:auth`, `test:e2e`, `e2e:browsers`.
- **CI:** novo job `e2e-public` no `pr-checks.yml`. Ele sobe o app com um Supabase fictício e roda os testes públicos (home e login em 7 larguras, 401 nas APIs sem login, CSP, tema claro).
- **Corrigido** (achado pelos testes novos): links do topo e do rodapé da home e a marca agora têm 44 px.
- **Auditoria de segurança somente leitura:** `docs/SECURITY_AUDIT_2026-11-15.md`, com matriz S-01 a S-15, evidências do banco e do código e ordem de correção. Nada foi mudado no banco, RLS, autenticação, permissões ou custo.
- **Comentários corrigidos** (sem mudança de comportamento): cliente admin e cookies de sessão.
- **Docs novos:** `docs/TESTES_E2E.md` (inclui a proposta de testes com login no CI), `docs/VALIDACAO_APARELHOS.md` e `docs/CORE_CONTEXTUAL_MVP.md`.
- Testado:
  - typecheck, 46 testes unitários e 16 de integração, build;
  - os 6 testes públicos num **clone limpo depois de `npm ci`**, sem `.env`, com Supabase fictício (como no CI);
  - os 6 + 14 testes contra o servidor local com o usuário de teste: 20 aprovados, 0 pulados.
- **CI no GitHub:** o job `e2e-public` rodou 6 testes, 6 aprovados e 0 pulados.
- **Publicado**: deploy `dpl_DkLudEdzoaxcpiAQVN8WohUGjLyj` `READY`. Em produção, com o usuário de teste: 6 + 14 testes aprovados, 0 pulados. No PR #19, os testes de 401 e CSP passaram a medir pelo próprio navegador (o cliente HTTP do Playwright não usa o proxy de algumas redes). Rollback: reverter os PRs #18 e #19 ou promover o deploy do PR #17.

## 2026-11-14 · `18f1071` · Sprint UX/UI v2.2 (PR #16)
- **Navegação híbrida no celular** (`GaduApp.tsx`, `src/app/v2.css`):
  - a barra de baixo fica com o uso frequente: Hoje, Conversas, GaDu, Tarefas e Módulos;
  - nova tela **Módulos** (`ModulesHub`) para explorar o produto por área, com os planejados discretos;
  - o menu (☰) virou uma gaveta pela esquerda, só com conta, plataforma, histórico e guia (sem repetir a barra);
  - a gaveta fica sempre montada, com animação de entrada e saída e fundo escurecido;
  - fecha ao tocar fora, ao escolher um destino, com Esc e com o **Voltar do Android**;
  - respeita as safe areas e o "reduzir movimento", e trava a rolagem da página por trás.
- **Computador:** menu lateral por área (Produtividade pessoal, Vida pessoal, Agentes e criação, Plataforma), **recolhível só para ícones**, com a escolha salva no aparelho.
- **Assistente Universal em três estados**, com a mesma conversa nos três (`Assistant.tsx`):
  - compacto: o orbe;
  - rápido: painel com as últimas trocas, alça para fechar e link para as anteriores;
  - completo: a tela Conversa.
  - No computador, a borda do painel é arrastável (320 a 640 px, também pelo teclado).
  - O avatar do painel ganhou halo por estado.
  - Corrigido: o cabeçalho do painel ficava fora da tela no computador.
- **Voz:**
  - tocar enquanto o GaDu responde agora só interrompe (antes, abria o microfone junto);
  - o modo mãos-livres só volta a ouvir quando nada está acontecendo;
  - o envio automático vem **desligado por padrão**, e a transcrição fica no campo para revisar;
  - trocar de tela com o microfone aberto e sem controle à vista para a escuta;
  - no celular, o assistente não abre sozinho ao carregar.
- **Pendências da v2.1:**
  - botões do painel com 44 px, e todos os botões pequenos, chips, grupos e abas com 44 px;
  - `themeColor` e manifest com as cores novas;
  - abas de Configurações quebram em linhas no celular;
  - interruptores acessíveis (`role="switch"`, linha inteira clicável);
  - a Agenda é dona da própria página;
  - dicas próprias para Tarefas e Projetos;
  - Hoje mais compacto, com indicadores em uma linha e o cartão **"Agora"** (próximo compromisso real);
  - o estado da voz no cabeçalho só aparece quando há algo acontecendo.
- **Contexto:** a interface separa "Contexto da tela" (Beta) de "Inteligência integrada entre módulos" (Planejada).
- **Módulos novos, planejados:**
  - **Metas & Conquistas** e **Casa Inteligente (GaDu Casa)** no catálogo único (`modules.ts`), com páginas e especificação;
  - docs `CASA_INTELIGENTE.md`, `METAS_CONQUISTAS.md` e `INTEGRACOES_SAUDE.md` (Samsung Health e Health Connect).
  - Nenhuma integração real e nenhuma tabela.
- **Protótipo do Lovable:** encontrado e avaliado (`docs/LOVABLE_VISUAL_REFRESH.md`); incorporados o cartão "Agora" e o halo por estado.
- **Home e Guia** atualizados com a visão ampliada.
- Testado:
  - typecheck, 46 testes unitários e 16 de integração, build;
  - **16 testes de interface com Playwright** (`npm run test:e2e`, `e2e/ui.e2e.cjs`) contra o servidor local com o usuário de teste;
  - os testes cobrem: 7 larguras sem rolagem lateral e com alvos de 44 px; menu (toque fora, Esc, Voltar, escolha); tela Módulos; barra de baixo sem esconder conteúdo; temas; assistente (orbe, Voltar, alça, histórico compartilhado); voz simulada (microfone negado, revisão da transcrição, limite de 20 s, interrupção, troca de tela); interruptores; Tarefas e Projetos com fixtures, estado vazio e erro; menu recolhível e largura do painel no computador;
  - chat e voz simulados, sem chamada à IA paga.
- Não verificado: voz e teclado em aparelhos físicos; prévia navegável do protótipo do Lovable (bloqueada pela rede do ambiente).
- **Publicado**: deploy `dpl_DEQDkX2dCyP9tbdaHSit6HzniL6U` `READY`. Os 16 testes de interface também passaram **em produção** (usuário de teste; chat e voz simulados). Capturas reais em produção: Hoje, menu, assistente, Módulos, Casa, Metas, Conversa e home, em 390 e 1440 px, nos dois temas. Rollback: promover `dpl_BSXyR5vex6zNB5F1Z9f9M6SCZAxJ` (PR #14).

## 2026-11-14 · `9733685` · Sprint UX/UI v2.1 (PR #14)
- **Identidade** (`src/app/v2.css`):
  - paleta azul-marinho e grafite no lugar do preto puro; ciano, azul e laranja como cores de identidade; menos neon;
  - Michroma só na marca e no título da home; rótulos sem caixa alta espaçada;
  - marca em texto nos cabeçalhos (`.brand`); avatar só no assistente;
  - logo novo de três movimentos: **asset pendente**, não está no repositório.
- **Navegação** (`GaduApp.tsx`):
  - menu com grupos recolhíveis (estado salvo no aparelho), rolagem própria, "Em breve" para módulos planejados e Administração só para admin;
  - no celular, a folha não repete o que está na barra;
  - barra de baixo de 58 px, com orbe de 50 px que muda só em estado real.
- **Módulos** (`src/lib/modules.ts`): status Disponível, Beta, Em desenvolvimento e Planejado; telas novas Tarefas, Agenda, Integrações e Perfil.
- **Hoje** (`TodayPage.tsx`): saudação compacta por horário (de noite: Revisar o dia e Planejar amanhã), indicadores, "Precisa de atenção", recomendações a partir dos dados reais.
- **Conversa:**
  - palco compacto no celular, com Nova e Histórico em botões de ícone;
  - estado vazio com sugestões;
  - microfone dentro do campo;
  - a escuta para sozinha em 20 s;
  - "Enviar sozinho o que eu falar" pode ser desligado para revisar a transcrição.
- **Assistente Universal** (`Assistant.tsx`): painel que pode ser alargado no computador (520 a 600 px); no celular, acompanha o teclado (`visualViewport`).
- **Telas** (`v2-pages.css`, `kit.tsx`):
  - Tarefas e Projetos separados;
  - Agenda (estado vazio com Conectar o Google), Agentes, Memórias, Administração, Guia e Como funciona, páginas de módulo, cartão de evento e gaveta de conversas;
  - componentes `PageHeader`, `Panel` e `EmptyState`.
- **Home pública** (`src/app/page.tsx`): visão completa e bloco "Inteligência contextual" marcado como Beta.
- **Core Contextual:** arquitetura futura em `docs/CORE_CONTEXTUAL.md`; tipos em `src/lib/core-context.ts`, sem uso em produção.
- Corrigido:
  - dica duplicada em Projetos (chave do React repetida);
  - rótulo de duração "1h30h" na Agenda.
- Testado:
  - typecheck, 45 testes unitários e 16 de integração, build;
  - auditoria autenticada local em 360, 412, 768, 1024 e 1920 px, em 7 telas: sem rolagem horizontal; alvos de 44 px (exceto links dentro do texto e caixinhas dentro de linhas clicáveis de 48 px);
  - contraste AA medido nos dois temas;
  - capturas em 390 e 1440 px, nos temas escuro e claro.
- Não verificado:
  - voz em iPhone e Android (validação humana);
  - Administração e telas com dados reais (o usuário de teste não é admin e não tem dados).
- **Publicado**: deploy `dpl_BSXyR5vex6zNB5F1Z9f9M6SCZAxJ` `READY`. Capturas em produção com sessão autenticada, sem rolagem horizontal: Hoje (escuro e claro), Conversa, Projetos, Agenda, menu do celular, assistente aberto (computador e celular) e home, em 1440 e 390 px. Rollback: promover `dpl_HT87wCvBrfSDQjkJ7ANsfkuFAAPF` (PR #13).

## 2026-11-13 · `883ea23` · UX/UI v2 (PR #12)
- **Módulos** (`src/lib/modules.ts`, `ModulePage.tsx`): seis módulos com status real; módulo planejado abre uma página que diz que ele ainda não existe.
- **Navegação** (`GaduApp.tsx`, `src/app/v2.css`): menu lateral por módulos no computador; no celular, barra de baixo com o assistente no centro e folha de módulos.
- **Assistente Universal** (`Assistant.tsx`): voz e texto em qualquer tela, com a mesma conversa. Painel lateral no computador, painel de baixo expansível no celular.
- **Contrato de contexto** (`src/lib/assistant-context.ts`, `src/app/api/chat/route.ts`): rótulo de módulo e tela, validado no servidor; inválido é recusado com 400 antes de qualquer custo; não amplia o acesso.
- **Temas claro e escuro** (`src/lib/theme.ts`, `layout.tsx`): cookie `gadu_theme`; cores antigas viraram tokens.
- **Telas redesenhadas**: painel Hoje (`TodayPage.tsx`), Conversa, Perfil e ajustes (`SettingsPage.tsx`), home pública (`src/app/page.tsx`). Memória virou tela própria.
- Preservados: avatar animado, marca GaDu e `public/avatar`.
- Testado:
  - 45 testes unitários e 16 de integração (7 novos), typecheck, build e CI;
  - navegador com sessão autenticada de um usuário de teste, local e em produção, em 1440 e 390 px, nos dois temas, sem rolagem horizontal.
- **Publicado**: deploy `dpl_ENVExSFmz4Wq1BLn6drKSreuQc5j` `READY`. Em produção, o assistente respondeu pelo painel no computador e no celular e informou corretamente a tela ("módulo Pessoal, tela Tarefas e projetos").
- Não incluído: redesenho de Projetos, Agentes, Memória, Admin, Guia e Agenda (usam os temas, com o desenho anterior); cruzamento de dados entre módulos ou clientes; validação da voz nos aparelhos.

## 2026-11-13 · `fd77f84` · Design System v1, menu lateral e responsividade (PR #10)
- Tokens únicos em `:root` (`src/app/globals.css`): espaço, raio, texto, movimento, camadas, toque, gradiente holográfico.
- Computador (1024+): menu lateral fixo (`.side` em `src/components/GaduApp.tsx`), cabeçalho com o título da tela, sem o menu de baixo.
- Conversa no computador: avatar em 38%, leitura centralizada (máx. 760 px).
- Hoje: 2 colunas (700 a 1279 px) e 3 colunas (1280 px ou mais).
- Celular: logo no cabeçalho, conteúdo livre da voz flutuante, ☰ vira "Menu" (`ConversationsDrawer.tsx`).
- Acessibilidade: atalho "Pular para o conteúdo", alvos de toque de 40 px. Home com topo alinhado.
- Corrigido:
  - erro de hidratação na voz em Ajustes (`SettingsPage.tsx`);
  - seta dos itens de Ajuda fora do lugar.
- Novo `docs/DESIGN_SYSTEM.md`.
- Testado: capturas em 390, 768, 1024 e 1440 px (prévia local com dados fictícios para as telas do app), teclado, alvos de toque, console sem erro de hidratação, `npm test`, typecheck, build e CI.
- **Publicado**: deploy `dpl_H9wxTBkNm1uEKHvNTJV57dWP5q1R` `READY`; smoke test em produção ok.

## 2026-11-13 · `758286c` · Erros em português, telas de erro e voz mais estável (PR #9)
- `src/lib/errors.ts`: mensagens do chat por situação (sem internet, 429, 5xx, 504, 413) e do microfone; 4xx não repete a tentativa.
- Telas próprias: `src/app/error.tsx`, `global-error.tsx`, `not-found.tsx` (`ErrorScreen.tsx`).
- Voz (`src/lib/speech.ts`):
  - "terminou" só depois da resposta inteira;
  - prazo por trecho (iPhone sem aviso de fim);
  - despertador no Chrome;
  - voz presa limpa ao começar;
  - um microfone por vez;
  - o modo conversa volta a ouvir mesmo sem voz na resposta.
- Ajustes: teto e reservas do mês vindos de `budget_status()`, com valor disponível (`src/app/api/usage/route.ts`).
- Testado: 8 testes novos (`errors.test.ts`, `speech.test.ts` com síntese simulada); 40 unitários e 14 de integração; typecheck, build e CI. **Falta confirmar a voz nos aparelhos.**
- **Publicado**: deploy `dpl_ELAhLL3G7DMh3hfQSQKAhZ4Uu3rF` `READY`; página 404 conferida em produção.

## 2026-11-13 · `9e9351a` · Orçamento mensal com reserva e reconciliação (PR #6)
- Migração `20261113140001_ai_budget_reservations.sql`: `private.budget_policy` (US$ 20), `private.user_budget`, `public.ai_reservations` (RLS), `reserve/settle/release/expire_ai_reservations`, `budget_status`.
- App: o chat, o resumo e a importação reservam antes e liquidam pelo custo real; o agendador expira reservas vencidas.
- Testado:
  - 32 testes unitários, 14 de integração e `test:db` (31 checks SQL e concorrência: 20 reservas simultâneas de US$ 0,25 com teto de US$ 1,00 → exatamente 4);
  - em produção, com usuário temporário e rollback: teto, idempotência, liberação, isolamento entre pessoas, permissões.
- **Publicado**:
  - backup `private.backup_usage_events_20261113` (44 linhas, somas iguais);
  - migração aplicada (registro `ai_budget_reservations`);
  - deploy `dpl_CBrNxW8eLPRPTQ6tjFP2ba9iTrU1` `READY`;
  - **uso real**: 1 reserva liquidada e ligada ao consumo.

## 2026-11-13 · `fcf7415` · Documentação central (PR #7)
- Novos `PROJECT_STATUS.md`, `CHANGELOG.md` e `docs/FEATURE_MATRIX.md`.
- `ROADMAP.md` ganha uma visão por módulo, com prioridade, status, dependências e próximos passos.
- `docs/ARCHITECTURE.md` atualizado com o fluxo real do chat, a cota e as decisões oficiais.
- `CLAUDE.md` passa a apontar para a documentação central e para as decisões vigentes.
- **Publicado** (só documentação, merge `fcf7415`).

## 2026-11-12 · `c6bbb30` · GaDu Fast Track (PR #4)
- `docs/FAST_TRACK.md`, seção no `CLAUDE.md`, item "Modelo de trabalho" no ROADMAP.
- **Publicado** (só documentação; deploy `dpl_2vUKHfMwytwdzztYpVXhQkb34RhN` `READY`).

## 2026-11-12 · `d18286f` · Cota diária atômica (PR #3)
- Corrige três problemas da cota antiga:
  - a contagem passava do limite;
  - o limite vinha do cliente;
  - o dia virava às 21h de Brasília, porque usava UTC.
- Banco: `private.quota_policy` (150), `private.user_quota` e `public.consume_daily_quota()`.
- App: o chat chama a função nova sem enviar limite; a cota é a última verificação. Na transição, se a função não existir, usa a antiga.
- Testes: unitários, integração e `test:db` local, inclusive 40 chamadas simultâneas com limite 10 → 10; CI com job de banco.
- **Publicado**:
  - backup de `usage_daily` em `private.backup_usage_daily_20261113`;
  - migração aplicada (registrada como `20261113004434 daily_quota_atomic`);
  - deploy `dpl_31Q3Q78PKHySMqB6FqdkRgk5icHn` `READY`;
  - verificação em produção com usuário temporário e rollback: limite respeitado, `anon` sem acesso, política ilegível para usuários.
- Teste real com login feito pelo Eduardo: 4 mensagens contadas em 12/11 (dia de Brasília).

## 2026-11-12 · `6ae6bac` · Chat fail closed (PR #2)
- Se a cota, o teto mensal ou os limites por motor não puderem ser validados, o chat não chama a IA e não grava nada.
- Arquivos: `src/lib/chat-budget-guard.ts`, `src/app/api/chat/route.ts`, `test/chat-route.integration.test.ts`, `.github/workflows/pr-checks.yml`.
- Testes: unitários e integração da rota; contra a `main` anterior, 4 de 8 testes falhavam, o que comprova a correção.
- **Publicado** (deploy `dpl_6tjFxWQV76zyfARx4mBZCtMa7GWu` `READY`; smoke test sem login → 401; funções do banco verificadas com usuário temporário).

## 2026-11-09 · `475ad50` · Home pública
- Home aberta em `/` (avatar animado, funções, um dia com o GaDu, arquitetura, botão Entrar). `src/app/page.tsx`.
- Publicado. Verificação não registrada além do deploy.

## 2026-11-09 · `df6b8cf` · Avatar oficial animado e ícone
- `src/components/avatar-engine.ts`, `RobotFace.tsx`, `public/avatar/*`, `public/icons/*`; plano `docs/PLANO-AGENTES.md`.
- Publicado.

## 2026-11-09 · `5df9543`, `1c2225f`, `775d5a3` · Guia, dicas e "Como funciona"
- `/app/guia`, `/app/sobre`, `HelpNav.tsx`, `TipCard.tsx`, `src/lib/tips.ts`.
- Publicado.

## 2026-11-09 · `b75b53a` · Agenda visual, voz flutuante, busca por significado, convites e admin
- Agenda semanal com criação de eventos por voz.
- Botão de voz em todas as telas.
- Busca por significado: pgvector e `search_index`, indexados pelo agendador.
- Convites (`members`, `invites`) e área Admin.
- Publicado. A criação de eventos depende de você liberar a permissão `calendar.events` no Google.

## 2026-11-09 · `4aa6330` · Correção ao abrir o app
- Publicado.

## 2026-11-09 · `d3d6f24`, `0557f40`, `40523b1` · Tarefas, projetos, agentes e Hoje em painel
- Tabelas `tasks`, `projects`, `agents`, com RLS.
- Publicado.

## 2026-11-09 · `ba5d7c9` · Hoje, lembretes por voz e briefing da manhã
- `reminders`, `push_subscriptions`, `daily_briefings`, Web Push e Vercel Cron a cada minuto.
- Publicado.

## 2026-11-09 · `20b07b4`, `570b210` · Google (agenda e Gmail, só leitura) e páginas legais
- Publicado. Primeira conexão real registrada no ROADMAP.

## 2026-11-09 · `fc47bef`, `3a135be`, `3fe3a83`, `68b6598`, `b54ab3b` · Fase 1
- Limites por motor, lista de conversas, memória v2 (resumos), importação de memórias, voz configurável.
- Login com senha, gasto do mês e teto mensal.
- Correção do microfone.
- Publicado.

## 2026-11-08 · `85454e7` → `241c28a` · MVP
- Conversa por voz e texto, memória com aprovação, login, motor pelo Vercel AI Gateway.
- Publicado (primeira resposta real registrada no ROADMAP).
