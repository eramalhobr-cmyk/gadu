# Piloto de voz pelo Vercel AI Gateway

Transcrição (fala → texto) e, depois, voz natural (texto → fala) por modelos pagos, comparados antes de entrar no app. O microfone do GaDu continua no aparelho (grátis) até uma decisão com base nos resultados abaixo.

## Decisões registradas

| Data | Decisão | Quem |
|---|---|---|
| 24/11/2026 | O piloto usa o **Vercel AI Gateway**, não a chave da OpenAI direto: mesma autenticação do chat (OIDC na Vercel), cobrança nos créditos da Vercel, registros no painel do Gateway e troca de modelo pelo nome. Substitui o caminho `api.openai.com` + `OPENAI_API_KEY` do plano anterior (`PILOTO_VOZ_OPENAI.md`). | Eduardo (aprovado), Claude Code |
| 24/11/2026 | Comparar 3 a 4 modelos de transcrição com frases fictícias do GaDu antes de escolher; nenhum áudio ou transcrição é guardado. | Eduardo, Claude Code |
| 24/11/2026 | O erro de palavras é medido de forma **justa**: número por extenso = dígito, "R$ 52" = "52 reais", "pro/pra" = "para o/para". O erro bruto aparece ao lado, para nada ficar escondido. | Claude Code |
| 24/11/2026 | Integrar no app só depois de uma rodada com **voz real** (gravações do Eduardo, com ruído) e da migração do controle de gasto (`usage_events`/orçamento aceitarem o tipo "transcrição"), com aprovação. | Eduardo, Claude Code |
| {D} | **Eduardo aprovou implementar já**, com a migração do orçamento (`20261124230001_orcamento_transcricao.sql`, aplicada em produção). A rodada com voz real continua para confirmar o modelo, mas agora pode ser feita no próprio app. | Eduardo (aprovado), Claude Code |
| {D} | **O modelo é configuração, não código:** `TRANSCRIBE_MODELS="principal,reserva"` na Vercel. Padrão: `microsoft/mai-transcribe-2` (mais rápido e barato na rodada 1), com `openai/gpt-transcribe` de reserva automática. Trocar de modelo não apaga memória, histórico nem dados (ficam no banco do GaDu) e vale só para as próximas falas. | Eduardo, Claude Code |
| {D} | **Opcional e desligado por padrão:** cada pessoa liga em Ajustes ("Transcrição na nuvem"). `TRANSCRIBE_ENABLED=0` desliga para todos. A confirmação falada (sim/não) continua no microfone do aparelho: curta, grátis e sem espera. | Claude Code |
| {D} | **O app grava WAV (PCM 16 kHz mono), não webm/m4a:** no teste, a Microsoft recusou webm e m4a (o que o navegador grava por padrão); WAV funcionou nos 3 modelos testados. 20 s de fala ≈ 640 KB. | Claude Code (teste real) |
| {D} | **Se a nuvem falhar, o GaDu volta ao microfone do aparelho** (teto do mês atingido, desligada ou fora do ar) e avisa. Custo: reserva no orçamento antes, liquidação pelo custo real depois (US$ 0,00002778/s na Microsoft, arredondado ao segundo). O áudio não é guardado em lugar nenhum. | Claude Code |

## Como rodar (máquina de teste, nunca no app)

Precisa de uma chave do AI Gateway no ambiente (`AI_GATEWAY_API_KEY`). No ambiente Cloud do Claude, ela fica salva como segredo de rede do host `ai-gateway.vercel.sh`: use `AI_GATEWAY_API_KEY=proxy-injected` e, para o `fetch` do Node passar pelo proxy, `NODE_USE_ENV_PROXY=1`.

```bash
node scripts/piloto-voz/gerar-audios.mjs .piloto-voz openai/tts-1 alloy        # 6 clipes de teste (voz sintética)
node scripts/piloto-voz/comparar.mjs .piloto-voz openai/gpt-transcribe,microsoft/mai-transcribe-2,elevenlabs/scribe-v2,spacexai/grok-stt
node scripts/piloto-transcricao.mjs --enviar --modelo microsoft/mai-transcribe-2 minha-gravacao.wav   # um arquivo só
```

A pasta `.piloto-voz/` é ignorada pelo git. Endpoints do Gateway: `POST /v4/ai/transcription-model` e `POST /v4/ai/speech-model` (áudio em base64 num JSON, modelo no cabeçalho `ai-model-id`). Preços vêm ao vivo de `/v1/models`.

## Rodada 1 · 24/11/2026 20:12 · voz sintética (`openai/tts-1`, voz alloy), 6 frases

| Modelo | Erro de palavras (justo) | Erro bruto | Tempo médio | Custo (6 frases) |
|---|---|---|---|---|
| `microsoft/mai-transcribe-2` | 0% | 14,3% | **0,36 s** | **US$ 0,0006** |
| `spacexai/grok-stt` | 0% | 2,8% | 0,46 s | US$ 0,0006 |
| `elevenlabs/scribe-v2` | 0% | 13,5% | 0,46 s | US$ 0,0014 |
| `openai/gpt-transcribe` | 0% | 3,7% | 0,74 s | US$ 0,0019 |

**Leitura:** com voz limpa, todos acertam tudo; o erro bruto é só formatação (Microsoft e ElevenLabs escrevem números em dígitos, "R$52"; todos escrevem "pro dentista"). Dígitos são até melhores para o GaDu ler valores e horários. Em 5 min/dia por 30 dias, o mais barato sai por cerca de US$ 0,25/mês e o mais caro por US$ 0,68/mês.

**Limite desta rodada:** voz sintética é fácil. Ela não diz qual modelo é melhor com voz real, sotaque, ruído e fala rápida.

## No app ({D})

- Ajustes → **Transcrição na nuvem**. Com ela ligada, o microfone do GaDu grava, para sozinho depois de 1,6 s de silêncio (ou em 20 s), mostra "Transcrevendo…" e põe o texto no campo, como antes.
- Código: `src/lib/voz/wav.ts` (montar e conferir o WAV), `src/lib/voz/gravador.ts` (gravação no aparelho), `src/lib/voz/transcricao.ts` (modelos, preço, reserva), `src/app/api/voz/transcrever/route.ts`.
- Testado: unidade (WAV, modelos, custo, reserva automática), banco (`98_orcamento_transcricao.test.sql`), chamada real ao Gateway (Microsoft e reserva OpenAI) e navegador Chromium com microfone simulado (fala → texto; silêncio → "não ouvi nada").
- Gasto aparece em Ajustes junto do chat (motor "gateway"); em `usage_events`, `kind = 'transcribe'`, `input_tokens` = segundos de áudio.

## Próximos passos

0. **Validar no celular:** ligar em Ajustes e ditar algumas frases (com e sem barulho). Se a Microsoft errar mais que o aparelho, trocar `TRANSCRIBE_MODELS` para `openai/gpt-transcribe` (sem publicar de novo).
1. **Rodada 2 com voz real:** o Eduardo grava 6 a 10 frases no celular (algumas com barulho: carro, cozinha, rua), salva em `.piloto-voz/` com os mesmos nomes (`lista.mp3`, `gasto.mp3`…) ou acrescenta frases em `scripts/piloto-voz/lib.mjs`; roda o `comparar.mjs`. Comparar também com o que o microfone do aparelho entendeu na mesma frase.
2. ~~Integração no app~~ feita em {D} (ver "No app").
3. Voz natural (texto → fala) pelo mesmo Gateway, na Fase 3 do roadmap, com o mesmo método de comparação.
