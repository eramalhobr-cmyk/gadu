# Voz natural · evolução da fala do GaDu

A saída opcional usa ElevenLabs Flash v2.5 pelo Vercel AI Gateway. A preferência é separada da transcrição Microsoft com OpenAI de reserva. O piloto grava apenas consumo no orçamento e toca a resposta por completo quando couber em uma chamada de até 2.400 caracteres. Se a síntese estiver indisponível, o texto for maior, ou o navegador recusar o áudio, usa a fala do aparelho. Confirmações continuam no aparelho.

## Custos e publicação

- Catálogo do Gateway em 25/11/2026: US$ 0,04 por mil caracteres. Exemplo: 30 respostas de 500 caracteres por mês custariam cerca de US$ 0,60 em fala. Chat e transcrição são cobrados separadamente.
- A rota só funciona com sessão, valida texto, checa termos bloqueados e dados sensíveis, e reserva no orçamento antes de chamar o Gateway. O áudio não fica armazenado. O texto a ser pronunciado é enviado ao provedor quando a opção está ligada.
- A migração `20261125090001_orcamento_fala.sql` inclui o tipo `speech` na reserva e na liquidação. Aplicar em produção só após testes e aprovação. Confirmar a credencial do Gateway e então ligar `SPEECH_ENABLED=1` para expor a opção **Voz natural** em Ajustes. A preferência começa desligada.
- Validar MP3 no Gateway, tempo até a primeira fala, interrupção, tela bloqueada e retorno a “sim ou não” no Android e no iPhone. O navegador pode restringir a reprodução automática.
- Rollback: `SPEECH_ENABLED=0` volta à síntese local sem apagar consumo já registrado.
