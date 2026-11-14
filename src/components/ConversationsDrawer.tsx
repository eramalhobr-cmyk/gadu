"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { EmptyState } from "./kit";
import { Icon } from "./ui";

type Conv = { id: number; title: string | null; summary: string | null; updated_at: string; message_count: number | null };

/** "hoje 14:05", "ontem", "seg", "12/10". */
export function when(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  if (diff === 0) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (diff === 1) return "ontem";
  if (diff < 7) return d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function ConversationsDrawer(props: {
  currentId: number | null;
  onClose: () => void;
  onOpen: (id: number) => void;
  onNew: () => void;
  onDeleted: (id: number) => void;
}) {
  const [items, setItems] = useState<Conv[] | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<number | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const db = supabaseBrowser();

  const load = useCallback(async (query: string) => {
    let req = db.from("conversations").select("id, title, summary, updated_at, message_count");
    const words = query.trim().split(/\s+/).filter((w) => w.length >= 2).join(" ");
    if (words) req = req.textSearch("search", words, { type: "websearch", config: "portuguese" });
    const { data, error } = await req.order("updated_at", { ascending: false }).limit(60);
    setError(error ? "Não consegui carregar as conversas." : "");
    setItems((data as Conv[]) ?? []);
  }, [db]);

  useEffect(() => {
    const id = setTimeout(() => void load(q), q ? 250 : 0);
    return () => clearTimeout(id);
  }, [q, load]);

  const closeRef = useRef(props.onClose);
  useEffect(() => { closeRef.current = props.onClose; }, [props.onClose]);
  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function remove(id: number) {
    const { error } = await db.from("conversations").delete().eq("id", id);
    if (error) return setError("Não consegui apagar. Tente de novo.");
    setConfirm(null);
    props.onDeleted(id);
    void load(q);
  }

  return (
    <div className="drawer-wrap" onClick={props.onClose}>
      <aside className="drawer hist" role="dialog" aria-modal="true" aria-label="Histórico de conversas" ref={panel} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="hist-head">
          <h2>Conversas</h2>
          <button className="icon-btn" onClick={props.onClose} aria-label="Fechar"><Icon name="x" size={20} /></button>
        </div>
        <button className="btn btn-pri hist-new" onClick={props.onNew}><Icon name="plus" size={18} />Nova conversa</button>
        <div className="search">
          <Icon name="history" size={18} />
          <label className="sr" htmlFor="conv-q">Buscar nas conversas</label>
          <input id="conv-q" className="search-input" type="search" placeholder="Buscar por assunto" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {error && <div className="notice" role="alert">{error}</div>}
        <div className="drawer-list hist-list">
          {items === null ? (
            <p className="muted" role="status">Carregando…</p>
          ) : items.length === 0 ? (
            <EmptyState icon="chat" title={q ? "Nada encontrado" : "Nenhuma conversa ainda"} text={q ? "Tente outras palavras." : "Comece uma nova conversa acima."} />
          ) : (
            items.map((c) => (
              <div key={c.id} className={`hist-item ${c.id === props.currentId ? "on" : ""}`}>
                <button className="hist-open" onClick={() => props.onOpen(c.id)} aria-current={c.id === props.currentId ? "true" : undefined}>
                  <span className="hist-top">
                    <span className="hist-title">{c.title || "Sem título"}</span>
                    <span className="hist-when">{when(c.updated_at)}</span>
                  </span>
                  {c.summary && <span className="hist-sum">{c.summary}</span>}
                  <span className="hist-count">{c.message_count ?? 0} mensagens</span>
                </button>
                {confirm === c.id ? (
                  <div className="hist-confirm">
                    <button className="btn btn-sm btn-bad" onClick={() => remove(c.id)}>Apagar de vez</button>
                    <button className="btn btn-sm" onClick={() => setConfirm(null)}>Cancelar</button>
                  </div>
                ) : (
                  <button className="icon-btn hist-del" onClick={() => setConfirm(c.id)} aria-label={`Apagar conversa ${c.title ?? ""}`}><Icon name="x" size={16} /></button>
                )}
              </div>
            ))
          )}
        </div>
        <nav className="hist-foot" aria-label="Ajuda">
          <a href="/app/guia"><Icon name="book" size={16} />Guia</a>
          <a href="/app/sobre"><Icon name="spark" size={16} />Como funciona</a>
        </nav>
      </aside>
    </div>
  );
}
