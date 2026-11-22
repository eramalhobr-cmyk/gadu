# GaDu · Validações que dependem de aparelhos físicos

Atualizado em 22/11/2026 (PR #28 publicado às 17:19, Brasília, merge `97f4d642ebe695286ceaabc80d83b05cf47b304d`). Os testes automáticos simulam voz, teclado e o botão Voltar. Isso **não substitui** o teste em aparelho. **Nada desta lista foi validado em aparelho de verdade ainda.** Roteiro para o Galaxy S26 Ultra e o iPhone: [CHECKLIST_CELULAR.md](CHECKLIST_CELULAR.md).

## O que já foi verificado (emulado, nesta máquina)
| Verificação | Como | Resultado |
|---|---|---|
| Layout, alvos de toque, viewport, campos 16 px, área segura, tema | `e2e/mobile.e2e.cjs`, 5 perfis (Pixel 7, Galaxy S9+, 412x915 Chrome e Samsung Internet, iPhone 14 WebKit) | 44/44 contra `next start` local; contra a produção (PR #28 publicado em 22/11/2026): 43/44 antes do ajuste do teste (só a navegação offline no WebKit, limitação do Playwright) e 44/44 com o ajuste, rodando local contra a produção |
| Manifest, ícones, service worker, offline, CSP | mesma suíte | idem |
| Instalável no Chrome | `Page.getInstallabilityErrors` vazio e manifest sem avisos (CDP) | 4 perfis, local e produção |
| Voltar com várias camadas abertas | `src/lib/overlay-history.test.ts` (7 testes, histórico simulado) | passam. **Não** prova o gesto de voltar do Android |
| Fala em trechos curtos, sem "despertador" no Android, reconhecimento ausente ou em HTTP | `src/lib/speech.test.ts` | passam. **Não** prova a voz no Chrome do Android |
| Push, clique na notificação, reinscrição | `test/sw.integration.test.ts` (service worker em ambiente simulado), `src/lib/push-client.test.ts` | passam. **Não** prova a entrega real do push |

**Não verificável sem aparelho:** teclado virtual (visualViewport real), microfone e reconhecimento (Chrome e Samsung Internet), vozes e TTS reais, corte de falas longas no Chrome do Android, push de verdade (FCM/APNs), Voltar físico e gesto de borda, instalação pelo menu do navegador, ícone e barra de status, iOS 16.4+ em PWA, desempenho e bateria.

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
| N3b | Android: abrir o assistente, abrir o menu e usar o Voltar duas vezes | 1º fecha o menu, 2º fecha o assistente; só o 3º sai da tela |
| N4 | iPhone: gesto de voltar pela borda dentro do PWA | não sai do app com o menu aberto |
| N5 | Aparelho com entalhe ou ilha | nada fica atrás da barra de status nem do indicador de início |
| N6 | Ligar "reduzir movimento" no sistema | menu e painel abrem sem animação |

## Notificações e PWA
| # | Passo | Esperado |
|---|---|---|
| P1 | Instalar na tela de início | ícone e cor do tema corretos (azul-marinho) |
| P2 | Ligar notificações e enviar teste | chega no aparelho |
| P3 | Abrir offline | tela offline; o rascunho fica guardado |
| P4 | Tocar na notificação com o app fechado e aberto | o app abre ou vem para a frente na rota da notificação |
| P5 | Permissão de notificação negada | o Ajustes explica como liberar; não fica botão que não faz nada |
