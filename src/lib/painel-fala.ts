// Resumo falado dos painéis (UX-7 · M4): o que o gráfico mostra, em uma ou duas frases, só com os números reais.
// Usado pelo botão "Ouvir" de cada painel e quando a pessoa pede "mostra meu resumo de…" / "lê o resumo" por voz.

const pl = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export type FalaFin = { mes: string; ano: number; contas: { qtd: number; pagas: number; aberto: string }; anoTotal: string | null; media: string | null; tetos: { categoria: string; pct: number }[] };
export function falaFinancas(f: FalaFin): string {
  const partes: string[] = [];
  partes.push(f.contas.qtd ? `Em ${f.mes}, você pagou ${f.contas.pagas} de ${pl(f.contas.qtd, "conta", "contas")}${f.contas.pagas < f.contas.qtd ? `; faltam ${f.contas.aberto} em aberto` : ""}.` : `Em ${f.mes}, nenhuma conta cadastrada.`);
  partes.push(f.anoTotal ? `No ano, o dia a dia soma ${f.anoTotal}${f.media ? `, média de ${f.media} por mês` : ""}.` : `Ainda não há gastos do dia a dia em ${f.ano}.`);
  const acima = f.tetos.filter((t) => t.pct >= 80).sort((a, b) => b.pct - a.pct).slice(0, 2);
  for (const t of acima) partes.push(t.pct >= 100 ? `${t.categoria} passou do teto, ${t.pct}%.` : `${t.categoria} está em ${t.pct}% do teto.`);
  if (f.tetos.length && !acima.length) partes.push("Todas as categorias estão abaixo de 80% do teto.");
  return partes.join(" ");
}

export function falaTarefas(r: { abertas: number; atrasadas: number; paraHoje: number; feitasHoje: number; feitas7: number }): string {
  if (!r.abertas && !r.feitas7) return "Nenhuma tarefa aberta e nenhuma concluída nos últimos 7 dias.";
  const extra = [r.atrasadas ? pl(r.atrasadas, "atrasada", "atrasadas") : "", r.paraHoje ? `${r.paraHoje} para hoje` : ""].filter(Boolean).join(" e ");
  return `Você tem ${pl(r.abertas, "tarefa aberta", "tarefas abertas")}${extra ? `, ${extra}` : ""}. Hoje concluiu ${r.feitasHoje}; nos últimos 7 dias, ${r.feitas7}.`;
}

export function falaMetas(metas: { titulo: string; pct: number | null; situacao: string }[]): string {
  if (!metas.length) return "Nenhuma meta ativa.";
  const itens = metas.slice(0, 3).map((m) => `${m.titulo}: ${m.pct === null ? "sem registro ainda" : `${m.pct}%`}${m.situacao ? `, ${m.situacao.toLowerCase()}` : ""}`);
  return `Você tem ${pl(metas.length, "meta ativa", "metas ativas")}. ${itens.join(". ")}.`;
}

export function falaAgentes(a: { ativos: number; total: string; top: { nome: string; valor: string }[] }): string {
  const base = `${pl(a.ativos, "agente ativo", "agentes ativos")}.`;
  if (!a.top.length) return `${base} Nenhum gasto registrado este mês.`;
  return `${base} Gasto no mês: ${a.total}. ${a.top.slice(0, 2).map((t) => `${t.nome}, ${t.valor}`).join("; ")}.`;
}

export function falaHoje(h: { compromissos: number | null; atencao: number | null; abertas: number | null; feitas: number | null; gasto?: { pago: string; previsto: string | null } | null }): string {
  const p: string[] = [];
  if (h.compromissos !== null) p.push(h.compromissos ? `${pl(h.compromissos, "compromisso", "compromissos")} pela frente` : "agenda livre pelo resto do dia");
  if (h.atencao !== null) p.push(h.atencao ? `${h.atencao} ${h.atencao === 1 ? "coisa pede" : "coisas pedem"} atenção` : "nada pedindo atenção");
  if (h.abertas !== null) p.push(pl(h.abertas, "tarefa aberta", "tarefas abertas"));
  if (h.feitas !== null) p.push(`${h.feitas} ${h.feitas === 1 ? "feita" : "feitas"}`);
  let t = p.length ? `Hoje: ${p.join(", ")}.` : "";
  if (h.gasto) t += ` Gasto no mês: ${h.gasto.pago}${h.gasto.previsto ? ` de ${h.gasto.previsto} previstos` : ""}.`;
  return t.trim();
}

/** "Lê o resumo", "me fala o resumo", "ouvir o resumo desta tela": lê o painel da tela atual, sem modelo. */
export function parseLerResumo(text: string): boolean {
  const t = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  return /^(gadu )?(por favor )?(me )?(le|leia|ler|fala|falar|diz|dizer|ouvir|quero ouvir|conta)( pra mim| para mim)? (o )?(resumo|painel)( desta tela| dessa tela| daqui| da tela)?( pra mim| para mim| por favor)?$/.test(t);
}

/** Evento para falar uma frase do app (o botão "Ouvir" dos painéis dispara; o GaduApp fala com a voz escolhida). */
export const EVENTO_FALAR = "gadu:falar";
