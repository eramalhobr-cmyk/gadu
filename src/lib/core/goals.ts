// Core · fonte `goals`: responde "como estão minhas metas", "minha meta de leitura" e prepara as PROPOSTAS de atualização
// ("corri 5 km hoje") com os dados reais da pessoa, SEM chamada de IA extra. Mesmas regras do resto do Core:
//  - escopo só do user_id da sessão; leitura com o cliente da sessão (RLS), nunca a chave secreta;
//  - termos bloqueados e dado sensível não entram com conteúdo ("(omitido pela regra de privacidade)") e a meta não pode ser atualizada pela conversa;
//  - cada fato tem etiqueta [M1]… citável, a data do último registro e a tela de origem (Metas);
//  - nada é inventado: sem registro, "sem registros".
import { hojeSP, isoDia } from "../finance/datas.ts";
import { dataBR, metasAtencao, progressoTexto, ritmoTexto } from "../goals/calc.ts";
import { loadMetas } from "../goals/load.ts";
import { CATEGORIA_LABEL, type MetaView } from "../goals/types.ts";
import { personalUserId, resolveScopes } from "./scopes.ts";
import { hidden } from "./privacy.ts";
import type { GoalsIntent } from "./plan.ts";
import { OMITTED, type AttentionFact, type SessionDb } from "./types.ts";

/** Meta que a pessoa pode atualizar pela conversa (resolvida no servidor pela etiqueta; o modelo nunca informa ids). */
export type GoalRef = { tag: string; id: string; titulo: string; medicao: MetaView["goal"]["medicao"]; unidade: string | null; agregacao: MetaView["goal"]["agregacao"] };
export type GoalsResult = { facts: AttentionFact[]; unavailable: string[]; refs: GoalRef[] };

export const GOALS_MAX_FACTS = 14;
export const GOALS_MAX_CHARS = 4500;

const sem = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export async function collectGoals(input: { userId: string; db: SessionDb; blocked: string[]; intent: GoalsIntent; now?: Date }): Promise<GoalsResult> {
  const userId = personalUserId(resolveScopes({ userId: input.userId }));
  const hojeIso = isoDia(hojeSP((input.now ?? new Date()).getTime()));
  const todas = await loadMetas(input.db, userId, hojeIso); // erro de leitura lança: o chamador trata como indisponível
  const { blocked, intent } = input;

  type F = Omit<AttentionFact, "tag"> & { ref?: Omit<GoalRef, "tag"> };
  const fact = (label: string, body: string, id: string, omitted = false, ref?: F["ref"]): F => ({
    module: "metas", scope: "pessoal", source: { table: "goals", id }, kind: "meta", label, view: "metas", omitted, rank: 0, text: `${label}: ${body}`, ref,
  });

  const ativas = todas.filter((m) => m.goal.status === "ativa");
  const n = (s: MetaView["ritmo"]["situacao"]) => ativas.filter((m) => m.ritmo.situacao === s).length;
  const resumo = fact("Resumo das metas", `${ativas.length} ativa${ativas.length === 1 ? "" : "s"} (${n("atrasada")} atrasada${n("atrasada") === 1 ? "" : "s"}, ${n("vencida")} com prazo vencido, ${n("batida")} atingida${n("batida") === 1 ? "" : "s"} e ainda não concluída${n("batida") === 1 ? "" : "s"}); `
    + `${todas.filter((m) => m.goal.status === "pausada").length} pausada(s); ${todas.filter((m) => m.goal.status === "concluida").length} concluída(s).`, "resumo");

  const linha = (m: MetaView, completo: boolean): F => {
    const g = m.goal, p = m.progresso;
    const oculto = hidden(g.titulo, blocked);
    const titulo = oculto ? OMITTED : g.titulo.slice(0, 120);
    const cat = g.categoria === "personalizada" && g.categoria_nome && !hidden(g.categoria_nome, blocked) ? g.categoria_nome : CATEGORIA_LABEL[g.categoria];
    const partes = [
      `${progressoTexto(m)}${!p.semDados && g.medicao !== "percentual" ? ` (${p.pct}%)` : ""}`,
      ritmoTexto(m),
      g.prazo ? `prazo ${dataBR(g.prazo)}/${g.prazo.slice(0, 4)}` : "sem prazo",
      p.ultimoRegistro ? `último registro em ${dataBR(p.ultimoRegistro)}` : g.medicao === "numerica" || g.medicao === "percentual" ? "nenhum registro ainda" : "",
    ];
    if (completo || intent.kind === "atualizar") {
      partes.push(g.medicao === "numerica" ? (g.agregacao === "soma" ? "registro de progresso: valor SOMADO aos anteriores" : "registro de progresso: ÚLTIMA medida vale")
        : g.medicao === "percentual" ? "registro de progresso: percentual atual (0 a 100)" : "não recebe valor (é medida por marcos ou tarefas)");
      partes.push(`situação: ${g.status}`);
    }
    return fact(oculto ? "Meta" : `Meta (${cat})`, `${titulo}: ${partes.filter(Boolean).join("; ")}.`, g.id, oculto,
      oculto ? undefined : { id: g.id, titulo: g.titulo, medicao: g.medicao, unidade: g.unidade, agregacao: g.agregacao });
  };

  const out: F[] = [];
  if (!todas.length) {
    out.push(fact("Sem metas", `a pessoa ainda não criou nenhuma meta. Diga isso e sugira criar na tela Metas.`, "vazio"));
  } else if (intent.kind === "meta") {
    const alvo = sem(intent.termo ?? "");
    const achadas = todas.filter((m) => !hidden(m.goal.titulo, blocked) && sem(m.goal.titulo).includes(alvo)).slice(0, 3);
    if (!achadas.length) {
      out.push(fact("Meta não encontrada", `nenhuma meta com "${hidden(intent.termo ?? "", blocked) ? OMITTED : intent.termo}" no nome. Metas ativas: ${ativas.filter((m) => !hidden(m.goal.titulo, blocked)).slice(0, 8).map((m) => m.goal.titulo.slice(0, 60)).join("; ") || "nenhuma"}.`, "busca"));
    }
    for (const m of achadas) out.push(linha(m, true));
    out.push(resumo);
  } else {
    // resumo e atualizar: atenção primeiro, depois as demais ativas; pausadas e concluídas só no resumo.
    const atencao = metasAtencao(ativas, 7, 5);
    const resto = ativas.filter((m) => !atencao.includes(m));
    out.push(resumo, ...[...atencao, ...resto].map((m) => linha(m, false)));
    if (intent.kind === "resumo") for (const m of todas.filter((x) => x.goal.status === "pausada").slice(0, 3)) out.push(linha(m, false));
  }

  let refs: GoalRef[] = [];
  let facts: AttentionFact[] = [];
  const build = (list: F[]) => {
    refs = [];
    facts = list.slice(0, GOALS_MAX_FACTS).map((f, i) => {
      const tag = `M${i + 1}`;
      if (f.ref) refs.push({ ...f.ref, tag });
      const { ref: _ref, ...rest } = f; void _ref;
      return { ...rest, tag };
    });
  };
  build(out);
  while (facts.length > 1 && formatGoalsBlock({ facts, unavailable: [], refs }).length > GOALS_MAX_CHARS) build(out.slice(0, facts.length - 1));
  return { facts, unavailable: [], refs };
}

const HEADER = "Core do GaDu · Metas (dados reais da própria pessoa, lidos agora, só leitura):";
const RULES = [
  "Como responder:",
  "- Use SÓ os itens acima. Não invente metas, valores, registros nem progresso. Sem registro, diga que não há registros.",
  "- Cite a etiqueta entre colchetes ao mencionar uma meta, por exemplo [M1], e a data do último registro quando falar de progresso.",
  "- O que for ritmo necessário até o prazo é projeção, não medição: deixe isso claro.",
  "- Se algo estiver omitido por privacidade, diga que está omitido e não tente adivinhar.",
  "- Tom de apoio, sem culpa. Metas de saúde não viram conselho médico. Responda curto, com os números.",
];

export function formatGoalsBlock(r: GoalsResult): string {
  const lines = r.facts.map((f) => `[${f.tag}] ${f.text}`);
  return "\n\n" + [HEADER, lines.join("\n"), RULES.join("\n")].join("\n");
}

/** Instruções para o modelo propor a atualização de uma meta (só com a intenção de atualizar). Não grava nada. */
export function goalsProposalRules(todayIso: string): string {
  return "\n\nAtualização de meta: a pessoa informou um progresso ou quer concluir uma meta. Você NÃO grava: escolha UMA meta da lista acima pela etiqueta e coloque no bloco de controle "
    + `"metas":[{"meta":"M1","acao":"registrar","valor":5,"data":"AAAA-MM-DD"}] (ou {"meta":"M1","acao":"concluir"}) e diga em uma frase "Preparei a atualização, confira e toque em Confirmar". `
    + "\"valor\" é o que a pessoa disse agora, como número (5 km corridos hoje = 5), SALVO nas metas em que a última medida vale (peso, percentual), onde é a medida atual. "
    + `"data" só se a pessoa disser outro dia (hoje é ${todayIso}); sem data, omita. `
    + "Só metas ativas medidas por número ou percentual recebem \"registrar\"; metas por marcos ou tarefas só aceitam \"concluir\". "
    + "Se nenhuma meta combinar com o que foi dito, ou faltar o valor, pergunte e deixe a lista vazia. Nunca invente valor. No máximo um item.";
}
