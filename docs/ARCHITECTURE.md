# Arquitetura

```
Celular / computador (PWA)
  │  HTTPS
  ▼
Vercel (rede global, funções sem estado)
  ├─ proxy.ts ........ sessão, CSP com nonce, bloqueio de rotas
  ├─ /auth/* ......... login Google (OAuth + PKCE)
  ├─ /api/chat ....... privacidade → cota → contexto → roteador → streaming → grava
  └─ /api/health ..... saúde
  │
  ├──► Supabase (São Paulo): Postgres + Auth, RLS em tudo
  └──► Provedores de IA (adaptadores): Claude → Gemini (contingência)
```

## Decisões

- **Sem estado no servidor.** Cada requisição é independente; a Vercel escala horizontalmente e em várias regiões. Todo estado fica no Postgres.
- **Isolamento por pessoa no banco.** RLS com `(select auth.uid()) = user_id` em todas as tabelas. Mesmo um bug no app não expõe dados de outra pessoa.
- **Adaptadores de modelo.** `src/lib/llm/*`: um provedor novo é um arquivo novo. O roteador troca de provedor se o principal falhar antes de responder, sem misturar respostas.
- **Streaming de ponta a ponta.** O servidor manda eventos NDJSON; o app mostra e fala frase a frase.
- **Cache de prompt.** A parte estável do prompt vai para o cache do provedor; memória e data ficam num bloco separado.
- **Voz no aparelho.** Reconhecimento e síntese do próprio navegador (custo zero). A troca por ElevenLabs/Scribe na fase 3 não muda o servidor de conversa.
- **Memória com aprovação.** O modelo propõe; só o que a pessoa aprova volta para o contexto.

## Resiliência e contingência

| Falha | O que acontece |
|---|---|
| Motor principal fora | Roteador tenta o Gemini (se configurado) |
| Nenhum motor configurado | Aviso claro na conversa, app continua |
| Rede cai antes da resposta | App tenta de novo uma vez; se falhar, a mensagem volta para o rascunho |
| Sem internet | PWA abre a tela offline; rascunho fica salvo no aparelho |
| Banco lento ao gravar | A resposta já foi entregue; a gravação acontece depois |
| Gasto fora do controle | Cota diária por pessoa no banco |

## Escala

Para muitas pessoas: o mesmo código, com `ALLOWED_EMAILS` trocado por convites no banco, e índices já criados por `user_id`. O próximo gargalo previsível é a cota de IA por conta; resolve-se com chaves por pessoa ou plano pago.
