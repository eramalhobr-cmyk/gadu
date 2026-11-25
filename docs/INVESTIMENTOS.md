# Investimentos · acompanhamento e pesquisa

## Primeira entrega

A tela Investimentos mostra LREN3 (Lojas Renner), CEAB3 (C&A) e VIVA3 (Vivara), com cotação, variação no dia e variação de preço em 21, 63 e 252 pregões. Os dados vêm da brapi e incluem horário de referência. Precisa de `BRAPI_TOKEN` no servidor. Se a janela solicitada exceder o plano, o servidor reduz de 2 anos para 1 ano, 3 meses e, por fim, consulta só a cotação. Janelas sem pregões suficientes seguem como “Sem dados”. Ausência de dado aparece na tela. O comando “abre investimentos” abre a tela.

A página identifica se os fechamentos estão ajustados pelo provedor, mostra a maior queda de pico a vale em 63 pregões e indica janelas incompletas. **Comparar com o GaDu** ou o mesmo pedido por voz gera uma leitura sob demanda com o orçamento do chat. A IA só recebe símbolos próprios, data e números validados da brapi. Cotações com mais de sete dias são excluídas da comparação. O chat descarta metadados de ação da pesquisa, mesmo se o modelo os retornar. Nenhum SDK ou código de OpenBB ou Qlib foi incorporado.

## Conectar a brapi em produção

1. Use a chave disponível no [dashboard da brapi](https://brapi.dev/dashboard).
2. Abra o projeto [gadu-agent na Vercel](https://vercel.com/eramalhobr-4914s-projects/gadu-agent/settings/environment-variables), adicione a variável `BRAPI_TOKEN` em **Production** e selecione **Sensitive** se disponível. Mantenha o valor só no painel, sem prefixo `NEXT_PUBLIC_`.
3. Faça redeploy do deployment de produção. A variável só entra em deploys novos. [Guia da Vercel](https://vercel.com/docs/environment-variables/managing-environment-variables)
4. Com login, abra **Hoje** e **Investimentos**. Confira LREN3, CEAB3 e VIVA3, o sinal da variação e o horário de atualização. Cotação indisponível com a fonte configurada indica que o servidor não recebeu uma cotação válida. Consulte no dashboard da brapi a cobertura dos ativos e os limites do plano. [Limites da brapi](https://brapi.dev/pricing)

A tela Hoje mostra a variação diária dos papéis e o horário de cada cotação. A comparação de 21, 63 e 252 pregões fica em Investimentos.

## Próxima fase da pesquisa diária

1. Confirmar universo e fonte. Inicialmente, a lista de acompanhamento fica separada de uma seleção mais ampla de ações líquidas. Cobrir cotações e eventos da B3 e fatos relevantes e demonstrações da CVM ou do RI. Para um IPO, confirmar empresa, ticker e mercado antes de buscar dados. Mostrar histórico insuficiente nas janelas longas quando for o caso.
2. Calcular candidatos fora do modelo. Curto prazo usa volume, volatilidade e movimento relativo ao benchmark. Médio prazo acrescenta revisões e resultados trimestrais. Longo prazo inclui crescimento, geração de caixa, dívida, valuation e risco. Cada tese registra data, fonte, cenário alternativo e o que invalidaria a leitura.
3. Validar o histórico por janelas móveis fora da amostra. Incluir custos, liquidez, deslistagens, eventos corporativos e comparação com índice. Evitar usar informação que não existia na data de análise. Registrar desempenho e perdas máximas, inclusive quando a abordagem não superar a referência.
4. Depois de validar a cobertura e o custo, programar a nota diária por IA a partir dos fatos calculados, com referências e dados faltantes. Apresentar teses de pesquisa e cenários de entrada, com incerteza, sem enviar ordem. Configurar agendamento e teto de uso em uma entrega própria.

## Referências avaliadas

- [Microsoft Qlib](https://github.com/microsoft/qlib), cerca de 50,5 mil estrelas na consulta de 25/11/2026. Plataforma MIT para experimentos e backtest quantitativo. Candidata a um processo de pesquisa separado depois da obtenção de séries ajustadas da B3.
- [OpenBB](https://github.com/OpenBB-finance/OpenBB), cerca de 75,7 mil estrelas na consulta. Camada de integração de fontes com extensões. Conferir licença, cobertura e termos de cada fornecedor antes de aproveitar componentes ou distribuir dados.
- [brapi](https://brapi.dev/docs/acoes) e [B3](https://sistemaswebb3-listados.b3.com.br/), fontes para cotações e identificação dos ativos. Popularidade no GitHub não mede cobertura brasileira ou qualidade de um sinal.
