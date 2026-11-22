// Core · fonte `finance`: responde "quanto gastei", "quanto gastei com mercado", "como estão minhas contas" com os dados
// reais da pessoa, SEM chamada de IA extra. Mesmas regras do resto do Core:
//  - escopo só do user_id da sessão; leitura com o cliente da sessão (RLS), nunca a chave secreta;
//  - termos bloqueados e dado sensível não entram com conteúdo (só números, "(omitido pela regra de privacidade)");
//  - cada fato tem etiqueta [F1]… citável e a tela de origem (Financeiro).
import { hojeSP } from "../finance/datas.ts";
import { loadMes } from "../finance/load.ts";
import { mesclarItens } from "../finance/month.ts";
import { formatBRL } from "../finance/money.ts";
import { previsaoRecebimento } from "../finance/previsao.ts";
import { resumoMensal } from "../finance/summary.ts";
import { MEIO_LABEL, MESES } from "../finance/types.ts";
import { personalUserId, resolveScopes } from "./scopes.ts";
import { hidden } from "./privacy.ts";
import type { FinanceIntent } from "./plan.ts";
import { OMITTED, type AttentionFact, type SessionDb } from "./types.ts";

export type FinanceResult = { facts: AttentionFact[]; unavailable: string[]; mesLabel: string };

export const FINANCE_MAX_FACTS = 24;
export const FINANCE_MAX_CHARS = 4500;

const sem = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export async function collectFinance(input: { userId: string; db: SessionDb; blocked: string[]; intent: FinanceIntent; now?: Date }): Promise<FinanceResult> {
  const userId = personalUserId(resolveScopes({ userId: input.userId }));
  const hoje = hojeSP((input.now ?? new Date()).getTime());
  const mesLabel = `${MESES[hoje.mes - 1]} de ${hoje.ano}`;
  const d = await loadMes(input.db, userId, hoje.ano, hoje.mes); // erro de leitura lança: o chamador trata como indisponível
  const resumo = resumoMensal({ itens: d.itens, meses: d.meses, gastos: d.gastos, config: d.config, ano: hoje.ano, mes: hoje.mes });
  const itens = mesclarItens(d.itens, d.meses, hoje.ano, hoje.mes);
  const blocked = input.blocked;

  type F = Omit<AttentionFact, "tag">;
  const fact = (label: string, body: string, table: string, id: string, omitted = false): F => ({
    module: "financeiro", scope: "pessoal", source: { table, id }, kind: "financa", label, view: "financeiro", omitted, rank: 0, text: `${label}: ${body}`,
  });
  const nome = (t: string) => (hidden(t, blocked) ? null : t.slice(0, 80));

  const sumario = fact("Resumo do mês", `${mesLabel}. Receitas ${formatBRL(resumo.receitas)} (recebido ${formatBRL(resumo.recebido)}); despesas ${formatBRL(resumo.despesas)} `
    + `(contas ${formatBRL(resumo.contas.total)} + dia a dia ${formatBRL(resumo.diaADia.total)}); já pago ${formatBRL(resumo.pagoTotal)} (${resumo.pctPago}%); a pagar ${formatBRL(resumo.aPagar)}; `
    + `sobra prevista ${formatBRL(resumo.sobra)}.`, "fin_item_meses", `${hoje.ano}-${hoje.mes}`);

  const abertas = itens.filter((i) => i.tipo === "despesa" && i.mes && !i.mes.pago && !i.cartao_id);
  const contasLinha = fact("Contas", resumo.contas.qtd
    ? `${resumo.contas.qtd - resumo.contas.qtdPagas} em aberto somando ${formatBRL(resumo.contas.aberto)}; ${resumo.contas.qtdPagas} paga${resumo.contas.qtdPagas === 1 ? "" : "s"} (${formatBRL(resumo.contas.pago)}).`
    : "nenhuma conta lançada neste mês.", "fin_item_meses", `${hoje.ano}-${hoje.mes}:contas`);
  const abertasFatos = abertas
    .sort((a, b) => (a.dia ?? 99) - (b.dia ?? 99) || b.mes!.valor - a.mes!.valor)
    .slice(0, 8)
    .map((i) => {
      const n = nome(i.nome);
      const vence = i.dia ? `, vence dia ${i.dia}${i.dia_estimado ? " (estimado)" : ""}${i.dia < hoje.dia ? " (já passou)" : ""}` : "";
      return fact("Conta em aberto", `${n ?? OMITTED} ${formatBRL(i.mes!.valor)}${vence}`, "fin_itens", i.id, n === null);
    });

  const diaLinha = fact("Dia a dia", resumo.diaADia.qtd
    ? `${formatBRL(resumo.diaADia.total)} em ${resumo.diaADia.qtd} gasto${resumo.diaADia.qtd === 1 ? "" : "s"} neste mês.`
    : "nenhum gasto do dia a dia lançado neste mês.", "fin_gastos", `${hoje.ano}-${hoje.mes}`);
  const catFatos = resumo.diaADia.porCategoria.slice(0, 8).map((c, i) => {
    const n = nome(c.categoria);
    return fact("Categoria", `${n ?? OMITTED} ${formatBRL(c.total)} (${c.qtd} gasto${c.qtd === 1 ? "" : "s"})`, "fin_gastos", `${hoje.ano}-${hoje.mes}:categoria-${i + 1}`, n === null);
  });

  const out: F[] = [];
  const credito = resumo.credito.qtd
    ? [fact("Crédito", resumo.credito.naFatura
      ? `${formatBRL(resumo.credito.total)} em ${resumo.credito.qtd} gasto${resumo.credito.qtd === 1 ? "" : "s"} no crédito, já dentro da fatura do cartão (não soma duas vezes).`
      : `${formatBRL(resumo.credito.total)} em ${resumo.credito.qtd} gasto${resumo.credito.qtd === 1 ? "" : "s"} no crédito, somados ao mês (a fatura do cartão não está lançada).`, "fin_gastos", `${hoje.ano}-${hoje.mes}:credito`)]
    : [];

  const { intent } = input;
  if (intent.kind === "categoria") {
    const alvo = intent.categoria ? sem(intent.categoria) : sem(intent.termo ?? "");
    const doTermo = d.gastos.filter((g) => (intent.categoria ? sem(g.categoria) === alvo : sem(g.categoria).includes(alvo) || sem(g.descricao).includes(alvo)));
    const rotulo = intent.categoria ?? intent.termo ?? "";
    const ocultoRotulo = hidden(rotulo, blocked);
    if (doTermo.length) {
      const total = doTermo.reduce((s, g) => s + Math.round(g.valor * 100), 0) / 100;
      const cred = doTermo.filter((g) => g.meio === "credito").length;
      out.push(fact("Gasto na categoria", `${ocultoRotulo ? OMITTED : rotulo} somou ${formatBRL(total)} em ${doTermo.length} gasto${doTermo.length === 1 ? "" : "s"} em ${mesLabel}${cred && resumo.credito.naFatura ? ` (${cred} no crédito, que também está na fatura do cartão)` : ""}.`, "fin_gastos", `${hoje.ano}-${hoje.mes}:busca`, ocultoRotulo));
      for (const g of doTermo.slice(0, 6)) {
        const desc = g.descricao ? nome(g.descricao) : "";
        out.push(fact("Gasto", `dia ${String(g.dia).padStart(2, "0")}/${String(g.mes).padStart(2, "0")}, ${formatBRL(g.valor)}, ${MEIO_LABEL[g.meio]}${desc === null ? `, ${OMITTED}` : desc ? `, ${desc}` : ""}`, "fin_gastos", g.id, desc === null));
      }
    } else out.push(fact("Gasto na categoria", `nenhum gasto de ${ocultoRotulo ? OMITTED : rotulo} lançado em ${mesLabel}.`, "fin_gastos", `${hoje.ano}-${hoje.mes}:busca`, ocultoRotulo));
    out.push(sumario, diaLinha, ...catFatos, ...credito);
  } else if (intent.kind === "contas") {
    out.push(contasLinha, ...abertasFatos, sumario, ...credito);
  } else {
    out.push(sumario, diaLinha, ...catFatos, ...credito, contasLinha, ...abertasFatos.slice(0, 4));
  }
  for (const a of resumo.avisos) out.push(fact("Aviso", a, "fin_item_meses", `${hoje.ano}-${hoje.mes}:aviso`));
  if (intent.kind !== "categoria") {
    const p = previsaoRecebimento({ hoje, itens: d.itens, meses: d.meses, config: d.config });
    if (p.proximo) {
      out.push(fact("Próximo recebimento", `${p.proximo.rotulo}, dia ${p.proximo.data.slice(8, 10)}/${p.proximo.data.slice(5, 7)}, ${formatBRL(p.proximo.valor)}${p.proximo.estimado ? " (estimado)" : ""}; até lá vencem ${formatBRL(p.contasAteLa.total)} em contas.`, "fin_config", "previsao"));
    }
  }
  if (!d.itens.length && !d.gastos.length) {
    out.unshift(fact("Sem lançamentos", `a pessoa ainda não lançou contas nem gastos em ${mesLabel}. Diga isso e sugira lançar na tela Financeiro ou pela conversa ("gastei 45 no mercado no pix").`, "fin_gastos", "vazio"));
  }

  // Limites de volume: fatos em ordem de importância; corta pelo número e pelo tamanho do bloco.
  let facts: AttentionFact[] = out.slice(0, FINANCE_MAX_FACTS).map((f, i) => ({ ...f, tag: `F${i + 1}` }));
  while (facts.length > 1 && formatFinanceBlock({ facts, unavailable: [], mesLabel }).length > FINANCE_MAX_CHARS) facts = facts.slice(0, -1);
  return { facts, unavailable: [], mesLabel };
}

const HEADER = "Core do GaDu · Finanças do mês (dados reais da própria pessoa, lidos agora, só leitura; valores em reais):";
const RULES = [
  "Como responder:",
  "- Use SÓ os itens acima. Não invente valores, contas ou gastos, e não faça contas que dependam do que não está listado.",
  "- Cite a etiqueta entre colchetes ao mencionar um dado, por exemplo [F1], [F2].",
  "- Gastos no crédito já estão dentro da fatura do cartão: não some os dois.",
  "- Se algo estiver omitido por privacidade, diga que está omitido e não tente adivinhar.",
  "- Responda curto, direto ao que foi perguntado, com os números.",
];

export function formatFinanceBlock(r: FinanceResult): string {
  const lines = r.facts.map((f) => `[${f.tag}] ${f.text}`);
  return "\n\n" + [HEADER, lines.join("\n"), RULES.join("\n")].join("\n");
}

/** Instruções para o modelo propor o lançamento de um gasto (só quando a mensagem tem essa intenção). Não grava nada. */
export function financeProposalRules(todayIso: string): string {
  return "\n\nLançamento de gasto (Finanças): a pessoa quer registrar um gasto. Você NÃO grava: coloque no bloco de controle "
    + `"gastos":[{"valor":45.00,"categoria":"Mercado","descricao":"curta, sem dados sensíveis","meio":"pix","data":"AAAA-MM-DD"}] e diga em uma frase "Preparei o lançamento, confira e toque em Lançar". `
    + "Categorias: Mercado, Restaurantes, Combustível, Carro, Farmácia e saúde, Cuidados pessoais, Transporte, Casa, Filhos, Presentes, Vestuário, Lazer, Loteria, Trabalho, Compras, Outros (na dúvida, Outros). "
    + `Meio: debito, pix, credito ou reserva (sem indicação: debito). "data" só se a pessoa disser outro dia (hoje é ${todayIso}); sem data, omita. `
    + "Se faltar o valor, pergunte e deixe a lista vazia. Um item por gasto, no máximo 5.";
}
