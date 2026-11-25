import { ACOMPANHADOS, type Papel } from "./cotacoes.ts";

export const PEDIDO_PESQUISA = "Compare as ações acompanhadas da B3 nos horizontes curto, médio e longo e explique os riscos.";
export const pedePesquisaInvestimentos = (texto: string) =>
  /\b(?:investimentos?|bolsa|b3|a[cç][oõ]es da b3|lren3|ceab3|viva3)\b/i.test(texto) &&
  /\b(?:cota[cç][aã]o|analise|an[aá]lise|compare|comparar|risco|compro|comprar|desempenho|cen[aá]rio|perspectivas|movimento)\b/i.test(texto);

const numero = (v: number | null) => v === null ? "sem dados" : v.toFixed(2);
const DIA = 86_400_000;

export function blocoPesquisa(cotacoes: (Papel | null)[], agora = Date.now()): string {
  const atuais = cotacoes.filter((p): p is Papel => {
    if (!p) return false;
    const idade = agora - Date.parse(p.horario);
    return idade >= -5 * 60_000 && idade <= 7 * DIA;
  });
  const instrucoes = "Compare 21, 63 e 252 pregões, identifique riscos e dados faltantes. Cite brapi e os horários. Diferencie os movimentos observados de hipóteses. Não invente preços, notícias, múltiplos, tese fundamentalista, resultado futuro ou preço-alvo. Não proponha ordens ou ações do app neste pedido.";
  if (atuais.length === 0) return `\n\nPesquisa de investimentos (brapi): sem cotações atuais verificadas. Diga isso e não estime entradas ou preços. ${instrucoes}`;
  const linhas = atuais.map((p) => `${p.ticker} · ${p.horario} · BRL ${numero(p.preco)} · dia % ${numero(p.dia)} · ${p.periodos.map((j) => `${j.sessoes} pregões % ${numero(j.variacao)}`).join(" · ")} · perda máxima em 63 pregões % ${numero(p.perdaMaxima63)} · base ${p.baseAjustada ? "ajustada pelo provedor" : "fechamentos sem ajuste verificado"}`);
  const indisponiveis = ACOMPANHADOS.filter((a) => !atuais.some((p) => p.ticker === a.ticker)).map((a) => a.ticker);
  return `\n\nPesquisa de investimentos (somente dados numéricos brapi):\n${linhas.join("\n")}${indisponiveis.length ? `\nSem dados atuais: ${indisponiveis.join(", ")}.` : ""}\n${instrucoes}`;
}
