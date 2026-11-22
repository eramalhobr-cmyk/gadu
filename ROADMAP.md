# GaDu · Roadmap

Atualizado a cada entrega. Última atualização: 22/11/2026 (Finanças, base, **publicada**, PR #26; antes: Core "atenção hoje" publicado, PR #24). Produção: https://gadu-agent.vercel.app (merge `41eb3ed`).
Princípios: mobile first, segurança, resiliência, contingência e pronto para outras pessoas usarem (cada pessoa vê só os próprios dados).

Documentos relacionados:
- [PROJECT_STATUS.md](PROJECT_STATUS.md): situação atual e ponto de retomada.
- [docs/FEATURE_MATRIX.md](docs/FEATURE_MATRIX.md): status por funcionalidade, com arquivos de código.
- [CHANGELOG.md](CHANGELOG.md): histórico.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): arquitetura e decisões oficiais.

## Visão por módulo (13/11/2026)
Status:
- **implementado**: em produção.
- **beta**: em produção, parcial ou sem validação real.
- **em desenvolvimento**: em PR.
- **planejado**: só em documento.
- **bloqueado**: depende de decisão ou recurso externo.

Prioridade: P0 agora · P1 próximo ciclo · P2 depois · P3 longo prazo.

| Módulo | Objetivo | Status | Prioridade | Dependências | Próximos passos |
|---|---|---|---|---|---|
| Assistente pessoal e conversacional | Conversa confiável, barata e segura | implementado: fail closed, cota atômica, orçamento com reserva (PRs #2, #3, #6), erros em português (PR #9) | P0 | — | etapa 2 da cota; créditos por pessoa |
| Assistente universal de voz e texto | Falar ou digitar em qualquer tela e módulo | implementado: Assistente Universal em todas as telas, com contexto do módulo (PR #12); voz do aparelho; modo conversa em beta | P1 | — | validar no iPhone e no Android; depois voz natural paga com teto |
| Inteligência contextual | Conectar memória, agenda, tarefas, e-mail e módulos, respeitando permissões | implementado (memória, busca por significado, insights) | P1 | módulos futuros | contexto de Finanças e Office com permissões |
| Financeiro | Controle mensal pela conversa: lançar, classificar, prever caixa | Beta: base (Contas e Dia a dia, perguntas e lançamento pela conversa, previsão até o próximo recebimento) **publicada** (PR #26, merge `41eb3ed`); especificação integrada (PR #5) | P1 | migração `financas_base` aplicada na produção (versão `20261122194404`) | validar com pessoa logada, em aparelho; depois simulador bruto → líquido, tetos, fase Conversa |
| Tarefas, agenda e memórias | Organizar o dia com voz | implementado; notificações e criação de eventos em beta | P1 | permissão `calendar.events`; PWA instalado | liberar a permissão; instalar o PWA no iPhone |
| Agent Office e agentes | Agentes por área, multiusuário, organizações e clientes | agentes simples implementados; Office planejado | P2 | PR #6 (teto por agente); isolamento por organização | 6.1 fundamentos (docs/PLANO-AGENTES.md) |
| Agent Office Studio | Agentes que criam sites, aplicações web e PWAs (sem app nativo nesta fase) | planejado | P3 | Agent Office; execução isolada | especificar depois do Office |
| 3D Studio e impressão 3D | Buscar, organizar e gerar modelos imprimíveis; exportar para fatiador | planejado | P2 | — | especificar depois do GaDu Personal, antes do Agent Office |
| Integrações, segurança e permissões | Isolamento por pessoa, custos sob controle, integrações autorizadas | implementado (RLS, fail closed, cota atômica, orçamento com reserva, CI); auditoria completa pendente | P0 | — | etapa 2 da cota; auditoria de RLS; créditos por pessoa; alerta de erro |
| Home pública, dashboard e desktop/mobile | Primeira impressão e uso diário em qualquer tela | implementado: home, Hoje em painel, PWA, avatar oficial, UX/UI v2 com módulos, temas claro e escuro, novo painel, conversa, ajustes e home (PR #12) | P1 | — | v2.1 (PR #14) concluída; logo novo pendente; testes de ponta a ponta |

Sequência combinada: Marco Zero (segurança) → uso diário (gastos visíveis, voz, erros) → Finanças → 3D Studio → Agent Office → Agent Office Studio.

## Histórico detalhado por fase
`[x]` feito · `[ ]` falta · `[~]` em andamento.

## Fase 0 · MVP publicado (v0.1)

### Fundação
- [x] Repositório próprio, separado de qualquer projeto corporativo
- [x] Next.js 16 (App Router) + TypeScript estrito
- [x] Projeto `gadu-agent` na Vercel (Pro), ligado ao GitHub: cada envio ao `main` publica sozinho
- [x] Variáveis cadastradas pela API da Vercel (nenhuma secreta)
- [x] Ambiente de trabalho "GaDu" no Claude com tokens da Vercel e do Supabase isolados
- [x] Banco Supabase próprio (São Paulo) com RLS em todas as tabelas
- [x] Esquema multiusuário: perfis, conversas, mensagens, memórias, cota diária
- [x] Migração versionada em `supabase/migrations`
- [x] ROADMAP, README, ARQUITETURA e SEGURANÇA documentados

### Acesso
- [x] Login com e-mail e senha (senha criada em Ajustes, mínimo 10 caracteres)
- [x] Link por e-mail como alternativa (esqueci a senha)
- [x] Supabase configurado pela API: endereço do site, endereços de retorno, link válido por 10 minutos
- [x] Login com Google pronto no código (liga com `GOOGLE_LOGIN_ENABLED=1` + cliente OAuth)
- [x] Lista de convidados (`ALLOWED_EMAILS`); quem não está na lista é desconectado
- [x] Rotas protegidas no servidor (proxy) e no banco (RLS)
- [ ] Código de 6 dígitos no e-mail (exige SMTP próprio, ex.: Resend; o plano grátis do Supabase não deixa mudar o e-mail)
- [x] Novos cadastros desligados no Supabase; o link só entra em contas existentes
- [ ] Convidar novas pessoas pelo painel (criar a conta antes de liberar o e-mail)
- [ ] (Opcional) Ativar o botão do Google

### Conversa
- [x] Conversa em streaming, mostrando qual modelo respondeu
- [x] Roteador de modelos com contingência: Claude → Gemini se o principal falhar antes de responder
- [x] Motor via Vercel AI Gateway com token automático da Vercel (sem chave guardada)
- [x] Memória aprovada entra no contexto; histórico das últimas mensagens
- [x] Prompt estável em cache (mais rápido e mais barato)
- [x] Abre na última conversa; botão "Nova conversa"
- [x] Primeiro login em produção (link por e-mail)
- [x] Registro de falha por motor e aviso claro na conversa (chave, crédito, ocupado)
- [x] Primeira resposta real em produção
- [x] Gasto de cada resposta registrado (tokens e US$) e mostrado em Ajustes
- [x] Teto de gasto mensal por pessoa (`MONTHLY_BUDGET_USD`, hoje US$ 20)
- [x] Crédito colocado: US$ 5 na Anthropic e US$ 20 no AI Gateway da Vercel
- [x] Limite mensal por motor em Ajustes (padrão US$ 5 cada); ao chegar no limite, passa para o outro motor
- [x] Gasto por motor em Ajustes e saldo real do AI Gateway (a Anthropic não tem API de saldo: gasto estimado)
- [ ] Limite mensal também no painel do provedor (segunda trava)

### Voz (grátis, do aparelho)
- [x] Apertar para falar (reconhecimento de voz do navegador, pt-BR)
- [x] GaDu fala a resposta frase a frase, enquanto ela chega
- [x] Interromper tocando no botão
- [x] Modo conversa: volta a ouvir depois de responder
- [x] Sem suporte a voz: o app segue por texto e avisa
- [x] Correção: botão do microfone ficava desativado depois de carregar (detecção agora acontece no aparelho)
- [x] Avisos claros para microfone bloqueado, sem microfone ou sem internet

### Memória
- [x] Memórias propostas pelo GaDu entram como pendentes
- [x] Aprovar, descartar, esquecer, "Lembre que…"
- [x] Termos bloqueados impedem a aprovação

### Segurança, resiliência e custo
- [x] CSP com nonce por requisição, HSTS, X-Frame-Options, Permissions-Policy
- [x] Chaves só no servidor; nada sensível no navegador
- [x] Regra de privacidade: dado sensível não é enviado nem gravado
- [x] Cota diária por pessoa (`DAILY_MESSAGE_LIMIT`)
- [x] Validação de entrada (zod) e limites de tamanho no banco
- [x] PWA instalável; tela offline; rascunho salvo no aparelho
- [x] Nova tentativa automática se a rede cair antes da resposta
- [x] `/api/health` para monitoramento
- [x] Testes automáticos da regra de privacidade e do protocolo de memória

### Visual
- [x] Cérebro neural no centro (login e conversa)
- [x] Robô pequeno no canto direito, que se acende ao conversar
- [x] Robô redesenhado (v0.3): cabeça "squircle", visor de vidro, olhos de LED e boca equalizadora
- [x] Rosto humanoide animado (repouso, escutando, pensando, falando)
- [x] Respeita "reduzir movimento" e pausa quando a aba está escondida

## Voz: resposta falada
- [x] v0: voz do próprio aparelho, frase a frase enquanto a resposta chega (grátis)
- [x] v1: escolher a voz em Ajustes, ajustar a velocidade e ouvir exemplo
- [x] Fala menos robótica: prioriza vozes naturais do aparelho, junta frases curtas, troca símbolos por palavras
- [ ] v2: voz natural (ElevenLabs ou OpenAI) com teto de gasto próprio
- [ ] v3: conversa contínua com interrupção natural

## Fase 1 · Memória e método
- [x] Memória v2: resumo automático de cada conversa (modelo barato, em segundo plano)
- [x] Conversas antigas parecidas entram no contexto (busca por assunto)
- [x] Busca em camadas na aba Memória: memórias, conversas e mensagens
- [x] Importar memórias do Claude, ChatGPT e Gemini (pedido pronto para copiar, colar ou enviar arquivo; tudo entra para revisão)
- [x] "Aprovar todas" nas memórias pendentes
- [x] Lista de conversas anteriores (abrir, buscar, apagar, nova)
- [ ] Busca por significado (embeddings) quando o volume de conversas crescer
- [ ] Receitas (skills) no formato de arquivo simples
- [ ] Escritório com o roteiro do spec-kit (pedido → especificação → plano → tarefas)

## Fase 2 · Conexões pessoais (em andamento)
- [x] Nome na interface: GaDu
- [x] Ícone do app (PWA) com o cérebro neural
- [x] Tabela `google_connections` com RLS; token do Google criptografado (AES-256-GCM, chave só no servidor)
- [x] Chave de criptografia `GOOGLE_TOKEN_KEY` cadastrada na Vercel (sensível)
- [x] Conectar e desconectar o Google em Ajustes › Conexões (OAuth com PKCE, só leitura, revoga ao desconectar)
- [x] Agenda e Gmail entram na conversa só quando o assunto pede (e-mails sensíveis ou com termo bloqueado são omitidos)
- [x] "Começar o dia": briefing falado (agenda, e-mails que pedem ação, foco do dia) e botão para ouvir o Update Diário
- [x] Atalhos na conversa: Começar o dia, agenda de hoje, e-mails importantes
- [x] Link do Update Diário configurável em Ajustes
- [x] Projeto GaDu no Google Cloud, APIs ligadas, cliente OAuth criado
- [x] GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET cadastrados na Vercel
- [x] Páginas públicas de Privacidade e Termos (exigidas pelo Google para publicar)
- [x] Branding preenchido e app publicado no Google
- [x] Primeira conexão do Google em produção (agenda e e-mails funcionando)
- [x] Aba "Hoje" (tela inicial): saudação, Começar o dia, agenda com "agora" e próximos, lembretes, e-mails não lidos com link para o Gmail, memórias para revisar
- [x] Lembretes por voz: "me lembra amanhã às 9h de…" vira lembrete (protocolo META) e também dá para criar na aba Hoje
- [x] Concluir e cancelar lembretes
- [ ] (Depois) Rascunho de resposta no Gmail, com aprovação
- [ ] (Depois) Reservar foco na agenda, com aprovação
- [x] Notificações no celular (Web Push, chaves VAPID só no servidor) com teste em Ajustes
- [x] Agendador a cada minuto (Vercel Cron, protegido por CRON_SECRET) para lembretes e briefing
- [x] Briefing da manhã no horário escolhido (padrão 7h): resumo da agenda, e-mails e lembretes; o toque abre o Começar o dia
- [x] Tabelas `reminders`, `push_subscriptions`, `daily_briefings` com RLS
- [ ] **Você: instalar o GaDu na tela de início do iPhone e ligar as notificações em Ajustes**
- [ ] Spotify pela API (tocar o episódio do dia direto)

## Evolução a partir das referências visuais (10/11)

### Experiência e visual
- [x] "Hoje" como painel no desktop: 3 colunas (cérebro, progresso e atalhos · agenda e lembretes · tarefas e e-mails)
- [x] Humanoide com o cérebro dentro da cabeça (Conversa e Hoje), reagindo à voz; substitui o robô do canto
- [x] Avatar oficial (ilustração) animado: sinapses no cérebro, fones ao escutar, ondas ao falar, âmbar ao pensar, HUD e pedestal girando; usado no login, Hoje e Conversa
- [x] Ícone do app com o avatar e o nome GaDu (versão adaptada para Android)
- [x] Home aberta em "/" (não comercial): avatar animado, pilares, funções, um dia com o GaDu, ilustração do app, arquitetura simples, privacidade, Pessoal e Trabalho, botão Entrar (quem já entrou vai direto ao app)
- [x] Barra "Fale com o GaDu" no topo do Hoje
- [x] Botão de voz flutuante em todas as telas, com painel de resposta (sem sair da tela)
- [x] Menu de baixo sempre fixo
- [x] Agenda visual: semana com faixa de dias, blocos por horário, linha de "agora"; no computador, a semana inteira
- [x] Criar eventos pela voz ("marca dentista quinta às 9") com confirmação, ou tocando num horário vazio
- [ ] **Você: adicionar a permissão calendar.events no Google Cloud e reconectar o Google**
- [x] Cards de vidro e cor por projeto e por agente
- [x] Navegação com ícones: Hoje · Conversa · Projetos · Agentes · Perfil (Memória e Ajustes dentro de Perfil)
- [x] Anel de progresso do dia (tarefas concluídas hoje x pendentes)
- [x] "Como posso ajudar?" no Hoje: priorizar o dia, revisar tarefas, planejar a semana, e-mails que pedem resposta

### Organização e arquitetura de dados
- [x] `tasks` (tarefas): prazo, prioridade, projeto e origem; criadas pela voz ("anota aí…") ou à mão; tarefas abertas entram no contexto do GaDu e no briefing
- [x] E-mail vira tarefa com um toque (com link para o e-mail)
- [x] Insights do GaDu: conflito na agenda, janela livre, tarefas atrasadas, e-mail importante parado (no Hoje, no briefing e no Começar o dia)
- [x] Revisão da noite (opcional): notificação e cartão para passar pendências para amanhã
- [x] `projects` (projetos pessoais): objetivo, próximos passos, status, cor, tarefas e progresso; "Conversar sobre o projeto"
- [x] `agents` (agentes): nome, área, instruções, ícone, cor, ativo; 5 sugestões pessoais; "Conversar com o agente"
- [ ] Agentes com ferramentas permitidas, modelo e teto de gasto próprios
- [ ] `insights`: sugestões geradas no briefing (atrasos, conflitos de agenda, e-mails sem resposta), com "aceitar/ignorar"
- [ ] `metrics` pessoais (opcional): sono, treino, leitura, finanças da casa; só números que você decidir registrar
- [x] Busca por significado (pgvector + embeddings pelo AI Gateway) unindo memórias, conversas, tarefas e projetos; indexação pelo agendador; usada na busca e no contexto da conversa
- [x] Agentes com memória própria (área do agente + preferências)
- [ ] Toda tabela nova com `user_id` e RLS, como hoje (serve outras pessoas sem mudar código)

### Cuidados
- [ ] Nada corporativo: os exemplos das imagens com empresas e métricas de trabalho ficam fora; agentes e métricas são da vida pessoal e dos projetos próprios
- [ ] Métricas só com fonte real (nada inventado na tela)

## Fase 3 · Voz premium (quando aprovar o custo)
- [ ] ElevenLabs para falar e Scribe para ouvir, com chave temporária
- [ ] Teto de gasto mensal e comparação com a voz grátis
- [ ] Detecção de fim de fala e interrupção natural

## Fase 4 · Privacidade
- [ ] Presidio com regras brasileiras (CPF, conta, Pix) no lugar das palavras-chave
- [ ] Transcrição local para assunto sensível

## Pessoas e administração
- [x] Acesso por convite (tabela `members`); o admin não vê conteúdo de ninguém, só a configuração inicial
- [x] Área Admin em Perfil: convidar (nome, e-mail, agentes iniciais, negócio próprio), link de 7 dias pelo WhatsApp, acompanhar ✓, bloquear
- [x] Página do convite: a pessoa cria a senha e já entra, com agentes e projeto prontos
- [x] Regra revisada: nada do empregador entra; o negócio próprio da pessoa pode entrar
- [ ] Convidar o primeiro usuário (Luiz Cláudio)
- [x] Página "Como o GaDu funciona" (arquitetura, fluxo, navegação, dados, segurança, custos)
- [x] Acesso fácil à página: botão "?" no topo de todas as telas, menu ☰ e Perfil › Ajustes
- [x] Guia passo a passo (`/app/guia`): 6 primeiros passos com ✓ automático, "como pedir cada coisa" com exemplos, voz e "se algo der errado"; o "?" abre o guia
- [x] Dicas na primeira visita de cada aba e do botão de voz (Entendi / Ver guia), salvas no perfil; "Rever as dicas" em Ajustes
- [x] Guia e Como funciona dentro da mesma estrutura do app (cabeçalho, menu ☰, menu de baixo e voz flutuante), com alternância Guia | Como funciona

## Marco Zero · segurança (auditoria de 12/11, ver docs/SECURITY_AUDIT_2026-11-12.md no PR #1)
- [x] PR #2: chat bloqueia quando cota, teto mensal ou limites por provedor não podem ser validados (fail closed), com testes de integração. Em produção desde 13/11
- [x] PR #3: cota diária atômica (limite no servidor, dia de Brasília, sem passar do teto), testes SQL e de concorrência. Migração aplicada no Supabase e app em produção desde 13/11
- [x] Remover `consume_quota(integer)` antiga (etapa 2): **publicado em 22/11/2026** (PR #22, migração restritiva `20261122175542` aplicada; conferido no banco: `consume_quota` não existe)
- [x] PR #6: orçamento mensal com reserva e reconciliação (concorrência). Migração aplicada e em produção desde 13/11; validado no uso real
- [ ] Auditoria de RLS, autenticação, permissões e isolamento entre usuários
- [ ] Administração de créditos e consumo por pessoa

## Modelo de trabalho
- [x] GaDu Fast Track documentado (`docs/FAST_TRACK.md`): baixo risco com processo simplificado, alto risco com aprovações específicas
- [x] Documentação central: PROJECT_STATUS, CHANGELOG, FEATURE_MATRIX, ARCHITECTURE e decisões oficiais (PR #7)

## Uso diário · experiência (13/11)
- [x] Mensagens de erro em português por situação e telas de erro próprias (PR #9)
- [x] Voz mais estável: fim da fala só com a resposta inteira, prazo por trecho, despertador no Chrome, um microfone por vez (PR #9)
- [ ] Validar a voz nova no iPhone e no Android
- [x] Teto, reservas e valor disponível do mês em Ajustes (PR #9)
- [x] Design System v1: tokens únicos e `docs/DESIGN_SYSTEM.md` (PR #10)
- [x] Menu lateral no computador; Hoje em 2 ou 3 colunas conforme a largura; conversa com leitura centralizada (PR #10)
- [x] Acessibilidade: atalho de teclado e alvos de toque de 40 px (PR #10)
- [ ] Design System etapa 2: migrar estilos inline e criar componentes compartilhados

## UX/UI v2 (13/11, PR #12)
- [x] Arquitetura de módulos com status real: Pessoal, Financeiro, Agent Office, Agent Office Studio, 3D Studio, Plataforma
- [x] Menu lateral por módulos (computador) e barra de baixo com o assistente no centro e folha de módulos (celular)
- [x] Assistente Universal por voz e texto em qualquer tela, com painel lateral e painel de baixo
- [x] Contrato de contexto do assistente (módulo e tela), validado no servidor, sem ampliar o acesso
- [x] Temas claro e escuro
- [x] Painel Hoje, Conversa, Perfil e ajustes e home pública redesenhados
- [x] Projetos, Agentes, Memória, Admin, Guia e Agenda no desenho da v2 (v2.1, PR #14)
- [x] Auditoria de contraste do tema claro (v2.1: todos os pares AA)
- [ ] Relacionar informações entre módulos (depende de permissões, isolamento e auditoria de segurança)

## Sprint UX/UI v2.1 (14/11, PR #14)
- [x] Paleta azul-marinho e grafite, menos neon, tipografia contemporânea
- [ ] Logo novo (três movimentos): aguardando o arquivo
- [x] Menu com grupos recolhíveis, sem repetir a barra de baixo; barra de baixo menor
- [x] Hoje: saudação por horário, atenção, recomendações reais
- [x] Conversa: palco compacto, microfone no campo, escuta com limite, transcrição revisável
- [x] Assistente: painel alargável no computador; painel de baixo com teclado no celular
- [x] Telas restantes redesenhadas com componentes compartilhados
- [x] Home pública com a visão completa e status reais
- [x] Arquitetura futura do Core Contextual documentada
- [ ] Validação de voz em iPhone e Android (humana; roteiro em docs/CHECKLIST_CELULAR.md)

## Sprint UX/UI v2.2 (14/11, PR #16)
- [x] Busca e avaliação do protótipo "GADU Visual Refresh" no Lovable (docs/LOVABLE_VISUAL_REFRESH.md)
- [x] Navegação híbrida no celular: barra de baixo, tela Módulos e menu da conta pela esquerda, com Voltar do Android
- [x] Menu lateral do computador por área e recolhível
- [x] Assistente em três estados (compacto, rápido, completo) com a mesma conversa; painel com largura ajustável
- [x] Voz: interromper sem reabrir o microfone; mãos-livres protegido; envio automático desligado por padrão
- [x] Pendências da v2.1: alvos de 44 px, cor do tema e manifest, abas e interruptores de Configurações, Agenda, textos, Hoje compacto
- [x] Metas & Conquistas e Casa Inteligente no catálogo como planejados, com especificação
- [x] Planejamento da integração com Samsung Health e Health Connect (docs/INTEGRACOES_SAUDE.md)
- [x] Testes de interface com Playwright (16 cenários)
- [ ] Validar voz, teclado e Voltar em iPhone e Android (humano)
- [ ] Logo novo (aguardando o arquivo)

## Qualidade e Segurança (15/11, PRs #18 e #19)
- [x] Playwright como dependência oficial, com lockfile atualizado
- [x] Testes reproduzíveis depois de `npm ci` (clone limpo, sem `.env`)
- [x] Testes públicos no CI (job `e2e-public`), sem segredos
- [x] Testes com login: falham se faltar credencial (nada é pulado); proposta de execução segura no CI (docs/TESTES_E2E.md)
- [x] Regressão de navegação, assistente, temas e voz simulada (6 + 14 testes)
- [x] Validações de aparelho documentadas (docs/VALIDACAO_APARELHOS.md)
- [x] Auditoria de segurança somente leitura e matriz de riscos (docs/SECURITY_AUDIT_2026-11-15.md)
- [x] Plano do Core Contextual MVP (docs/CORE_CONTEXTUAL_MVP.md)
- [ ] Correções de segurança S-01 a S-09 (alto risco: cada uma com aprovação): ver "Segurança P1" abaixo; S-08 e S-09 seguem abertos
- [ ] Testes com login no CI (segredo em GitHub Environment com revisor: aprovação)

## Isolamento e preparação do Core (16/11, PR #20)
- [x] Banco de teste com todas as migrações (pgvector no local e no CI)
- [x] Isolamento entre pessoas testado em execução nas 18 tabelas, vínculos cruzados, papéis e busca por significado (CI)
- [x] Riscos S-01, S-05, S-07, S-10 e S-12 confirmados em execução (`npm run audit:db`)
- [x] Proposta "O que merece minha atenção hoje?" para decisão (docs/CORE_ATENCAO_HOJE.md)
- [x] Roteiro curto de validação no Android (docs/ROTEIRO_ANDROID.md)
- [x] Decisão sobre a primeira entrega do Core e sobre a correção do S-01 (aprovada pelo Eduardo; S-01 corrigido no PR #22)
- [ ] Logo novo (arquivo ainda não está no repositório nem no Drive)

## Segurança P1 / fase 0 do Core (22/11, PR #22)
Estágio: **publicado em 22/11/2026** (merge `cc85040`, migrações aditiva `20261122175405` e restritiva `20261122175542` aplicadas, deploy no ar; painel do Supabase não alterado). Evidências em PROJECT_STATUS.md e CHANGELOG.md. Detalhe por S-xx em docs/SECURITY_AUDIT_2026-11-15.md; passos manuais em docs/SEGURANCA_P1_MANUAL.md.
- [x] S-01: orçamento (reserva, liquidação, liberação) só pelo servidor, com `service_role` e o id da sessão; custo real gravado mesmo com `already`
- [x] S-02: resposta cortada com texto já enviado é liquidada por estimativa; libera só se nada saiu
- [x] S-07 (etapa 2 da cota): chat fail closed sem `consume_quota`; função revogada e removida
- [x] S-10: pessoa não escreve em `usage_events`
- [x] S-12: `anon` sem acesso ao schema `public`; `authenticated` sem TRUNCATE, REFERENCES e TRIGGER
- [x] S-03 (código): limite de tentativas por IP e por e-mail (hash) em login, código e convite, com 429 em português
- [ ] S-03 (painel): ligar a proteção contra senhas vazadas (manual, seção 2)
- [x] S-04: agendador e `index_backlog` ignoram quem não está ativo
- [x] S-05 (parcial): bloquear encerra sessões; custo e cota recusam quem não está ativo
- [ ] S-05 (resto): RLS de escrita por acesso
- [x] S-06: admin não bloqueia admin, `ADMIN_EMAILS` nem a si mesmo
- [x] S-11: proxy responde 503 nas rotas protegidas sem a configuração do Supabase
- [x] Testes: SQL (`test:db`, com compatibilidade da migração aditiva e corrida de liquidação), integração (chat, limite de tentativas, bloqueio de admin, agendador, proxy) e unitários
- [x] **Publicar:** migração aditiva → deploy → migração restritiva (feito em 22/11/2026)
- [ ] Verificar em produção, com uma pessoa logada: chat e encerramento de sessões ao bloquear (não verificados)
- [x] Plano Supabase conferido: Free (sem backups automáticos baixáveis nem PITR)
- [ ] S-09: decisão do Eduardo (plano Pro ou dump lógico agendado); depois RPO, RTO e ensaio de restauração
- [ ] Passos manuais: senhas vazadas, Vercel Firewall (opcional)
- [ ] S-08 (organizações), S-13, S-14, S-15: fora desta entrega


## Core Contextual · fase 1: "O que merece minha atenção hoje?" (22/11, PR #24)
Estágio: **publicado em 22/11/2026 às 15:42 (Brasília)**, merge `215edab`, CI verde, deploy `success`, e2e público 7 de 7 em produção, sem migração. Aprovado pelo Eduardo. Detalhe em docs/CORE_ATENCAO_HOJE.md e docs/CORE_CONTEXTUAL_MVP.md.
- [x] `src/lib/core/` (escopos, plano por regra, fontes de tarefas, lembretes, agenda e e-mail, coleta, formato, limites, privacidade)
- [x] Chat: intenção "atencao_hoje" injeta o bloco do Core (etiquetas T/L/A/E, indisponíveis explícitos), sem IA extra e com a reserva/cota de sempre
- [x] "Fontes" recolhível sob a resposta, com link para a tela de origem
- [x] Cartão "Merece sua atenção" na tela Hoje (`/api/attention`, sem IA, custo zero de modelo)
- [x] Gmail só leitura e enxuto (até 5, remetente e assunto), só com o escopo já concedido
- [x] Interruptor `CORE_MVP=0` (ligado por padrão, porque não há acesso às variáveis da Vercel agora)
- [x] Testes: unitários, integração (com e sem flag, A x B, Google desconectado), `test:db` (consulta do Core como B), e2e público (401)
- [x] Nenhuma migração nova
- [ ] Validar em celular de verdade (390 px) com uma pessoa logada e dados reais (os testes de interface com login não rodaram aqui)
- [x] Publicar (PR #24, CI verde, merge, deploy; produção: home 200, `/api/attention` 401 sem sessão, `/api/health` ok, e2e público 7 de 7; `CORE_MVP` não definida na Vercel, ligado por padrão)
- [ ] Validar em produção com pessoa logada: tela Hoje e Fontes, Gmail e agenda reais, voz no aparelho; medir o custo por mensagem
- [ ] Próximo: auditoria sem conteúdo (`core_audit`, fase 3, alto risco) e priorização pela tela aberta (fase 2)

## Finanças · Base (fase 1 da especificação; PR #26, 22/11/2026)
Estágio: **publicada** (merge `41eb3ed`, 22/11/2026 às 16:44, Brasília). Aprovada pelo Eduardo, inclusive as tabelas novas. Detalhe e decisões em [docs/FEATURE-FINANCAS.md](docs/FEATURE-FINANCAS.md).
- [x] Migração `20261122190001_financas_base.sql`: `fin_itens`, `fin_item_meses`, `fin_gastos`, `fin_config` (user_id, RLS com `(select auth.uid())`, só `authenticated`, nada para `anon`, CHECKs, índices por `(user_id, ano, mes)`, vínculos por chave composta, rollback no topo)
- [x] Cálculos puros em `src/lib/finance/` (resumo do mês, vínculos cartão/segue, previsão até o próximo recebimento, validação de lançamento) com testes unitários
- [x] API `/api/finance/*` (resumo, itens, valor/pago por mês, gastos, config): sessão obrigatória, zod, `user_id` da sessão, cliente da sessão (RLS)
- [x] Tela Financeiro (mobile first): saldo/sobra, resumo, por categoria, previsão, abas Contas e Dia a dia, adicionar/editar/apagar, marcar pago, seletor de mês, estados vazios; módulo passa de "planejado" para Beta
- [x] Assistente: fonte `finance` do Core ([F1]…, Fontes, sem IA extra) e lançar gasto como proposta que a pessoa confirma
- [x] Interruptor `FINANCE_ENABLED=0` (ligado por padrão); `CORE_MVP=0` desliga a fonte `finance`
- [x] Testes: banco (isolamento A x B nas 4 tabelas e na suíte geral, CHECKs, vínculos, privilégios), unitários, integração (rotas, chat, interruptores), e2e público (12 rotas 401)
- [x] Aplicar a migração no Supabase (antes do merge, só aditiva; versão `20261122194404`; 4 tabelas com RLS, 4 políticas cada, `anon` sem SELECT; assessor sem avisos novos) e publicar (PR #26, CI verde, deploy `success`; produção: home 200, `/api/finance/resumo` 401 sem sessão, `/api/health` ok, e2e público 8 de 8; `FINANCE_ENABLED` e `CORE_MVP` não definidas na Vercel, ligado por padrão)
- [ ] Validar tela Financeiro e lançamento pela conversa com pessoa logada, em aparelho (390 px)
- [ ] Próximo: simulador bruto → líquido (INSS/IRRF por ano), teto por categoria, acumulado do ano, fase Conversa (marcar pago e lançar fixos por texto/áudio, log, "a confirmar", regras)

## Validação de uso diário no celular (22/11/2026, PR #28, **publicado**; aparelho real pendente)
- [x] Suíte `e2e/mobile.e2e.cjs` com 5 perfis emulados (Pixel 7, Galaxy S9+, 412x915 Chrome e Samsung Internet, iPhone WebKit), no job `e2e-public` do CI
- [x] Instalabilidade pelo CDP (`Page.getInstallabilityErrors`), manifest, ícones, service worker e offline verificados (local e produção)
- [x] Voltar do Android com uma entrada por camada (menu, histórico, assistente)
- [x] Voz: fala em trechos curtos, sem pause/resume no Android, reconhecimento sem HTTP e com mensagens por erro, microfone para em segundo plano
- [x] Push: reinscrição (`pushsubscriptionchange`), clique abre a rota certa, selo monocromático, permissão negada explicada
- [x] CSP da tela offline, alvos de toque, `enterkeyhint`/`autocomplete`, `touch-action`
- [x] Checklist para o Galaxy S26 Ultra e iPhone (docs/CHECKLIST_CELULAR.md)
- [ ] Rodar o checklist no aparelho de verdade (Chrome, Samsung Internet, iPhone) e registrar
- [x] Publicar: PR #28 integrado em 22/11/2026 às 17:19 (Brasília), merge `97f4d642ebe695286ceaabc80d83b05cf47b304d`, CI verde, deploy Vercel `success`, e2e público 8/8 e mobile na produção (43/44 antes do ajuste do teste WebKit offline, 44/44 com o ajuste rodando local contra a produção)

## Próximo ciclo (prioridades, em ordem)
1. Auditoria de RLS e isolamento multiusuário e multiempresa.
2. Core Contextual (depende do item 1).
3. Financeiro: base publicada (PR #26); validar com pessoa logada, depois simulador bruto → líquido.
4. Agent Office: organizações, clientes, membros e papéis.
5. Agent Office Studio.
6. 3D Studio.
7. Observabilidade, alertas de erro e créditos por pessoa.
8. Testes de ponta a ponta automatizados e validação de voz nos aparelhos.

## Módulos futuros (planejados, sem código)
- [~] Financeiro: base publicada (ver "Finanças · Base" abaixo); o restante da especificação (`docs/FEATURE-FINANCAS.md`) segue planejado
- [ ] Metas & Conquistas: fase 1 em desenvolvimento (abaixo); fases 2 a 6 em docs/METAS_CONQUISTAS.md (projetos e agenda, recomendações, indicadores do Financeiro e de saúde, metas compartilhadas)

## Metas · Base (fase 1 da especificação; branch `feat/metas-base`)
Estágio: **publicada** em 22/11/2026 às 18:33 (Brasília), PR #30, merge `901e27d`. CI verde (verify, e2e-public, database). Migração `metas_base` aplicada na produção antes do merge (só aditiva); conferido: `goals`, `goal_progress`, `goal_milestones` e `goal_tasks` com RLS, 4 políticas cada, `anon` sem SELECT. Deploy de produção da Vercel concluído; home 200, `/api/goals` sem sessão 401, `/api/health` ok; e2e público contra a produção 9/9. `GOALS_ENABLED` não definida na Vercel (ligado por padrão). **Não verificado:** tela Metas, resumo do Hoje e propostas no chat com pessoa logada e em aparelho. Aprovada pelo Eduardo, inclusive as tabelas novas. Detalhe e decisões em [docs/METAS_CONQUISTAS.md](docs/METAS_CONQUISTAS.md).
- [x] Migração `20261122210001_metas_base.sql`: `goals`, `goal_progress`, `goal_milestones`, `goal_tasks` (RLS com `(select auth.uid())`, só `authenticated`, chaves compostas `(id, user_id)`, CHECKs, rollback no topo); só aditiva (uma restrição de unicidade em `tasks`)
- [x] Cálculos puros em `src/lib/goals/` (progresso, ritmo necessário, no ritmo/atrasada/vencida, por tarefas concluídas, metas que pedem atenção) com testes unitários
- [x] API `/api/goals/*` (lista, criar, editar/arquivar, detalhe, progresso, marcos, tarefas, resumo): sessão obrigatória, zod, `user_id` da sessão
- [x] Tela Metas (mobile first, lista por situação e categoria, detalhe com histórico e tarefas, criar/editar, registrar progresso); módulo vira Beta; resumo no Hoje
- [x] Assistente: fonte `goals` do Core ([M1]…, Fontes) e atualização ("corri 5 km hoje", "conclui a meta X") como proposta com confirmação, sem IA extra
- [x] Interruptor `GOALS_ENABLED=0`; `CORE_MVP=0` desliga a fonte e as propostas
- [x] Testes: isolamento A×B nas 4 tabelas, CHECKs, integração (401, user_id, proposta sem gravar, interruptores), e2e público 9/9 e mobile 44/44
- [ ] Revisão do Eduardo, PR, aplicar a migração na produção (aprovação explícita), publicar, validar com pessoa logada em aparelho
- [ ] Depois: conquistas, recomendações, hábito simples, vínculo com projetos e agenda, indicadores do Financeiro, metas compartilhadas
- [ ] Casa Inteligente (GaDu Casa): ver docs/CASA_INTELIGENTE.md (Home Assistant como camada recomendada; Alexa via Home Assistant; Tuya direto como opção; confirmação e regras para dispositivos críticos)
- [ ] Saúde: Samsung Health e Health Connect por conector Android desacoplado, depois de importação manual (docs/INTEGRACOES_SAUDE.md). App nativo exige aprovação específica
- [ ] 3D Studio: busca de modelos gratuitos respeitando licenças, biblioteca, geração de modelos imprimíveis, exportação para fatiador
- [ ] Agent Office Studio: agentes que criam sites, aplicações web e PWAs, com execução isolada e aprovação; sem app nativo Android/iOS nesta fase
- [ ] Voz e texto em todos os módulos novos (decisão oficial)

## Fase 6 · Agentes Pessoal e Trabalho (proposta em discussão, ver docs/PLANO-AGENTES.md)
- [ ] 6.1 Fundamentos: espaços Pessoal e Trabalho; agentes com categoria, papel, hierarquia, autonomia e teto; organograma
- [ ] 6.2 CRM leve: clientes, contatos, funil, atividades; agente Comercial; "antes da reunião"
- [ ] 6.3 Orquestração: CEO delega às áreas; caixa de aprovações; registro de execuções; relatório semanal
- [ ] 6.4 Execução: rotinas por agente; rascunhos de e-mail com aprovação; notas de reunião viram tarefas; documentos
- [ ] 6.5 Métricas: painel por área e metas do trimestre
- [ ] Convidar o Luiz Cláudio depois da 6.2

## Finanças pessoais (proposta, ver docs/FEATURE-FINANCAS.md)
- [x] Especificação de referência: telas, modelo de dados, regras de cálculo, entrada pela conversa e deduplicação
- [ ] Base: tabelas `fin_*` com RLS, abas Contas e Dia a dia
- [ ] Conversa: lançar e classificar por texto e voz, pendências "a confirmar", regras de classificação
- [ ] Arquivos: print e PDF de extrato com deduplicação e saldo do banco
- [ ] Caixa, Plano, Simulador e Ano

## Por último (combinado em 10/11)
- [ ] Testes automáticos de ponta a ponta antes de publicar e alerta de erro (tela de erro própria: feita no PR #9)
- [ ] Ações com aprovação no Gmail (rascunhos) e foco na agenda
- [ ] Voz natural paga (ElevenLabs/OpenAI) com teto próprio

## Fase 5 · Escritório real e versão para outras pessoas
- [ ] Agentes executando em sessões do Claude Code, com aprovação
- [ ] Convites por e-mail e painel de administração
- [ ] Guia de instalação para outra pessoa (um projeto Supabase + Vercel por pessoa, ou multiusuário)

## Operação
- [ ] Monitoramento de erros e alerta de saúde
- [ ] Backups do banco conferidos (plano grátis: diário, 7 dias)
- [ ] Domínio próprio
