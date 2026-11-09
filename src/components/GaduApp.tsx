"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Visual } from "./RobotFace";
import type { FaceMode } from "./robot-engine";
import { canListen, canSpeak, createRecognizer, Speaker } from "@/lib/speech";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ConversationsDrawer } from "./ConversationsDrawer";
import { MemoryPage } from "./MemoryPage";
import { SettingsPage, type Prefs } from "./SettingsPage";

export type Msg = { id: string; role: "user" | "assistant" | "notice"; content: string; via?: string };
type Tab = "conversa" | "memoria" | "ajustes";

const LS_DRAFT = "gadu.draft";
const LS_PREFS = "gadu.prefs";
const DEFAULT_PREFS: Prefs = { voice: true, handsFree: false, voiceURI: "", rate: 1 };

function readPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(LS_PREFS) || "{}");
    const rate = Number(p.rate);
    return {
      voice: p.voice !== false,
      handsFree: Boolean(p.handsFree),
      voiceURI: typeof p.voiceURI === "string" ? p.voiceURI : "",
      rate: Number.isFinite(rate) && rate >= 0.7 && rate <= 1.6 ? rate : 1,
    };
  } catch {
    return DEFAULT_PREFS;
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
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [drawer, setDrawer] = useState(false);
  const [pending, setPending] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const speaker = useMemo(() => (typeof window === "undefined" ? null : new Speaker()), []);
  const recRef = useRef<ReturnType<typeof createRecognizer>>(null);
  const handsFreeRef = useRef(false);
  // Detectado só no aparelho (no servidor não existe reconhecimento de voz).
  const [voiceOk, setVoiceOk] = useState(false);

  // Preferências e rascunho ficam no aparelho.
  useEffect(() => {
    setPrefs(readPrefs());
    setVoiceOk(canListen());
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
    if (speaker) speaker.prefs = { voiceURI: prefs.voiceURI, rate: prefs.rate };
  }, [prefs, speaker]);
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
        const text: Record<string, string> = {
          "not-allowed": "O microfone está bloqueado. Libere o microfone para este site nas configurações do navegador.",
          "service-not-allowed": "O microfone está bloqueado. Libere o microfone para este site nas configurações do navegador.",
          "audio-capture": "Não encontrei um microfone neste aparelho.",
          network: "O reconhecimento de voz precisa de internet. Confira a conexão e tente de novo.",
        };
        if (text[code]) setMessages((ms) => [...ms, { id: crypto.randomUUID(), role: "notice", content: text[code] }]);
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
    if (!voiceOk && !busy) {
      setMessages((ms) => [...ms, { id: crypto.randomUUID(), role: "notice", content: "Este navegador não reconhece voz. Use o Chrome (Android ou computador) ou o Safari (iPhone), ou o microfone do teclado." }]);
      return;
    }
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

  async function openConversation(id: number) {
    abortRef.current?.abort();
    speaker?.cancel();
    setMode("idle");
    const { data, error } = await supabaseBrowser()
      .from("messages")
      .select("id, role, content, provider")
      .eq("conversation_id", id)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) {
      setMessages((ms) => [...ms, { id: crypto.randomUUID(), role: "notice", content: "Não consegui abrir essa conversa. Tente de novo." }]);
      return;
    }
    setConversationId(id);
    setMessages(((data ?? []) as { id: number; role: string; content: string; provider: string | null }[]).reverse().map((m) => ({ id: String(m.id), role: m.role as "user" | "assistant", content: m.content as string, via: (m.provider as string) || undefined })));
    setTab("conversa");
    setDrawer(false);
  }

  const stateLabel = { idle: "Em repouso", listening: "Escutando", thinking: "Pensando", speaking: "Respondendo" }[mode];

  return (
    <div className="shell dots">
      <header className="top">
        <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
          <button className="icon-btn" onClick={() => setDrawer(true)} aria-label="Conversas anteriores" aria-expanded={drawer}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10" /></svg>
          </button>
          <span className="brand">Gadu</span>
        </div>
        <span className={`mono state ${mode === "thinking" ? "hot" : ""}`}><i />{stateLabel}</span>
      </header>
      {!online && <div className="banner" role="status">Sem internet. O app continua aberto e as mensagens ficam no rascunho.</div>}

      {tab === "conversa" && (
        <main className="main chat">
          <section className="face" aria-label="Cérebro do Gadu">
            <Visual kind="brain" mode={mode} label="Cérebro do Gadu" />
            <div className={`mini ${mode !== "idle" ? "on" : ""}`} aria-hidden="true"><Visual kind="bot" mode={mode} compact label="Robô do Gadu" /></div>
          </section>
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
            <button type="button" className={`mic ${listening ? "on" : ""}`} onClick={micClick} aria-label={listening ? "Parar de ouvir" : busy ? "Parar resposta" : "Falar"} >
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

      {tab === "memoria" && <MemoryPage blocked={props.initialBlocked} onChange={refreshPending} onOpenConversation={openConversation} />}
      {tab === "ajustes" && (
        <SettingsPage
          email={props.email}
          version={props.version}
          prefs={prefs}
          setPrefs={setPrefs}
          voiceOk={voiceOk}
          speaker={speaker}
          onNew={() => { newConversation(); setTab("conversa"); }}
          initialBlocked={props.initialBlocked}
        />
      )}

      {drawer && (
        <ConversationsDrawer
          currentId={conversationId}
          onClose={() => setDrawer(false)}
          onOpen={openConversation}
          onNew={() => { newConversation(); setTab("conversa"); setDrawer(false); }}
          onDeleted={(id) => { if (id === conversationId) newConversation(); }}
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

