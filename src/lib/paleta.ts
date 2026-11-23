// Paleta de comandos do computador (UX-7 · M6): Ctrl+K (ou ⌘K) abre um campo único que aceita texto ou voz.
// Lista telas, comandos do app e frases da tela atual; o que não for um item vira pergunta ao GaDu.
// Funções puras para testar a ordem e o filtro sem navegador.
import type { ViewId } from "./modules.ts";
import { parseNavIntent, VIEW_NOME } from "./nav-intent.ts";

export type PaletaItem =
  | { id: string; kind: "tela"; label: string; hint: string; view: ViewId }
  | { id: string; kind: "comando"; label: string; hint: string; cmd: PaletaCmd }
  | { id: string; kind: "frase"; label: string; hint: string; text: string }
  | { id: string; kind: "perguntar"; label: string; hint: string; text: string };
export type PaletaCmd = "nova_conversa" | "tema" | "menu" | "assistente" | "guia" | "voz";

export const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

export function paletaItens(q: string, ctx: { views: ViewId[]; frases: string[]; navMini: boolean; theme: "light" | "dark" }): PaletaItem[] {
  const n = norm(q);
  const telas: PaletaItem[] = ctx.views.map((v) => ({ id: `tela-${v}`, kind: "tela", label: VIEW_NOME[v] ?? v, hint: "Abrir tela", view: v }));
  const comandos: PaletaItem[] = [
    { id: "c-voz", kind: "comando", label: "Falar com o GaDu", hint: "Abre o microfone", cmd: "voz" },
    { id: "c-nova", kind: "comando", label: "Nova conversa", hint: "Começa do zero", cmd: "nova_conversa" },
    { id: "c-assist", kind: "comando", label: "Abrir ou fechar o assistente", hint: "Painel ao lado da tela", cmd: "assistente" },
    { id: "c-menu", kind: "comando", label: ctx.navMini ? "Expandir o menu" : "Recolher o menu", hint: ctx.navMini ? "Mostra os nomes" : "Só ícones, mais espaço", cmd: "menu" },
    { id: "c-tema", kind: "comando", label: ctx.theme === "dark" ? "Usar tema claro" : "Usar tema escuro", hint: "Aparência", cmd: "tema" },
    { id: "c-guia", kind: "comando", label: "Guia do GaDu", hint: "Ajuda e mapa", cmd: "guia" },
  ];
  const frases: PaletaItem[] = ctx.frases.map((f, i) => ({ id: `f-${i}`, kind: "frase", label: f, hint: "Diga ou envie", text: f }));
  if (!n) return [...comandos.slice(0, 2), ...frases, ...telas];
  // "abre fin" também acha Financeiro: tira o verbo de navegação e os artigos antes de filtrar.
  const m = n.replace(/^(abre|abrir|abra|vai para|vai pra|ir para|ir pra|me leva para|leva para|entra em|entra no|entra na) (a |o |as |os |minha |minhas |meu |meus )?/, "");
  const bate = (it: PaletaItem) => norm(it.label).includes(n) || norm(it.hint).includes(n) || (m !== n && it.kind === "tela" && norm(it.label).startsWith(m));
  const nav = parseNavIntent(q);
  const out: PaletaItem[] = [];
  if (nav && nav.tipo === "abrir" && ctx.views.includes(nav.view)) out.push(telas.find((t) => t.kind === "tela" && t.view === nav.view)!);
  const comeca = (it: PaletaItem) => (norm(it.label).startsWith(n) || (m !== n && norm(it.label).startsWith(m)) ? 0 : 1);
  for (const it of [...telas, ...comandos, ...frases].filter(bate).sort((a, b) => comeca(a) - comeca(b))) if (!out.includes(it)) out.push(it);
  out.push({ id: "perguntar", kind: "perguntar", label: `Perguntar ao GaDu: “${q.trim()}”`, hint: "Enter envia", text: q.trim() });
  return out.slice(0, 9);
}

/** "Recolhe o menu" / "expande o menu" (computador). */
export function parseMenuCommand(text: string): "mini" | "full" | null {
  const t = norm(text).replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  if (/^(gadu )?(recolhe|recolher|recolha|esconde|esconder|compacta|compactar|diminui|fecha|fechar) o menu( lateral)?$/.test(t)) return "mini";
  if (/^(gadu )?(expande|expandir|expanda|aumenta|abre|abrir|mostra) o menu( lateral)?( inteiro| completo)?$/.test(t)) return "full";
  return null;
}

/** Ctrl+K ou ⌘K. */
export const isPaletaKey = (e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }) =>
  (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k";
