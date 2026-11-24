// Compras: acompanha pedidos já feitos a partir dos e-mails da própria pessoa (Gmail, só leitura).
// Módulo puro, sem IA e sem banco: agrupa e-mails do mesmo pedido, acha loja, número, situação,
// previsão de entrega e código de rastreio. O que o e-mail não diz fica em branco (nada é inventado).

export type EmailPedido = {
  id: string;
  thread?: string;
  from: string;
  fromEmail?: string;
  subject: string;
  /** Snippet e começo do corpo em texto puro (já cortado por quem busca). */
  text: string;
  /** Data do e-mail (cabeçalho Date ou ISO). */
  date: string;
};

export type Situacao = "confirmado" | "enviado" | "saiu_para_entrega" | "entregue" | "cancelado" | "atualizacao";

export type Pedido = {
  /** Chave estável do agrupamento (loja + número, ou conversa do Gmail). */
  chave: string;
  loja: string;
  numero: string | null;
  situacao: Situacao;
  /** Previsão de entrega em AAAA-MM-DD (fuso de Brasília), só quando o e-mail diz. */
  previsao: string | null;
  rastreio: string | null;
  /** Data do e-mail mais recente do pedido (ISO). */
  atualizadoEm: string;
  emails: number;
  /** Conversa do Gmail mais recente, para abrir o e-mail. */
  thread: string | null;
  assunto: string;
};

export const SITUACAO_TEXTO: Record<Situacao, string> = {
  confirmado: "Confirmado",
  enviado: "A caminho",
  saiu_para_entrega: "Saiu para entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
  atualizacao: "Atualização",
};

/** Ordem de avanço: a situação de um pedido é a mais avançada entre os e-mails dele. */
const RANK: Record<Situacao, number> = { atualizacao: 0, confirmado: 1, enviado: 2, saiu_para_entrega: 3, entregue: 4, cancelado: 5 };

/** Busca do Gmail: e-mails de pedido dos últimos 45 dias, fora de redes sociais e fóruns. */
export const GMAIL_QUERY_PEDIDOS =
  'newer_than:45d -category:social -category:forums (pedido OR compra OR entrega OR rastreio OR rastreamento OR enviado OR despachado OR "a caminho" OR order OR shipped OR delivery)';

function norm(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const SINAL_PEDIDO = /\b(pedido|compra|order|encomenda|entrega|entregue|rastreio|rastreamento|enviado|despachado|shipped|delivered|delivery|a caminho|em transito|saiu para entrega|nota fiscal)\b/;
const PROMO = /\b(oferta|ofertas|cupom|cupons|desconto|promocao|promocoes|black friday|liquidacao|so hoje|aproveite|newsletter|frete gratis para voce)\b/;

const RX_NUMERO = [
  /\b(?:pedido|order|compra|encomenda)\s*(?:n(?:o|º|°|\.)?|num(?:ero)?|#|:)?\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{4,29})\b/i,
  /#\s?([0-9][0-9-]{4,29})\b/,
];
/** Correios (AA123456789BR) e códigos genéricos depois de "rastreio"/"rastreamento"/"tracking". */
const RX_CORREIOS = /\b([A-Z]{2}\d{9}[A-Z]{2})\b/;
const RX_RASTREIO = /\b(?:codigo de rastreio|codigo de rastreamento|rastreio|rastreamento|tracking(?: number)?)\s*[:#-]?\s*([A-Z0-9]{8,30})\b/i;

const MESES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};
const GATILHO_PREVISAO = "(?:previsao de entrega|entrega prevista(?: para)?|prazo de entrega|chega(?:ra)? ate|chegara em|receba ate|sera entregue (?:ate|em)|entrega ate|data estimada(?: de entrega)?|estimated delivery|arrives(?: by)?)";
const RX_PREV_NUM = new RegExp(`${GATILHO_PREVISAO}\\s*[:-]?\\s*(?:dia\\s*)?(\\d{1,2})[/.-](\\d{1,2})(?:[/.-](\\d{2,4}))?`);
const RX_PREV_EXT = new RegExp(`${GATILHO_PREVISAO}\\s*[:-]?\\s*(?:dia\\s*)?(\\d{1,2})\\s+de\\s+([a-z]+)(?:\\s+de\\s+(\\d{4}))?`);

/** Data ISO (AAAA-MM-DD) no fuso de Brasília. */
export function diaSP(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function dataDoEmail(e: EmailPedido): Date {
  const d = new Date(e.date);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

/** Monta AAAA-MM-DD; sem ano, usa o do e-mail (ou o seguinte, se a data ficaria muito antes do e-mail). */
function montarData(dia: number, mes: number, ano: number | null, ref: Date): string | null {
  if (!(dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12)) return null;
  const refAno = Number(diaSP(ref).slice(0, 4));
  let y = ano ?? refAno;
  if (y < 100) y += 2000;
  if (ano === null) {
    const refMes = Number(diaSP(ref).slice(5, 7));
    if (mes < refMes - 6) y += 1; // pedido de dezembro com entrega em janeiro
  }
  const d = new Date(Date.UTC(y, mes - 1, dia));
  if (d.getUTCMonth() !== mes - 1) return null; // 31/02 e afins
  return `${y}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function previsaoDe(texto: string, ref: Date): string | null {
  const t = norm(texto);
  const n = RX_PREV_NUM.exec(t);
  if (n) return montarData(Number(n[1]), Number(n[2]), n[3] ? Number(n[3]) : null, ref);
  const x = RX_PREV_EXT.exec(t);
  if (x && MESES[x[2]]) return montarData(Number(x[1]), MESES[x[2]], x[3] ? Number(x[3]) : null, ref);
  return null;
}

export function situacaoDe(texto: string): Situacao {
  const t = norm(texto);
  if (/\b(cancelado|cancelamento|foi cancelad|order cancel)/.test(t)) return "cancelado";
  if (/\b(foi entregue|pedido entregue|entregue com sucesso|entrega realizada|delivered|was delivered|objeto entregue)\b/.test(t)) return "entregue";
  if (/\b(saiu para entrega|out for delivery|em rota de entrega|chega hoje)\b/.test(t)) return "saiu_para_entrega";
  if (/\b(enviado|enviamos|despachado|a caminho|em transito|shipped|has shipped|postado|coletado pela transportadora)\b/.test(t)) return "enviado";
  if (/\b(confirmado|confirmamos|recebemos seu pedido|pedido recebido|pagamento aprovado|order confirmed|obrigado pela (sua )?compra|pedido realizado)\b/.test(t)) return "confirmado";
  return "atualizacao";
}

export function numeroDe(texto: string): string | null {
  for (const rx of RX_NUMERO) {
    const m = rx.exec(texto);
    // Número de pedido tem pelo menos um dígito (evita "pedido CONFIRMADO").
    if (m && /\d/.test(m[1])) return m[1].replace(/-+$/, "").toUpperCase();
  }
  return null;
}

export function rastreioDe(texto: string): string | null {
  const c = RX_CORREIOS.exec(texto);
  if (c) return c[1];
  const g = RX_RASTREIO.exec(norm(texto));
  return g && /\d/.test(g[1]) ? g[1].toUpperCase() : null;
}

/** Nome da loja: o nome do remetente sem "não responda"; sem nome, o domínio do e-mail. */
export function lojaDe(from: string, fromEmail?: string): string {
  const limpo = from
    .replace(/\b(no-?reply|nao-?responda|naoresponda|noreply|notificac(?:ao|oes)|pedidos?|orders?|entregas?)\b/gi, "")
    .replace(/[|·•–-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (limpo.length >= 2 && !limpo.includes("@")) return limpo.slice(0, 40);
  const dom = (fromEmail ?? from).split("@")[1]?.split(".").filter((p) => !["com", "br", "net", "org", "mail", "email", "e", "news", "info", "www"].includes(p.toLowerCase()))[0];
  return dom ? dom.charAt(0).toUpperCase() + dom.slice(1).slice(0, 39) : "Loja";
}

/** É e-mail de pedido? Sinal de pedido no assunto ou no texto, e não é só propaganda. */
export function ehPedido(e: EmailPedido): boolean {
  const assunto = norm(e.subject);
  const tudo = `${assunto} ${norm(e.text)}`;
  if (!SINAL_PEDIDO.test(tudo)) return false;
  const temNumeroOuRastreio = Boolean(numeroDe(`${e.subject} ${e.text}`) || rastreioDe(`${e.subject} ${e.text}`));
  if (PROMO.test(assunto) && !temNumeroOuRastreio) return false;
  return SINAL_PEDIDO.test(assunto) || temNumeroOuRastreio;
}

/** Agrupa os e-mails em pedidos. Confirmação e envio do mesmo pedido viram um só; pedidos diferentes ficam separados. */
export function agruparPedidos(emails: EmailPedido[]): Pedido[] {
  const grupos = new Map<string, { loja: string; numero: string | null; itens: EmailPedido[] }>();
  for (const e of emails) {
    if (!ehPedido(e)) continue;
    const texto = `${e.subject} ${e.text}`;
    const loja = lojaDe(e.from, e.fromEmail);
    const numero = numeroDe(texto);
    const chave = numero ? `${norm(loja)}#${numero}` : e.thread ? `t:${e.thread}` : `${norm(loja)}:${norm(e.subject).replace(/\d+/g, "").slice(0, 60)}`;
    const g = grupos.get(chave) ?? { loja, numero, itens: [] };
    g.itens.push(e);
    grupos.set(chave, g);
  }
  // Um e-mail sem número na mesma conversa de um pedido com número junta-se a ele.
  for (const [chave, g] of [...grupos]) {
    if (!chave.startsWith("t:")) continue;
    const alvo = [...grupos.entries()].find(([k, o]) => k !== chave && o.numero && o.itens.some((i) => i.thread && i.thread === g.itens[0].thread));
    if (alvo) { alvo[1].itens.push(...g.itens); grupos.delete(chave); }
  }
  const pedidos: Pedido[] = [];
  for (const [chave, g] of grupos) {
    const itens = [...g.itens].sort((a, b) => dataDoEmail(a).getTime() - dataDoEmail(b).getTime());
    let situacao: Situacao = "atualizacao";
    let previsao: string | null = null;
    let rastreio: string | null = null;
    for (const e of itens) {
      const texto = `${e.subject} ${e.text}`;
      const s = situacaoDe(texto);
      if (RANK[s] >= RANK[situacao]) situacao = s;
      previsao = previsaoDe(texto, dataDoEmail(e)) ?? previsao; // a mais recente que o e-mail informar
      rastreio = rastreio ?? rastreioDe(texto);
    }
    const ultimo = itens[itens.length - 1];
    pedidos.push({
      chave,
      loja: g.loja,
      numero: g.numero,
      situacao,
      previsao: situacao === "entregue" || situacao === "cancelado" ? null : previsao,
      rastreio,
      atualizadoEm: dataDoEmail(ultimo).toISOString(),
      emails: itens.length,
      thread: ultimo.thread ?? null,
      assunto: ultimo.subject.slice(0, 160),
    });
  }
  // Primeiro o que ainda vai chegar (pela previsão), depois o resto do mais recente para o mais antigo.
  const aberto = (p: Pedido) => p.situacao !== "entregue" && p.situacao !== "cancelado";
  return pedidos.sort((a, b) =>
    Number(aberto(b)) - Number(aberto(a))
    || (a.previsao && b.previsao ? a.previsao.localeCompare(b.previsao) : Number(Boolean(b.previsao)) - Number(Boolean(a.previsao)))
    || b.atualizadoEm.localeCompare(a.atualizadoEm));
}

export type DiaEntrega = { dia: string; pedidos: Pedido[] };

/** Calendário de entregas: pedidos em aberto com previsão, agrupados por dia; os sem previsão ficam à parte. */
export function calendarioEntregas(pedidos: Pedido[]): { dias: DiaEntrega[]; semPrevisao: Pedido[] } {
  const abertos = pedidos.filter((p) => p.situacao !== "entregue" && p.situacao !== "cancelado");
  const porDia = new Map<string, Pedido[]>();
  for (const p of abertos) if (p.previsao) porDia.set(p.previsao, [...(porDia.get(p.previsao) ?? []), p]);
  return {
    dias: [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([dia, ps]) => ({ dia, pedidos: ps })),
    semPrevisao: abertos.filter((p) => !p.previsao),
  };
}

/** Pergunta sobre compras e entregas na conversa ("quando chega meu pedido?", "tem entrega hoje?"). */
export function pedeCompras(mensagem: string): boolean {
  const t = norm(mensagem);
  return /\b(meus? pedidos?|minhas? compras?|minhas? entregas?|encomendas?|rastreio|rastrear|rastreamento)\b/.test(t)
    || /\b(quando chega|quando vai chegar|ja chegou|chega hoje|chega amanha|tem (alguma )?entrega|o que (vai )?chega)/.test(t);
}

/** Bloco de contexto para o modelo: cada pedido com etiqueta de origem [C1], [C2]… Só o que o e-mail disse. */
export function blocoCompras(pedidos: Pedido[], hoje: string): string {
  if (!pedidos.length) return "COMPRAS (e-mails de pedidos dos últimos 45 dias): nenhum pedido encontrado. Diga isso com clareza; não invente pedidos.";
  const linhas = pedidos.slice(0, 15).map((p, i) => {
    const prev = p.previsao ? (p.previsao === hoje ? "previsão: hoje" : `previsão: ${p.previsao.split("-").reverse().join("/")}`) : "sem previsão no e-mail";
    return `[C${i + 1}] ${p.loja}${p.numero ? ` · pedido ${p.numero}` : ""} · ${SITUACAO_TEXTO[p.situacao]} · ${prev}${p.rastreio ? ` · rastreio ${p.rastreio}` : ""}`;
  });
  return `COMPRAS (dos e-mails de pedidos da pessoa; cite as etiquetas [C1]… ao responder; o que não está aqui o e-mail não disse):\n${linhas.join("\n")}`;
}
