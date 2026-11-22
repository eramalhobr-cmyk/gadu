// Resumo mensal (especificação §5.1 e §5.2). Funções puras: recebem os dados já lidos (da sessão, com RLS) e devolvem números.
// Tudo em centavos por dentro. Sem dupla contagem:
//  - item vinculado a cartão (cartao_id) não soma: já está na fatura;
//  - gasto no crédito não soma: está na fatura do cartão principal (só quando a fatura existe neste mês; senão soma, para não sumir do total).
import { formatBRL, fromCents, toCents } from "./money.ts";
import type { Config, Gasto, Item, ItemMes } from "./types.ts";

export type CategoriaTotal = { categoria: string; total: number; qtd: number };

export type ResumoMensal = {
  ano: number;
  mes: number;
  receitas: number;
  recebido: number;
  aReceber: number;
  contas: { total: number; pago: number; aberto: number; qtd: number; qtdPagas: number };
  diaADia: { total: number; qtd: number; porCategoria: CategoriaTotal[] };
  /** Gastos no crédito. `naFatura`: não somam no mês porque a fatura do cartão principal já os contém. */
  credito: { total: number; qtd: number; naFatura: boolean };
  /** Fatura do cartão principal e o que se sabe que está dentro dela (assinaturas vinculadas + gastos no crédito). */
  cartao: { itemId: string; nome: string; fatura: number; conteudo: number } | null;
  despesas: number;
  pagoTotal: number;
  aPagar: number;
  /** 0 a 100. */
  pctPago: number;
  /** Receitas − despesas do mês (previsto). */
  sobra: number;
  /** Já recebido − já pago. */
  sobraRealizada: number;
  avisos: string[];
};

export type EntradaResumo = { itens: Item[]; meses: ItemMes[]; gastos: Gasto[]; config: Config | null; ano: number; mes: number };

export function resumoMensal(e: EntradaResumo): ResumoMensal {
  const { ano, mes } = e;
  const avisos: string[] = [];
  const itemPorId = new Map(e.itens.map((i) => [i.id, i]));
  const doMes = e.meses.filter((m) => m.ano === ano && m.mes === mes && toCents(m.valor) > 0 && itemPorId.has(m.item_id));
  const gastosMes = e.gastos.filter((g) => g.ano === ano && g.mes === mes);

  let receitas = 0, recebido = 0, contasTotal = 0, contasPago = 0, qtdContas = 0, qtdPagas = 0;
  for (const m of doMes) {
    const item = itemPorId.get(m.item_id)!;
    if (item.cartao_id) continue; // dentro da fatura do cartão
    const c = toCents(m.valor);
    if (item.tipo === "receita") { receitas += c; if (m.pago) recebido += c; }
    else { contasTotal += c; qtdContas++; if (m.pago) { contasPago += c; qtdPagas++; } }
  }

  // Cartão principal: a fatura precisa existir (valor > 0) neste mês para o crédito não somar de novo.
  const cartaoId = e.config?.cartao_principal_id ?? null;
  const cartaoItem = cartaoId ? itemPorId.get(cartaoId) : undefined;
  const cartaoMes = cartaoItem ? doMes.find((m) => m.item_id === cartaoItem.id) : undefined;
  const naFatura = Boolean(cartaoMes);

  let diaTotal = 0, diaQtd = 0, credTotal = 0, credQtd = 0;
  const cats = new Map<string, { total: number; qtd: number }>();
  for (const g of gastosMes) {
    const c = toCents(g.valor);
    if (g.meio === "credito") { credTotal += c; credQtd++; if (naFatura) continue; }
    diaTotal += c; diaQtd++;
    const k = g.categoria.trim() || "Outros";
    const cur = cats.get(k) ?? { total: 0, qtd: 0 };
    cur.total += c; cur.qtd++;
    cats.set(k, cur);
  }
  if (credQtd > 0 && !naFatura) {
    avisos.push(cartaoItem
      ? `Há gastos no crédito, mas o cartão não tem fatura lançada neste mês. Somei os gastos para não ficarem de fora.`
      : `Há gastos no crédito e nenhum cartão principal escolhido. Somei os gastos no mês; escolha o cartão em Contas para não contar duas vezes.`);
  }

  let cartao: ResumoMensal["cartao"] = null;
  if (cartaoItem && cartaoMes) {
    const vinculados = doMes.filter((m) => itemPorId.get(m.item_id)?.cartao_id === cartaoItem.id).reduce((s, m) => s + toCents(m.valor), 0);
    const conteudo = vinculados + credTotal;
    cartao = { itemId: cartaoItem.id, nome: cartaoItem.nome, fatura: cartaoMes.valor, conteudo: fromCents(conteudo) };
    if (conteudo > toCents(cartaoMes.valor)) {
      avisos.push(`O que está dentro do cartão (${formatBRL(fromCents(conteudo))}) passa da fatura lançada (${formatBRL(cartaoMes.valor)}). Atualize o valor da fatura.`);
    }
  }

  const despesas = contasTotal + diaTotal;
  const pagoTotal = contasPago + diaTotal; // gasto do dia a dia já aconteceu: conta como pago
  const porCategoria: CategoriaTotal[] = [...cats.entries()]
    .map(([categoria, v]) => ({ categoria, total: fromCents(v.total), qtd: v.qtd }))
    .sort((a, b) => b.total - a.total || a.categoria.localeCompare(b.categoria, "pt-BR"));

  return {
    ano, mes,
    receitas: fromCents(receitas), recebido: fromCents(recebido), aReceber: fromCents(receitas - recebido),
    contas: { total: fromCents(contasTotal), pago: fromCents(contasPago), aberto: fromCents(contasTotal - contasPago), qtd: qtdContas, qtdPagas },
    diaADia: { total: fromCents(diaTotal), qtd: diaQtd, porCategoria },
    credito: { total: fromCents(credTotal), qtd: credQtd, naFatura },
    cartao,
    despesas: fromCents(despesas),
    pagoTotal: fromCents(pagoTotal),
    aPagar: fromCents(despesas - pagoTotal),
    pctPago: despesas > 0 ? Math.round((pagoTotal / despesas) * 100) : 0,
    sobra: fromCents(receitas - despesas),
    sobraRealizada: fromCents(recebido - pagoTotal),
    avisos,
  };
}
