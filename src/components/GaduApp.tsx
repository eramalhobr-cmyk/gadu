"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RobotFace } from "./RobotFace";
import type { FaceMode } from "./robot-engine";
import { canListen, canSpeak, createRecognizer, Speaker } from "@/lib/speech";
import { supabaseBrowser } from "@/lib/supabase/client";

export type Msg = { id: string; role: "user" | "assistant" | "notice"; content: string; via?: string };
type Memory = { id: number; content: string; area: string; origin: string; status: "pending" | "approved" };
type Tab = "conversa" | "memoria" | "ajustes";

const AREAS = ["Preferências", "Projetos", "Agent Office", "Pessoal", "Profissional"];
const LS_DRAFT = "gadu.draft";
const LS_PREFS = "gadu.prefs";

function readPrefs(): { voice: boolean; handsFree: boolean } {
  try {
    const p = JSON.parse(localStorage.getItem(LS_PREFS) || "{}");
    return { voice: p.voice !== false, handsFree: Boolean(p.handsFree) };
  } catch {
    return { voice: true, handsFree: false };
  }
}

export function GaduApp(props: {
  name: string;
  email: string;
  initialConversationId: number | null;
  initialMessages: Msg[];
  initialBlocked: string[];
  version: string;
}) {
  const [tab, setTab] = useState<Tab>("conversa");
  const [messages, setMessages] = useState<Msg[]>(props.initialMessages);
  const [conversationId, setConversationId] = useState<number | null>(props.initialConversationId);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<FaceMode>("idle");
  const [listening, setListening] = useState(false);
  const [online, setOnline] = useState(true);
  const [prefs, setPrefs] = useState({ voice: true, handsFree: false });
  const [pending, setPending] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const speaker = useMemo(() => (typeof window === "undefined" ? null : new Speaker()), []);
  const recRef = useRef<ReturnType<typeof createRecognizer>>(null);
  const handsFreeRef = useRef(false);
  const voiceOk = typeof window !== "undefined" && canListen();

  // Preferências e rascunho ficam no aparelho.
  useEffect(() => {
    setPrefs(readPrefs());
    try { setDraft(localStorage.getItem(LS_DRAFT) || ""); } catch {}
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  useEffect(() => { try { localStorage.setItem(LS_DRAFT, draft); } catch {} }, [draft]);
  useEffect(() => {
    try { localStorage.setItem(LS_PREFS, JSON.stringify(prefs)); } catch {}
    handsFreeRef.current = prefs.handsFree;
  }, [prefs]);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [messages, tab]);

  const refreshPending = useCallback(async () => {
    const { count } = await supabaseBrowser().from("memories").select("id", { count: "exact", head: true }).eq("status", "pending");
    setPending(count ?? 0);
  }, []);
  useEffect(() => { refreshPending(); }, [refreshPending]);

  const listen = useCallback(() => {
    if (!voiceOk || busy) return;
    speaker?.cancel();
    const rec = createRecognizer({
      onText: (text, final) => {
        setDraft(text);
        if (final && text) void sendRef.current(text);
      },
      onEnd: () => { setListening(false); setMode((m) => (m === "listening" ? "idle" : m)); },
      onError: (code) => {
        setListening(false);
        setMode("idle");
        if (code === "not-allowed" || code === "service-not-allowed") {
          setMessages((ms) => [...ms, { id: crypto.randomUUID(), role: "notice", content: "O microfone está bloqueado. Libere o microfone para este site nas configurações do navegador." }]);
        }
      },
    });
    if (!rec) return;
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
      setMode("listening");
    } catch {
      setListening(false);
    }
  }, [busy, speaker, voiceOk]);

  const send = useCallback(async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    if (!navigator.onLine) {
      setMessages((ms) => [...ms, { id: crypto.randomUUID(), role: "notice", content: "Você está sem internet. A mensagem ficou no rascunho para enviar depois." }]);
      return;
    }
    setDraft("");
    setBusy(true);
    setMode("thinking");
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: message };
    const botId = crypto.randomUUID();
    setMessages((ms) => [...ms, userMsg]);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let answer = "";
    let spoke = false;
    let answerStarted = false;
    if (speaker) {
      speaker.onStart = () => setMode("speaking");
      speaker.onIdle = () => {
        setMode("idle");
        if (handsFreeRef.current) setTimeout(() => listenRef.current(), 400);
      };
    }
    const attempt = async () => {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, conversationId }),
        signal: ctrl.signal,
      });
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (!res.ok || !res.body) throw new Error(String(res.status));
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line);
          if (ev.t === "start") setConversationId(ev.conversationId);
          else if (ev.t === "provider") {
            setMessages((ms) => [...ms, { id: botId, role: "assistant", content: "", via: ev.name }]);
          } else if (ev.t === "delta") {
            answer += ev.text;
            if (!answerStarted) { answerStarted = true; if (!(prefs.voice && canSpeak())) setMode("speaking"); }
            setMessages((ms) => ms.map((m) => (m.id === botId ? { ...m, content: answer } : m)));
            if (prefs.voice && speaker) { speaker.push(ev.text); spoke = true; }
          } else if (ev.t === "notice") {
            setMessages((ms) => [...ms, { id: crypto.randomUUID(), role: "notice", content: ev.text }]);
          } else if (ev.t === "done" && ev.memories > 0) {
            setMessages((ms) => [...ms, { id: crypto.randomUUID(), role: "notice", content: ev.memories === 1 ? "1 memória nova para você revisar na aba Memória." : `${ev.memories} memórias novas para você revisar na aba Memória.` }]);
            void refreshPending();
          }
        }
      }
    };
    try {
      try {
        await attempt();
      } catch (e) {
        // Contingência: uma nova tentativa automática se a rede caiu antes de responder.
        if (ctrl.signal.aborted || answer) throw e;
        await new Promise((r) => setTimeout(r, 800));
        await attempt();
      }
    } catch {
      if (!ctrl.signal.aborted) {
        setMessages((ms) => [...ms, { id: crypto.randomUUID(), role: "notice", content: "Não consegui falar com o servidor. Sua mensagem ficou no rascunho; tente de novo." }]);
        setDraft(message);
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
      if (spoke && speaker) speaker.flush();
      else setMode("idle");
    }
  }, [busy, conversationId, prefs.voice, refreshPending, speaker]);

  const sendRef = useRef(send);
  const listenRef = useRef(listen);
  useEffect(() => { sendRef.current = send; listenRef.current = listen; }, [send, listen]);

  function micClick() {
    speaker?.unlock();
    if (listening) { recRef.current?.stop(); return; }
    if (busy) { abortRef.current?.abort(); speaker?.cancel(); setMode("idle"); return; }
    speaker?.cancel();
    listen();
  }

  function newConversation() {
    abortRef.current?.abort();
    speaker?.cancel();
    setConversationId(null);
    setMessages([]);
    setMode("idle");
  }

  const stateLabel = { idle: "Em repouso", listening: "Escutando", thinking: "Pensando", speaking: "Respondendo" }[mode];

  return (
    <div className="shell dots">
      <header className="top">
        <span className="brand">Gadu</span>
        <span className={`mono state ${mode === "thinking" ? "hot" : ""}`}><i />{stateLabel}</span>
      </header>
      {!online && <div className="banner" role="status">Sem internet. O app continua aberto e as mensagens ficam no rascunho.</div>}

      {tab === "conversa" && (
        <main className="main chat">
          <section className="face" aria-label="Rosto do Gadu"><RobotFace mode={mode} /></section>
          <div className="log" ref={logRef} aria-live="polite">
            {messages.length === 0 && (
              <div className="msg-b">
                <div className="mono via">Gadu</div>
                Oi{props.name ? `, ${props.name}` : ""}. Toque no microfone e fale, ou escreva. Tudo o que eu aprender sobre você passa pela sua aprovação antes de virar memória.
              </div>
            )}
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="msg-u">{m.content}</div>
              ) : m.role === "notice" ? (
                <div key={m.id} className="notice" role="status">{m.content}</div>
              ) : (
                <div key={m.id} className="msg-b">
                  <div className="mono via">Gadu{m.via ? ` · via ${m.via}` : ""}</div>
                  {m.content || "…"}
                </div>
              ),
            )}
          </div>
          <form
            className="composer"
            onSubmit={(e) => { e.preventDefault(); void send(draft); }}
          >
            <button type="button" className={`mic ${listening ? "on" : ""}`} onClick={micClick} aria-label={listening ? "Parar de ouvir" : busy ? "Parar resposta" : "Falar"} disabled={!voiceOk && !busy} title={voiceOk ? "" : "Este navegador não tem reconhecimento de voz. Use o ditado do teclado."}>
              {busy && !listening ? (
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" fill="currentColor" /></svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M12 3.5a3 3 0 0 0-3 3V12a3 3 0 0 0 6 0V6.5a3 3 0 0 0-3-3zM5.5 12a6.5 6.5 0 0 0 13 0M12 18.5V21" /></svg>
              )}
            </button>
            <label className="sr" htmlFor="msg">Mensagem</label>
            <textarea
              id="msg"
              className="field"
              rows={1}
              value={draft}
              placeholder={listening ? "Escutando…" : "Fale ou escreva"}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 900) { e.preventDefault(); void send(draft); } }}
              maxLength={4000}
            />
            <button type="submit" className="btn btn-pri send" aria-label="Enviar" disabled={busy || !draft.trim()}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4.5 12h15M13 5.5l6.5 6.5-6.5 6.5" /></svg>
            </button>
          </form>
        </main>
      )}

      {tab === "memoria" && <MemoryPage blocked={props.initialBlocked} onChange={refreshPending} />}
      {tab === "ajustes" && (
        <SettingsPage
          email={props.email}
          version={props.version}
          prefs={prefs}
          setPrefs={setPrefs}
          voiceOk={voiceOk}
          onNew={() => { newConversation(); setTab("conversa"); }}
          initialBlocked={props.initialBlocked}
        />
      )}

      <nav className="tabs" aria-label="Navegação">
        {(["conversa", "memoria", "ajustes"] as Tab[]).map((t) => (
          <button key={t} className="tab" aria-current={tab === t ? "page" : undefined} onClick={() => setTab(t)}>
            {t === "conversa" ? "Conversa" : t === "memoria" ? "Memória" : "Ajustes"}
            {t === "memoria" && pending > 0 && <b className="badge">{pending}</b>}
          </button>
        ))}
      </nav>
    </div>
  );
}

function MemoryPage({ blocked, onChange }: { blocked: string[]; onChange: () => void }) {
  const [items, setItems] = useState<Memory[] | null>(null);
  const [text, setText] = useState("");
  const [area, setArea] = useState(AREAS[3]);
  const [error, setError] = useState("");
  const db = supabaseBrowser();

  const load = useCallback(async () => {
    const { data, error } = await db.from("memories").select("id, content, area, origin, status").order("created_at", { ascending: false }).limit(300);
    if (error) setError("Não consegui carregar a memória. Puxe para atualizar ou tente de novo.");
    setItems((data as Memory[]) ?? []);
    onChange();
  }, [db, onChange]);
  useEffect(() => { void load(); }, [load]);

  const hit = (t: string) => blocked.find((b) => b && t.toLowerCase().includes(b.toLowerCase()));
  const pending = (items ?? []).filter((m) => m.status === "pending");
  const approved = (items ?? []).filter((m) => m.status === "approved");

  async function act(fn: () => PromiseLike<{ error: unknown }>) {
    const { error } = await fn();
    if (error) setError("A alteração não foi salva. Tente de novo.");
    await load();
  }

  return (
    <main className="page">
      <p className="muted" style={{ margin: 0 }}>A memória é do Gadu, não das IAs. Tudo entra como pendente e só vale depois que você aprova.</p>
      {error && <div className="notice" role="alert">{error}</div>}
      <section className="card">
        <h2 style={{ color: "var(--hot)" }}>Para revisar</h2>
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
      <section className="card">
        <h2>O que eu sei sobre você</h2>
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

function SettingsPage(props: {
  email: string;
  version: string;
  prefs: { voice: boolean; handsFree: boolean };
  setPrefs: (p: { voice: boolean; handsFree: boolean }) => void;
  voiceOk: boolean;
  onNew: () => void;
  initialBlocked: string[];
}) {
  const [blocked, setBlocked] = useState<string[]>(props.initialBlocked);
  const [term, setTerm] = useState("");
  const [saved, setSaved] = useState("");
  const db = supabaseBrowser();

  async function saveBlocked(next: string[]) {
    setBlocked(next);
    const { data: auth } = await db.auth.getUser();
    if (!auth.user) return;
    const { data } = await db.from("profiles").select("settings").eq("id", auth.user.id).maybeSingle();
    const settings = { ...((data?.settings as object) ?? {}), blocked: next };
    const { error } = await db.from("profiles").update({ settings }).eq("id", auth.user.id);
    setSaved(error ? "Não salvou. Tente de novo." : "Salvo.");
  }

  return (
    <main className="page">
      <section className="card">
        <h2>Voz</h2>
        <label className="switch"><span>Gadu responde falando</span><input type="checkbox" checked={props.prefs.voice} onChange={(e) => props.setPrefs({ ...props.prefs, voice: e.target.checked })} /></label>
        <label className="switch"><span>Modo conversa (volta a ouvir depois de responder)</span><input type="checkbox" checked={props.prefs.handsFree} disabled={!props.voiceOk} onChange={(e) => props.setPrefs({ ...props.prefs, handsFree: e.target.checked })} /></label>
        {!props.voiceOk && <p className="muted" style={{ margin: 0 }}>Este navegador não reconhece voz. No celular, use o Chrome (Android) ou o Safari (iPhone), ou o ditado do teclado.</p>}
      </section>
      <section className="card">
        <h2>Termos bloqueados</h2>
        <p className="muted" style={{ margin: 0 }}>Memórias com estes termos não podem ser aprovadas. Use para o nome da empresa e assuntos corporativos.</p>
        <div className="row">{blocked.length ? blocked.map((b) => <button key={b} className="chip" onClick={() => saveBlocked(blocked.filter((x) => x !== b))} aria-label={`Remover ${b}`}>{b} ×</button>) : <span className="muted">Nenhum termo ainda.</span>}</div>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <label className="sr" htmlFor="term">Novo termo</label>
          <input id="term" className="field" value={term} maxLength={60} placeholder="Ex.: nome da empresa" onChange={(e) => setTerm(e.target.value)} />
          <button className="btn" disabled={!term.trim()} onClick={() => { void saveBlocked([...new Set([...blocked, term.trim()])]); setTerm(""); }}>Bloquear</button>
        </div>
        {saved && <span className="muted" role="status">{saved}</span>}
      </section>
      <section className="card">
        <h2>Conta</h2>
        <div>{props.email}</div>
        <div className="row">
          <button className="btn" onClick={props.onNew}>Nova conversa</button>
          <form action="/auth/signout" method="post"><button className="btn" type="submit">Sair</button></form>
        </div>
        <div className="mono muted">Gadu {props.version}</div>
      </section>
    </main>
  );
}
