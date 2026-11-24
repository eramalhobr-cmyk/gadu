// "Tudo por voz": ações que a conversa pode PROPOR para qualquer módulo (bloco de controle "acoes").
// O modelo nunca grava: o servidor valida aqui, resolve os nomes para ids SÓ entre os itens da própria pessoa
// e manda cartões; quem grava é a pessoa, com um toque ou dizendo "sim". Puro: sem banco nem rede.
import { nomeItem } from "./lista-compras/types.ts";
import type { ViewId } from "./modules.ts";
import { FERRAMENTAS, TETO_MAX_USD, type Ferramenta } from "./agentes/ferramentas.ts";
import { PEDIDO_MAX } from "./3d/limits.ts";
import { lerData, hojeSP, isoDia, ordinal } from "./finance/datas.ts";
import { parseNumero } from "./goals/numero.ts";
import { normalizarCategoria, normalizarMeio } from "./finance/lancamento.ts";
import { parseValor } from "./finance/money.ts";
import { MAX_DEPENDENTES, calcularSalario } from "./finance/salario.ts";
import type { Meio } from "./finance/types.ts";
import { CATEGORIAS, MEDICOES, type Categoria, type Medicao } from "./goals/types.ts";
import { MAX_BLOCOS, MAX_SEMANAS, type Periodo } from "./goals/agenda.ts";

const periodoDe = (v: unknown): Periodo | null => { const k = norm(String(v ?? "")); return k === "manha" || k === "manhas" ? "manha" : k === "tarde" || k === "tardes" ? "tarde" : k === "noite" || k === "noites" ? "noite" : null; };

export type Ajuste = { opcao: "texto"; valor: "100" | "115" | "130" } | { opcao: "maos_livres" | "respostas_curtas" | "voz"; valor: boolean } | { opcao: "tema"; valor: "dark" | "light" }
  | { opcao: "velocidade"; valor: number | "mais_devagar" | "mais_rapido" }
  | { opcao: "voz_trocar"; valor: "proxima" };

export type AcaoProposta =
  | { tipo: "lista_compra_adicionar" | "lista_compra_marcar" | "lista_compra_reabrir" | "lista_compra_remover"; nome: string }
  | { tipo: "meta_criar"; titulo: string; medicao: Medicao; unidade: string | null; alvo: number | null; inicial: number; prazo: string | null; categoria: Categoria; marcos: string[] }
  | { tipo: "meta_registrar"; meta: string; valor: number; data: string | null }
  | { tipo: "meta_registro_apagar"; meta: string; valor: number | null; data: string | null }
  | { tipo: "meta_concluir"; meta: string }
  | { tipo: "meta_pausar" | "meta_retomar" | "meta_arquivar"; meta: string }
  | { tipo: "meta_editar"; meta: string; titulo: string | null; alvo: number | null; prazo: string | null }
  | { tipo: "projeto_editar"; projeto: string; nome: string | null; objetivo: string | null }
  | { tipo: "projeto_arquivar"; projeto: string }
  | { tipo: "agente_criar"; nome: string; area: string | null; instrucoes: string | null }
  // liberar/bloquear = ferramentas que entram/saem; teto em US$ por mês (0 = sem teto próprio). Só aparecem quando a pessoa pediu.
  | { tipo: "agente_editar"; agente: string; nome: string | null; area: string | null; instrucoes: string | null; ativo: boolean | null; liberar?: Ferramenta[]; bloquear?: Ferramenta[]; teto?: number }
  | { tipo: "meta_marco"; meta: string; titulo: string; data: string | null }
  | { tipo: "meta_marco_concluir"; meta: string; marco: string }
  | { tipo: "meta_tarefa"; meta: string; tarefa: string; prazo: string | null }
  /** Liga (ou desliga) uma meta a um projeto da própria pessoa. */
  | { tipo: "meta_projeto"; meta: string; projeto: string; desligar: boolean }
  /** Reserva blocos de tempo na agenda para a meta. O SERVIDOR escolhe dias e horários (o modelo só diz quantas vezes, em que período e por quanto tempo). */
  | { tipo: "meta_agenda"; meta: string; vezes: number; periodo: Periodo; duracaoMin: number; semanas: number }
  | { tipo: "tarefa_concluir"; tarefa: string }
  | { tipo: "tarefa_adiar"; tarefa: string; prazo: string }
  | { tipo: "tarefa_cancelar"; tarefa: string }
  | { tipo: "tarefa_reabrir"; tarefa: string }
  | { tipo: "tarefa_editar"; tarefa: string; titulo: string | null; prioridade: 1 | 2 | 3 | null; prazo: string | null; projeto: string | null }
  | { tipo: "lembrete_cancelar"; lembrete: string }
  | { tipo: "lembrete_adiar"; lembrete: string; quando: string }
  | { tipo: "conta_paga"; conta: string }
  | { tipo: "conta_desmarcar"; conta: string }
  | { tipo: "conta_valor"; conta: string; valor: number; escopo: "mes" | "proximos" }
  | { tipo: "gasto_apagar"; gasto: string; valor: number | null; data: string | null }
  | { tipo: "gasto_editar"; gasto: string; de_valor: number | null; de_data: string | null; valor: number | null; categoria: string | null; descricao: string | null; meio: Meio | null; data: string | null }
  | { tipo: "evento_editar"; evento: string; titulo: string | null; inicio: string | null; fim: string | null; local: string | null }
  | { tipo: "evento_apagar"; evento: string }
  | { tipo: "memoria_aprovar"; memoria: string | null; todas: boolean }
  | { tipo: "memoria_recusar"; memoria: string }
  | { tipo: "memoria_esquecer"; memoria: string }
  | { tipo: "conta_criar"; contaTipo: "despesa" | "receita"; nome: string; valor: number | null; dia: number | null; grupo: string | null; todoMes: boolean }
  | { tipo: "receita_principal"; receita: string }
  | { tipo: "peca3d_abrir"; busca: string | null }
  | { tipo: "peca3d_ajustar"; busca: string | null; pedido: string }
  | { tipo: "teto_definir"; categoria: string; valor: number | null }
  /** Aceitar ou ignorar uma percepção de hoje (atrasos, conflito, e-mail parado, janela livre, dia cheio). */
  | { tipo: "percepcao"; percepcao: "conflito" | "livre" | "atrasadas" | "email" | "cheio"; decisao: "aceitar" | "ignorar" }
  | { tipo: "nova_conversa" }
  | { tipo: "conversa_abrir"; busca: string }
  | { tipo: "guia" }
  | { tipo: "navegar"; destino: Destino }
  | { tipo: "projeto_criar"; nome: string; objetivo: string | null }
  | { tipo: "salario_simular"; bruto: number; dependentes: number; salvar: boolean; outrasDeducoes?: number; beneficios?: number }
  | { tipo: "ajuste"; ajuste: Ajuste };

/** Telas que a conversa abre (instantâneo, sem gravar nada). Admin e telas em desenvolvimento ficam de fora. */
export const DESTINOS = ["hoje", "conversa", "tarefas", "agenda", "financeiro", "metas", "projetos", "memoria", "agentes", "ajustes", "modulos", "lista_compras"] as const satisfies readonly ViewId[];
export type Destino = (typeof DESTINOS)[number];
export const DESTINO_NOME: Record<Destino, string> = { hoje: "Hoje", conversa: "Conversa", tarefas: "Tarefas", agenda: "Agenda", financeiro: "Financeiro", metas: "Metas", projetos: "Projetos", memoria: "Memória", agentes: "Agentes", ajustes: "Configurações", modulos: "Mais", lista_compras: "Lista de compras" };
const DESTINO_APELIDO: Record<string, Destino> = { inicio: "hoje", chat: "conversa", calendario: "agenda", financas: "financeiro", dinheiro: "financeiro", configuracoes: "ajustes", configuracao: "ajustes", mais: "modulos", listadecompras: "lista_compras", listacompras: "lista_compras", listademercado: "lista_compras" };
export function destinoDe(v: unknown): Destino | null {
  if (typeof v !== "string") return null;
  const k = v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
  return (DESTINOS as readonly string[]).includes(k) ? (k as Destino) : DESTINO_APELIDO[k] ?? null;
}

export const TIPOS = ["lista_compra_adicionar", "lista_compra_marcar", "lista_compra_reabrir", "lista_compra_remover", "meta_criar", "meta_registrar", "meta_registro_apagar", "meta_concluir", "meta_pausar", "meta_retomar", "meta_arquivar", "meta_editar", "projeto_editar", "projeto_arquivar", "meta_marco", "meta_marco_concluir", "meta_tarefa", "meta_projeto", "meta_agenda", "tarefa_concluir", "tarefa_adiar", "tarefa_cancelar", "tarefa_reabrir", "tarefa_editar", "lembrete_cancelar", "lembrete_adiar", "conta_paga", "conta_desmarcar", "conta_valor", "gasto_apagar", "gasto_editar", "evento_editar", "evento_apagar", "memoria_aprovar", "memoria_recusar", "memoria_esquecer", "conta_criar", "receita_principal", "teto_definir", "percepcao", "peca3d_abrir", "peca3d_ajustar", "nova_conversa", "conversa_abrir", "guia", "navegar", "projeto_criar", "agente_criar", "agente_editar", "salario_simular", "ajuste"] as const;

/** Instruções de agente: mantém as quebras de linha (até 2 seguidas), tira espaços sobrando. */
const instr = (v: unknown): string | null => (typeof v === "string" ? v.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 4000) : null);
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

/** Momento futuro (ISO 8601; sem fuso = Brasília), de 20 s a 1 ano à frente. */
function quandoFuturo(v: unknown, now: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  const d = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(t) ? t : `${t}-03:00`);
  if (!t || Number.isNaN(d.getTime())) return null;
  return d.getTime() >= now + 20_000 && d.getTime() <= now + 366 * 86_400_000 ? d.toISOString() : null;
}

const valorOuNulo = (v: unknown): number | null => { const n = parseValor(v); return n !== null && n > 0 ? n : null; };

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
    case "velocidade": {
      // Número (0,7 a 1,6, como em Configurações) ou relativo ("mais devagar", "mais rápido"); "normal" = 1.
      if (typeof v === "number") return Number.isFinite(v) && v >= 0.7 && v <= 1.6 ? { opcao: "velocidade", valor: Math.round(v * 20) / 20 } : null;
      const s = norm(String(v ?? "")).replace(/\s+/g, "_");
      if (s === "normal") return { opcao: "velocidade", valor: 1 };
      if (s === "mais_devagar" || s === "devagar" || s === "lento" || s === "mais_lento") return { opcao: "velocidade", valor: "mais_devagar" };
      if (s === "mais_rapido" || s === "rapido" || s === "mais_depressa") return { opcao: "velocidade", valor: "mais_rapido" };
      return null;
    }
    case "voz_trocar":
      return v === undefined || v === "proxima" || v === "outra" ? { opcao: "voz_trocar", valor: "proxima" } : null;
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
    case "lista_compra_adicionar": case "lista_compra_marcar": case "lista_compra_reabrir": case "lista_compra_remover": {
      const nome = nomeItem(o.nome);
      return nome ? { tipo: o.tipo, nome } : null;
    }
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
    case "meta_registro_apagar": {
      // Corrigir um engano: sem valor nem data, apaga o registro mais recente da meta.
      const meta = txt(o.meta, 120);
      const temValor = !(o.valor === undefined || o.valor === null || o.valor === "");
      const valor = temValor ? parseNumero(o.valor) : null;
      if (!meta || (temValor && (valor === null || valor <= 0))) return null;
      return { tipo: "meta_registro_apagar", meta, valor, data: dataPassada(o.data, now) };
    }
    case "meta_concluir": {
      const meta = txt(o.meta, 120);
      return meta ? { tipo: "meta_concluir", meta } : null;
    }
    case "meta_pausar": case "meta_retomar": case "meta_arquivar": {
      const meta = txt(o.meta, 120);
      return meta ? { tipo: o.tipo, meta } : null;
    }
    case "meta_editar": {
      const meta = txt(o.meta, 120), titulo = txt(o.titulo, 120) || null;
      const alvo = parseNumero(o.alvo), prazo = dataFutura(o.prazo, now, 3650);
      return meta && (titulo || alvo !== null || prazo) ? { tipo: "meta_editar", meta, titulo, alvo, prazo } : null;
    }
    case "projeto_editar": {
      const projeto = txt(o.projeto, 80), nome = txt(o.nome, 80) || null, objetivo = typeof o.objetivo === "string" ? txt(o.objetivo, 400) : null;
      return projeto && (nome || objetivo !== null) ? { tipo: "projeto_editar", projeto, nome, objetivo } : null;
    }
    case "projeto_arquivar": {
      const projeto = txt(o.projeto, 80);
      return projeto ? { tipo: "projeto_arquivar", projeto } : null;
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
    case "meta_projeto": {
      const meta = txt(o.meta, 120), projeto = txt(o.projeto, 120);
      return meta && projeto ? { tipo: "meta_projeto", meta, projeto, desligar: o.desligar === true || o.desligar === "true" } : null;
    }
    case "meta_agenda": {
      const meta = txt(o.meta, 120), vezes = Number(o.vezes), periodo = periodoDe(o.periodo);
      if (!meta || !Number.isInteger(vezes) || vezes < 1 || vezes > 7 || !periodo) return null;
      const dur = o.duracao === undefined || o.duracao === null ? 60 : Number(o.duracao);
      const sem = o.semanas === undefined || o.semanas === null ? 4 : Number(o.semanas);
      if (!Number.isInteger(dur) || dur < 15 || dur > 240 || !Number.isInteger(sem) || sem < 1 || sem > MAX_SEMANAS) return null;
      return { tipo: "meta_agenda", meta, vezes, periodo, duracaoMin: dur, semanas: Math.min(sem, Math.floor(MAX_BLOCOS / vezes)) };
    }
    case "tarefa_concluir": {
      const tarefa = txt(o.tarefa, 200);
      return tarefa ? { tipo: "tarefa_concluir", tarefa } : null;
    }
    case "tarefa_adiar": {
      const tarefa = txt(o.tarefa, 200), prazo = dataFutura(o.prazo, now);
      return tarefa && prazo ? { tipo: "tarefa_adiar", tarefa, prazo } : null;
    }
    case "tarefa_cancelar": case "tarefa_reabrir": {
      const tarefa = txt(o.tarefa, 200);
      return tarefa ? { tipo: o.tipo, tarefa } : null;
    }
    case "tarefa_editar": {
      const tarefa = txt(o.tarefa, 200);
      const titulo = txt(o.titulo, 200) || null;
      const p = Number(o.prioridade);
      const prioridade = p === 1 || p === 2 || p === 3 ? p : null;
      const prazo = dataFutura(o.prazo, now);
      const projeto = txt(o.projeto, 80) || null;
      // Sem nenhuma mudança válida não há o que propor.
      return tarefa && (titulo || prioridade || prazo || projeto) ? { tipo: "tarefa_editar", tarefa, titulo, prioridade, prazo, projeto } : null;
    }
    case "lembrete_adiar": {
      const lembrete = txt(o.lembrete, 300), quando = quandoFuturo(o.quando, now);
      return lembrete && quando ? { tipo: "lembrete_adiar", lembrete, quando } : null;
    }
    case "lembrete_cancelar": {
      const lembrete = txt(o.lembrete, 300);
      return lembrete ? { tipo: "lembrete_cancelar", lembrete } : null;
    }
    case "conta_paga": {
      const conta = txt(o.conta, 80);
      return conta ? { tipo: "conta_paga", conta } : null;
    }
    case "conta_desmarcar": {
      const conta = txt(o.conta, 80);
      return conta ? { tipo: "conta_desmarcar", conta } : null;
    }
    case "conta_valor": {
      const conta = txt(o.conta, 80), valor = parseValor(o.valor);
      return conta && valor !== null && valor > 0 ? { tipo: "conta_valor", conta, valor, escopo: o.escopo === "proximos" ? "proximos" : "mes" } : null;
    }
    case "gasto_apagar": {
      const gasto = txt(o.gasto, 120), valor = valorOuNulo(o.valor), data = dataPassada(o.data, now);
      return gasto || valor !== null || data ? { tipo: "gasto_apagar", gasto, valor, data } : null;
    }
    case "gasto_editar": {
      const gasto = txt(o.gasto, 120), de_valor = valorOuNulo(o.de_valor), de_data = dataPassada(o.de_data, now);
      const valor = valorOuNulo(o.valor), data = dataPassada(o.data, now);
      const categoria = txt(o.categoria, 40) ? normalizarCategoria(o.categoria) : null;
      const descricao = typeof o.descricao === "string" ? txt(o.descricao, 120) : null;
      const meio = txt(o.meio, 40) ? normalizarMeio(o.meio) : null;
      if (!(gasto || de_valor !== null || de_data)) return null;
      if (valor === null && !categoria && descricao === null && !meio && !data) return null;
      return { tipo: "gasto_editar", gasto, de_valor, de_data, valor, categoria, descricao, meio, data };
    }
    case "evento_editar": {
      const evento = txt(o.evento, 160), titulo = txt(o.titulo, 160) || null, local = txt(o.local, 160) || null;
      const inicio = quandoFuturo(o.inicio, now), fim = quandoFuturo(o.fim, now);
      return evento && (titulo || inicio || fim || local) ? { tipo: "evento_editar", evento, titulo, inicio, fim, local } : null;
    }
    case "evento_apagar": {
      const evento = txt(o.evento, 160);
      return evento ? { tipo: "evento_apagar", evento } : null;
    }
    case "memoria_aprovar": {
      const memoria = txt(o.memoria, 300) || null, todas = o.todas === true || o.todas === "true";
      return memoria || todas ? { tipo: "memoria_aprovar", memoria: todas ? null : memoria, todas } : null;
    }
    case "memoria_recusar": case "memoria_esquecer": {
      const memoria = txt(o.memoria, 300);
      return memoria ? { tipo: o.tipo, memoria } : null;
    }
    case "conta_criar": {
      // Conta fixa (despesa) ou receita do Financeiro; o valor do mês é opcional ("todo mês" vale até dezembro).
      const contaTipo = o.contaTipo === "receita" || o.conta_tipo === "receita" ? "receita" : "despesa";
      const nome = txt(o.nome, 80), grupo = txt(o.grupo, 40) || null;
      const temValor = !(o.valor === undefined || o.valor === null || o.valor === "");
      const valor = temValor ? parseValor(o.valor) : null;
      const dia = o.dia === undefined || o.dia === null || o.dia === "" ? null : Number(o.dia);
      if (!nome || (temValor && (valor === null || valor <= 0)) || (dia !== null && (!Number.isInteger(dia) || dia < 1 || dia > 31))) return null;
      return { tipo: "conta_criar", contaTipo, nome, valor, dia, grupo, todoMes: o.todoMes === true || o.todo_mes === true || o.todoMes === "true" };
    }
    case "receita_principal": {
      const receita = txt(o.receita, 80);
      return receita ? { tipo: "receita_principal", receita } : null;
    }
    case "peca3d_abrir": {
      // Sem busca (ou "última") = a peça mais recente do 3D Studio.
      const busca = txt(o.busca, 80);
      return { tipo: "peca3d_abrir", busca: busca && !/^(a\s+)?[uú]ltima( pe[cç]a)?$/i.test(busca) ? busca : null };
    }
    case "peca3d_ajustar": {
      // "deixa o suporte 2 mm mais alto": a mudança vai para o 3D Studio, que pede à IA (mesma reserva e cota do 3D).
      const busca = txt(o.busca, 80), pedido = txt(o.pedido, PEDIDO_MAX);
      return pedido.length >= 3 ? { tipo: "peca3d_ajustar", busca: busca && !/^(a\s+)?[uú]ltima( pe[cç]a)?$/i.test(busca) ? busca : null, pedido } : null;
    }
    case "percepcao": {
      const k = norm(String(o.percepcao ?? ""));
      const percepcao = (["conflito", "livre", "atrasadas", "email", "cheio"] as const).find((x) => x === k) ?? (k === "atrasada" || k === "atraso" || k === "atrasos" ? "atrasadas" : k === "e-mail" || k === "emails" ? "email" : null);
      const d = norm(String(o.decisao ?? ""));
      const decisao = d === "aceitar" || d === "aceita" ? "aceitar" : d === "ignorar" || d === "ignora" ? "ignorar" : null;
      return percepcao && decisao ? { tipo: "percepcao", percepcao, decisao } : null;
    }
    case "teto_definir": {
      // valor null (ou "tirar") = remove o teto da categoria.
      const categoria = txt(o.categoria, 40);
      const tira = o.valor === null || o.valor === undefined || o.valor === "" || o.remover === true;
      const valor = tira ? null : parseValor(o.valor);
      if (!categoria || (!tira && (valor === null || valor <= 0 || valor >= 1e9))) return null;
      return { tipo: "teto_definir", categoria, valor };
    }
    case "nova_conversa":
      return { tipo: "nova_conversa" };
    case "conversa_abrir": {
      const busca = txt(o.busca, 120);
      return busca.length >= 2 ? { tipo: "conversa_abrir", busca } : null;
    }
    case "guia":
      return { tipo: "guia" };
    case "navegar": {
      const destino = destinoDe(o.destino);
      return destino ? { tipo: "navegar", destino } : null;
    }
    case "agente_criar": {
      const nome = txt(o.nome, 60);
      return nome ? { tipo: "agente_criar", nome, area: txt(o.area, 40) || null, instrucoes: instr(o.instrucoes) || null } : null;
    }
    case "agente_editar": {
      const agente = txt(o.agente, 60), nome = txt(o.nome, 60) || null, area = txt(o.area, 40) || null, instrucoes = instr(o.instrucoes);
      const ativo = o.ativo === true || o.ativo === "true" ? true : o.ativo === false || o.ativo === "false" ? false : null;
      const lista = (v: unknown) => (Array.isArray(v) ? FERRAMENTAS.filter((f) => v.includes(f)) : []);
      const liberar = lista(o.liberar), bloquear = lista(o.bloquear).filter((f) => !liberar.includes(f));
      const t = o.teto === null || o.teto === undefined || o.teto === "" ? null : typeof o.teto === "number" ? o.teto : parseValor(String(o.teto));
      const teto = t !== null && Number.isFinite(t) && t >= 0 && t <= TETO_MAX_USD ? Math.round(t * 100) / 100 : null;
      const extra = { ...(liberar.length ? { liberar } : {}), ...(bloquear.length ? { bloquear } : {}), ...(teto !== null ? { teto } : {}) };
      return agente && (nome || area || instrucoes !== null || ativo !== null || Object.keys(extra).length) ? { tipo: "agente_editar", agente, nome, area, instrucoes, ativo, ...extra } : null;
    }
    case "projeto_criar": {
      const nome = txt(o.nome, 80);
      return nome ? { tipo: "projeto_criar", nome, objetivo: txt(o.objetivo, 400) || null } : null;
    }
    case "salario_simular": {
      // Só o pedido: o cálculo é feito no servidor (calcularSalario). Sem valor válido ou com dependentes fora do limite, não há o que propor.
      const bruto = parseValor(o.bruto);
      const dep = o.dependentes === undefined || o.dependentes === null || o.dependentes === "" ? 0 : Number(o.dependentes);
      if (bruto === null || !Number.isInteger(dep) || dep < 0 || dep > MAX_DEPENDENTES) return null;
      // Outras deduções (pensão, previdência privada) e benefícios (VR, VA): só entram se a pessoa disse e o valor é válido; na dúvida, ficam de fora.
      const outras = valorOuNulo(o.outrasDeducoes), ben = valorOuNulo(o.beneficios);
      const extras = { ...(outras !== null && calcularSalario(bruto, dep, { outrasDeducoes: outras }) ? { outrasDeducoes: outras } : {}), ...(ben !== null && calcularSalario(bruto, dep, { beneficios: ben }) ? { beneficios: ben } : {}) };
      return { tipo: "salario_simular", bruto, dependentes: dep, salvar: o.salvar === true || o.salvar === "true", ...extras };
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
  {"tipo":"lista_compra_adicionar","nome":"leite"} para incluir na lista de compras. Use uma ação por item. Para marcar como comprado, devolver aos pendentes ou tirar da lista, use "lista_compra_marcar", "lista_compra_reabrir" ou "lista_compra_remover" com o nome. Só use quando a pessoa pedir uma mudança na lista de compras; nunca confunda com compra online, gasto ou tarefa. Para mostrar a lista, use {"tipo":"navegar","destino":"lista_compras"}.
  {"tipo":"meta_criar","titulo":"Correr 50 km","medicao":"numerica","unidade":"km","alvo":50,"inicial":0,"prazo":"AAAA-MM-DD","categoria":"saude"} (medicao: numerica com alvo, percentual, marcos com "marcos":["..."], ou tarefas; categoria: financeira, familiar, profissional, saude, desenvolvimento ou educacao; sem alvo numa meta numérica, pergunte);
  {"tipo":"meta_registrar","meta":"nome da meta","valor":5,"data":"AAAA-MM-DD"} (data só se não for hoje); {"tipo":"meta_concluir","meta":"..."}; {"tipo":"meta_registro_apagar","meta":"...","valor":5,"data":"AAAA-MM-DD"} ("apaga o último registro da meta de corrida", "aquele registro de 5 km de ontem foi engano": valor e data são opcionais; sem eles, o mais recente);
  {"tipo":"meta_pausar","meta":"..."}; {"tipo":"meta_retomar","meta":"..."}; {"tipo":"meta_arquivar","meta":"..."} (some das listas, nada é apagado);
  {"tipo":"meta_editar","meta":"nome atual","titulo":"novo título","alvo":60,"prazo":"AAAA-MM-DD"} (só o que muda; alvo só em meta numérica);
  {"tipo":"projeto_editar","projeto":"nome atual","nome":"novo nome","objetivo":"..."} (só o que muda); {"tipo":"projeto_arquivar","projeto":"..."} (marca o projeto como concluído; some dos ativos);
  {"tipo":"meta_marco","meta":"...","titulo":"...","data":"AAAA-MM-DD"}; {"tipo":"meta_marco_concluir","meta":"...","marco":"..."}; {"tipo":"meta_tarefa","meta":"...","tarefa":"...","prazo":"AAAA-MM-DD"};
  {"tipo":"meta_projeto","meta":"...","projeto":"...","desligar":false} ("liga a meta de corrida ao projeto Saúde"; "desligar":true para tirar o vínculo; a meta e o projeto precisam existir);
  {"tipo":"meta_agenda","meta":"...","vezes":3,"periodo":"manha|tarde|noite","duracao":60,"semanas":4} ("reserva 3 manhãs por semana para a meta de corrida": vezes por semana de 1 a 7, periodo obrigatório, duracao em minutos (15 a 240, padrão 60) e semanas (1 a 6, padrão 4) são opcionais; você NÃO escolhe dias nem horários: o SERVIDOR escolhe, pula o que já está ocupado na agenda do Google e mostra no cartão; sem vezes ou sem período, pergunte);
  {"tipo":"tarefa_concluir","tarefa":"..."}; {"tipo":"tarefa_adiar","tarefa":"...","prazo":"AAAA-MM-DD"}; {"tipo":"lembrete_cancelar","lembrete":"..."};
  {"tipo":"tarefa_cancelar","tarefa":"..."} ("cancela/apaga a tarefa…"); {"tipo":"tarefa_reabrir","tarefa":"..."} (tarefa já feita ou cancelada que volta a ficar aberta);
  {"tipo":"tarefa_editar","tarefa":"nome atual","titulo":"novo título","prioridade":1,"prazo":"AAAA-MM-DD","projeto":"nome do projeto"} (só os campos que mudam; prioridade 1 alta, 2 normal, 3 baixa);
  {"tipo":"lembrete_adiar","lembrete":"...","quando":"AAAA-MM-DDTHH:MM:00-03:00"} ("me lembra daqui a 1 hora", "adia para amanhã às 9": calcule o novo horário a partir de agora, no horário de Brasília);
  {"tipo":"conta_paga","conta":"luz"} ("paguei a luz", "a internet já foi paga": marca a conta do mês como paga);
  {"tipo":"conta_desmarcar","conta":"luz"} ("a luz ainda não foi paga": volta a conta do mês para em aberto); {"tipo":"conta_valor","conta":"luz","valor":210.5,"escopo":"mes|proximos"} ("a luz veio 210,50 este mês"; "proximos" = deste mês até dezembro);
  {"tipo":"gasto_apagar","gasto":"mercado","valor":50,"data":"AAAA-MM-DD"} (apaga um gasto já lançado: nome ou categoria, e o valor ou a data se ajudarem a achar); {"tipo":"gasto_editar","gasto":"mercado","de_valor":50,"de_data":"AAAA-MM-DD","valor":55,"categoria":"Mercado","descricao":"...","meio":"pix","data":"AAAA-MM-DD"} (de_* só para achar o gasto; valor, categoria, descricao, meio e data são o que muda);
  {"tipo":"evento_editar","evento":"título atual","titulo":"novo título","inicio":"AAAA-MM-DDTHH:MM:00-03:00","fim":"AAAA-MM-DDTHH:MM:00-03:00","local":"..."} (só o que muda; sem "fim", a duração é mantida); {"tipo":"evento_apagar","evento":"título"} (eventos da agenda do Google);
  {"tipo":"memoria_aprovar","memoria":"palavras da memória pendente"} ou {"tipo":"memoria_aprovar","todas":true}; {"tipo":"memoria_recusar","memoria":"..."} (descarta uma memória pendente); {"tipo":"memoria_esquecer","memoria":"palavras do fato"} ("esquece que eu…": apaga uma memória aprovada; use as palavras da lista de memória);
  {"tipo":"percepcao","percepcao":"conflito|livre|atrasadas|email|cheio","decisao":"aceitar|ignorar"} ("pode passar as atrasadas para hoje", "ignora o aviso do e-mail", "reserva o foco na janela livre": só as percepções listadas em "Percepções de hoje"; "cheio" só dá para ignorar);
  {"tipo":"conta_criar","contaTipo":"despesa|receita","nome":"Água","valor":90,"dia":10,"grupo":"Moradia","todoMes":true} ("cria uma conta de água de 90 reais todo dia 10", "adiciona minha receita de aluguel de 1500": valor, dia e grupo são opcionais; todoMes = o valor vale deste mês até dezembro); {"tipo":"receita_principal","receita":"nome da receita"} ("meu salário principal é o da empresa": define a receita principal do Financeiro, que o simulador de salário usa para salvar); {"tipo":"peca3d_ajustar","busca":"nome da peça ou vazio","pedido":"a mudança, como a pessoa disse"} ("deixa o suporte 2 mm mais alto", "arredonda as bordas da minha última peça": muda uma peça salva do 3D; a pessoa confirma e o 3D Studio faz o ajuste); {"tipo":"peca3d_abrir","busca":"nome da peça ou vazio"} ("abre a minha última peça", "abre o suporte de celular no 3D": abre uma peça salva do 3D Studio, com confirmação; sem busca = a mais recente); {"tipo":"teto_definir","categoria":"Restaurantes","valor":800} ("põe um teto de 800 para restaurante", "meu limite de mercado é 1500 por mês"; "tira o teto de lazer" = valor null): teto mensal de gasto por categoria do dia a dia, com aviso a 80% e 100%; {"tipo":"nova_conversa"} ("começa uma conversa nova"); {"tipo":"conversa_abrir","busca":"assunto ou título"} ("abre a conversa sobre o condomínio", "volta naquela conversa da viagem": abre uma conversa anterior da pessoa, com confirmação); {"tipo":"guia"} ("me mostra o guia de novo", "como o GaDu funciona?": abre o guia de primeiro uso na hora, sem confirmação; não grava nada); {"tipo":"navegar","destino":"hoje|conversa|tarefas|agenda|financeiro|metas|projetos|memoria|agentes|ajustes|mais"} ("abre o Financeiro", "vai para Metas", "mostra minhas tarefas": abre a tela na hora, sem confirmação; use só quando a pessoa pedir para ir ou abrir uma tela);
  {"tipo":"projeto_criar","nome":"...","objetivo":"..."}; {"tipo":"agente_criar","nome":"Mentor de estudos","area":"Estudos","instrucoes":"como o agente deve pensar e falar"} ("cria um agente para me ajudar com as finanças da casa": nome até 60 letras; area opcional entre Pessoal, Preferências, Saúde, Finanças, Estudos, Família, Projetos, Trabalho; escreva instruções curtas e claras na voz da pessoa); {"tipo":"agente_editar","agente":"nome atual","nome":"novo nome","area":"...","instrucoes":"texto novo que SUBSTITUI o anterior","ativo":true|false,"liberar":["email"],"bloquear":["financas"],"teto":5} ("muda as instruções do agente Mentor para ser mais direto", "desativa o agente de estudos", "tira o acesso do Mentor às finanças", "limita o agente de estudos a 5 dólares por mês": só o que muda; ferramentas entre ${FERRAMENTAS.join(", ")} — "acoes" = propor ações; teto em US$ por mês até ${TETO_MAX_USD}, 0 = sem teto próprio);
  {"tipo":"salario_simular","bruto":8000,"dependentes":0,"salvar":false,"outrasDeducoes":500,"beneficios":800} ("quanto fica líquido um salário de 8 mil?", "e com 2 dependentes?"; "outrasDeducoes" e "beneficios" são opcionais e só entram se a pessoa disser ("descontando 500 de previdência", "com 800 de benefícios"); na dúvida, omita: o SERVIDOR calcula INSS e imposto de renda e mostra o cartão com o passo a passo; você NUNCA calcula nem escreve valores de INSS, imposto ou líquido: diga só que o cartão tem o cálculo, ou repita os números do bloco "Cálculo do salário" se ele estiver no contexto. "salvar":true só quando a pessoa pedir para guardar o líquido como o salário deste mês: vira um cartão de confirmação);
  {"tipo":"ajuste","opcao":"texto","valor":"100|115|130"} (letra normal, grande, maior), {"tipo":"ajuste","opcao":"maos_livres|respostas_curtas|voz","valor":true|false}, {"tipo":"ajuste","opcao":"tema","valor":"dark|light"} ("muda para o tema escuro", "volta para o tema claro"; o claro é o padrão), {"tipo":"ajuste","opcao":"velocidade","valor":0.7 a 1.6|"normal"|"mais_devagar"|"mais_rapido"} ("fala mais devagar", "fala mais rápido", "volta a velocidade normal"), {"tipo":"ajuste","opcao":"voz_trocar","valor":"proxima"} ("troca a voz", "usa outra voz": passa para a próxima voz em português do aparelho).
  Diga em uma frase o que preparou ("Preparei, é só confirmar"). Não diga que não consegue fazer algo que está nesta lista. No máximo 5 itens; quase sempre a lista fica vazia.`;
}
