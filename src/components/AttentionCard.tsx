"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ActionItem } from "@/lib/core/format";
import type { ViewId } from "@/lib/modules";
import { SITUACAO_LABEL, type Situacao } from "@/lib/goals/types";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Icon } from "./ui";
import { EmptyState, Panel } from "./kit";

type Data = { enabled: boolean; items?: ActionItem[]; more?: number; unavailable?: { source: string; reason: string; text: string }[] };
type Goals = { ativas: number; atencao: { id: string; titulo: string; situacao: Situacao; pct: number; semDados: boolean; prazo: string | null }[] };
type Undo = { text: string; revert: () => Promise<unknown> };

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
  pendingMemories: number;
  /** Quantos itens pedem atenção (para a frase do topo). */
  onCount?: (n: number) => void;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [goals, setGoals] = useState<Goals | null>(null);
  const [failed, setFailed] = useState(false);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [undo, setUndo] = useState<Undo | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  useEffect(() => {
    if (!props.goalsEnabled) return;
    fetch("/api/goals/resumo", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Goals | null) => setGoals(j && Array.isArray(j.atencao) ? j : null))
      .catch(() => setGoals(null));
  }, [props.goalsEnabled]);
  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  const items = (data?.items ?? []).filter((s) => !gone.has(s.tag));
  const goalRows = goals?.atencao ?? [];
  const total = items.length + goalRows.length + (props.pendingMemories > 0 ? 1 : 0);
  const onCount = props.onCount;
  useEffect(() => { if (data) onCount?.(total); }, [data, total, onCount]);

  // Sem o Core (CORE_MVP=0), a lista some, como antes.
  if (data && !data.enabled) return null;
  const unavailable = data?.unavailable ?? [];
  const reconnect = unavailable.some((u) => u.reason !== "error");

  function showUndo(u: Undo) {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo(u);
    undoTimer.current = setTimeout(() => setUndo(null), 6000);
  }

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
      showUndo({ text: "Não consegui gravar. Tente de novo.", revert: async () => {} });
      return;
    }
    showUndo({
      text: kind === "done" ? "Feito." : table === "tasks" ? "Passou para amanhã." : "Adiado para amanhã.",
      revert: async () => { await revert(); setGone((g) => { const n = new Set(g); n.delete(s.tag); return n; }); },
    });
  }

  return (
    <>
      <div className="sec-head"><h2>Merece sua atenção</h2></div>
      <Panel className="attn-card">
        {failed ? <p className="muted">Não consegui montar esta lista agora. <button className="link-btn" onClick={load}>Tentar de novo</button></p>
          : data === null ? <p className="muted">Carregando…</p>
          : total === 0 ? <EmptyState icon="sun" title="Nada pendente para hoje" text={unavailable.length ? "Nas fontes que consegui ler. Veja o aviso abaixo." : "Sem tarefas atrasadas ou de hoje, lembretes, compromissos ou metas pedindo atenção."} />
          : (
            <div className="rows">
              {items.map((s) => (
                <div className={`row-i attn-i ${s.ref ? "" : "one"}`} key={s.tag}>
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
                    ) : s.href ? <a className="btn btn-sm" href={s.href} target="_blank" rel="noopener noreferrer">Abrir e-mail</a>
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
              {(data.more ?? 0) > 0 && <p className="muted" style={{ margin: 0 }}>e mais {data.more} {data.more === 1 ? "item" : "itens"}. Pergunte ao GaDu para ver tudo.</p>}
            </div>
          )}
        {!failed && unavailable.length > 0 && (
          <ul className="attn-miss" aria-label="O que não consegui ler">
            {unavailable.map((u) => <li key={u.source}>{u.text}</li>)}
            {reconnect && <li><a className="btn btn-sm" href="/api/google/connect">Conectar Google</a></li>}
          </ul>
        )}
      </Panel>
      {undo && (
        <div className="undo-toast" role="status">
          <span>{undo.text}</span>
          {undo.text !== "Não consegui gravar. Tente de novo." && (
            <button className="btn btn-sm" onClick={() => { const u = undo; setUndo(null); void u.revert(); }}>Desfazer</button>
          )}
        </div>
      )}
    </>
  );
}
