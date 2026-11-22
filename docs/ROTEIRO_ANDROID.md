# Roteiro curto · validação no Android físico

Cerca de 15 minutos. Use o GaDu instalado na tela de início (Chrome › Instalar app). Anote, para cada cenário: aparelho, versão do Android, ok ou falhou e o que aconteceu. Versão para o Galaxy S26 Ultra (Chrome e Samsung Internet) e iPhone, com os itens novos: [CHECKLIST_CELULAR.md](CHECKLIST_CELULAR.md). A lista completa (iPhone, PWA, notificações) está em [VALIDACAO_APARELHOS.md](VALIDACAO_APARELHOS.md).

| # | O que fazer | Resultado esperado |
|---|---|---|
| 1 | Abra **Conversas** e toque no **microfone dentro do campo** pela primeira vez | o Android pede permissão do microfone; nada escuta antes do toque |
| 2 | Responda **Não permitir** | aparece "O microfone está bloqueado…" e o botão volta ao normal |
| 3 | Libere o microfone (Configurações do Chrome › Site › Microfone), toque de novo e diga uma frase curta | a faixa "Escutando…" aparece; ao parar de falar, **o texto fica no campo** para revisar (não envia sozinho) |
| 4 | Toque no microfone e fique em silêncio | a escuta para sozinha em **até 20 segundos** |
| 5 | Envie "Me conte em três frases como funciona o GaDu" e, **enquanto ele fala**, toque no botão de parar | a fala para na hora e o **microfone não abre** |
| 6 | Em Configurações, ligue **Modo mãos-livres**; volte e converse | ele só volta a ouvir **depois de terminar de falar**, nunca durante. Desligue ao final |
| 7 | Em **Hoje**, toque no **GaDu no centro da barra** e depois no campo de texto | o painel sobe junto com o **teclado**; o campo e o botão enviar continuam visíveis |
| 8 | Com o painel aberto, arraste a **alça** para baixo | o painel fecha |
| 9 | Abra o **menu ☰** e use o **Voltar** (botão ou gesto da borda) | o menu fecha e você **continua na mesma tela** |
| 10 | Abra o assistente e use o **Voltar** | o painel fecha, sem sair do app |
| 11 | Vá de Hoje para **Módulos › Projetos** e use o **Voltar** | volta para a tela anterior |
| 12 | Abra o microfone na Conversa e toque em **Hoje** na barra de baixo | a escuta para |
| 13 | Abra o assistente e depois o **menu ☰**; use o **Voltar** duas vezes | o 1º fecha o menu, o 2º fecha o assistente; o app não sai da tela |
| 14 | Com a resposta falada longa (peça "explique em um parágrafo grande"), ouça até o fim | a fala **não corta** no meio (no Android a resposta é falada em trechos curtos) |
| 15 | No **Samsung Internet**, toque no microfone | ou reconhece, ou mostra "reconhecimento de voz não está disponível…"; nunca trava |

Se algo falhar, mande o número do cenário, o que apareceu na tela e, se possível, uma gravação de tela.
