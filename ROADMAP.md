# Gadu · Roadmap

Atualizado a cada entrega. Última atualização: 08/11/2026 (v0.2.0). Produção: https://gadu-agent.vercel.app `[x]` feito · `[ ]` falta · `[~]` em andamento.
Princípios: mobile first, segurança, resiliência, contingência e pronto para outras pessoas usarem (cada pessoa vê só os próprios dados).

## Fase 0 · MVP publicado (v0.1)

### Fundação
- [x] Repositório próprio, separado de qualquer projeto corporativo
- [x] Next.js 16 (App Router) + TypeScript estrito
- [x] Projeto `gadu-agent` na Vercel (Pro), ligado ao GitHub: cada envio ao `main` publica sozinho
- [x] Variáveis cadastradas pela API da Vercel (nenhuma secreta)
- [x] Ambiente de trabalho "Gadu" no Claude com tokens da Vercel e do Supabase isolados
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
- [ ] **Primeira resposta real em produção** (nome do modelo corrigido; se ainda falhar, o aviso diz se é chave ou crédito)
- [x] Gasto de cada resposta registrado (tokens e US$) e mostrado em Ajustes
- [x] Teto de gasto mensal por pessoa (`MONTHLY_BUDGET_USD`, hoje US$ 20)
- [ ] **Colocar crédito na Anthropic** (a conta está sem saldo; o Gateway da Vercel também exige crédito pago)
- [ ] Limite mensal também no painel do provedor (segunda trava)

### Voz (grátis, do aparelho)
- [x] Apertar para falar (reconhecimento de voz do navegador, pt-BR)
- [x] Gadu fala a resposta frase a frase, enquanto ela chega
- [x] Interromper tocando no botão
- [x] Modo conversa: volta a ouvir depois de responder
- [x] Sem suporte a voz: o app segue por texto e avisa
- [x] Correção: botão do microfone ficava desativado depois de carregar (detecção agora acontece no aparelho)
- [x] Avisos claros para microfone bloqueado, sem microfone ou sem internet

### Memória
- [x] Memórias propostas pelo Gadu entram como pendentes
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
- [x] Rosto humanoide pequeno no canto direito, que se acende ao conversar
- [x] Rosto humanoide animado (repouso, escutando, pensando, falando)
- [x] Respeita "reduzir movimento" e pausa quando a aba está escondida

## Voz: resposta falada
- [x] v0: voz do próprio aparelho, frase a frase enquanto a resposta chega (grátis)
- [ ] v1: escolher a voz em Ajustes e ajustar a velocidade
- [ ] v2: voz natural (ElevenLabs ou OpenAI) com teto de gasto próprio
- [ ] v3: conversa contínua com interrupção natural

## Fase 1 · Memória e método
- [ ] Memória v2: resumo de cada conversa e busca em camadas (ideias do claude-mem e do mem0)
- [ ] Importar memórias exportadas do Claude, GPT e Gemini
- [ ] Lista de conversas anteriores
- [ ] Receitas (skills) no formato de arquivo simples
- [ ] Escritório com o roteiro do spec-kit (pedido → especificação → plano → tarefas)

## Fase 2 · Conexões pessoais
- [ ] Gmail (ler e criar rascunhos) com escopos mínimos
- [ ] Google Agenda (ler e reservar foco)
- [ ] Spotify (Update Diário)
- [ ] "Começar o dia" e briefing às 7h no celular (notificação)

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
