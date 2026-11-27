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

## Fase "Sinais" (Claude Code, 27/11/2026)

Pedido do Eduardo: olhar projetos no GitHub que sugerem compra e venda a partir de dados, curvas e algoritmos, e aplicar o método às principais ações de IA e do Brasil. Nenhum código ou SDK desses projetos foi copiado ou instalado; só o método.

**Universo fixo no servidor** (`src/lib/investimentos/universo.ts`):
- Acompanhados: LREN3, CEAB3, VIVA3.
- IA (EUA): NVDA, MSFT, GOOGL, META, AMD, AVGO, TSM, AMZN.
- Brasil: PETR4, VALE3, ITUB4, BBAS3, WEGE3, EMBR3, BPAC11, SBSP3, ITSA4, PRIO3.
- Referências: Ibovespa (`^BVSP`) para a B3 e S&P 500 pelo SPY para os EUA.

**Fontes** (`series.ts`): Yahoo Finance chart API (`query1.finance.yahoo.com/v8/finance/chart/{símbolo}?range=2y&interval=1d`, sem chave; B3 com sufixo `.SA`), com fechamento ajustado quando vier. Se o Yahoo falhar num papel da B3 e houver `BRAPI_TOKEN`, a brapi entra como reserva. Tudo validado com zod (símbolo conferido), prazo de 8 s por chamada, sem redirecionamento, cache de 15 min (`next.revalidate = 900`). O provedor recebe só o símbolo público da lista do servidor; nenhum dado da pessoa sai.

**Motor de sinais** (`sinais.ts`, puro e testado). Inspirado em virattt/ai-hedge-fund e TauricResearch/TradingAgents: analistas votam e um gestor consolida.
- Indicadores: SMA 50/200, EMA 21, RSI 14 (Wilder), MACD 12/26/9, retorno em 3/6/12 meses (63/126/252 pregões), força relativa contra o índice nos mesmos dias, volatilidade anual (desvio dos retornos log × raiz de 252) e queda máxima em 1 ano.
- Analistas (nota de -1 a +1): **Tendência** (preço × SMA200, SMA50 × SMA200, inclinação da SMA200 em 20 pregões); **Momento** (tanh dos retornos de 3/6/12 meses, MACD × linha de sinal, RSI acima de 75 ou abaixo de 25); **Força relativa** (excesso de retorno de 3 e 6 meses contra o índice); **Risco** (faixas de volatilidade e distância da máxima de 1 ano).
- Consolidado: média ponderada (Tendência 35%, Momento 25%, Força 25%, Risco 15%). Nota ≥ 0,25 = Compra; ≤ -0,25 = Venda; entre as duas = Manter. Confiança combina a força da nota e a concordância dos analistas, com teto de 85%. Até 3 motivos curtos em pt-BR, dos analistas de maior peso na nota.
- A avaliação só olha os últimos 300 pregões, igual ao vivo e no teste.
- **Sem dados fundamentais**: não há fonte grátis confiável de balanços. Não existe nota de valuation e a tela diz isso.

**Backtest walk-forward** (`backtest.ts`). Método inspirado em microsoft/qlib e AI4Finance/FinRL. A decisão de cada dia usa só os pregões até aquele dia e vale para o dia seguinte; Compra entra, Venda sai, Manter mantém. Custo de 0,1% por troca (e na entrada de comprar e segurar). Começa depois de 1 ano de aquecimento (cerca de 1 ano testado com 2 anos de dados). Mostra retorno da regra, de comprar e segurar e do índice, queda máxima, % de acerto por operação, nº de trocas e **avisa quando a regra perde de comprar e segurar**. Um teste prova que mudar os preços depois do dia k não muda nenhuma decisão até k.

**API**: `GET /api/investimentos/sinais?grupo=acompanhados|ia|brasil` ou `?ticker=NVDA` (só papéis do universo). Sessão e acesso (401), zod (400), interruptor `INVESTIMENTOS_SINAIS_ENABLED` ligado por padrão (`=0` → 404 e tira o bloco da conversa). A rota `/api/investimentos` (brapi) continua igual.

**Tela**: abas Acompanhados, IA (EUA) e Brasil; cartão por ação com preço, sinal (cor, símbolo e texto), confiança, motivos, mini gráfico SVG (preço do último ano e SMA200 tracejada) e o resultado do teste. Aviso fixo: “Estudo automático com dados públicos. Não é recomendação de investimento.” A variação por pregões da brapi e “Comparar com o GaDu” ficam em Acompanhados.

**Conversa e voz** (`chat-sinais.ts`): “como está a Nvidia?”, “o que comprar de IA?”, “sinal da Petrobras” levam ao GaDu um bloco só com os números calculados (sinal, confiança, notas, retornos, RSI, volatilidade, queda, backtest). Sem preço-alvo, sem ordens, sem valuation. Nomes ambíguos (Meta, Vale, Itaú, Amazon, Google, Sabesp…) só contam com uma palavra de mercado (ação, papel, sinal, bolsa, cotação), para não confundir a tela Metas, “vale a pena” ou compras numa loja. Respeita a permissão `financas` do agente. Dados com mais de 7 dias são descartados.

**Limites conhecidos**
- Sinais técnicos de preço, sem balanços, notícias, liquidez ou eventos corporativos além do ajuste do provedor.
- O teste cobre só cerca de 1 ano e um conjunto pequeno de papéis escolhidos hoje (viés de sobrevivência). Resultado passado não garante resultado futuro.
- O Yahoo não tem contrato nem SLA e pode limitar pedidos de servidores em nuvem; na B3 a brapi cobre a falha se houver token. Nos EUA, o papel aparece como “sem dados agora”.
- Cada aba faz até 11 chamadas ao provedor (com cache de 15 min).

## Referências avaliadas

- [Microsoft Qlib](https://github.com/microsoft/qlib), cerca de 50,5 mil estrelas na consulta de 25/11/2026. Plataforma MIT para experimentos e backtest quantitativo. Candidata a um processo de pesquisa separado depois da obtenção de séries ajustadas da B3.
- [OpenBB](https://github.com/OpenBB-finance/OpenBB), cerca de 75,7 mil estrelas na consulta. Camada de integração de fontes com extensões. Conferir licença, cobertura e termos de cada fornecedor antes de aproveitar componentes ou distribuir dados.
- [virattt/ai-hedge-fund](https://github.com/virattt/ai-hedge-fund) e [TauricResearch/TradingAgents](https://github.com/TauricResearch/TradingAgents): analistas que votam e um gestor que consolida (método usado nos sinais). [AI4Finance/FinRL](https://github.com/AI4Finance-Foundation/FinRL): validação fora da amostra e custos. Todos se declaram ferramentas de pesquisa, sem garantia de lucro.
- [brapi](https://brapi.dev/docs/acoes) e [B3](https://sistemaswebb3-listados.b3.com.br/), fontes para cotações e identificação dos ativos. Popularidade no GitHub não mede cobertura brasileira ou qualidade de um sinal.
