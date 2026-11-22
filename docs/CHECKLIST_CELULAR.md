# GaDu · Checklist no celular

Para o Eduardo, no **Galaxy S26 Ultra** (Chrome e Samsung Internet) e, se tiver, no iPhone. Cerca de 20 minutos. Nada aqui foi testado em aparelho de verdade: os testes automáticos só **emulam** celular (ver [VALIDACAO_APARELHOS.md](VALIDACAO_APARELHOS.md)).

**Onde anotar:** copie a tabela para uma nota, ou responda no chat com o número do item e "ok" ou "falhou + o que apareceu". Se puder, grave a tela nos itens que falharem. Anote também: aparelho, navegador, se abriu pelo ícone instalado.

Faça uma vez no **Chrome** e repita os itens 2, 4, 5, 6 e 8 no **Samsung Internet**.

| # | O que tocar | Resultado esperado | Anotar |
|---|---|---|---|
| 1 | Chrome › menu ⋮ › **Instalar app** (ou Adicionar à tela inicial). No Samsung Internet: menu ☰ › **Adicionar à tela inicial** | O ícone do GaDu (azul-marinho) aparece na tela inicial, com o nome "GaDu" | ☐ ok ☐ falhou |
| 2 | Abrir o GaDu **pelo ícone** | Abre em tela cheia, sem barra de endereço, com a barra de status azul-marinho. Cai em Hoje (ou no login, na 1ª vez) | ☐ |
| 3 | Modo avião ligado, abrir o ícone | Aparece "Você está sem internet" com botão para tentar de novo. Desligue o modo avião | ☐ |
| 4 | **Conversa › microfone** (1ª vez) | O Android pede permissão. Nada escuta antes do toque | ☐ |
| 5 | Permitir, dizer "teste de voz" e parar | A faixa "Escutando…" aparece; o texto fica **no campo** para revisar, sem enviar sozinho. No Samsung Internet pode aparecer "reconhecimento de voz não está disponível": anote, é esperado em alguns aparelhos | ☐ |
| 5b | Negar a permissão (ou bloquear em Configurações › Site) e tocar no microfone | Mensagem "O microfone está bloqueado…", sem travar | ☐ |
| 6 | Enviar "Me conte em três frases como funciona o GaDu" com **Ajustes › GaDu responde falando** ligado | A resposta é **falada até o fim**, sem cortar no meio. Tocar em parar: a fala para e o microfone **não** abre | ☐ |
| 7 | Em Hoje, tocar no **GaDu no centro da barra** e depois no campo de texto | O painel sobe junto com o **teclado**; o campo e o botão enviar ficam visíveis | ☐ |
| 7b | Na **Conversa**, tocar no campo de mensagem e escrever 4 linhas | O campo continua acima do teclado; a última mensagem continua acessível ao rolar | ☐ |
| 8 | Abrir o **menu ☰** e usar o **Voltar** (botão ou gesto da borda) | O menu fecha, você **continua na mesma tela**, sem sair do app | ☐ |
| 8b | Abrir o assistente, depois o ☰, e usar o Voltar **duas vezes** | 1º Voltar fecha o menu; 2º fecha o assistente; o 3º volta de tela (só aí) | ☐ |
| 8c | Conversa › **Histórico**, e usar o Voltar | Fecha o histórico e continua na Conversa | ☐ |
| 9 | **Ajustes › Notificações › Ligar notificações** | O Android pede permissão só depois do toque. Ao permitir, aparece "Ligadas neste aparelho". Se negar: aparece como liberar | ☐ |
| 9b | **Enviar teste** | A notificação chega em segundos, com o ícone do GaDu e um selo branco simples na barra de status | ☐ |
| 10 | Fechar o GaDu e **tocar na notificação** | O GaDu abre (ou vem para a frente) na tela certa, sem tela em branco | ☐ |
| 11 | **Financeiro** e **Hoje**, com o celular em pé | Nada corta nem rola para o lado; botões fáceis de tocar; nada atrás da barra de baixo | ☐ |
| 12 | Tema **escuro** e **claro** (Ajustes) e, no Android, modo escuro do sistema | Textos legíveis nos dois; a barra de status acompanha a cor do tema | ☐ |
| 13 | Girar o celular (se o Android permitir) e dar zoom com dois dedos numa página | Não quebra; o zoom por pinça funciona (acessibilidade) | ☐ |
| 14 | **iPhone** (Safari › Compartilhar › Adicionar à Tela de Início): abrir pelo ícone e repetir 2, 4–8, 11, 12 | Igual ao Android. Notificação só funciona instalado e com iOS 16.4 ou mais novo; fora disso o GaDu explica | ☐ |

Se algo falhar, mande o número do item, o que apareceu na tela e o navegador. O registro vai para o CHANGELOG só depois de feito de fato.
