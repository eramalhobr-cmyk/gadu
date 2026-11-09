# GaDu · Roadmap

Atualizado a cada entrega. Última atualização: 10/11/2026 (v0.6.0). Produção: https://gadu-agent.vercel.app `[x]` feito · `[ ]` falta · `[~]` em andamento.
Princípios: mobile first, segurança, resiliência, contingência e pronto para outras pessoas usarem (cada pessoa vê só os próprios dados).

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
- [ ] Hero com cérebro + humanoide estilizado (o cérebro dentro da cabeça), reagindo à voz
- [ ] Barra "Fale com o GaDu" fixa no topo do Hoje (atalho para a conversa por voz)
- [x] Cards de vidro e cor por projeto e por agente
- [x] Navegação com ícones: Hoje · Conversa · Projetos · Agentes · Perfil (Memória e Ajustes dentro de Perfil)
- [x] Anel de progresso do dia (tarefas concluídas hoje x pendentes)
- [x] "Como posso ajudar?" no Hoje: priorizar o dia, revisar tarefas, planejar a semana, e-mails que pedem resposta

### Organização e arquitetura de dados
- [x] `tasks` (tarefas): prazo, prioridade, projeto e origem; criadas pela voz ("anota aí…") ou à mão; tarefas abertas entram no contexto do GaDu e no briefing
- [ ] Transformar e-mail em tarefa com um toque
- [x] `projects` (projetos pessoais): objetivo, próximos passos, status, cor, tarefas e progresso; "Conversar sobre o projeto"
- [x] `agents` (agentes): nome, área, instruções, ícone, cor, ativo; 5 sugestões pessoais; "Conversar com o agente"
- [ ] Agentes com ferramentas permitidas, modelo e teto de gasto próprios
- [ ] `insights`: sugestões geradas no briefing (atrasos, conflitos de agenda, e-mails sem resposta), com "aceitar/ignorar"
- [ ] `metrics` pessoais (opcional): sono, treino, leitura, finanças da casa; só números que você decidir registrar
- [ ] Busca por significado (pgvector) unindo conversas, memórias, tarefas e projetos
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

## Fase 5 · Escritório real e versão para outras pessoas
- [ ] Agentes executando em sessões do Claude Code, com aprovação
- [ ] Convites por e-mail e painel de administração
- [ ] Guia de instalação para outra pessoa (um projeto Supabase + Vercel por pessoa, ou multiusuário)

## Operação
- [ ] Monitoramento de erros e alerta de saúde
- [ ] Backups do banco conferidos (plano grátis: diário, 7 dias)
- [ ] Domínio próprio
