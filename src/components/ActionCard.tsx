"use client";
import { LISTA_COMPRAS_ATUALIZADA } from "@/lib/lista-compras/types";
import { AGENDA_FILHOS_ATUALIZADA } from "@/lib/filhos/carregar";
import { MSG, RETRY_LABEL } from "@/lib/errors";
import { describe, type ChatAction } from "@/lib/chat-actions";
import type { ViewId } from "@/lib/modules";
import { supabaseBrowser } from "@/lib/supabase/client";
import { applyTextSize } from "@/lib/text-size";
import { CardFrame } from "./ConfirmCard";
import { Icon } from "./ui";
import { AJUSTE_3D_KEY, CRIAR_3D_KEY } from "@/lib/3d/ajuste-voz";

export type Result = { ok: boolean; msg?: string; link?: string; /** Id do que foi criado (gasto, evento), para o Desfazer. */ id?: string; /** Como voltar atrás, quando dá: usado pelo aviso "Feito · Desfazer" (UX-4). */ undo?: () => Promise<Result> };
export type State = "proposed" | "saving" | "created" | "discarded" | "error";

async function json(r: Response): Promise<Record<string, unknown>> {
  return r.json().catch(() => ({}));
}

/** Executa a ação, com a sessão da pessoa. Nada é gravado antes desta chamada (exceto o lembrete, que já existe).
 * Quando dá para voltar atrás, o resultado traz `undo` (aviso "Feito · Desfazer"). */
export async function runAction(a: ChatAction): Promise<Result> {
  const prep = await capture(a);
  const r = await execute(a);
  if (r.ok && prep) { const undo = prep(r); if (undo) r.undo = undo; }
  return r;
}

type Prep = (r: Result) => (() => Promise<Result>) | undefined;
const back = async (p: PromiseLike<{ error: unknown }>, fail = MSG.undo): Promise<Result> => { const { error } = await p; return error ? { ok: false, msg: fail } : { ok: true }; };
const backApi = async (p: Promise<Response>): Promise<Result> => { try { const r = await p; return r.ok ? { ok: true } : { ok: false, msg: MSG.undo }; } catch { return { ok: false, msg: MSG.offlineDo }; } };
const listaApi = "/api/lista-compras";
const atualizaLista = () => window.dispatchEvent(new Event(LISTA_COMPRAS_ATUALIZADA));
const desfazLista = async (p: Promise<Response>) => {
  const r = await backApi(p);
  if (r.ok) atualizaLista();
  return r;
};
const filhosApi = "/api/agenda-filhos/ajustes";
const atualizaFilhos = () => window.dispatchEvent(new Event(AGENDA_FILHOS_ATUALIZADA));
const postFilhos = (tipo: "troca" | "recorrencia", data: string, comigo: boolean) => fetch(filhosApi, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tipo, data, comigo }) });
const desfazFilhos = async (p: Promise<Response>) => {
  const r = await backApi(p);
  if (r.ok) atualizaFilhos();
  return r;
};
/** Termos bloqueados (Configurações): mesma gravação da tela, em profiles.settings.blocked, pela sessão (RLS). */
async function salvarTermo(termo: string, bloquear: boolean): Promise<{ error: unknown }> {
  const db = supabaseBrowser();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return { error: "auth" };
  const { data } = await db.from("profiles").select("settings").eq("id", auth.user.id).maybeSingle();
  const settings = (data?.settings as { blocked?: unknown } | null) ?? {};
  const atual = Array.isArray(settings.blocked) ? settings.blocked.map(String) : [];
  const chave = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const blocked = bloquear ? [...new Set([...atual, termo])] : atual.filter((x) => chave(x) !== chave(termo));
  const { error } = await db.from("profiles").update({ settings: { ...settings, blocked } }).eq("id", auth.user.id);
  return { error };
}
const put = (path: string, body: unknown) => fetch(path, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const patch = (path: string, body: unknown) => fetch(path, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

/** Guarda o que a ação vai mudar, para poder desfazer. Devolve, depois da gravação, como voltar atrás.
 * Só as ações que dá para desfazer sem perder nada. Apagar (memória, gasto, evento) não tem Desfazer: o cartão já pediu o "sim". */
async function capture(a: ChatAction): Promise<Prep | null> {
  const db = supabaseBrowser();
  try {
    switch (a.kind) {
      // Agenda de filhos: o id traz {id, anterior}. Ajuste novo → apaga; ajuste que já existia → volta o valor de antes.
      case "filhos_troca": case "filhos_mudar": return (r) => {
        if (!r.id) return undefined;
        const { id, anterior } = JSON.parse(r.id) as { id: string; anterior: boolean | null };
        const tipo = a.kind === "filhos_troca" ? "troca" : "recorrencia";
        return () => desfazFilhos(anterior === null ? fetch(`${filhosApi}/${id}`, { method: "DELETE" }) : postFilhos(tipo, a.sabado, anterior));
      };
      case "filhos_troca_remover": return () => () => desfazFilhos(postFilhos("troca", a.sabado, a.comigo));
      case "filhos_mudanca_remover": return () => () => desfazFilhos(postFilhos("recorrencia", a.sabado, a.comigo));
      case "filhos_config": return () => () => desfazFilhos(a.anterior ? put("/api/agenda-filhos", a.anterior) : fetch("/api/agenda-filhos", { method: "DELETE" }));
      // Várias trocas: o id traz [{id, anterior}] de cada uma, para desfazer todas.
      case "filhos_trocas": return (r) => {
        if (!r.id) return undefined;
        const feitos = JSON.parse(r.id) as { id: string; sabado: string; anterior: boolean | null }[];
        return async () => {
          for (const f of feitos) {
            const res = await backApi(f.anterior === null ? fetch(`${filhosApi}/${f.id}`, { method: "DELETE" }) : postFilhos("troca", f.sabado, f.anterior));
            if (!res.ok) return res;
          }
          atualizaFilhos();
          return { ok: true };
        };
      };
      case "termo": return () => () => back(salvarTermo(a.termo, !a.bloquear));
      case "lista_compra_adicionar": return (r) => (r.id ? () => desfazLista(fetch(`${listaApi}/${r.id}`, { method: "DELETE" })) : undefined);
      case "lista_compra_status": return () => () => desfazLista(patch(`${listaApi}/${a.id}`, { comprado: !a.comprado }));
      case "tarefa_ok": case "tarefa_cancelar": case "tarefa_reabrir": case "tarefa_adiar": case "tarefa_editar": {
        const { data } = await db.from("tasks").select("status, done_at, due_date, title, priority, project_id").eq("id", a.id).maybeSingle();
        if (!data) return null;
        return () => () => back(db.from("tasks").update(data).eq("id", a.id));
      }
      case "lembrete_adiar": case "lembrete_off": {
        const { data } = await db.from("reminders").select("due_at, status, sent_at").eq("id", a.id).maybeSingle();
        if (!data) return null;
        return () => () => back(db.from("reminders").update(data).eq("id", a.id));
      }
      case "memoria_aprovar": return () => () => back(db.from("memories").update({ status: "pending" }).in("id", a.ids).eq("status", "approved"));
      case "projeto_arquivar": {
        const { data } = await db.from("projects").select("status").eq("id", a.id).maybeSingle();
        if (!data) return null;
        return () => () => back(db.from("projects").update({ status: data.status }).eq("id", a.id));
      }
      case "conta_paga": return () => () => backApi(put(`/api/finance/itens/${a.itemId}/mes`, { ano: a.ano, mes: a.mes, pago: false }));
      case "conta_desmarcar": return () => () => backApi(put(`/api/finance/itens/${a.itemId}/mes`, { ano: a.ano, mes: a.mes, pago: true }));
      case "salario": return a.salvar ? (() => { const s = a.salvar; return () => () => backApi(put(`/api/finance/itens/${s.itemId}/mes`, { ano: s.ano, mes: s.mes, valor: s.antes ?? 0, escopo: "mes" })); })() : null;
      case "meta_projeto": return () => () => backApi(a.desligar
        ? fetch(`/api/goals/${a.goalId}/projetos`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project_id: a.projectId }) })
        : fetch(`/api/goals/${a.goalId}/projetos/${a.projectId}`, { method: "DELETE" }));
      // Os ids dos eventos criados voltam em r.id (separados por vírgula): Desfazer libera cada bloco (Google e vínculo).
      case "meta_agenda": return (r) => (r.id ? () => backApi(Promise.all(r.id!.split(",").map((eid) => fetch(`/api/goals/${a.goalId}/agenda/${encodeURIComponent(eid)}`, { method: "DELETE" }))).then((rs) => (rs.every((x) => x.ok) ? rs[0] : new Response(null, { status: 502 })))) : undefined);
      case "marco_ok": return () => () => backApi(patch(`/api/goals/${a.goalId}/marcos/${a.marcoId}`, { concluido: false }));
      case "meta_status": {
        const r = await fetch(`/api/goals/${a.goalId}`, { cache: "no-store" });
        const j = r.ok ? await json(r) as { meta?: { goal?: { status?: string } } } : null;
        const antes = j?.meta?.goal?.status;
        if (!antes) return null;
        return () => () => backApi(patch(`/api/goals/${a.goalId}`, { status: antes }));
      }
      case "teto": {
        const r = await fetch("/api/finance/tetos", { cache: "no-store" });
        const j = r.ok ? await json(r) as { tetos?: { categoria: string; valor: number }[] } : null;
        if (!j?.tetos) return null;
        const antes = j.tetos.find((t) => t.categoria === a.categoria)?.valor ?? null;
        return () => () => backApi(antes === null
          ? fetch(`/api/finance/tetos?categoria=${encodeURIComponent(a.categoria)}`, { method: "DELETE" })
          : put("/api/finance/tetos", { categoria: a.categoria, valor: antes }));
      }
      case "conta_nova": return (r) => (r.id ? () => backApi(fetch(`/api/finance/itens/${r.id}`, { method: "DELETE" })) : undefined);
      case "receita_principal": {
        const r = await fetch("/api/finance/config", { cache: "no-store" });
        const j = r.ok ? await json(r) as { config?: { receita_principal_id?: string | null } } : null;
        if (!j?.config) return null;
        const antes = j.config.receita_principal_id ?? null;
        return () => () => backApi(put("/api/finance/config", { receita_principal_id: antes }));
      }
      case "agente_novo": return (r) => (r.id ? () => back(db.from("agents").delete().eq("id", Number(r.id))) : undefined);
      case "agente_editar": {
        const { data } = await db.from("agents").select(`name, area, instructions, active${a.mudancas.ferramentas ? ", ferramentas" : ""}${a.mudancas.teto !== undefined ? ", teto_mensal_usd" : ""}`).eq("id", a.id).maybeSingle();
        if (!data) return null;
        return () => () => back(db.from("agents").update(data).eq("id", a.id));
      }
      // O que o Aceitar fez volta do servidor (r.id, em JSON); Desfazer reverte só isso e apaga a resposta de hoje.
      case "percepcao": return (r) => () => backApi(fetch("/api/insights/desfazer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tipo: a.tipo, desfazer: r.id ? JSON.parse(r.id) : {} }) }));
      case "gasto": return (r) => (r.id ? () => backApi(fetch(`/api/finance/gastos/${r.id}`, { method: "DELETE" })) : undefined);
      case "evento": return (r) => (r.id ? () => backApi(fetch(`/api/calendar/${encodeURIComponent(r.id!)}`, { method: "DELETE" })) : undefined);
      default: return null;
    }
  } catch { return null; }
}

async function execute(a: ChatAction): Promise<Result> {
  try {
    if (a.kind === "filhos_config") {
      const r = await put("/api/agenda-filhos", { ancora: a.ancora, inicio: a.inicio, fim: a.fim, feriadoSegue: a.feriadoSegue });
      const result = await api(r, "Não consegui configurar a Agenda de filhos.");
      if (result.ok) atualizaFilhos();
      return result;
    }
    if (a.kind === "filhos_trocas") {
      const feitos: { id: string; sabado: string; anterior: boolean | null }[] = [];
      for (const t of a.itens) {
        const r = await postFilhos("troca", t.sabado, t.comigo);
        const result = await api(r, "Não consegui trocar todos os fins de semana.");
        if (!result.ok) { atualizaFilhos(); return feitos.length ? { ...result, msg: `${result.msg ?? ""} ${feitos.length} de ${a.itens.length} já foram trocados.`.trim() } : result; }
        const j = await json(r) as { ajuste?: { id?: string }; anterior?: boolean | null };
        if (j.ajuste?.id) feitos.push({ id: j.ajuste.id, sabado: t.sabado, anterior: j.anterior ?? null });
      }
      atualizaFilhos();
      return { ok: true, id: JSON.stringify(feitos) };
    }
    if (a.kind === "filhos_mudanca_remover") {
      const result = await api(await fetch(`${filhosApi}/${a.id}`, { method: "DELETE" }), "Não consegui desfazer a mudança.");
      if (result.ok) atualizaFilhos();
      return result;
    }
    if (a.kind === "agente_apagar") return saved(await supabaseBrowser().from("agents").delete().eq("id", a.id).select("id"));
    if (a.kind === "termo") {
      const { error } = await salvarTermo(a.termo, a.bloquear);
      return error ? { ok: false, msg: MSG.save } : { ok: true };
    }
    if (a.kind === "filhos_troca" || a.kind === "filhos_mudar" || a.kind === "filhos_troca_remover") {
      const r = a.kind === "filhos_troca_remover" ? await fetch(`${filhosApi}/${a.id}`, { method: "DELETE" })
        : await postFilhos(a.kind === "filhos_troca" ? "troca" : "recorrencia", a.sabado, a.comigo);
      const result = await api(r, "Não consegui atualizar a Agenda de filhos.");
      if (!result.ok) return result;
      atualizaFilhos();
      if (a.kind === "filhos_troca_remover") return result;
      const j = await json(r) as { ajuste?: { id?: string }; anterior?: boolean | null };
      return j.ajuste?.id ? { ...result, id: JSON.stringify({ id: j.ajuste.id, anterior: j.anterior ?? null }) } : result;
    }
    if (a.kind === "lista_compra_adicionar" || a.kind === "lista_compra_status" || a.kind === "lista_compra_remover") {
      const r = a.kind === "lista_compra_adicionar"
        ? await fetch(listaApi, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nome: a.nome }) })
        : a.kind === "lista_compra_status" ? await patch(`${listaApi}/${a.id}`, { comprado: a.comprado })
          : await fetch(`${listaApi}/${a.id}`, { method: "DELETE" });
      const result = await api(r, "Não consegui atualizar a lista.");
      if (!result.ok) return result;
      atualizaLista();
      if (a.kind === "lista_compra_adicionar") {
        const j = await json(r) as { item?: { id?: string } };
        return { ...result, id: j.item?.id };
      }
      return result;
    }
    if (a.kind === "gasto") {
      const [ano, mes, dia] = a.g.data.split("-").map(Number);
      const r = await fetch("/api/finance/gastos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ano, mes, dia, valor: a.g.valor, categoria: a.g.categoria, descricao: a.g.descricao, meio: a.g.meio, origem: "conversa" }) });
      if (r.status === 401) { window.location.href = "/login"; return { ok: false }; }
      if (!r.ok) return { ok: false, msg: r.status === 404 ? "Finanças está desligado no momento." : "Não consegui lançar. Tente de novo." };
      const gj = await json(r) as { gasto?: { id?: unknown } };
      return { ok: true, ...(typeof gj.gasto?.id === "string" ? { id: gj.gasto.id } : {}) };
    }
    if (a.kind === "meta") {
      const reg = a.d.acao === "registrar";
      const r = reg
        ? await fetch(`/api/goals/${a.d.goalId}/progresso`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ valor: a.d.valor, data: a.d.data, origem: "conversa" }) })
        : await fetch(`/api/goals/${a.d.goalId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "concluida" }) });
      if (r.status === 401) { window.location.href = "/login"; return { ok: false }; }
      return r.ok ? { ok: true } : { ok: false, msg: r.status === 404 ? "Não encontrei a meta (ou Metas está desligado)." : "Não consegui atualizar. Tente de novo." };
    }
    if (a.kind === "evento") {
      const r = await fetch("/api/calendar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: a.ev.title, start: a.ev.start, end: a.ev.end, ...(a.ev.location ? { location: a.ev.location } : {}), ...(a.ev.recurrence ? { recurrence: a.ev.recurrence } : {}) }) });
      const j = await json(r);
      return r.ok ? { ok: true, link: typeof j.link === "string" ? j.link : "", ...(typeof j.id === "string" ? { id: j.id } : {}) } : { ok: false, msg: (typeof j.message === "string" && j.message) || "Não consegui criar. Tente de novo." };
    }
    if (a.kind === "meta_nova") {
      const r = await fetch("/api/goals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        titulo: a.titulo, medicao: a.medicao, categoria: a.categoria, unidade: a.unidade, valor_inicial: a.inicial, valor_alvo: a.alvo, prazo: a.prazo, ...(a.medicao === "marcos" ? { marcos: a.marcos } : {}),
      }) });
      return api(r, "Não consegui criar a meta.");
    }
    if (a.kind === "meta_status") return api(await fetch(`/api/goals/${a.goalId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: a.para }) }), "Não consegui mudar a meta.");
    if (a.kind === "meta_editar") {
      const m = a.mudancas;
      const body: Record<string, unknown> = {};
      if (m.titulo) body.titulo = m.titulo;
      if (m.alvo !== undefined) body.valor_alvo = m.alvo;
      if (m.prazo) body.prazo = m.prazo;
      return api(await fetch(`/api/goals/${a.goalId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), "Não consegui mudar a meta.");
    }
    if (a.kind === "projeto_editar") {
      const m = a.mudancas;
      const patch: Record<string, unknown> = {};
      if (m.nome) patch.name = m.nome;
      if (m.objetivo !== undefined) patch.goal = m.objetivo || null;
      return saved(await supabaseBrowser().from("projects").update(patch).eq("id", a.id).select("id"));
    }
    if (a.kind === "agente_novo") {
      const r = await supabaseBrowser().from("agents").insert({ name: a.nome, area: a.area, instructions: a.instrucoes, color: "sig", icon: "spark", active: true }).select("id");
      const res = saved(r);
      const id = (r.data as { id?: unknown }[] | null)?.[0]?.id;
      return res.ok && (typeof id === "number" || typeof id === "string") ? { ...res, id: String(id) } : res;
    }
    if (a.kind === "agente_editar") {
      const m = a.mudancas;
      const patch: Record<string, unknown> = {};
      if (m.nome) patch.name = m.nome;
      if (m.area) patch.area = m.area;
      if (m.instrucoes !== undefined) patch.instructions = m.instrucoes;
      if (m.ativo !== undefined) patch.active = m.ativo;
      if (m.ferramentas) patch.ferramentas = m.ferramentas;
      if (m.teto !== undefined) patch.teto_mensal_usd = m.teto;
      return saved(await supabaseBrowser().from("agents").update(patch).eq("id", a.id).select("id"));
    }
    if (a.kind === "projeto_arquivar") return saved(await supabaseBrowser().from("projects").update({ status: "done" }).eq("id", a.id).in("status", ["active", "paused"]).select("id"));
    if (a.kind === "memoria_aprovar") return saved(await supabaseBrowser().from("memories").update({ status: "approved" }).in("id", a.ids).eq("status", "pending").select("id"));
    if (a.kind === "memoria_recusar") return saved(await supabaseBrowser().from("memories").delete().eq("id", a.id).eq("status", "pending").select("id"));
    if (a.kind === "memoria_esquecer") return saved(await supabaseBrowser().from("memories").delete().eq("id", a.id).eq("status", "approved").select("id"));
    if (a.kind === "registro_apagar") return api(await fetch(`/api/goals/${a.goalId}/progresso/${a.registroId}`, { method: "DELETE" }), "Não consegui apagar o registro.");
    // nova_conversa, conversa_abrir, peca3d_abrir e navegar são tratados pelo app (GaduApp), não gravam nada.
    // Ajuste de peça por voz: o pedido vai pela sessão do navegador (não pela URL) e o 3D Studio faz o ajuste ao abrir.
    if (a.kind === "peca3d_criar") {
      sessionStorage.setItem(CRIAR_3D_KEY, JSON.stringify({ pedido: a.pedido, t: Date.now() }));
      window.location.assign("/app/3d");
      return { ok: true };
    }
    if (a.kind === "peca3d_ajustar") {
      sessionStorage.setItem(AJUSTE_3D_KEY, JSON.stringify({ id: a.id, pedido: a.pedido, t: Date.now() }));
      window.location.assign(`/app/3d?peca=${encodeURIComponent(a.id)}`);
      return { ok: true };
    }
    if (a.kind === "marco") return api(await fetch(`/api/goals/${a.goalId}/marcos`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ titulo: a.titulo, data_alvo: a.data }) }), "Não consegui adicionar o marco.");
    if (a.kind === "marco_ok") return api(await fetch(`/api/goals/${a.goalId}/marcos/${a.marcoId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ concluido: true }) }), "Não consegui concluir o marco.");
    if (a.kind === "meta_tarefa") {
      // Cria a tarefa (como na tela de Tarefas) e vincula à meta; se o vínculo falhar, a tarefa é cancelada.
      const db = supabaseBrowser();
      const { data, error } = await db.from("tasks").insert({ title: a.titulo, due_date: a.prazo, priority: 2, origin: "Conversa" }).select("id").single();
      if (error || !data) return { ok: false, msg: "Não consegui criar a tarefa. Tente de novo." };
      const r = await fetch(`/api/goals/${a.goalId}/tarefas`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task_id: data.id }) });
      if (!r.ok) { await db.from("tasks").update({ status: "cancelled" }).eq("id", data.id); return api(r, "Não consegui ligar a tarefa à meta."); }
      return { ok: true };
    }
    if (a.kind === "percepcao") {
      const r = await fetch("/api/insights", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tipo: a.tipo, decisao: a.decisao, ...(a.ref ? { ref: a.ref } : {}) }) });
      if (r.status === 401) { window.location.href = "/login"; return { ok: false }; }
      const j = await json(r) as { desfazer?: unknown; message?: string };
      if (!r.ok) return { ok: false, msg: (typeof j.message === "string" && j.message) || "Não consegui agora. Tente de novo." };
      return { ok: true, id: JSON.stringify(j.desfazer ?? {}) };
    }
    if (a.kind === "meta_agenda") {
      const r = await fetch(`/api/goals/${a.goalId}/agenda`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ blocos: a.blocos }) });
      if (r.status === 401) { window.location.href = "/login"; return { ok: false }; }
      const j = await json(r) as { ids?: unknown; message?: string };
      if (!r.ok) return { ok: false, msg: (typeof j.message === "string" && j.message) || "Não consegui reservar na agenda. Tente de novo." };
      const ids = Array.isArray(j.ids) ? j.ids.filter((x): x is string => typeof x === "string") : [];
      return { ok: true, ...(ids.length ? { id: ids.join(",") } : {}) };
    }
    if (a.kind === "meta_projeto") return api(a.desligar
      ? await fetch(`/api/goals/${a.goalId}/projetos/${a.projectId}`, { method: "DELETE" })
      : await fetch(`/api/goals/${a.goalId}/projetos`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project_id: a.projectId }) }),
    a.desligar ? "Não consegui desligar a meta do projeto." : "Não consegui ligar a meta ao projeto.");
    if (a.kind === "tarefa_ok") return saved(await supabaseBrowser().from("tasks").update({ status: "done", done_at: new Date().toISOString() }).eq("id", a.id).eq("status", "open").select("id"));
    if (a.kind === "tarefa_adiar") return saved(await supabaseBrowser().from("tasks").update({ due_date: a.prazo }).eq("id", a.id).select("id"));
    if (a.kind === "tarefa_cancelar") return saved(await supabaseBrowser().from("tasks").update({ status: "cancelled" }).eq("id", a.id).eq("status", "open").select("id"));
    if (a.kind === "tarefa_reabrir") return saved(await supabaseBrowser().from("tasks").update({ status: "open", done_at: null }).eq("id", a.id).in("status", ["done", "cancelled"]).select("id"));
    if (a.kind === "tarefa_editar") {
      const m = a.mudancas;
      const patch: Record<string, unknown> = {};
      if (m.titulo) patch.title = m.titulo;
      if (m.prioridade) patch.priority = m.prioridade;
      if (m.prazo) patch.due_date = m.prazo;
      if (m.projetoId !== undefined) patch.project_id = m.projetoId;
      return saved(await supabaseBrowser().from("tasks").update(patch).eq("id", a.id).eq("status", "open").select("id"));
    }
    // Adiar: volta para "pendente" (se já tinha avisado) e o servidor avisa de novo no novo horário.
    if (a.kind === "lembrete_adiar") return saved(await supabaseBrowser().from("reminders").update({ due_at: a.novoDueAt, status: "pending", sent_at: null }).eq("id", a.id).in("status", ["pending", "sent"]).select("id"));
    if (a.kind === "lembrete_off") return saved(await supabaseBrowser().from("reminders").update({ status: "cancelled" }).eq("id", a.id).select("id"));
    if (a.kind === "teto") return api(a.valor === null
      ? await fetch(`/api/finance/tetos?categoria=${encodeURIComponent(a.categoria)}`, { method: "DELETE" })
      : await put("/api/finance/tetos", { categoria: a.categoria, valor: a.valor }), "Não consegui salvar o teto.");
    if (a.kind === "conta_nova") {
      const r = await fetch("/api/finance/itens", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tipo: a.contaTipo, nome: a.nome, grupo: a.grupo, ...(a.dia ? { dia: a.dia } : {}), ...(a.valor !== null ? { inicial: { ano: a.ano, mes: a.mes, valor: a.valor, escopo: a.escopo } } : {}) }) });
      if (r.status === 401) { window.location.href = "/login"; return { ok: false }; }
      if (!r.ok) return { ok: false, msg: r.status === 404 ? "Finanças está desligado no momento." : "Não consegui criar. Tente de novo." };
      const j = await json(r) as { item?: { id?: unknown } };
      return { ok: true, ...(typeof j.item?.id === "string" ? { id: j.item.id } : {}) };
    }
    if (a.kind === "receita_principal") return api(await put("/api/finance/config", { receita_principal_id: a.itemId }), "Não consegui definir a receita principal.");
    if (a.kind === "conta_paga") return api(await fetch(`/api/finance/itens/${a.itemId}/mes`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ano: a.ano, mes: a.mes, pago: true }) }), "Não consegui marcar a conta.");
    if (a.kind === "conta_desmarcar") return api(await fetch(`/api/finance/itens/${a.itemId}/mes`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ano: a.ano, mes: a.mes, pago: false }) }), "Não consegui desmarcar a conta.");
    if (a.kind === "salario" && a.salvar) return api(await fetch(`/api/finance/itens/${a.salvar.itemId}/mes`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ano: a.salvar.ano, mes: a.salvar.mes, valor: a.calc.liquido, escopo: "mes" }) }), "Não consegui salvar o salário.");
    if (a.kind === "conta_valor") return api(await fetch(`/api/finance/itens/${a.itemId}/mes`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ano: a.ano, mes: a.mes, valor: a.valor, escopo: a.escopo }) }), "Não consegui mudar o valor.");
    if (a.kind === "gasto_apagar") return api(await fetch(`/api/finance/gastos/${a.id}`, { method: "DELETE" }), "Não consegui apagar o gasto.");
    if (a.kind === "gasto_editar") {
      const m = a.mudancas;
      const body: Record<string, unknown> = {};
      if (m.valor !== undefined) body.valor = m.valor;
      if (m.categoria) body.categoria = m.categoria;
      if (m.descricao !== undefined) body.descricao = m.descricao;
      if (m.meio) body.meio = m.meio;
      if (m.data) { const [ano, mes, dia] = m.data.split("-").map(Number); Object.assign(body, { ano, mes, dia }); }
      return api(await fetch(`/api/finance/gastos/${a.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), "Não consegui mudar o gasto.");
    }
    if (a.kind === "evento_editar") return api(await fetch(`/api/calendar/${encodeURIComponent(a.eventId)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(a.mudancas) }), "Não consegui mudar o evento.");
    if (a.kind === "evento_apagar") return api(await fetch(`/api/calendar/${encodeURIComponent(a.eventId)}`, { method: "DELETE" }), "Não consegui apagar o evento.");
    if (a.kind === "projeto") return saved(await supabaseBrowser().from("projects").insert({ name: a.nome, goal: a.objetivo, color: "sig", status: "active" }).select("id"));
    if (a.kind === "ajuste") {
      // Configurações deste aparelho: o texto é aplicado aqui; voz, conversa contínua e tema, pelo app (evento).
      if (a.ajuste.opcao === "texto") applyTextSize(a.ajuste.valor);
      else window.dispatchEvent(new CustomEvent("gadu:ajuste", { detail: a.ajuste }));
      return { ok: true };
    }
    return { ok: true };
  } catch {
    return { ok: false, msg: MSG.offlineDo };
  }
}

/** Resposta de uma rota do app: 401 vai para o login; 404 costuma ser módulo desligado ou item que não existe mais. */
async function api(r: Response, fail: string): Promise<Result> {
  if (r.status === 401) { window.location.href = "/login"; return { ok: false }; }
  if (r.ok) return { ok: true };
  const j = await json(r);
  return { ok: false, msg: (typeof j.message === "string" && j.message) || (r.status === 404 ? "Não encontrei o item (ou o módulo está desligado)." : `${fail} Tente de novo.`) };
}
/** Resultado de uma gravação direta pela sessão (RLS): erro ou nenhuma linha alterada = falhou. */
function saved(r: { error: unknown; data: unknown[] | null }): Result {
  return !r.error && (r.data?.length ?? 0) > 0 ? { ok: true } : { ok: false, msg: MSG.save };
}

/** Desfaz o que o servidor já criou (lembrete e tarefa anotada). */
export async function undoAction(a: ChatAction): Promise<Result> {
  if (a.kind === "lembrete") {
    const { error } = await supabaseBrowser().from("reminders").delete().eq("id", a.id);
    return error ? { ok: false, msg: "Não consegui apagar. Tente de novo." } : { ok: true };
  }
  if (a.kind === "tarefa_criada") {
    const { error } = await supabaseBrowser().from("tasks").update({ status: "cancelled" }).eq("id", a.id);
    return error ? { ok: false, msg: MSG.undo } : { ok: true };
  }
  return { ok: true };
}

export type CardState = { state: State; msg?: string; link?: string; undone?: boolean };
/** Estado inicial: o que o servidor já criou (lembrete, tarefa anotada) começa como "criado", com Desfazer. */
export const initialCard = (a: ChatAction): CardState => ({ state: describe(a).applied ? "created" : "proposed" });

/** Cartão de confirmação de uma ação da conversa. O estado mora no app (o mesmo cartão aparece no painel e na Conversa,
 * e a confirmação falada decide mesmo se o cartão não estiver à vista). Um toque ou a voz ("sim"/"não") decidem. */
export function ActionCard({ a, st, onConfirm, onDiscard, onUndo, onOpen }: { a: ChatAction; st?: CardState; onConfirm: () => void; onDiscard: () => void; onUndo: () => void; onOpen?: (v: ViewId) => void }) {
  const v = describe(a);
  const { state, msg = "", link = "", undone = false } = st ?? initialCard(a);
  const label = state === "created" ? v.done : state === "discarded" ? v.undone : v.proposed;
  const pending = state === "proposed" || state === "error" || state === "saving";
  return (
    <CardFrame state={state} kind={a.kind} icon={v.icon} label={label} title={v.title} detail={v.detail}>
      {v.applied ? (
        !v.info && !undone && (state === "created" || state === "saving" || state === "error") && (
          <div className="evc-actions">
            <button className="btn btn-sm" disabled={state === "saving"} onClick={onUndo}>{state === "saving" ? v.busy : "Desfazer"}</button>
          </div>
        )
      ) : pending && (
        <div className="evc-actions">
          <button className="btn btn-sm btn-pri" disabled={state === "saving"} onClick={onConfirm}>{state === "saving" ? v.busy : state === "error" ? RETRY_LABEL : v.confirm}</button>
          <button className="btn btn-sm" disabled={state === "saving"} onClick={onDiscard}>Descartar</button>
        </div>
      )}
      {state === "created" && link && <a className="evc-link" href={link} target="_blank" rel="noopener noreferrer">Abrir no Google Agenda<Icon name="chevron" size={14} /></a>}
      {state === "created" && !link && v.open && onOpen && <button className="evc-link link-btn" onClick={() => onOpen(v.open!.view)}>{v.open.label}<Icon name="chevron" size={14} /></button>}
      {msg && state === "error" && <span className="evc-err" role="alert">{msg}</span>}
    </CardFrame>
  );
}
