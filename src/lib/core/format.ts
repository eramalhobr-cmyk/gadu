// Bloco de contexto para o modelo e lista de fontes para a interface.
import { ATENCAO_HOJE } from "./plan.ts";
import type { AttentionFact, CoreResult } from "./types.ts";

const HEADER = "Core do GaDu · O que merece atenção hoje (dados reais da própria pessoa, lidos agora, só leitura):";
const RULES = [
  "Como responder:",
  "- Use SÓ os itens acima. Não invente tarefas, compromissos, lembretes ou e-mails.",
  "- Cite a etiqueta entre colchetes ao mencionar um item, por exemplo [T1], [L1], [A1], [E1].",
  "- Diga explicitamente o que está indisponível (por exemplo: \"Sua agenda não está conectada\") e não fale de agenda ou e-mail se estiverem indisponíveis.",
  "- Se não houver nenhum item e nada indisponível, diga que não há pendências para hoje, sem inventar nada.",
  "- Comece pelo que é mais urgente (atrasadas, depois o que é de hoje). Seja curto.",
];

/** Bloco completo. `max` limita o tamanho total (padrão: o do plano); itens que não cabem entram em "e mais N". */
export function formatCoreBlock(r: CoreResult): string {
  const lines = r.facts.map((f) => `[${f.tag}] ${f.text}`);
  const parts: string[] = [HEADER];
  parts.push(lines.length ? lines.join("\n") : "(nenhum item pendente encontrado nas fontes disponíveis)");
  if (r.more > 0) parts.push(`e mais ${r.more} ${r.more === 1 ? "item não listado" : "itens não listados"} (menos urgentes).`);
  if (r.unavailable.length) parts.push("Fontes indisponíveis:\n" + r.unavailable.map((u) => `- ${u.text}`).join("\n"));
  parts.push(RULES.join("\n"));
  return "\n\n" + parts.join("\n");
}

/** Maior prefixo de fatos (já em ordem de prioridade) que cabe nos limites. Devolve quantos cabem. */
export function fitFacts(base: Omit<CoreResult, "more">, maxFacts: number, maxChars: number): number {
  let n = Math.min(base.facts.length, maxFacts);
  // Reserva "e mais N" (pior caso) no cálculo.
  while (n > 0 && formatCoreBlock({ ...base, facts: base.facts.slice(0, n), more: base.facts.length - n || 1 }).length > maxChars) n--;
  return n;
}

export type SourceItem = { tag: string; kind: AttentionFact["kind"]; label: string; text: string; view: AttentionFact["view"]; href?: string; omitted: boolean };

/** Item para a interface: texto curto da origem, sem o prefixo do tipo. */
export function toItem(f: AttentionFact): SourceItem {
  const text = f.text.includes(": ") ? f.text.slice(f.text.indexOf(": ") + 2) : f.text;
  return { tag: f.tag, kind: f.kind, label: f.label, text, view: f.view, ...(f.href ? { href: f.href } : {}), omitted: f.omitted };
}

/** Item da tela Hoje (UX-2): com a referência da linha quando dá para agir no próprio item (Feito/Adiar).
 * Só tarefas e lembretes da própria pessoa; a ação grava pelo cliente com a sessão dela (RLS). */
export type ActionItem = SourceItem & { ref?: { table: "tasks" | "reminders"; id: number } };
export function toActionItem(f: AttentionFact): ActionItem {
  const item: ActionItem = toItem(f);
  const { table, id } = f.source;
  const n = typeof id === "number" ? id : /^\d+$/.test(String(id)) ? Number(id) : NaN;
  if ((table === "tasks" || table === "reminders") && Number.isSafeInteger(n)) item.ref = { table, id: n };
  return item;
}

export const DEFAULT_LIMITS = { maxFacts: ATENCAO_HOJE.maxFacts, maxChars: ATENCAO_HOJE.maxChars };

/** "2 tarefas, 1 lembrete, 1 compromisso" para o resumo de "Fontes". */
export function summarizeSources(items: Pick<SourceItem, "kind">[]): string {
  const groups: [string, string, (k: SourceItem["kind"]) => boolean][] = [
    ["tarefa", "tarefas", (k) => k === "atrasada" || k === "tarefa_hoje" || k === "prioridade"],
    ["lembrete", "lembretes", (k) => k === "lembrete"],
    ["compromisso", "compromissos", (k) => k === "evento"],
    ["e-mail", "e-mails", (k) => k === "email"],
    ["dado financeiro", "dados financeiros", (k) => k === "financa"],
    ["meta", "metas", (k) => k === "meta"],
  ];
  return groups
    .map(([one, many, is]) => { const n = items.filter((i) => is(i.kind)).length; return n ? `${n} ${n === 1 ? one : many}` : ""; })
    .filter(Boolean)
    .join(", ");
}
