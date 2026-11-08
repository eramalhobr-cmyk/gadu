# Gadu · Roadmap

Atualizado a cada entrega. `[x]` feito · `[ ]` falta · `[~]` em andamento.
Princípios: mobile first, segurança, resiliência, contingência e pronto para outras pessoas usarem (cada pessoa vê só os próprios dados).

## Fase 0 · MVP publicado (v0.1)

### Fundação
- [x] Repositório próprio, separado de qualquer projeto corporativo
- [x] Next.js 16 (App Router) + TypeScript estrito, publicado na Vercel
- [x] Banco Supabase próprio (São Paulo) com RLS em todas as tabelas
- [x] Esquema multiusuário: perfis, conversas, mensagens, memórias, cota diária
- [x] Migração versionada em `supabase/migrations`
- [x] ROADMAP, README, ARQUITETURA e SEGURANÇA documentados

### Acesso
- [x] Login com Google (OAuth com PKCE via Supabase Auth)
- [x] Lista de convidados (`ALLOWED_EMAILS`); quem não está na lista é desconectado
- [x] Rotas protegidas no servidor (proxy) e no banco (RLS)
- [ ] **Configurar o cliente OAuth do Google e ativar o provedor no Supabase** (passo manual, ver README)

### Conversa
- [x] Conversa em streaming, mostrando qual modelo respondeu
- [x] Roteador de modelos com contingência: Claude → Gemini se o principal falhar antes de responder
- [x] Memória aprovada entra no contexto; histórico das últimas mensagens
- [x] Prompt estável em cache (mais rápido e mais barato)
- [x] Abre na última conversa; botão "Nova conversa"
- [ ] **Cadastrar `ANTHROPIC_API_KEY` na Vercel** (passo manual)

### Voz (grátis, do aparelho)
- [x] Apertar para falar (reconhecimento de voz do navegador, pt-BR)
- [x] Gadu fala a resposta frase a frase, enquanto ela chega
- [x] Interromper tocando no botão
- [x] Modo conversa: volta a ouvir depois de responder
- [x] Sem suporte a voz: o app segue por texto e avisa

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

### Robô
- [x] Rosto humanoide animado (repouso, escutando, pensando, falando)
- [x] Respeita "reduzir movimento" e pausa quando a aba está escondida

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
