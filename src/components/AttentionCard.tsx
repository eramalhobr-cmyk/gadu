"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ActionItem } from "@/lib/core/format";
import type { ViewId } from "@/lib/modules";
import { ATENCAO_RECARREGAR_EVENT, EMAIL_NAO_IMPORTANTE_EVENT } from "@/lib/email-regras";
import { SITUACAO_LABEL, type Situacao } from "@/lib/goals/types";
import { supabaseBrowser } from "@/lib/supabase/client";
import { EVENTO_FALAR } from "@/lib/painel-fala";
import { showNotice, showUndo, UNDO_TEXT } from "@/lib/undo";
import { Icon } from "./ui";
import { EmptyState, Panel } from "./kit";

type Data = { enabled: boolean; items?: ActionItem[]; more?: number; unavailable?: { source: string; reason: string; text: string }[] };
type TetoAviso = { id: string; categoria: string; valor: number; gasto: number; pct: number; nivel: "ok" | "alerta" | "estourou" };
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
type Goals = { ativas: number; atencao: { id: string; titulo: string; situacao: Situacao; pct: number; semDados: boolean; prazo: string | null }[] };

const ORIGIN: Partial<Record<ViewId, string>> = { tarefas: "Tarefas", agenda: "Agenda", metas: "Metas", financeiro: "Financeiro", memoria: "Revisar" };
const ICON: Record<ActionItem["kind"], string> = { atrasada: "check", tarefa_hoje: "check", prioridade: "check", lembrete: "bell", evento: "calendar", email: "chat", financa: "coin", meta: "target" };
const TZ = "America/Sao_Paulo";
const tomorrowKey = () => new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA", { timeZone: TZ });

/** Lista única "Merece sua atenção" da tela Hoje (UX-2): o mesmo Core do chat (sem IA, custo zero de modelo),
 * mais as metas que pedem atenção e as memórias para revisar. Tarefas e lembretes têm Feito e Adiar no próprio item, com Desfazer. */
export function AttentionCard(props: {
  busy: boolean;
  onOpen: (view: ViewId) => void;
  onAsk: (q: string) => void;
  goalsEnabled: boolean;
  /** Financeiro ligado: mostra os tetos do mês que passaram de 80%. */
  financeEnabled?: boolean;
  pendingMemories: number;
  /** Quantos itens pedem atenção (para a frase do topo). */
  onCount?: (n: number) => void;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [goals, setGoals] = useState<Goals | null>(null);
  const [failed, setFailed] = useState(false);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const load = useCallback(async () => {
    setFailed(false);
    try {
      const r = await fetch("/api/attention?limit=8", { cache: "no-store" });
      if (r.status === 401) return setData({ enabled: false });
      if (!r.ok) return setFailed(true);
      setData(await r.json());
      setGone(new Set());
    } catch { setFailed(true); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  // App aberto em segundo plano: ao voltar para ele, refaz a lista (regra nova ou memória aprovada em outro lugar vale na hora).
  useEffect(() => {
    const v = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", v);
    return () => document.removeEventListener("visibilitychange", v);
  }, [load]);
  useEffect(() => {
    if (!props.goalsEnabled) return;
    fetch("/api/goals/resumo", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Goals | null) => setGoals(j && Array.isArray(j.atencao) ? j : null))
      .catch(() => setGoals(null));
  }, [props.goalsEnabled]);

  const [tetos, setTetos] = useState<TetoAviso[]>([]);
  useEffect(() => {
    if (!props.financeEnabled) return;
    fetch("/api/finance/tetos", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { tetos?: TetoAviso[] } | null) => setTetos(Array.isArray(j?.tetos) ? j.tetos.filter((t) => t.nivel !== "ok") : []))
      .catch(() => setTetos([]));
  }, [props.financeEnabled]);
  const items = (data?.items ?? []).filter((s) => !gone.has(s.tag));
  const goalRows = goals?.atencao ?? [];
  const total = items.length + goalRows.length + tetos.length + (props.pendingMemories > 0 ? 1 : 0);
  const onCount = props.onCount;
  useEffect(() => { if (data) onCount?.(total); }, [data, total, onCount]);

  // Sem o Core (CORE_MVP=0), a lista some, como antes.
  if (data && !data.enabled) return null;
  const unavailable = data?.unavailable ?? [];
  const reconnect = unavailable.some((u) => u.reason !== "error");

  /** "Não é importante" num e-mail: grava a regra (memória aprovada) e recarrega a lista na hora. */
  async function naoImportante(s: ActionItem, voz = false) {
    if (!s.de) return;
    // Pedido por voz: a confirmação também é falada (o GaduApp escuta "gadu:falar").
    const avisar = (txt: string) => { showNotice(txt); if (voz) window.dispatchEvent(new CustomEvent(EVENTO_FALAR, { detail: txt })); };
    try {
      const r = await fetch("/api/email/nao-importante", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ de: s.de }) });
      const j = (await r.json().catch(() => ({}))) as { termo?: string; error?: string };
      if (!r.ok) return avisar(j.error ?? UNDO_TEXT.failSave);
      avisar(`Pronto: e-mails de ${j.termo ?? "esse remetente"} não aparecem mais aqui.`);
      await load();
    } catch { avisar(UNDO_TEXT.failSave); }
  }
  // Voz ou texto ("isso não é importante") aplica ao primeiro e-mail da lista; "gadu:atencao-recarregar" refaz a lista.
  const aplicarRef = useRef<(voz: boolean) => void>(() => {});
  aplicarRef.current = (voz) => {
    const primeiro = items.find((x) => x.kind === "email" && x.de);
    if (primeiro) void naoImportante(primeiro, voz);
    else {
      const t = "Não há e-mail na lista agora. Diga de quem: “e-mails da Vercel não são importantes”.";
      showNotice(t);
      if (voz) window.dispatchEvent(new CustomEvent(EVENTO_FALAR, { detail: t }));
    }
  };
  useEffect(() => {
    const a = (e: Event) => aplicarRef.current(!!(e as CustomEvent<{ voz?: boolean }>).detail?.voz);
    const b = () => { void load(); };
    window.addEventListener(EMAIL_NAO_IMPORTANTE_EVENT, a);
    window.addEventListener(ATENCAO_RECARREGAR_EVENT, b);
    return () => { window.removeEventListener(EMAIL_NAO_IMPORTANTE_EVENT, a); window.removeEventListener(ATENCAO_RECARREGAR_EVENT, b); };
  }, [load]);

  /** Feito ou Adiar no próprio item. Grava com a sessão da pessoa (RLS) e oferece Desfazer por alguns segundos. */
  async function act(s: ActionItem, kind: "done" | "later") {
    if (!s.ref) return;
    const db = supabaseBrowser();
    const { table, id } = s.ref;
    setGone((g) => new Set(g).add(s.tag));
    let revert: () => Promise<unknown>;
    let error: unknown = null;
    if (table === "tasks") {
      if (kind === "done") {
        ({ error } = await db.from("tasks").update({ status: "done", done_at: new Date().toISOString() }).eq("id", id));
        revert = () => db.from("tasks").update({ status: "open", done_at: null }).eq("id", id);
      } else {
        const { data: row } = await db.from("tasks").select("due_date").eq("id", id).maybeSingle();
        const prev = (row as { due_date: string | null } | null)?.due_date ?? null;
        ({ error } = await db.from("tasks").update({ due_date: tomorrowKey() }).eq("id", id));
        revert = () => db.from("tasks").update({ due_date: prev }).eq("id", id);
      }
    } else if (kind === "done") {
      ({ error } = await db.from("reminders").update({ status: "done" }).eq("id", id));
      revert = () => db.from("reminders").update({ status: "pending" }).eq("id", id);
    } else {
      const { data: row } = await db.from("reminders").select("due_at").eq("id", id).maybeSingle();
      const prev = (row as { due_at: string } | null)?.due_at;
      const base = prev ? new Date(prev).getTime() : Date.now();
      ({ error } = await db.from("reminders").update({ due_at: new Date(Math.max(base, Date.now()) + 86_400_000).toISOString(), status: "pending" }).eq("id", id));
      revert = () => (prev ? db.from("reminders").update({ due_at: prev }).eq("id", id) : Promise.resolve());
    }
    if (error) {
      setGone((g) => { const n = new Set(g); n.delete(s.tag); return n; });
      showNotice(UNDO_TEXT.failSave);
      return;
    }
    showUndo(kind === "done" ? UNDO_TEXT.done : table === "tasks" ? UNDO_TEXT.later : "Adiado para amanhã.",
      async () => { const r = await revert(); setGone((g) => { const n = new Set(g); n.delete(s.tag); return n; }); return r; });
  }

  return (
    <>
      <div className="sec-head"><h2>Merece sua atenção</h2></div>
      <Panel className="attn-card">
        {failed ? <p className="muted">Não consegui montar esta lista agora. <button className="link-btn" onClick={load}>Tentar de novo</button></p>
          : data === null ? <p className="muted">Carregando…</p>
          : total === 0 ? <EmptyState icon="sun" title="Nada pendente para hoje" text={unavailable.length ? "Nas fontes que consegui ler. Veja o aviso abaixo." : "Nenhum item pede atenção. Entre os e-mails recentes consultados, nenhum foi classificado como crítico ou importante."} />
          : (
            <div className="rows">
              {items.map((s) => (
                <div className={`row-i attn-i ${s.ref || s.de ? "" : "one"}`} key={s.tag}>
                  <span className="rec-ico" aria-hidden="true"><Icon name={ICON[s.kind]} size={20} /></span>
                  <div className="grow">
                    <span className="t wrap-t">{s.text}</span>
                    <span className="s">{s.label}</span>
                  </div>
                  <div className="attn-acts">
                    {s.ref ? (
                      <>
                        <button className="btn btn-sm btn-pri" onClick={() => act(s, "done")} aria-label={`Feito: ${s.text}`}>Feito</button>
                        <button className="btn btn-sm" onClick={() => act(s, "later")} aria-label={`Adiar para amanhã: ${s.text}`}>Adiar</button>
                      </>
                    ) : s.href ? (
                      <>
                        <a className="btn btn-sm" href={s.href} target="_blank" rel="noopener noreferrer">Abrir e-mail</a>
                        {s.kind === "email" && s.de && <button className="btn btn-sm" onClick={() => naoImportante(s)} aria-label={`Não é importante: e-mails de ${s.de}`}>Não é importante</button>}
                      </>
                    )
                      : <button className="btn btn-sm" onClick={() => props.onOpen(s.view)}>{ORIGIN[s.view] ?? "Abrir"}</button>}
                  </div>
                </div>
              ))}
              {goalRows.map((m) => (
                <div className="row-i attn-i one" key={`g-${m.id}`}>
                  <span className="rec-ico" aria-hidden="true"><Icon name="target" size={20} /></span>
                  <div className="grow">
                    <span className="t wrap-t">{m.titulo}</span>
                    <span className="s">Meta · {SITUACAO_LABEL[m.situacao]}{m.semDados ? " · sem registros" : ` · ${m.pct}%`}</span>
                  </div>
                  <div className="attn-acts"><button className="btn btn-sm" onClick={() => props.onOpen("metas")}>Metas</button></div>
                </div>
              ))}
              {tetos.map((t) => (
                <div className="row-i attn-i one" key={`t-${t.id}`}>
                  <span className="rec-ico" aria-hidden="true"><Icon name="coin" size={20} /></span>
                  <div className="grow">
                    <span className="t wrap-t">{t.nivel === "estourou" ? `${t.categoria} estourou o teto do mês` : `${t.categoria} passou de 80% do teto`}</span>
                    <span className="s">Financeiro · {brl(t.gasto)} de {brl(t.valor)} ({t.pct}%)</span>
                  </div>
                  <div className="attn-acts"><button className="btn btn-sm" onClick={() => props.onOpen("financeiro")}>Financeiro</button></div>
                </div>
              ))}
              {props.pendingMemories > 0 && (
                <div className="row-i attn-i one">
                  <span className="rec-ico" aria-hidden="true"><Icon name="book" size={20} /></span>
                  <div className="grow">
                    <span className="t wrap-t">{props.pendingMemories === 1 ? "1 coisa que o GaDu aprendeu espera o seu sim" : `${props.pendingMemories} coisas que o GaDu aprendeu esperam o seu sim`}</span>
                    <span className="s">Memória</span>
                  </div>
                  <div className="attn-acts"><button className="btn btn-sm" onClick={() => props.onOpen("memoria")}>Revisar</button></div>
                </div>
              )}
              {(data.more ?? 0) > 0 && <p className="muted m0">e mais {data.more} {data.more === 1 ? "item" : "itens"}. Pergunte ao GaDu para ver tudo.</p>}
            </div>
          )}
        {!failed && unavailable.length > 0 && (
          <ul className="attn-miss" aria-label="O que não consegui ler">
            {unavailable.map((u) => <li key={u.source}>{u.text}</li>)}
            {reconnect && <li><a className="btn btn-sm" href="/api/google/connect">Conectar Google</a></li>}
          </ul>
        )}
      </Panel>
    </>
  );
}
