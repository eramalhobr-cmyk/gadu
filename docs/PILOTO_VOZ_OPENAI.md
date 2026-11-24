# Piloto de voz OpenAI

A primeira etapa mede transcrição de clipes curtos em português brasileiro com `gpt-transcribe`. O comando local recebe um WAV PCM mono, 16 kHz e 16 bits, com até 20 segundos. A execução padrão só mede a duração e imprime o custo estimado. Com `--enviar`, o script faz uma chamada e mostra a transcrição e a latência. Use áudio fictício ou autorizado, sem e-mails, nomes ou dados pessoais.

```bash
ffmpeg -i amostra-original.m4a -t 20 -ac 1 -ar 16000 -c:a pcm_s16le -fflags +bitexact -flags:a +bitexact amostra.wav
node scripts/piloto-transcricao.mjs amostra.wav
node scripts/piloto-transcricao.mjs --enviar amostra.wav
```

A última linha usa `OPENAI_API_KEY` no ambiente de teste e envia o áudio à OpenAI. O script não guarda o áudio nem a transcrição. A transcrição é exibida no terminal. A US$ 0,0045 por minuto, um clipe de 20 segundos custa cerca de US$ 0,0015, e cinco minutos por dia por 30 dias custam cerca de US$ 0,68. [Preços](https://developers.openai.com/api/docs/pricing) · [Transcrição](https://developers.openai.com/api/docs/guides/speech-to-text)

## Retomada no Cloud

1. Rodar o piloto com chave de teste e frases fictícias de Compras, Lista e Agenda de filhos. Anotar acerto, demora e necessidade de corrigir, comparando com a mesma frase na voz atual.
2. Antes de habilitar uma rota paga, revisar o controle de orçamento. Hoje `usage_events` e `server_settle_ai_budget` restringem os provedores, e reserva e consumo restringem os tipos a chat, resumo e importação. Preparar migração aditiva e testes de orçamento, sessão, limites e concorrência. A chave fica no servidor.
3. Integrar captura curta opcional ao microfone, com transcrição editável antes de enviar, alternativa do aparelho e interruptor do piloto. Separar a decisão sobre fala natural e conversa contínua.
4. Em paralelo, validar Abrir e-mail e Voltar no Android com duas contas, a leitura completa com uma resposta longa e o agrupamento de Compras com dados autorizados. Se ainda houver cortes com a opção de respostas curtas desligada, registrar aparelho, navegador e trecho onde parou.

A opção Respostas faladas curtas continua disponível em Ajustes. Preferências já gravadas são respeitadas. No Android, o GaDu tenta encaminhar a conversa ao Gmail. Se o app ou o sistema ignorar a conversa, a opção Abrir no navegador abre pelo link da conta Google conectada.
