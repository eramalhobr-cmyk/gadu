// "Tudo por voz": ações que a conversa pode PROPOR para qualquer módulo (bloco de controle "acoes").
// O modelo nunca grava: o servidor valida aqui, resolve os nomes para ids SÓ entre os itens da própria pessoa
// e manda cartões; quem grava é a pessoa, com um toque ou dizendo "sim". Puro: sem banco nem rede.
import { lerData, hojeSP, isoDia, ordinal } from "./finance/datas.ts";
import { parseNumero } from "./goals/numero.ts";
import { CATEGORIAS, MEDICOES, type Categoria, type Medicao } from "./goals/types.ts";

export type Ajuste = { opcao: "texto"; valor: "100" | "115" | "130" } | { opcao: "maos_livres" | "respostas_curtas" | "voz"; valor: boolean } | { opcao: "tema"; valor: "dark" | "light" };

export type AcaoProposta =
  | { tipo: "meta_criar"; titulo: string; medicao: Medicao; unidade: string | null; alvo: number | null; inicial: number; prazo: string | null; categoria: Categoria; marcos: string[] }
  | { tipo: "meta_registrar"; meta: string; valor: number; data: string | null }
  | { tipo: "meta_concluir"; meta: string }
  | { tipo: "meta_marco"; meta: string; titulo: string; data: string | null }
  | { tipo: "meta_marco_concluir"; meta: string; marco: string }
  | { tipo: "meta_tarefa"; meta: string; tarefa: string; prazo: string | null }
  | { tipo: "tarefa_concluir"; tarefa: string }
  | { tipo: "tarefa_adiar"; tarefa: string; prazo: string }
  | { tipo: "lembrete_cancelar"; lembrete: string }
  | { tipo: "conta_paga"; conta: string }
  | { tipo: "projeto_criar"; nome: string; objetivo: string | null }
  | { tipo: "ajuste"; ajuste: Ajuste };

export const TIPOS = ["meta_criar", "meta_registrar", "meta_concluir", "meta_marco", "meta_marco_concluir", "meta_tarefa", "tarefa_concluir", "tarefa_adiar", "lembrete_cancelar", "conta_paga", "projeto_criar", "ajuste"] as const;

const txt = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

/** Data AAAA-MM-DD de hoje até `dias` à frente (ou para trás, se negativo). */
function dataFutura(v: unknown, now: number, dias = 730): string | null {
  if (typeof v !== "string") return null;
  const d = lerData(v);
  if (!d) return null;
  const hoje = ordinal(hojeSP(now));
  const o = ordinal(d);
  return o >= hoje && o <= hoje + dias ? isoDia(d) : null;
}
function dataPassada(v: unknown, now: number): string | null {
  if (typeof v !== "string") return null;
  const d = lerData(v);
  if (!d) return null;
  const hoje = ordinal(hojeSP(now));
  const o = ordinal(d);
  return o <= hoje && o >= hoje - 366 ? isoDia(d) : null;
}

function validAjuste(o: Record<string, unknown>): Ajuste | null {
  const v = o.valor;
  const bool = v === true || v === "true" || v === "ligar" || v === "ligado" ? true : v === false || v === "false" || v === "desligar" || v === "desligado" ? false : null;
  switch (o.opcao) {
    case "texto": {
      const s = String(v);
      const t = s === "115" || s === "grande" ? "115" : s === "130" || s === "maior" ? "130" : s === "100" || s === "normal" ? "100" : null;
      return t ? { opcao: "texto", valor: t } : null;
    }
    case "maos_livres": case "respostas_curtas": case "voz":
      return bool === null ? null : { opcao: o.opcao, valor: bool };
    case "tema":
      return v === "dark" || v === "escuro" ? { opcao: "tema", valor: "dark" } : v === "light" || v === "claro" ? { opcao: "tema", valor: "light" } : null;
    default:
      return null;
  }
}

/** Valida uma ação do bloco de controle. Qualquer campo fora do esperado invalida a ação (nada é adivinhado). */
export function validAcao(raw: unknown, now = Date.now()): AcaoProposta | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  switch (o.tipo) {
    case "meta_criar": {
      const titulo = txt(o.titulo, 120);
      if (!titulo) return null;
      const medicao = (MEDICOES as readonly string[]).includes(String(o.medicao)) ? (o.medicao as Medicao) : "numerica";
      const categoria = (CATEGORIAS as readonly string[]).includes(String(o.categoria)) && o.categoria !== "personalizada" ? (o.categoria as Categoria) : "desenvolvimento";
      const alvo = parseNumero(o.alvo);
      const inicial = parseNumero(o.inicial) ?? 0;
      const marcos = (Array.isArray(o.marcos) ? o.marcos : []).map((m) => txt(m, 120)).filter(Boolean).slice(0, 20);
      if (medicao === "numerica" && (alvo === null || alvo === inicial)) return null;
      if (medicao === "marcos" && marcos.length === 0) return null;
      return {
        tipo: "meta_criar", titulo, medicao, categoria, marcos: medicao === "marcos" ? marcos : [],
        unidade: medicao === "numerica" ? txt(o.unidade, 20) || null : null,
        alvo: medicao === "numerica" ? alvo : medicao === "percentual" ? 100 : null,
        inicial: medicao === "numerica" ? inicial : 0,
        prazo: dataFutura(o.prazo, now, 3650),
      };
    }
    case "meta_registrar": {
      const meta = txt(o.meta, 120);
      const valor = parseNumero(o.valor);
      if (!meta || valor === null || valor <= 0) return null;
      return { tipo: "meta_registrar", meta, valor, data: dataPassada(o.data, now) };
    }
    case "meta_concluir": {
      const meta = txt(o.meta, 120);
      return meta ? { tipo: "meta_concluir", meta } : null;
    }
    case "meta_marco": {
      const meta = txt(o.meta, 120), titulo = txt(o.titulo, 120);
      return meta && titulo ? { tipo: "meta_marco", meta, titulo, data: dataFutura(o.data, now, 3650) } : null;
    }
    case "meta_marco_concluir": {
      const meta = txt(o.meta, 120), marco = txt(o.marco, 120);
      return meta && marco ? { tipo: "meta_marco_concluir", meta, marco } : null;
    }
    case "meta_tarefa": {
      const meta = txt(o.meta, 120), tarefa = txt(o.tarefa, 200);
      return meta && tarefa ? { tipo: "meta_tarefa", meta, tarefa, prazo: dataFutura(o.prazo, now) } : null;
    }
    case "tarefa_concluir": {
      const tarefa = txt(o.tarefa, 200);
      return tarefa ? { tipo: "tarefa_concluir", tarefa } : null;
    }
    case "tarefa_adiar": {
      const tarefa = txt(o.tarefa, 200), prazo = dataFutura(o.prazo, now);
      return tarefa && prazo ? { tipo: "tarefa_adiar", tarefa, prazo } : null;
    }
    case "lembrete_cancelar": {
      const lembrete = txt(o.lembrete, 300);
      return lembrete ? { tipo: "lembrete_cancelar", lembrete } : null;
    }
    case "conta_paga": {
      const conta = txt(o.conta, 80);
      return conta ? { tipo: "conta_paga", conta } : null;
    }
    case "projeto_criar": {
      const nome = txt(o.nome, 80);
      return nome ? { tipo: "projeto_criar", nome, objetivo: txt(o.objetivo, 400) || null } : null;
    }
    case "ajuste": {
      const ajuste = validAjuste(o);
      return ajuste ? { tipo: "ajuste", ajuste } : null;
    }
    default:
      return null;
  }
}

/** Lista do bloco de controle: válidas, sem repetição, no máximo 5. */
export function parseAcoes(list: unknown, now = Date.now()): AcaoProposta[] {
  const out: AcaoProposta[] = [];
  const seen = new Set<string>();
  for (const raw of Array.isArray(list) ? list : []) {
    const a = validAcao(raw, now);
    if (!a) continue;
    const k = JSON.stringify(a);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
    if (out.length >= 5) break;
  }
  return out;
}

export function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}
const STOP = new Set(["a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "em", "no", "na", "nos", "nas", "um", "uma", "para", "pra", "meta", "minha", "meu", "conta", "tarefa", "lembrete"]);
const tokens = (s: string) => norm(s).split(" ").filter((w) => w && !STOP.has(w));

/** Mesma palavra ou mesma raiz ("corrida" e "correr", "livro" e "livros"): prefixo comum de 4+ letras e 60% da menor. */
function similar(a: string, b: string): boolean {
  if (a === b) return true;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i >= 4 && i >= 0.6 * Math.min(a.length, b.length);
}

/** Acha UM item pelo nome dito (só entre os itens da própria pessoa). Ambíguo ou sem correspondência: null (o app avisa). */
export function matchByName<T>(items: T[], name: (t: T) => string, query: string): T | null {
  const q = norm(query);
  if (!q) return null;
  const exact = items.filter((i) => norm(name(i)) === q);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;
  const contains = items.filter((i) => { const n = norm(name(i)); return n.includes(q) || (q.includes(n) && n.length >= 3); });
  if (contains.length === 1) return contains[0];
  const qt = tokens(query);
  if (!qt.length) return null;
  const scored = items
    .map((i) => { const nt = tokens(name(i)); const hit = qt.filter((w) => nt.some((n) => similar(n, w))).length; return { i, s: hit / Math.max(qt.length, 1) }; })
    .filter((x) => x.s >= 0.5)
    .sort((a, b) => b.s - a.s);
  if (!scored.length) return null;
  if (scored.length > 1 && scored[1].s === scored[0].s) return null;
  return scored[0].i;
}

/** Instruções do bloco "acoes" (parte estável do prompt). */
export function acoesRules(): string {
  return `- "acoes": para fazer pela conversa tudo o que dá para fazer tocando no app. Você NÃO grava: o app mostra um cartão e a pessoa confirma com um toque ou dizendo "sim". Use os nomes como a pessoa disse ou como aparecem no contexto; o app acha o item. Tipos:
  {"tipo":"meta_criar","titulo":"Correr 50 km","medicao":"numerica","unidade":"km","alvo":50,"inicial":0,"prazo":"AAAA-MM-DD","categoria":"saude"} (medicao: numerica com alvo, percentual, marcos com "marcos":["..."], ou tarefas; categoria: financeira, familiar, profissional, saude, desenvolvimento ou educacao; sem alvo numa meta numérica, pergunte);
  {"tipo":"meta_registrar","meta":"nome da meta","valor":5,"data":"AAAA-MM-DD"} (data só se não for hoje); {"tipo":"meta_concluir","meta":"..."};
  {"tipo":"meta_marco","meta":"...","titulo":"...","data":"AAAA-MM-DD"}; {"tipo":"meta_marco_concluir","meta":"...","marco":"..."}; {"tipo":"meta_tarefa","meta":"...","tarefa":"...","prazo":"AAAA-MM-DD"};
  {"tipo":"tarefa_concluir","tarefa":"..."}; {"tipo":"tarefa_adiar","tarefa":"...","prazo":"AAAA-MM-DD"}; {"tipo":"lembrete_cancelar","lembrete":"..."};
  {"tipo":"conta_paga","conta":"luz"} ("paguei a luz", "a internet já foi paga": marca a conta do mês como paga);
  {"tipo":"projeto_criar","nome":"...","objetivo":"..."};
  {"tipo":"ajuste","opcao":"texto","valor":"100|115|130"} (letra normal, grande, maior), {"tipo":"ajuste","opcao":"maos_livres|respostas_curtas|voz","valor":true|false}, {"tipo":"ajuste","opcao":"tema","valor":"dark|light"}.
  Diga em uma frase o que preparou ("Preparei, é só confirmar"). Não diga que não consegue fazer algo que está nesta lista. No máximo 5 itens; quase sempre a lista fica vazia.`;
}
