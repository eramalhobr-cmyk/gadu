import { categoriaConhecida } from "../finance/lancamento.ts";

// Plano do Core: qual é a intenção da mensagem e quanto contexto cabe. Regra simples, sem IA.
export type Intent = "atencao_hoje";

export type Plan = {
  intent: Intent;
  /** Máximo de fatos e de caracteres do bloco enviado ao modelo. */
  maxFacts: number;
  maxChars: number;
};

export const ATENCAO_HOJE: Plan = { intent: "atencao_hoje", maxFacts: 30, maxChars: 6000 };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

// Frases (já sem acento nem pontuação) que pedem a visão de atenção do dia.
const ATENCAO: RegExp[] = [
  /\bo que (merece|pede|precisa de|requer|exige) (a |de )?(minha )?atencao\b/,
  /\bo que (mais )?(merece|pede|precisa de) (de )?atencao\b/,
  /\bcomo (esta|ta|vai|anda) (o )?meu dia\b/,
  /\bcomo (esta|ta|vai) (o )?(meu )?dia de hoje\b/,
  /\bo que (esta|ta|anda|tenho|tem|ha) (de )?atrasad[oa]s?\b/,
  /\bo que (eu )?(tenho|tem|ha) (de |pra |para )?(atrasad[oa]s?)\b/,
  /\b(minhas )?(tarefas|coisas|pendencias) atrasadas\b/,
  /\bo que (ainda )?(falta|faltou) (eu )?(fazer )?(hoje|pra hoje|para hoje)\b/,
  /\bo que (e|eh) (mais )?(importante|urgente|prioridade|prioritario) (pra |para )?(hoje|agora)\b/,
  /\bo que (eu )?(preciso|devo|tenho que|tenho de) (ver|fazer|resolver|olhar) (primeiro )?(hoje|agora)\b/,
  /\bpriorizar (o )?meu dia\b/,
  /\bme ajuda a priorizar (o )?meu dia\b/,
];

/** Intenção da mensagem, ou null. Não usa o contexto da tela nem nada vindo do cliente além do texto. */
export function detectIntent(message: string): Intent | null {
  const t = norm(message.slice(0, 400));
  return ATENCAO.some((r) => r.test(t)) ? "atencao_hoje" : null;
}

export function planFor(intent: Intent, over: Partial<Pick<Plan, "maxFacts" | "maxChars">> = {}): Plan {
  void intent;
  return { ...ATENCAO_HOJE, ...over };
}

// ---- Finanças: intenções simples, sem IA ----
export type FinanceKind = "resumo" | "contas" | "categoria" | "gasto";
/** `categoria`: categoria padrão reconhecida; `termo`: palavra livre (estabelecimento) quando a categoria não é conhecida. */
export type FinanceIntent = { kind: FinanceKind; categoria?: string; termo?: string };

const GASTO_REGISTRAR: RegExp[] = [
  /\b(gastei|paguei)\b.*\d/,
  /\bcomprei\b.*\b(por|de|a)\s+(r\s*)?\d/,
  /\b(lancar|lance|lanca|registrar|registre|registra|anotar|anote|anota|adicionar|adicione)\b.*\b(gasto|despesa|compra)\b.*\d/,
];
const CONTAS: RegExp[] = [
  /\bcomo (estao|esta|ta|anda|andam|vao|vai) (as |minhas |meus |o |a )*(minhas |meus )?(contas|financas|gastos|dinheiro|orcamento)\b/,
  /\b(minhas )?contas (em aberto|a pagar|abertas|do mes|deste mes|pendentes)\b/,
  /\bquais (das )?(minhas )?contas (faltam|estao em aberto|estao abertas|vencem|ainda)\b/,
  /\bquanto (ainda )?(falta|tenho que|tenho de|devo) pagar\b/,
  /\bo que (falta|ainda falta) pagar\b/,
];
const RESUMO: RegExp[] = [
  /\bquanto (eu )?(ja )?(gastei|gasto)\b/,
  /\bquanto (eu )?(ja )?(recebi|ganhei|sobrou|sobra|vai sobrar)\b/,
  /\b(resumo|balanco) (financeiro|do mes|das contas|dos gastos)\b/,
  /\bcomo estao (meus )?gastos\b/,
];
const PREP = /\bquanto (?:eu )?(?:ja )?(?:gastei|gasto|foi gasto)\s+(?:com|em|no|na|nos|nas|de|do|da|pra|para)\s+(.+)$/;
const FIM_TERMO = /\b(este|esse|neste|nesse|no|nesta|essa|esta|durante|hoje|ontem|agora|ate|desde|em|do|da|de)\b.*$/;

/** Intenção financeira da mensagem, ou null. Só o texto; nenhuma chamada de IA. */
export function detectFinanceIntent(message: string): FinanceIntent | null {
  const t = norm(message.slice(0, 400));
  if (!t) return null;
  if (GASTO_REGISTRAR.some((r) => r.test(t))) return { kind: "gasto" };
  const m = PREP.exec(t);
  if (m) {
    const trecho = m[1].replace(FIM_TERMO, "").trim() || m[1].trim();
    const palavras = trecho.split(" ").filter(Boolean).slice(0, 4);
    const candidatos = [trecho, ...palavras, ...palavras.slice(0, -1).map((p, i) => `${p} ${palavras[i + 1]}`)];
    for (const c of candidatos) { const cat = categoriaConhecida(c); if (cat) return { kind: "categoria", categoria: cat }; }
    const termo = palavras.slice(0, 2).join(" ").slice(0, 40);
    if (termo.length >= 3) return { kind: "categoria", termo };
  }
  if (CONTAS.some((r) => r.test(t))) return { kind: "contas" };
  if (RESUMO.some((r) => r.test(t))) return { kind: "resumo" };
  return null;
}
