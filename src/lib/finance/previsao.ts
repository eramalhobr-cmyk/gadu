// "Previsão até o próximo recebimento": o que ainda vence antes de o próximo dinheiro entrar (dia 15 e dia 1 por padrão).
// Pequena e pura. Não é o fluxo de caixa completo (fase futura): sem saldo do banco, só contas em aberto e receitas do mês.
import { diaNoMes, isoDia, ordinal, proximoMes } from "./datas.ts";
import { fromCents, toCents } from "./money.ts";
import type { Config, Item, ItemMes, YM, YMD } from "./types.ts";

type Evento = { data: YMD; valor: number; rotulo: string };

export type PrevisaoRecebimento = {
  /** Próximo recebimento; null se não há receita datada. `estimado`: veio dos valores do mês atual, porque o mês seguinte ainda não tem receita lançada. */
  proximo: { data: string; dias: number; valor: number; rotulo: string; estimado: boolean } | null;
  /** Contas em aberto que vencem de hoje até o dia anterior ao recebimento. */
  contasAteLa: { total: number; qtd: number; itens: { nome: string; data: string; valor: number }[] };
  /** Contas em aberto com vencimento já passado (se já pagou, é só marcar). */
  vencidasEmAberto: { total: number; qtd: number };
  /** Itens sem dia de vencimento ou de entrada: não entram na conta. */
  semDia: number;
  /** Receitas em aberto datadas depois do próximo recebimento (não entram na conta). */
  receitasDepois: number;
};

/** Recebimentos ainda não marcados como recebidos de um mês. A receita principal se divide em adiantamento e restante, se configurado. */
function recebimentos(ym: YM, itens: Item[], meses: ItemMes[], config: Config | null, soEmAberto: boolean): { eventos: Evento[]; semDia: number } {
  const eventos: Evento[] = [];
  let semDia = 0;
  const porId = new Map(itens.map((i) => [i.id, i]));
  for (const m of meses) {
    if (m.ano !== ym.ano || m.mes !== ym.mes || toCents(m.valor) <= 0) continue;
    const it = porId.get(m.item_id);
    if (!it || it.tipo !== "receita" || (soEmAberto && m.pago)) continue;
    const pct = config?.adiantamento_pct ?? 0;
    if (config && it.id === config.receita_principal_id && pct > 0) {
      const adiant = Math.round((toCents(m.valor) * pct) / 100);
      eventos.push({ data: { ...ym, dia: diaNoMes(ym, config.dia_adiantamento) }, valor: fromCents(adiant), rotulo: `Adiantamento de ${it.nome}` });
      eventos.push({ data: { ...ym, dia: diaNoMes(ym, config.dia_restante) }, valor: fromCents(toCents(m.valor) - adiant), rotulo: `Restante de ${it.nome}` });
    } else if (it.dia) eventos.push({ data: { ...ym, dia: diaNoMes(ym, it.dia) }, valor: m.valor, rotulo: it.nome });
    else semDia++;
  }
  return { eventos, semDia };
}

export function previsaoRecebimento(e: { hoje: YMD; itens: Item[]; meses: ItemMes[]; config: Config | null }): PrevisaoRecebimento {
  const hoje = e.hoje;
  const hojeOrd = ordinal(hoje);
  const ymHoje: YM = { ano: hoje.ano, mes: hoje.mes };
  const ymProx = proximoMes(ymHoje);

  const atual = recebimentos(ymHoje, e.itens, e.meses, e.config, true);
  let futuros = atual.eventos.filter((ev) => ordinal(ev.data) > hojeOrd);
  let estimado = false;
  let semDia = atual.semDia;
  if (futuros.length === 0) {
    const prox = recebimentos(ymProx, e.itens, e.meses, e.config, false);
    semDia += prox.semDia;
    futuros = prox.eventos;
    if (futuros.length === 0) {
      // Mês seguinte sem receita lançada: estima com os valores do mês atual (inclusive os já recebidos), nas mesmas datas.
      const base = recebimentos(ymHoje, e.itens, e.meses, e.config, false);
      futuros = base.eventos.map((ev) => ({ ...ev, data: { ...ymProx, dia: diaNoMes(ymProx, ev.data.dia) } }));
      estimado = futuros.length > 0;
    }
  }
  futuros.sort((a, b) => ordinal(a.data) - ordinal(b.data));
  const prox = futuros[0] ?? null;
  const limite = prox ? ordinal(prox.data) : null;
  // Sem recebimento conhecido, as contas "até lá" vão só até o fim do mês.
  const limiteContas = limite ?? ordinal({ ...ymProx, dia: 1 });

  // Contas em aberto: despesas não pagas, fora de cartão e fora da conta corrente (via reserva).
  const porId = new Map(e.itens.map((i) => [i.id, i]));
  let ateTotal = 0, ateQtd = 0, vencTotal = 0, vencQtd = 0, receitasDepois = 0;
  const lista: { nome: string; data: string; valor: number; ord: number }[] = [];
  for (const m of e.meses) {
    const it = porId.get(m.item_id);
    const ym = { ano: m.ano, mes: m.mes };
    const doMes = (m.ano === ymHoje.ano && m.mes === ymHoje.mes);
    const doProx = (m.ano === ymProx.ano && m.mes === ymProx.mes);
    if (!it || toCents(m.valor) <= 0 || (!doMes && !doProx)) continue;
    if (it.tipo === "receita") {
      if (!m.pago && it.dia && limite !== null && ordinal({ ...ym, dia: diaNoMes(ym, it.dia) }) > limite) receitasDepois++;
      continue;
    }
    if (m.pago || it.cartao_id || m.via_reserva) continue;
    if (!it.dia) { if (doMes) semDia++; continue; }
    const data: YMD = { ...ym, dia: diaNoMes(ym, it.dia) };
    const ord = ordinal(data);
    if (ord < hojeOrd) { if (doMes) { vencTotal += toCents(m.valor); vencQtd++; } continue; }
    if (ord >= limiteContas) continue;
    ateTotal += toCents(m.valor); ateQtd++;
    lista.push({ nome: it.nome, data: isoDia(data), valor: m.valor, ord });
  }
  lista.sort((a, b) => a.ord - b.ord || b.valor - a.valor);

  return {
    proximo: prox ? { data: isoDia(prox.data), dias: ordinal(prox.data) - hojeOrd, valor: prox.valor, rotulo: prox.rotulo, estimado } : null,
    contasAteLa: { total: fromCents(ateTotal), qtd: ateQtd, itens: lista.slice(0, 6).map(({ nome, data, valor }) => ({ nome, data, valor })) },
    vencidasEmAberto: { total: fromCents(vencTotal), qtd: vencQtd },
    semDia,
    receitasDepois,
  };
}
