# GaDu · Validações que dependem de aparelhos físicos

Atualizado em 15/11/2026. Os testes automáticos simulam voz, teclado e o botão Voltar. Isso **não substitui** o teste em aparelho. Nada desta lista foi validado ainda.

Como registrar: para cada item, anotar aparelho, sistema, navegador, se está instalado na tela de início (PWA), data e resultado (ok, falhou e o que aconteceu). Registrar no CHANGELOG só o que foi feito de fato.

## Aparelhos mínimos
- iPhone com iOS atual, Safari e PWA instalado.
- Android com Chrome e PWA instalado (de preferência um Samsung, por causa do teclado e do Voltar por gesto).

## Voz
| # | Passo | Esperado |
|---|---|---|
| V1 | Na Conversa, tocar no microfone pela primeira vez | o sistema pede permissão; só liga depois do toque |
| V2 | Negar a permissão | aviso "O microfone está bloqueado…" e nada fica ouvindo |
| V3 | Falar uma frase e parar | o texto aparece no campo para revisar (envio automático desligado) |
| V4 | Ficar calado por 20 s com o microfone aberto | a escuta para sozinha |
| V5 | Enquanto o GaDu fala, tocar no botão | a fala para e o microfone **não** abre |
| V6 | Ligar o modo mãos-livres em Configurações e conversar | volta a ouvir só depois de terminar de falar, nunca durante |
| V7 | Abrir o microfone e trocar de tela pela barra de baixo | a escuta para |
| V8 | Voz da resposta: escolher outra voz e velocidade | a resposta usa a voz escolhida |
| V9 | Tela bloqueada ou app em segundo plano durante a fala | não trava; ao voltar, o estado está coerente |

## Teclado e assistente
| # | Passo | Esperado |
|---|---|---|
| T1 | Abrir o assistente pelo orbe e tocar no campo | o painel sobe junto com o teclado e o campo continua visível |
| T2 | Escrever uma mensagem longa | o campo cresce sem esconder o botão de enviar |
| T3 | Arrastar a alça do painel para baixo | o painel fecha |
| T4 | Na Conversa, com o teclado aberto, rolar o histórico | a última mensagem continua acessível |

## Navegação
| # | Passo | Esperado |
|---|---|---|
| N1 | Android: abrir o menu ☰ e usar o Voltar (botão ou gesto) | o menu fecha e o app continua na mesma tela |
| N2 | Android: abrir o assistente e usar o Voltar | o painel fecha |
| N3 | Android: trocar de tela pelo menu e usar o Voltar | volta para a tela anterior |
| N4 | iPhone: gesto de voltar pela borda dentro do PWA | não sai do app com o menu aberto |
| N5 | Aparelho com entalhe ou ilha | nada fica atrás da barra de status nem do indicador de início |
| N6 | Ligar "reduzir movimento" no sistema | menu e painel abrem sem animação |

## Notificações e PWA
| # | Passo | Esperado |
|---|---|---|
| P1 | Instalar na tela de início | ícone e cor do tema corretos (azul-marinho) |
| P2 | Ligar notificações e enviar teste | chega no aparelho |
| P3 | Abrir offline | tela offline; o rascunho fica guardado |
