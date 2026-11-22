"use client";
import { useCallback, useEffect, useState } from "react";
import { EXPORT_PROMPT, IMPORT_MAX_CHARS } from "@/lib/importer";
import { supabaseBrowser } from "@/lib/supabase/client";
import { when } from "./ConversationsDrawer";
import { EmptyState, PageHeader, Panel } from "./kit";
import { Icon } from "./ui";

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

  const KIND = { memoria: "Memória", conversa: "Conversa", mensagem: "Mensagem", tarefa: "Tarefa", projeto: "Projeto" } as const;
  const byArea = approved.reduce<Record<string, Memory[]>>((acc, m) => { (acc[m.area] ??= []).push(m); return acc; }, {});

  return (
    <main className="page" id="conteudo">
      <div className="wrap">
        <PageHeader eyebrow="Pessoal" title="Memórias" text="A memória é do GaDu, não das IAs. Tudo entra como pendente e só vale depois que você aprova." />
        <div className="search">
          <Icon name="spark" size={18} />
          <label className="sr" htmlFor="mem-q">Buscar na memória</label>
          <input id="mem-q" className="search-input" type="search" placeholder="Buscar em memórias e conversas" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && <button className="icon-btn" onClick={() => setQ("")} aria-label="Limpar busca"><Icon name="x" size={16} /></button>}
        </div>
        {error && <div className="notice" role="alert">{error}</div>}

        {hits && (
          <Panel title={`Resultados${hits.length ? ` · ${hits.length}` : ""}`} icon="spark">
            <div aria-live="polite">
              {hits.length === 0 ? <EmptyState icon="spark" title="Nada encontrado" text="Tente outras palavras. A busca também procura pelo significado." /> : (
                <div className="rows">
                  {hits.map((h) => (
                    <div className="row-i mem-hit" key={`${h.kind}-${h.id}`}>
                      <div className="grow">
                        <span className={`kind ${h.kind}`}>{KIND[h.kind]}{h.semantic ? " · por significado" : ""}</span>
                        <span className="t wrap-t">{h.text}</span>
                        <span className="s">{h.sub}</span>
                      </div>
                      {h.conversationId && <button className="btn btn-sm" onClick={() => onOpenConversation(h.conversationId!)}>Abrir</button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>
        )}

        <div className="mem-cols">
          <div className="col">
            <Panel className="mem-review o1" title={`Para revisar${pending.length ? ` · ${pending.length}` : ""}`} icon="bell"
              action={approvable.length > 1 && <button className="btn btn-sm" onClick={() => act(() => db.from("memories").update({ status: "approved" }).in("id", approvable.map((m) => m.id)))}>Aprovar todas ({approvable.length})</button>}>
              {items === null ? <p className="muted" role="status">Carregando…</p> : pending.length === 0 ? (
                <EmptyState icon="check" title="Nada para revisar" text="Quando o GaDu aprender algo numa conversa, aparece aqui para o seu sim." />
              ) : (
                <div className="rows">
                  {pending.map((m) => (
                    <div className="mem-item" key={m.id}>
                      <p className="mem-text">{m.content}</p>
                      <span className="mem-meta">{m.area} · origem: {m.origin}</span>
                      {hit(m.content) && <p className="mem-warn" role="note">Contém o termo bloqueado “{hit(m.content)}”. Não pode ser aprovada.</p>}
                      <div className="form-actions">
                        <button className="btn btn-sm btn-pri" disabled={Boolean(hit(m.content))} onClick={() => act(() => db.from("memories").update({ status: "approved" }).eq("id", m.id))}><Icon name="check" size={16} />Aprovar</button>
                        <button className="btn btn-sm" onClick={() => act(() => db.from("memories").delete().eq("id", m.id))}>Descartar</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel className="o3" title={`O que eu sei sobre você${approved.length ? ` · ${approved.length}` : ""}`} icon="book">
              {items === null ? <p className="muted" role="status">Carregando…</p> : approved.length === 0 ? (
                <EmptyState icon="book" title="Ainda não sei nada aprovado" text="Adicione algo em “Lembre que…” ou importe de outra IA." />
              ) : Object.entries(byArea).map(([a, list]) => (
                <section key={a} className="mem-area" aria-label={a}>
                  <h3 className="tl-group-head"><span>{a}</span><span className="tl-count">{list.length}</span></h3>
                  <div className="rows">
                    {list.map((m) => (
                      <div className="row-i" key={m.id}>
                        <div className="grow"><span className="t wrap-t">{m.content}</span><span className="s">origem: {m.origin}</span></div>
                        <button className="btn btn-sm btn-quiet" onClick={() => act(() => db.from("memories").delete().eq("id", m.id))}>Esquecer</button>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </Panel>
          </div>

          <div className="col">
            <Panel className="o2" title="Lembre que…" icon="plus">
              <label className="fld">
                <span>Nova memória</span>
                <input id="mem-new" className="field" value={text} maxLength={400} placeholder="Ex.: prefiro reuniões depois das 10h" onChange={(e) => setText(e.target.value)} />
              </label>
              <div className="fld">
                <span id="mem-area-l">Área</span>
                <div className="chips" role="group" aria-labelledby="mem-area-l">
                  {AREAS.map((a) => <button key={a} className="chip" aria-pressed={area === a} onClick={() => setArea(a)}>{a}</button>)}
                </div>
              </div>
              <div><button className="btn" disabled={!text.trim()} onClick={() => act(async () => { const r = await db.from("memories").insert({ content: text.trim(), area, origin: "Você" }); if (!r.error) setText(""); return r; })}>Adicionar para revisão</button></div>
            </Panel>
            <ImportCard onDone={load} />
          </div>
        </div>
      </div>
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
    <Panel className="o4" title="Importar de outra IA" icon="link">
      {!open ? (
        <>
          <p className="muted">Traga o que o ChatGPT, o Claude ou o Gemini já sabem sobre você. Tudo entra para revisão.</p>
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
          <div className="chips" role="group" aria-label="Origem">
            {ORIGINS.map((o) => <button key={o} className="chip" aria-pressed={origin === o} onClick={() => setOrigin(o)}>{o}</button>)}
          </div>
          <label className="sr" htmlFor="imp-text">Texto para importar</label>
          <textarea id="imp-text" className="field" rows={6} maxLength={IMPORT_MAX_CHARS} placeholder="Cole aqui. Uma informação por linha funciona melhor." value={text} onChange={(e) => setText(e.target.value)} />
          <div className="form-actions">
            <label className="btn btn-sm file-btn">
              Enviar arquivo
              <input type="file" accept=".txt,.md,.json,text/plain,application/json" onChange={readFile} hidden />
            </label>
            <button className="btn btn-sm btn-pri" disabled={busy || !text.trim()} onClick={submit}>{busy ? "Importando…" : "Importar"}</button>
            <button className="btn btn-sm" onClick={() => { setOpen(false); setMsg(""); }}>Fechar</button>
          </div>
          <p className="muted small">Lista: grátis. Texto corrido: o GaDu usa o modelo mais barato para separar os fatos (centavos).</p>
        </>
      )}
      {msg && <p className="form-msg" role="status">{msg}</p>}
    </Panel>
  );
}
