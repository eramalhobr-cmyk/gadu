# GaDu · Ciclo Compras, Lista de compras e Agenda de filhos

Escopo aprovado em 24/11/2026. A implementação e a publicação de cada frente dependem das verificações registradas no diário de bordo.

| Frente | Entrega planejada | Como verificar |
|---|---|---|
| Compras | Menu para agrupar e-mails por pedido, com loja, previsão de entrega, rastreio disponível e calendário de entregas | Confirmação e remessa do mesmo pedido agrupadas, pedidos diferentes preservados, previsão ausente indicada, cronograma navegável, erro de acesso ao Gmail explicado |
| Lista de compras | Lista de mercado pessoal com inclusão por toque, voz ou texto, confirmação na conversa e marcação de itens comprados | Adicionar, marcar, reabrir e consultar com dados fictícios. Testar isolamento entre contas |
| Agenda de filhos | Configurar um fim de semana de referência, alternar fins de semana, consultar datas futuras e ajustar trocas pontuais ou a recorrência futura | Conferir antes e depois da âncora, virada de ano, fim de semana alternado, troca, feriado consultado por data e confirmação pela conversa |
| Hoje e voz | Validar Hoje e Fontes, lembretes, tarefas e lançamento financeiro pela conversa | Executar os cenários com login de teste e conferir em aparelho real |
| Studio 3D | Corrigir a preparação do teste móvel e concluir o PR #119 | CI autenticado verde. Conferir Abrir, pedido e versões no celular |
| Saúde do sistema | Revisar e concluir o PR #117, incluindo o painel e o alerta | CI, gate da migração, janela e teto de alertas, painel autenticado e push de teste |

## Decisões de implementação

- Compras acompanha pedidos já feitos. Lista de compras organiza itens que a pessoa pretende buscar depois no mercado.
- No acompanhamento de pedidos, consultar o Gmail da sessão em modo leitura. Datas e rastreio dependem das informações disponíveis nos e-mails. Indicar previsões e informações ausentes.
- A Agenda de filhos usa datas locais para a recorrência. Uma troca pontual preserva a alternância, enquanto um ajuste permanente altera o calendário a partir da data escolhida. Consultas de feriados devem considerar a data e a regra configurada.
- Ações que gravam dados pela conversa exigem a confirmação da pessoa. A pessoa configura a primeira data de referência no aplicativo.
- Testar com dados fictícios, confirmar o CI e o deploy, e registrar separadamente as validações autenticadas em ambiente de teste e as verificações em produção.
