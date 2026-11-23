// Navegação por intenção (UX-7 · G2): "abre finanças", "vai para as metas", "volta". Entendido no aparelho, sem modelo
// e sem custo. Só frases curtas e claras; qualquer outra coisa ("abre a conversa sobre a viagem") segue para o GaDu.
import type { ViewId } from "./modules.ts";
import { destinoDe, DESTINO_NOME } from "./acoes.ts";

export type NavIntent = { tipo: "abrir"; view: ViewId; painel?: boolean } | { tipo: "voltar" };

/** Telas com painel de resumo (id="painel"): "mostra meu resumo de finanças" abre a tela e rola até ele. */
export const COM_PAINEL: ViewId[] = ["hoje", "financeiro", "metas", "tarefas", "agentes"];

const EXTRA: Record<string, ViewId> = {
  "3d": "studio3d", estudio3d: "studio3d", studio3d: "studio3d", impressao3d: "studio3d",
  memorias: "memoria", lembrancas: "memoria", tarefa: "tarefas", meta: "metas", projeto: "projetos", agente: "agentes",
  financeira: "financeiro", gastos: "financeiro", contas: "financeiro", perfil: "perfil", integracoes: "integracoes",
  ajuste: "ajustes", preferencias: "ajustes", telainicial: "hoje", inicial: "hoje", menu: "modulos", modulos: "modulos",
};
export const VIEW_NOME: Partial<Record<ViewId, string>> = { ...DESTINO_NOME, studio3d: "3D Studio", perfil: "Perfil", integracoes: "Integrações" };

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const VERBO = "(?:abre|abrir|abra|abri|vai para|vai pra|va para|va pra|vamos para|vamos pra|ir para|ir pra|me leva para|me leva pra|leva para|leva pra|volta para|volta pra|voltar para|voltar pra|entra em|entra no|entra na|entra nas|entra nos)";
const ABRIR = new RegExp(`^(?:gadu )?(?:por favor )?(?:pode )?${VERBO} (?:a |o |as |os |tela (?:de |do |da |das |dos )?|minha |minhas |meu |meus |aba (?:de |do |da )?)*(.{1,30}?)(?: por favor)?$`);
const VOLTAR = /^(?:gadu )?(?:por favor )?(?:volta|voltar|volte|retorna)(?: (?:para|pra) (?:a )?tela anterior| a tela anterior| para tras| pra tras)?(?: por favor)?$|^(?:tela anterior)$/;

const RESUMO = /^(?:gadu )?(?:por favor )?(?:(?:me )?(?:mostra|mostrar|mostre|abre|abrir|ver|quero ver|cade|exibe)(?: o| a)? )?(?:meu |o meu |minha )?(?:resumo|painel|dashboard|panorama)(?: geral)? (?:de |do |da |das |dos |das minhas |dos meus |das minhas )?(?:minhas |meus )?(.{1,30}?)(?: por favor)?$/;
const RESUMO_DIA = /^(?:gadu )?(?:(?:me )?(?:mostra|mostre|ver|quero ver) )?(?:o )?(?:meu )?(?:resumo|painel) do dia$/;

function viewDe(dest: string): ViewId | null {
  const k = dest.replace(/\s+/g, "");
  return destinoDe(k) ?? EXTRA[k] ?? null;
}

export function parseNavIntent(text: string): NavIntent | null {
  const t = norm(text);
  if (!t || t.length > 60) return null;
  if (VOLTAR.test(t)) return { tipo: "voltar" };
  if (RESUMO_DIA.test(t)) return { tipo: "abrir", view: "hoje", painel: true };
  const r = RESUMO.exec(t);
  if (r) {
    const v = r[1] === "hoje" || r[1] === "dia" ? "hoje" : viewDe(r[1]);
    if (v) return COM_PAINEL.includes(v) ? { tipo: "abrir", view: v, painel: true } : { tipo: "abrir", view: v };
  }
  const m = ABRIR.exec(t);
  if (!m) return null;
  const view = viewDe(m[1]);
  return view ? { tipo: "abrir", view } : null;
}

/** Pilha simples das telas visitadas para o "volta" (sem repetir a mesma tela seguida; no máximo 20). */
export function pushTab(stack: ViewId[], prev: ViewId, next: ViewId): ViewId[] {
  if (prev === next) return stack;
  const s = stack[stack.length - 1] === prev ? stack : [...stack, prev];
  return s.slice(-20);
}

export function navSpoken(intent: NavIntent, view: ViewId | null): string {
  if (!view) return "Não há tela anterior.";
  const nome = VIEW_NOME[view] ?? "a tela";
  if (intent.tipo === "voltar") return `Voltando para ${nome}.`;
  return intent.painel ? `Mostrando o resumo de ${nome}.` : `Abrindo ${nome}.`;
}
