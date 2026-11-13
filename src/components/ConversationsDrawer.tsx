"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

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
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Menu" ref={panel} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2 className="mono" style={{ margin: 0, color: "var(--sig)", fontWeight: 500 }}>Menu</h2>
          <button className="icon-btn" onClick={props.onClose} aria-label="Fechar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <button className="btn btn-pri" onClick={props.onNew}>Nova conversa</button>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <a className="btn btn-sm" style={{ flex: 1 }} href="/app/guia">Guia</a>
          <a className="btn btn-sm" style={{ flex: 1 }} href="/app/sobre">Como funciona</a>
        </div>
        <h3 className="mono muted" style={{ margin: "var(--s-2) 0 0", fontWeight: 500 }}>Conversas anteriores</h3>
        <label className="sr" htmlFor="conv-q">Buscar nas conversas</label>
        <input id="conv-q" className="field" type="search" placeholder="Buscar por assunto" value={q} onChange={(e) => setQ(e.target.value)} />
        {error && <div className="notice" role="alert">{error}</div>}
        <div className="drawer-list">
          {items === null ? (
            <p className="muted">Carregando…</p>
          ) : items.length === 0 ? (
            <p className="muted">{q ? "Nada encontrado." : "Nenhuma conversa ainda."}</p>
          ) : (
            items.map((c) => (
              <div key={c.id} className={`conv ${c.id === props.currentId ? "on" : ""}`}>
                <button className="conv-open" onClick={() => props.onOpen(c.id)} aria-current={c.id === props.currentId ? "true" : undefined}>
                  <span className="conv-top">
                    <span className="conv-title">{c.title || "Sem título"}</span>
                    <span className="mono muted">{when(c.updated_at)}</span>
                  </span>
                  {c.summary && <span className="conv-sum">{c.summary}</span>}
                  <span className="mono muted">{c.message_count ?? 0} mensagens</span>
                </button>
                {confirm === c.id ? (
                  <div className="row">
                    <button className="btn btn-sm" onClick={() => remove(c.id)} style={{ borderColor: "var(--bad)", color: "var(--bad)" }}>Apagar de vez</button>
                    <button className="btn btn-sm" onClick={() => setConfirm(null)}>Cancelar</button>
                  </div>
                ) : (
                  <button className="link-btn" onClick={() => setConfirm(c.id)} aria-label={`Apagar conversa ${c.title ?? ""}`}>Apagar</button>
                )}
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
