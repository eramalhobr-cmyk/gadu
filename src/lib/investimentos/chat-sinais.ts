import type { RespostaSinais, SinalAcao } from "./analise.ts";
import { NOME_SINAL } from "./sinais.ts";
import { ativosDoGrupo, UNIVERSO, type Ativo } from "./universo.ts";

/**
 * Detector de pedido de sinais na conversa ("como está a Nvidia?", "o que comprar de IA?", "sinal da Petrobras").
 * Nomes ambíguos (meta, vale, itaú, amazon…) só valem com uma palavra de mercado, para não confundir
 * a tela Metas, "vale a pena" ou compras numa loja.
 */
const MAX_ATIVOS = 10;
const normalizar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\&]/g, "\\$&");
const temTermo = (texto: string, termo: string) => new RegExp(`(?<![a-z0-9])${escapar(normalizar(termo))}(?![a-z0-9])`).test(texto);

const MERCADO_FORTE = /\b(?:acao|acoes|papel|papeis|sinal|sinais|bolsa|cotacao|ticker|investir|investimento|investimentos|nasdaq|b3|ibovespa)\b/;
const MERCADO_FRACO = /\b(?:compr\w*|vend\w*|tendencia|preco|grafico|analise|vale a pena|como (?:esta|estao|anda|andam|vai|vao)|subindo|caindo)\b/;
const IA = /\b(?:ia|inteligencia artificial)\b/;
const BRASIL = /\b(?:brasileir\w*|brasil|b3|ibovespa)\b/;

export function pedeSinais(mensagem: string): Ativo[] | null {
  const t = normalizar(mensagem);
  const forte = MERCADO_FORTE.test(t);
  const fraco = forte || MERCADO_FRACO.test(t);
  const achados = UNIVERSO.filter((a) => {
    // Tickers explícitos valem sempre, exceto os que também são palavras comuns (META, AMD tratados como nomes).
    if (!["META", "AMD"].includes(a.ticker) && temTermo(t, a.ticker)) return true;
    if (fraco && a.busca.some((n) => temTermo(t, n))) return true;
    return forte && (a.ambiguo ?? []).some((n) => temTermo(t, n));
  });
  if (achados.length) return achados.slice(0, MAX_ATIVOS);
  const grupoPedido = forte || /\b(?:compr\w*|vend\w*|empresas)\b/.test(t);
  if (grupoPedido && IA.test(t)) return ativosDoGrupo("ia");
  if (forte && /\b(?:acoes|papeis|lideres|empresas)\b/.test(t) && BRASIL.test(t) && !/\bacompanhad/.test(t)) return ativosDoGrupo("brasil");
  return null;
}

const DIA = 86_400_000;
const p = (v: number | null) => (v === null ? "sem dados" : `${(v * 100).toFixed(1)}%`);
const n2 = (v: number | null) => (v === null ? "sem dados" : v.toFixed(2));

function linha(a: SinalAcao): string {
  const i = a.indicadores;
  const notas = a.analistas.map((x) => `${x.nome} ${x.nota === null ? "sem dados" : x.nota.toFixed(2)}`).join(", ");
  const bt = a.backtest
    ? `teste ${a.backtest.inicio} a ${a.backtest.fim}: regra ${p(a.backtest.retornoRegra)} x segurar ${p(a.backtest.retornoSegurar)}${a.backtest.perdeuDaReferencia ? " (a regra PERDEU de segurar)" : ""}, queda máxima da regra ${p(a.backtest.quedaRegra)}, acerto ${p(a.backtest.acerto)}, ${a.backtest.trocas} trocas`
    : "sem backtest (histórico curto)";
  return `${a.ticker} (${a.nome}) · ${a.horario} · ${a.moeda} ${n2(a.preco)} · sinal ${NOME_SINAL[a.sinal]} · confiança ${a.confianca}% · notas: ${notas} · retorno 3m ${p(i.retorno3m)}, 6m ${p(i.retorno6m)}, 12m ${p(i.retorno12m)} · contra o índice 6m ${p(i.forca6m)} · RSI ${n2(i.rsi14)} · volatilidade ${p(i.volatilidade)} ao ano · queda máxima 1 ano ${p(i.quedaMaxima)} · motivos: ${a.motivos.join(" ")} · ${bt} · fonte ${a.fonte}`;
}

/** Bloco para o contexto do GaDu: só números calculados no servidor a partir de dados públicos verificados. */
export function blocoSinais(r: Pick<RespostaSinais, "itens" | "indisponiveis" | "referencias"> | null, agora = Date.now()): string {
  const instrucoes = "Responda curto, em pt-BR, só com estes números. Diga que é um estudo automático com dados públicos e não é recomendação de investimento. Explique o sinal pelos motivos e cite o backtest, inclusive quando a regra perdeu de comprar e segurar. Sem dados fundamentais: não invente valuation, notícias, balanços, preço-alvo ou previsão. Não proponha ordens nem ações do app neste pedido.";
  const atuais = (r?.itens ?? []).filter((a) => {
    const idade = agora - Date.parse(a.horario);
    return idade >= -5 * 60_000 && idade <= 7 * DIA;
  });
  if (atuais.length === 0) return `\n\nSinais de investimentos: sem dados atuais verificados. Diga isso e não estime preços nem sinais. ${instrucoes}`;
  const faltam = [...(r?.indisponiveis ?? []), ...(r?.itens ?? []).filter((a) => !atuais.includes(a)).map((a) => a.ticker)];
  const refs = (r?.referencias ?? []).map((x) => `${x.nome}${x.disponivel ? "" : " (indisponível)"}`).join(", ");
  return `\n\nSinais de investimentos (estudo automático; analistas Tendência, Momento, Força relativa e Risco; nota de -1 a +1; referência: ${refs || "nenhuma"}):\n${atuais.map(linha).join("\n")}${faltam.length ? `\nSem dados atuais: ${faltam.join(", ")}.` : ""}\n${instrucoes}`;
}
