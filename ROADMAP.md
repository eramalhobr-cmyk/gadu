# GaDu · Roadmap

Atualizado a cada entrega. Última atualização: 13/11/2026 (tarde). Produção: https://gadu-agent.vercel.app (commit `fd77f84`).
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
| Assistente universal de voz e texto | Falar ou digitar em qualquer tela e módulo | implementado (voz do aparelho); modo conversa em beta, com estabilidade melhorada no PR #9 (falta validar nos aparelhos) | P1 | — | validar no iPhone e no Android; depois voz natural paga com teto |
| Inteligência contextual | Conectar memória, agenda, tarefas, e-mail e módulos, respeitando permissões | implementado (memória, busca por significado, insights) | P1 | módulos futuros | contexto de Finanças e Office com permissões |
| Financeiro | Controle mensal pela conversa: lançar, classificar, prever caixa | planejado (especificação no PR #5) | P1 | tabelas `fin_*` com RLS | revisar o PR #5; base Contas e Dia a dia |
| Tarefas, agenda e memórias | Organizar o dia com voz | implementado; notificações e criação de eventos em beta | P1 | permissão `calendar.events`; PWA instalado | liberar a permissão; instalar o PWA no iPhone |
| Agent Office e agentes | Agentes por área, multiusuário, organizações e clientes | agentes simples implementados; Office planejado | P2 | PR #6 (teto por agente); isolamento por organização | 6.1 fundamentos (docs/PLANO-AGENTES.md) |
| Agent Office Studio | Agentes que criam sites, aplicações web e PWAs (sem app nativo nesta fase) | planejado | P3 | Agent Office; execução isolada | especificar depois do Office |
| 3D Studio e impressão 3D | Buscar, organizar e gerar modelos imprimíveis; exportar para fatiador | planejado | P2 | — | especificar depois do GaDu Personal, antes do Agent Office |
| Integrações, segurança e permissões | Isolamento por pessoa, custos sob controle, integrações autorizadas | implementado (RLS, fail closed, cota atômica, orçamento com reserva, CI); auditoria completa pendente | P0 | — | etapa 2 da cota; auditoria de RLS; créditos por pessoa; alerta de erro |
| Home pública, dashboard e desktop/mobile | Primeira impressão e uso diário em qualquer tela | implementado: home, Hoje em painel, PWA, avatar oficial, Design System v1 com menu lateral no computador e layouts para tablet (PR #10), telas de erro (PR #9) | P1 | — | Design System etapa 2: migrar estilos inline; componentes compartilhados |

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
- [ ] Remover `consume_quota(integer)` antiga (etapa 2, depois de 24h estável)
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

## Módulos futuros (planejados, sem código)
- [ ] Financeiro: ver a seção "Finanças pessoais" no PR #5 (`docs/FEATURE-FINANCAS.md`)
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
