"use client";
import { useCallback, useEffect, useState } from "react";
import { EXPORT_PROMPT, IMPORT_MAX_CHARS } from "@/lib/importer";
import { supabaseBrowser } from "@/lib/supabase/client";
import { when } from "./ConversationsDrawer";

type Memory = { id: number; content: string; area: string; origin: string; status: "pending" | "approved" };
type Hit = { kind: "memoria" | "conversa" | "mensagem" | "tarefa" | "projeto"; id: number; text: string; sub: string; conversationId?: number; semantic?: boolean };

import { AREAS } from "@/lib/presets";
const ORIGINS = ["ChatGPT", "Claude", "Gemini", "Outra"] as const;

export function MemoryPage({ blocked, onChange, onOpenConversation }: { blocked: string[]; onChange: () => void; onOpenConversation: (id: number) => void }) {
  const [items, setItems] = useState<Memory[] | null>(null);
  const [text, setText] = useState("");
  const [area, setArea] = useState<string>(AREAS[0]);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const db = supabaseBrowser();

  const load = useCallback(async () => {
    const { data, error } = await db.from("memories").select("id, content, area, origin, status").order("created_at", { ascending: false }).limit(400);
    if (error) setError("Não consegui carregar a memória. Tente de novo.");
    setItems((data as Memory[]) ?? []);
    onChange();
  }, [db, onChange]);
  useEffect(() => { void load(); }, [load]);

  // Busca em camadas: memórias aprovadas, resumos de conversas e mensagens.
  useEffect(() => {
    const words = q.trim().split(/\s+/).filter((w) => w.length >= 2).join(" ");
    if (!words) { setHits(null); return; }
    const id = setTimeout(async () => {
      const opt = { type: "websearch" as const, config: "portuguese" };
      const [sem, m, c, msg] = await Promise.all([
        fetch(`/api/search?q=${encodeURIComponent(q.trim().slice(0, 300))}`).then((r) => r.json()).catch(() => ({ results: [] })) as Promise<{ results: { kind: string; ref_id: number; content: string; similarity: number }[] }>,
        db.from("memories").select("id, content, area, status").textSearch("search", words, opt).limit(10),
        db.from("conversations").select("id, title, summary, updated_at").textSearch("search", words, opt).order("updated_at", { ascending: false }).limit(8),
        db.from("messages").select("id, content, conversation_id, created_at, role").textSearch("search", words, opt).order("created_at", { ascending: false }).limit(10),
      ]);
      const out: Hit[] = [
        ...((m.data ?? []) as { id: number; content: string; area: string; status: string }[]).map((x) => ({ kind: "memoria" as const, id: x.id, text: x.content, sub: `${x.area}${x.status === "pending" ? " · pendente" : ""}` })),
        ...((c.data ?? []) as { id: number; title: string | null; summary: string | null; updated_at: string }[]).map((x) => ({ kind: "conversa" as const, id: x.id, text: x.title || "Sem título", sub: `${when(x.updated_at)}${x.summary ? ` · ${x.summary.slice(0, 140)}` : ""}`, conversationId: x.id })),
        ...((msg.data ?? []) as { id: number; content: string; conversation_id: number; created_at: string; role: string }[]).map((x) => ({ kind: "mensagem" as const, id: x.id, text: x.content.slice(0, 180), sub: `${x.role === "user" ? "Você" : "GaDu"} · ${when(x.created_at)}`, conversationId: x.conversation_id })),
      ];
      // Busca por significado primeiro (encontra mesmo sem as palavras exatas), sem repetir o que a busca por palavras achou.
      const seen = new Set(out.map((h) => `${h.kind}-${h.id}`));
      const kindMap: Record<string, Hit["kind"]> = { memory: "memoria", conversation: "conversa", task: "tarefa", project: "projeto" };
      const semHits: Hit[] = (sem.results ?? [])
        .map((r) => ({ kind: kindMap[r.kind] ?? "memoria", id: r.ref_id, text: r.content.slice(0, 200), sub: "parecido com a busca", conversationId: r.kind === "conversation" ? r.ref_id : undefined, semantic: true }))
        .filter((h) => !seen.has(`${h.kind}-${h.id}`));
      setHits([...semHits.slice(0, 6), ...out]);
    }, 300);
    return () => clearTimeout(id);
  }, [q, db]);

  const hit = (t: string) => blocked.find((b) => b && t.toLowerCase().includes(b.toLowerCase()));
  const pending = (items ?? []).filter((m) => m.status === "pending");
  const approved = (items ?? []).filter((m) => m.status === "approved");
  const approvable = pending.filter((m) => !hit(m.content));

  async function act(fn: () => PromiseLike<{ error: unknown }>) {
    const { error } = await fn();
    if (error) setError("A alteração não foi salva. Tente de novo.");
    await load();
  }

  return (
    <main className="page">
      <label className="sr" htmlFor="mem-q">Buscar na memória</label>
      <input id="mem-q" className="field" type="search" placeholder="Buscar em memórias e conversas" value={q} onChange={(e) => setQ(e.target.value)} />
      {hits && (
        <section className="card" aria-live="polite">
          <h2>Resultados</h2>
          {hits.length === 0 ? <p className="muted">Nada encontrado.</p> : hits.map((h) => (
            <div className="item" key={`${h.kind}-${h.id}`}>
              <div className="mono" style={{ color: h.kind === "memoria" ? "var(--sig)" : "var(--ink-3)" }}>{({ memoria: "Memória", conversa: "Conversa", mensagem: "Mensagem", tarefa: "Tarefa", projeto: "Projeto" } as const)[h.kind]}{h.semantic ? " · por significado" : ""}</div>
              <div>{h.text}</div>
              <div className="muted" style={{ fontSize: 14 }}>{h.sub}</div>
              {h.conversationId && <div><button className="btn btn-sm" onClick={() => onOpenConversation(h.conversationId!)}>Abrir conversa</button></div>}
            </div>
          ))}
        </section>
      )}

      {!hits && <p className="muted" style={{ margin: 0 }}>A memória é do GaDu, não das IAs. Tudo entra como pendente e só vale depois que você aprova.</p>}
      {error && <div className="notice" role="alert">{error}</div>}

      <section className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ color: "var(--hot)" }}>Para revisar{pending.length ? ` · ${pending.length}` : ""}</h2>
          {approvable.length > 1 && (
            <button className="btn btn-sm" onClick={() => act(() => db.from("memories").update({ status: "approved" }).in("id", approvable.map((m) => m.id)))}>Aprovar todas ({approvable.length})</button>
          )}
        </div>
        {items === null ? <p className="muted">Carregando…</p> : pending.length === 0 ? <p className="muted">Nada para revisar.</p> : pending.map((m) => (
          <div className="item" key={m.id}>
            <div>{m.content}</div>
            <div className="mono muted">{m.area} · origem: {m.origin}</div>
            {hit(m.content) && <div style={{ color: "var(--hot)", fontSize: 14 }}>Contém o termo bloqueado “{hit(m.content)}”. Não pode ser aprovada.</div>}
            <div className="row">
              <button className="btn btn-sm btn-pri" disabled={Boolean(hit(m.content))} onClick={() => act(() => db.from("memories").update({ status: "approved" }).eq("id", m.id))}>Aprovar</button>
              <button className="btn btn-sm" onClick={() => act(() => db.from("memories").delete().eq("id", m.id))}>Descartar</button>
            </div>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Lembre que…</h2>
        <label className="sr" htmlFor="mem-new">Nova memória</label>
        <input id="mem-new" className="field" value={text} maxLength={400} placeholder="Ex.: prefiro reuniões depois das 10h" onChange={(e) => setText(e.target.value)} />
        <div className="row">
          {AREAS.map((a) => <button key={a} className="chip" aria-pressed={area === a} onClick={() => setArea(a)}>{a}</button>)}
        </div>
        <div><button className="btn" disabled={!text.trim()} onClick={() => act(async () => { const r = await db.from("memories").insert({ content: text.trim(), area, origin: "Você" }); if (!r.error) setText(""); return r; })}>Adicionar para revisão</button></div>
      </section>

      <ImportCard onDone={load} />

      <section className="card">
        <h2>O que eu sei sobre você{approved.length ? ` · ${approved.length}` : ""}</h2>
        {approved.length === 0 ? <p className="muted">Ainda não sei nada aprovado sobre você.</p> : approved.map((m) => (
          <div className="item" key={m.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ minWidth: 0 }}><div>{m.content}</div><div className="mono muted">{m.area} · origem: {m.origin}</div></div>
            <button className="btn btn-sm" onClick={() => act(() => db.from("memories").delete().eq("id", m.id))}>Esquecer</button>
          </div>
        ))}
      </section>
    </main>
  );
}

function ImportCard({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState<(typeof ORIGINS)[number]>("ChatGPT");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    try { await navigator.clipboard.writeText(EXPORT_PROMPT); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); }
  }

  async function readFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 200_000) return setMsg("Arquivo grande demais. Use até 200 KB ou cole só a parte das memórias.");
    const t = await f.text();
    setText(t.slice(0, IMPORT_MAX_CHARS));
    setMsg(t.length > IMPORT_MAX_CHARS ? "O arquivo foi cortado em 30 mil caracteres." : "");
  }

  async function submit() {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/memories/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, origin }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(j.message || "Não consegui importar. Tente de novo."); return; }
      setText("");
      setMsg(j.added
        ? `${j.added} ${j.added === 1 ? "memória entrou" : "memórias entraram"} para revisão${j.skipped ? ` (${j.skipped} ignoradas: repetidas, sensíveis ou bloqueadas)` : ""}.`
        : "Nada novo para importar.");
      onDone();
    } catch {
      setMsg("Sem conexão. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>Importar de outra IA</h2>
      {!open ? (
        <>
          <p className="muted" style={{ margin: 0 }}>Traga o que o ChatGPT, o Claude ou o Gemini já sabem sobre você. Tudo entra para revisão.</p>
          <div><button className="btn" onClick={() => setOpen(true)}>Importar memórias</button></div>
        </>
      ) : (
        <>
          <ol className="steps">
            <li>Copie o pedido abaixo e cole na outra IA.</li>
            <li>Copie a resposta dela e cole aqui (ou envie um arquivo .txt, .md ou .json).</li>
            <li>Revise e aprove em “Para revisar”.</li>
          </ol>
          <div className="quote">{EXPORT_PROMPT}</div>
          <div><button className="btn btn-sm" onClick={copyPrompt}>{copied ? "Copiado" : "Copiar pedido"}</button></div>
          <div className="row">
            {ORIGINS.map((o) => <button key={o} className="chip" aria-pressed={origin === o} onClick={() => setOrigin(o)}>{o}</button>)}
          </div>
          <label className="sr" htmlFor="imp-text">Texto para importar</label>
          <textarea id="imp-text" className="field" rows={6} maxLength={IMPORT_MAX_CHARS} placeholder="Cole aqui. Uma informação por linha funciona melhor." value={text} onChange={(e) => setText(e.target.value)} />
          <div className="row">
            <label className="btn btn-sm" style={{ cursor: "pointer" }}>
              Enviar arquivo
              <input type="file" accept=".txt,.md,.json,text/plain,application/json" onChange={readFile} hidden />
            </label>
            <button className="btn btn-sm btn-pri" disabled={busy || !text.trim()} onClick={submit}>{busy ? "Importando…" : "Importar"}</button>
            <button className="btn btn-sm" onClick={() => { setOpen(false); setMsg(""); }}>Fechar</button>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>Lista: grátis. Texto corrido: o GaDu usa o modelo mais barato para separar os fatos (centavos).</p>
        </>
      )}
      {msg && <span className="muted" role="status">{msg}</span>}
    </section>
  );
}
