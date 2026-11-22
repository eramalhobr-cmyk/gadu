# Finanças pessoais · especificação de referência

> Documento de **estrutura e regras**, sem dados. Descreve um painel de controle mensal que já funciona fora do GaDu (página única + banco de documentos, atualizado pela conversa com a IA) para servir de base à feature dentro do GaDu.
> Nenhum valor, nome de pessoa, banco, empresa ou estabelecimento real aparece aqui. Os exemplos são genéricos.

---

## Implementação: fase Base (22/11/2026) · publicada

**Publicação (22/11/2026):** PR #5 (esta especificação) integrado às 15:49 (Brasília), merge `ff8fff0`. PR #26 (a base) integrado às 16:44 (Brasília), merge `41eb3edd7caaf640675f970f2dd2457dd942c8bf`, CI verde (`verify`, `e2e-public`, `database`). Migração `financas_base` aplicada na produção antes do merge (só aditiva), versão `20261122190001` no repositório e `20261122194404` no registro do Supabase; conferido: 4 tabelas `fin_*` com RLS ligada, 4 políticas cada, `anon` sem SELECT. Produção: home 200, `/api/finance/resumo` sem sessão 401, `/api/health` ok, e2e público 8 de 8. `FINANCE_ENABLED` não definida na Vercel (ligado por padrão). **Não verificado:** tela Financeiro e lançamento pela conversa com pessoa logada, em aparelho.

Primeira fatia da §10 ("Base"), aprovada pelo Eduardo, inclusive as tabelas novas com RLS. O resto deste documento continua sendo a especificação de referência; esta seção diz **o que existe de verdade** e **o que foi decidido**.

### O que foi implementado
| Especificação | Estado | Onde |
|---|---|---|
| §3.1 Contas (itens e receitas, grupos, pago/em aberto, filtros, edição na linha, "este mês" ou "este e os próximos") | implementado | `FinanceiroPage.tsx` (aba Contas), `/api/finance/itens*` |
| §3.2 Dia a dia (lançamento rápido, chips de categoria, meio, dia, descrição; lista por dia; total por categoria) | implementado, **sem teto por categoria** e sem soma por estabelecimento | aba Dia a dia, `/api/finance/gastos*` |
| §3 Resumo do mês (4 cartões) | parcial: saldo do mês/sobra, % pago, receitas, contas, dia a dia, a pagar, por categoria. **Sem** "conta corrente" (saldo do banco) e **sem** "acumulado do ano" | `src/lib/finance/summary.ts` |
| §4.1 `fin_itens` | implementado em forma **normalizada** (ver decisão 1) | migração `20261122190001_financas_base.sql` |
| §4.2 `fin_gastos` | implementado (`origem`: manual, conversa, voz, print, extrato; só manual e conversa são usadas hoje) | idem |
| §4.3 `config` | implementado como `fin_config` (dias de recebimento, adiantamento, receita e cartão principais). `orcamento`, `patrimonio`, `plano`, `simulacao`, `conta` e `log` **não existem** ainda | idem |
| §5.1 Totais do mês | implementado, menos "previsão do dia a dia" (precisa de tetos) | `summary.ts` |
| §5.2 Vínculos | implementado: `cartao` (não soma de novo; marcar o cartão marca as assinaturas e vice-versa), `segue` (marcar a receita marca quem segue), `via_reserva` (por mês, conta como despesa). Saem do **fluxo de caixa** só na fase Caixa | `summary.ts`, `pagamento.ts` |
| §6 Entrada pela conversa: texto | implementado só para **gasto** ("gastei 45 no mercado no pix"), como proposta que a pessoa confirma. Sem áudio dedicado (a voz do app já transcreve), sem print, sem PDF, sem log, sem "a confirmar", sem regras de classificação | `src/lib/finance/lancamento.ts`, `GastoCard.tsx` |
| Perguntas ("quanto gastei", "como estão minhas contas") | implementado como fonte `finance` do Core, sem IA extra | `src/lib/core/finance.ts` |
| §5.4 Caixa, §5.5 Salário, §5.6 Quitação, §5.7 Reserva, §3.3 a §3.6, §6.2 a §6.4, §7 (deduplicação) | **não implementados** | — |
| Simulador de salário (item pequeno) | só a **previsão até o próximo recebimento** (dia 15 e dia 1, configuráveis) | `previsao.ts` |

### Decisões
1. **Modelo normalizado em vez de `valores numeric[12]`/`pagos bool[12]`.** `fin_itens` (cadastro, vale para todos os anos) + `fin_item_meses` (item, ano, mês, valor, pago, via_reserva, nota). Motivos: CHECK por valor (`valor > 0`), mês 1-12 e índice `(user_id, ano, mes)` funcionam no banco (num array, nada disso vale por posição); "este e os próximos" e o simulador de salário futuro viram INSERT/UPDATE de linhas; virada de ano sem migração. Sem linha = o item não existe naquele mês (o "0" da especificação).
2. **Vínculos como chaves compostas `(id, user_id)`.** `cartao_id`, `segue_id` e a config só apontam para itens da mesma pessoa, mesmo por quem tentar pelo banco (a RLS não protege chave estrangeira, a chave composta protege). Apagar o item solta os vínculos (`on delete set null (coluna)`) e apaga os meses (cascata).
3. **Crédito sem dupla contagem só quando a fatura existe.** Gasto no crédito não soma no mês se o cartão principal tem fatura (valor > 0) naquele mês. Sem cartão principal ou sem fatura, soma e mostra um aviso, para não sumir do total. A especificação (§5.1) manda ignorar sempre; esta é a única diferença, para nunca esconder gasto.
4. **`adiantamento_pct` (porcentagem) em vez de valor.** Se o salário mudar, o adiantamento acompanha. Padrão 0 (sem adiantamento): a receita entra inteira no dia dela. Dias padrão: 15 (adiantamento) e 1 (restante), editáveis.
5. **Categoria é texto livre** no banco (1 a 40 caracteres); as 16 padrão da §3.2 são sugestões na tela e as únicas aceitas nas propostas da conversa (o resto vira "Outros").
6. **Lançar pela conversa só propõe.** O modelo devolve `gastos` no bloco de controle; o servidor valida (valor > 0, data existente de até 1 ano atrás até hoje) e só repassa se a mensagem tinha intenção de lançar. A pessoa toca em "Lançar" e a tela chama `POST /api/finance/gastos` com a sessão dela. Meio sem indicação vira débito (aparece no cartão antes de confirmar).
7. **Intenções por regra, sem IA** (`detectFinanceIntent`): resumo, contas, categoria (ou estabelecimento) e gasto. Perguntar injeta o bloco `[F1]…` e as "Fontes" (link para o Financeiro). Lançar só acrescenta as regras de proposta ao contexto. A pergunta de atenção do dia tem prioridade.
8. **Interruptores.** `FINANCE_ENABLED=0` (ligado por padrão) esconde a tela e o módulo, responde 404 `disabled` nas rotas (depois do 401), desliga a fonte do Core e a proposta de gasto. `CORE_MVP=0` desliga só a fonte `finance` do Core (as perguntas); a proposta de gasto depende apenas de `FINANCE_ENABLED`.
9. **Privacidade.** Nomes de contas, descrições e categorias com termo bloqueado ou dado sensível viram "(omitido pela regra de privacidade)" no bloco; os valores continuam. Descrição de proposta com termo bloqueado é descartada. A regra global já impede mensagens com "cartão de crédito", "chave pix" etc. de irem ao modelo.
10. **Custo.** Nada novo: perguntas e lançamentos passam pelos limites, reserva de orçamento, cota diária e liquidação do chat (fail closed). As rotas `/api/finance/*` não chamam IA e não gastam cota.

### Limitações conhecidas
- "Paguei 120 de luz" vira **proposta de gasto**, não "marcar a conta de luz como paga" (isso é fase Conversa).
- Valores em `numeric(12,2)`; a interface mostra reais com centavos, arredondados nos cartões grandes.
- A tela não foi validada em aparelho nem com pessoa logada; foi conferida em 390 px e 1280 px com dados fictícios interceptados (sem rolagem lateral, alvos de 44 px, sem erros no console).
- Sem exportação, sem gráfico de 12 meses, sem edição de ordem dos itens (a coluna `ordem` existe).

### Próximos passos sugeridos
Simulador bruto → líquido (INSS/IRRF por ano, com `salario_bruto` na config), teto por categoria e acumulado do ano, depois a fase Conversa (marcar pago e lançar item fixo por texto/áudio, log, "a confirmar", regras de classificação).

---

## 1. O que a feature resolve

Uma pessoa quer saber, a qualquer momento e pelo celular:

1. **Quanto ainda falta pagar no mês** e o que já foi pago.
2. **Se a conta corrente vai ficar no vermelho** e em que dia.
3. **Para onde vai o dinheiro do dia a dia** (mercado, restaurante, combustível…), comparado a um teto por categoria.
4. **Como está a reserva**, quantos meses de custo ela cobre e quanto dá para usar sem furar o mínimo.
5. **Quando quita uma dívida longa** (ex.: financiamento) com aportes extras.
6. **O que muda com outro salário**, com bônus ou com descontos que dependem do salário.

O diferencial: **a pessoa não digita planilha**. Ela manda print, PDF de extrato ou áudio ("paguei a escola", "isso foi mercado") e a IA lança, classifica, marca como pago e pergunta só o que não souber.

---

## 2. Princípios de produto

| Princípio | Como aparece |
|---|---|
| Conversa é a entrada principal | Print, PDF, áudio e texto viram lançamentos. A tela também permite editar, mas é secundária. |
| Nunca duplicar | Toda entrada é conferida contra o que já existe antes de gravar (ver §7). |
| Perguntar só o que for dúvida | Lançamento desconhecido entra como "a confirmar" na categoria Outros e vai para uma lista de pendências que a IA cobra depois. |
| Bater com o banco | Existe uma visão "real" ancorada no saldo informado do banco, separada da visão "planejada". |
| Sem dupla contagem | Itens que já estão dentro de outro (assinaturas dentro da fatura do cartão, desconto que já vem abatido no salário) não somam duas vezes. |
| Mobile first | Tudo cabe em 390px: abas no topo, cartões empilhados, tabelas viram listas. |
| Cada pessoa vê só o seu | Toda tabela tem `user_id` e RLS (regra do projeto). |

---

## 3. Telas (abas)

Seletor de **mês** fixo no topo (jan–dez, abre no mês atual). Abaixo, um **resumo** de 4 cartões que aparece em todas as abas:

- **A pagar no mês**: valor pendente, % já pago, barra de progresso. Inclui a previsão do dia a dia ainda não gasta.
- **Conta corrente** (quando há saldo informado no mês atual): saldo do banco, saldo projetado no fim do mês e, se for o caso, o dia em que fica negativa. Sem saldo informado, o cartão mostra o **pior saldo do mês** (plano) e quanto puxar da reserva.
- **Sobra do mês**: receitas − despesas.
- **Acumulado do ano**: soma das sobras de jan a dez.

### 3.1 Contas (contas fixas e receitas)

- Lista agrupada por **grupo** (ex.: Moradia, Família, Pessoal, Assinaturas, Veículo, Projetos, Negócio próprio, Receitas).
- Cada linha mostra o nome, o valor do mês, o dia de vencimento (com marca "estimado" quando não é certo) e o botão **Pago / Em aberto**.
- Filtros: todas · em aberto · pagas.
- Edição na própria linha: tocar no valor para mudar só aquele mês; tocar no dia para mudar o vencimento.
- Gráfico de barras dos 12 meses (despesas × receitas).
- **Registro** (log) das últimas atualizações feitas pela IA, com data e frase curta.
- Itens vinculados aparecem indentados sob o "pai" e não somam (ver §5.2).

### 3.2 Dia a dia (gastos variáveis)

- **Lançamento rápido**: valor, chips de categoria, meio (débito · pix · crédito · reserva), dia e descrição.
- Lista do mês por dia, com categoria colorida e meio.
- **Total por categoria** com barra contra o **teto** da categoria (teto editável na própria linha).
- Contagem e soma por estabelecimento, para perguntas como "quanto gastei no lugar X este mês?".
- Categorias padrão (configuráveis por pessoa): Mercado, Restaurantes, Combustível, Carro, Farmácia e saúde, Cuidados pessoais, Transporte, Casa, Filhos, Presentes, Vestuário, Lazer, Loteria, Trabalho, Compras, Outros.

### 3.3 Caixa (saldo dia a dia)

Dois modos, escolhidos automaticamente:

- **Real** (mês atual com saldo informado): parte do saldo do banco no dia informado e projeta até o fim do mês só o que **ainda não foi pago**.
- **Plano** (meses futuros ou sem saldo): parte do zero no dia 1 e simula entradas e saídas pelos dias de vencimento.

Componentes:
- Gráfico de degraus do saldo por dia, verde acima de zero e vermelho abaixo, com marcas de "hoje", "mínimo" e "fim do mês".
- Janelas de resumo: ainda entra · ainda sai · saldo no fim · veredito em uma frase ("fecha no azul" ou "fica negativa no dia N: transfira R$ X da reserva antes").
- Linha do tempo por dia com cada evento e o saldo depois dele.
- Aviso de contas com vencimento já passado e ainda marcadas como em aberto ("se já pagou, marque como paga").
- Formulário para informar o saldo do banco (valor + dia + mês).
- Opção "mover contas móveis" (itens marcados como `movivel`) para depois da entrada do salário, para testar se o vermelho some.

### 3.4 Plano (reserva e dívida longa)

- **Reserva de emergência**: valor, quantos meses de custo cobre e um medidor de 0 a 6+ meses com a faixa-alvo (ex.: 3 a 5) destacada.
- **Uso temporário no mês**: quanto precisa sair da reserva para cobrir o buraco entre as entradas e quando volta. Regra: a reserva nunca fica abaixo do mínimo definido.
- Saldo de fundo de garantia (quando houver) e quando pode ser usado para amortizar.
- **Simulador de quitação** com aporte mensal extra, 13º, bônus anual, fundo de garantia periódico e aportes avulsos. Mostra três cenários (com bônus · sem bônus · só as parcelas): mês de término, número de meses e total de juros. Inclui um gráfico do saldo devedor nos próximos 4 anos.
- Formulário de patrimônio: reserva, fundo de garantia, saldo da dívida, parcela, parcelas restantes, taxa anual, mínimo da reserva em meses.

### 3.5 Simulador (salário e pacote)

- **Bruto → líquido** com as tabelas oficiais do ano (INSS progressivo e IRRF com a redução vigente). Botões de valores prontos e campo livre.
- O líquido simulado desconta **"outros descontos"**, calibrados automaticamente pela diferença entre o líquido calculado e o líquido real do salário atual.
- Mostra o aumento em R$ e em % sobre o salário atual (bruto e líquido).
- **Bônus** em número de salários (com fator líquido configurável).
- **Ações/RSU e opções**: quantidade, preço e cotação, para somar ao pacote anual (podem ficar zerados).
- **Desconto proporcional ao salário** (ex.: pensão ou qualquer obrigação em % do líquido ou do bruto), com teto opcional. Para cada cenário mostra o valor completo da obrigação e a diferença contra o valor atual.
- Cenários lado a lado: atual × simulado, com sobra mensal resultante.

### 3.6 Ano

- Grade de 12 meses × itens: cada célula mostra o valor e o estado (pago / em aberto / futuro). Tocar marca ou desmarca o pagamento.
- Totais por mês nas linhas de rodapé.

---

## 4. Modelo de dados

No protótipo é um banco de documentos. No GaDu vira Postgres (Supabase), **cada tabela com `user_id` e RLS** `(select auth.uid()) = user_id`.

### 4.1 `fin_itens`: contas fixas e receitas (um registro por item por ano)

| Campo | Tipo | Uso |
|---|---|---|
| `id` | texto/uuid | Identificador estável (ex.: `moradia-condominio`) |
| `ano` | int | Ano do controle |
| `tipo` | `despesa` \| `receita` | |
| `grupo` | texto | Agrupamento na tela |
| `nome`, `nota` | texto | Nota guarda o "porquê" de valores diferentes no mês |
| `ordem` | numérico | Ordem dentro do grupo |
| `valores` | numérico[12] | Valor por mês (0 = não existe naquele mês) |
| `pagos` | bool[12] | Estado por mês |
| `dia` | int | Dia de vencimento ou entrada |
| `dia_estimado` | bool | Mostra "data estimada" |
| `movivel` | bool | Pode ser empurrado para depois do salário na simulação |
| `cartao` | ref `fin_itens.id` | **Vinculado**: está dentro da fatura desse cartão e não soma de novo |
| `segue` | ref `fin_itens.id` | **Segue** outro item: já vem descontado de uma receita e fica pago quando ela entra |
| `via_reserva` | jsonb `{mes: true}` | Pago com a reserva naquele mês: sai do fluxo da conta corrente |
| `nao_caixa` | bool | Receita que não passa pela conta (ex.: vale-alimentação) |

> Alternativa normalizada: `fin_itens` (cadastro) + `fin_lancamentos_mes(item_id, ano, mes, valor, pago)`. Facilita histórico e consultas, mas o array de 12 posições é simples e funcionou bem.

### 4.2 `fin_gastos`: dia a dia

| Campo | Tipo |
|---|---|
| `id` | texto/uuid (no protótipo: `g<aamm>-<estab>-<ddmm>` para facilitar a deduplicação) |
| `ano`, `mes`, `dia` | int |
| `valor` | numérico |
| `categoria` | texto (referência à lista da pessoa) |
| `descricao` | texto (estabelecimento + observação; "(a confirmar)" quando a classificação é dúvida) |
| `meio` | `debito` \| `pix` \| `credito` \| `reserva` |
| `origem` | opcional: `print`, `extrato`, `voz`, `manual` + referência do arquivo |

Regras do `meio`:
- `credito`: entra na fatura do cartão principal e **não** soma de novo no mês (soma no "conteúdo" do cartão).
- `reserva`: pago com a poupança, fora da conta corrente.
- `debito` e `pix`: saem da conta corrente.

### 4.3 Documentos de configuração (um por pessoa)

| Documento | Conteúdo |
|---|---|
| `config` | id da receita principal, adiantamento e dia, dia do restante, bruto atual, id do cartão principal |
| `orcamento` | teto por categoria do dia a dia |
| `patrimonio` | reserva, fundo de garantia, saldo da dívida, parcela, parcelas restantes, taxa a.a., mínimo da reserva em meses, data de atualização |
| `plano` | parâmetros do simulador de quitação (aporte, 13º, bônus, fundo, avulsos) |
| `simulacao` | parâmetros do pacote (bônus em salários, ações, opções, % e teto do desconto proporcional) |
| `conta` | saldo do banco, dia, mês, data e hora da informação |
| `log` | lista curta das últimas atualizações (data + frase) |

---

## 5. Regras de cálculo

### 5.1 Totais do mês
```
para cada item do mês com valor > 0:
  se vinculado a cartão → ignora (já está na fatura)
  receita → soma em receitas (e em recebido, se pago)
  despesa → soma em despesas (e em pago, se pago)
para cada gasto do mês:
  se meio = crédito → ignora (está na fatura)
  senão → soma em despesas e em pago
despesas += previsão do dia a dia ainda não gasta
sobra = receitas − despesas
```

### 5.2 Vínculos (sem dupla contagem)
- **Cartão**: assinaturas com `cartao = <id do cartão>` aparecem sob o cartão. Marcar o cartão como pago marca todas; tentar marcar uma assinatura sozinha marca o cartão. O "conteúdo" do cartão = soma das assinaturas vinculadas + gastos no crédito.
- **Segue**: item com `segue = <id da receita>` (ex.: previdência descontada na fonte) fica pago quando a receita entra e **não** é subtraído de novo no fluxo. No fluxo, a parte da receita que entra é `valor − adiantamento − soma dos itens que seguem`.
- **Via reserva**: o item conta como despesa do mês, mas não sai da conta corrente.

### 5.3 Previsão do dia a dia
`previsão(m) = max(0, soma dos tetos − gasto do mês)`, só para o mês atual e os futuros. Na visão real, é espalhada igualmente pelos dias que faltam.

### 5.4 Fluxo de caixa
- **Plano**: eventos de entrada e saída no dia de vencimento; a receita principal é dividida em adiantamento (dia X) e restante (dia Y); calcula saldo diário, mínimo, dia do mínimo e quanto puxar da reserva (`max(0, −mínimo)`), que volta no dia do restante.
- **Real**: âncora = saldo informado no dia A. Entram só itens **não pagos**, não vinculados, sem `segue` e sem `via_reserva`, e gastos com dia > A (débito/pix). Item vencido e não pago vai para A+1 e aparece como "em aberto". Ordenação no mesmo dia: entradas antes das saídas.
- Ao receber um saldo novo do banco, a âncora é substituída (nunca somada) e o que já saiu do extrato é marcado como pago, para não sair duas vezes.

### 5.5 Salário
- INSS progressivo por faixas, com teto.
- IRRF sobre (bruto − INSS), pela tabela do ano e com a redução vigente para rendas menores.
- `outros descontos = líquido calculado do bruto atual − líquido real recebido` (calibração automática).
- `líquido simulado = líquido calculado − outros descontos`.
- Bônus líquido = salários × bruto × fator (configurável).
- **As tabelas mudam todo ano**: deixar em um arquivo de constantes versionado por ano.

### 5.6 Quitação
- Juros mensais: `(1 + taxa a.a.)^(1/12) − 1`.
- A cada mês: `saldo += juros − parcela − aportes do mês` (aporte fixo, 13º em nov/dez, bônus no mês configurado, fundo de garantia na largada e depois a cada 24 meses, avulsos).
- Base de comparação: SAC puro com as parcelas restantes.
- Saída: mês e ano de término, meses e juros totais, série para o gráfico.

### 5.7 Reserva
- Custo mensal = média das despesas dos meses restantes do ano.
- Meses cobertos = reserva ÷ custo.
- Alerta quando `reserva − uso temporário < custo × mínimo em meses`.

---

## 6. Entrada pela conversa (o coração da feature)

### 6.1 Tipos de entrada
| Entrada | O que a IA faz |
|---|---|
| Print de pagamento ou comprovante | Identifica o item fixo e marca pago no mês; se o valor difere, atualiza o valor do mês e registra o motivo em `nota`. |
| Print de fatura do cartão | Confere item a item: assinaturas viram itens vinculados; compras viram gastos no crédito; canceladas são zeradas dali para a frente. |
| PDF de extrato da conta | Extrai os lançamentos, cruza com o que já existe, lança só o novo, atualiza o saldo âncora e marca os fixos pagos. |
| Áudio ou texto | "X foi mercado", "a faxina deste mês não teve", "a escola agora é Y daqui para a frente". |

### 6.2 Fluxo de um extrato
1. Extrair linhas (data, descrição, valor) e o saldo final.
2. Para cada linha, procurar correspondência (§7). Se existe, pular.
3. Classificar: item fixo conhecido → marcar pago; estabelecimento conhecido → categoria; desconhecido → Outros + "(a confirmar)".
4. Gravar tudo em **um lote atômico** (tudo ou nada), com versão de cada registro (bloqueio otimista).
5. Atualizar o saldo âncora (`conta`) e o `log`.
6. Responder com: o que entrou de novo · o que já estava e não foi duplicado · a lista de "a confirmar".
7. Mostrar a conta de verificação: saldo anterior − débitos novos = saldo do banco. Se não fechar, avisar.

### 6.3 Memória de classificação
- Cada correção da pessoa vira regra: "estabelecimento X → categoria Y". No GaDu, guardar em uma tabela `fin_regras(user_id, padrao, categoria, descricao)` e aplicar automaticamente na próxima vez.
- Pendências "a confirmar" ficam numa lista que a IA cobra de novo quando a pessoa pede ("me cobre depois").

### 6.4 Mudanças de regra vindas da conversa
- "A partir de agora o valor é Y": muda os meses futuros, não os passados.
- "Este mês não teve": zera só o mês e anota o motivo.
- "Paguei com a poupança": marca `via_reserva` no mês e baixa a reserva.
- "Isso já vem descontado do salário": vira `segue`.
- "Isso está dentro do cartão": vira `cartao`.

---

## 7. Deduplicação

Chave de correspondência para gastos: **(mês, dia ± 1, valor exato, estabelecimento normalizado)**. Para fixos: **(item, mês)**.

Cuidados que apareceram na prática:
- O extrato mostra a data de **lançamento**, que pode ser diferente da data da compra (a descrição costuma trazer a data real, ex.: "LOJA 31/10" lançado em 03/11). Usar a data da descrição.
- Débitos **agendados** aparecem antes de acontecer. Ao ancorar o saldo, não descontar duas vezes o que já está no saldo.
- Entrada parcelada do salário (adiantamento): não confundir com receita extra.
- Valores repetidos no mesmo dia e no mesmo lugar são possíveis: usar sufixo (`a`, `b`) e confirmar com a pessoa.

---

## 8. Interface e visual

- Abas: Contas · Dia a dia · Caixa · Plano · Simulador · Ano.
- Números em fonte monoespaçada tabular; moeda pt-BR (`R$ 1.234,56`), arredondada nos cartões grandes.
- Cores semânticas: pago (verde), a vencer (âmbar), negativo (vermelho), destaque (azul). Uma cor fixa por categoria.
- Tema claro e escuro.
- Toast curto em toda gravação ("Item marcado em nov · 3 assinaturas junto").
- Estados vazios com instrução de uma linha ("Mande um print ou extrato para começar").
- Acessibilidade: botões com `aria-pressed`, gráficos SVG com `aria-label`, alvos de toque ≥ 44px.

---

## 9. Segurança e privacidade (alinhado ao CLAUDE.md do GaDu)

- Toda tabela `fin_*` com `user_id` e RLS. Nenhum dado financeiro em código, testes ou seeds: usar dados sintéticos.
- Arquivos enviados (prints, PDFs) em bucket privado por pessoa; apagar ou expirar o original depois de extraído, se a pessoa preferir.
- Mostrar sempre a origem do lançamento (print, extrato, voz) para auditoria.
- Validação com zod em toda rota que grava.
- Gravações em lote atômico com controle de versão, para dois dispositivos não se sobrescreverem.

---

## 10. Sugestão de fases no GaDu

1. **Base**: tabelas `fin_itens`, `fin_gastos` e config com RLS; abas Contas e Dia a dia; marcar como pago; edição na linha.
2. **Conversa**: a IA lança e classifica a partir de texto e áudio; registro (log); pendências "a confirmar"; regras de classificação.
3. **Arquivos**: leitura de print e PDF de extrato com deduplicação e saldo âncora.
4. **Caixa**: fluxo plano e real, gráfico, veredito e uso da reserva.
5. **Plano e Simulador**: reserva, quitação, salário bruto/líquido, pacote e descontos proporcionais.
6. **Ano** e exportação (CSV).

---

## 11. Lições do protótipo

- O que mais gerou retrabalho foi **dupla contagem**: assinatura × fatura, desconto na fonte × salário e agendado × saldo. Modelar `cartao`, `segue` e `via_reserva` desde o começo.
- A visão real só ganha confiança quando a conta de verificação fecha com o banco. Mostrar a conta.
- Perguntar em lote ("estes 10 eu não sei o que são") funciona melhor que perguntar um por um.
- Valores que mudam "daqui para a frente" são comuns (reajuste, troca de escola, cancelamento): a edição precisa da opção "só este mês" ou "este e os próximos".
- Por voz, a pessoa fala nomes aproximados ("Ou Champê" para um estabelecimento escrito de outro jeito no extrato): a IA deve casar por semelhança e confirmar quando houver dúvida.
