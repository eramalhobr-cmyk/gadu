"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "./RobotFace";
import { EventCard, type EventDraft } from "./EventCard";
import { AdminPage } from "./AdminPage";
import type { FaceMode } from "./robot-engine";
import { canListen, canSpeak, createRecognizer, Speaker } from "@/lib/speech";
import { chatErrorMessage, micErrorMessage } from "@/lib/errors";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ConversationsDrawer } from "./ConversationsDrawer";
import { MemoryPage } from "./MemoryPage";
import { SettingsPage, type Prefs } from "./SettingsPage";
import { dueLabel, TodayPage } from "./TodayPage";
import { AgentsPage } from "./AgentsPage";
import { ProjectsPage } from "./ProjectsPage";
import { Icon } from "./ui";
import { TipCard } from "./TipCard";
import { TIP_IDS, type TipId } from "@/lib/tips";

export type Msg = { id: string; role: "user" | "assistant" | "notice" | "event"; content: string; via?: string; link?: { href: string; label: string }; event?: EventDraft };

const DEFAULT_MORNING = "https://open.spotify.com/search/Update%20Di%C3%A1rio/podcasts";
const QUICK = ["Começar o dia", "Como está minha agenda hoje?", "Tenho e-mails importantes?"];
const FLASH: Record<string, string> = {
  ok: "Google conectado. Agora posso ler sua agenda e seus e-mails (só leitura). Experimente: Começar o dia.",
  cancelado: "A conexão com o Google foi cancelada. Nada foi alterado.",
  permissoes: "Faltou marcar as permissões de Agenda e Gmail na tela do Google. Conecte de novo e marque as duas caixas.",
  config: "O Google ainda não está configurado no servidor. Siga o passo a passo para criar as credenciais.",
  erro: "Não consegui concluir a conexão com o Google. Tente de novo em Ajustes, Conexões.",
};
import { TABS, type Tab } from "@/lib/tabs";
export type { Tab };
const TAB_LABEL: Record<Tab, string> = { hoje: "Hoje", conversa: "Conversa", projetos: "Projetos", agentes: "Agentes", perfil: "Perfil" };
const TAB_ICON: Record<Tab, string> = { hoje: "sun", conversa: "chat", projetos: "grid", agentes: "agents", perfil: "user" };
type Target = { kind: "project" | "agent"; id: number; name: string } | null;

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
  morningLink: string;
  flash: string | null;
  initialTab: Tab;
  initialProfile: "memoria" | "ajustes" | "admin";
  autoStart: "briefing" | "review" | null;
  admin: boolean;
  seenTips: string[];
  /** Página de conteúdo (guia, como funciona) dentro do mesmo cabeçalho e menu. */
  page?: React.ReactNode;
}) {
  const [tab, setTabState] = useState<Tab>(props.initialTab);
  const [profileView, setProfileView] = useState<"memoria" | "ajustes" | "admin">(props.initialProfile);
  const [dock, setDock] = useState(false);
  const [pageOpen, setPageOpen] = useState(Boolean(props.page));
  // Com uma página de conteúdo aberta, nenhuma aba aparece; tocar numa aba volta ao app.
  const view: Tab | null = pageOpen ? null : tab;
  /** Troca de aba. Se estiver numa página de conteúdo, volta para o app e ajusta o endereço. */
  function setTab(t: Tab) {
    if (pageOpen) {
      setPageOpen(false);
      window.history.replaceState(null, "", `/app?tab=${t}`);
    }
    setTabState(t);
  }
  const [seen, setSeen] = useState<Set<string>>(() => new Set(props.seenTips));
  const [review, setReview] = useState(false);
  const [target, setTarget] = useState<Target>(null);
  const [projView, setProjView] = useState<"tarefas" | "projetos">("tarefas");
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
  // Aviso de volta da conexão com o Google (?google=...). Limpa o endereço depois.
  useEffect(() => {
    const text = props.flash ? FLASH[props.flash] : undefined;
    if (!text) return;
    setMessages((ms) => [...ms, { id: crypto.randomUUID(), role: "notice", content: text }]);
    window.history.replaceState(null, "", "/app");
  }, [props.flash]);

  const listen = useCallback(() => {
    if (!voiceOk || busy) return;
    speaker?.cancel();
    // Nunca dois microfones abertos ao mesmo tempo (toques repetidos ou modo conversa).
    try { recRef.current?.abort(); } catch {}
    // Avisos de um microfone antigo (já trocado) são ignorados.
    const mine = () => recRef.current === rec;
    const rec = createRecognizer({
      onText: (text, final) => {
        if (!mine()) return;
        setDraft(text);
        if (final && text) void sendRef.current(text);
      },
      onEnd: () => { if (!mine()) return; setListening(false); setMode((m) => (m === "listening" ? "idle" : m)); },
      onError: (code) => {
        if (!mine()) return;
        setListening(false);
        setMode("idle");
        const text = micErrorMessage(code);
        if (text) setMessages((ms) => [...ms, { id: crypto.randomUUID(), role: "notice", content: text }]);
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
        body: JSON.stringify({ message, conversationId, projectId: !conversationId && target?.kind === "project" ? target.id : null, agentId: !conversationId && target?.kind === "agent" ? target.id : null }),
        signal: ctrl.signal,
      });
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (!res.ok || !res.body) throw Object.assign(new Error("http"), { status: res.status || 500 });
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
          } else if (ev.t === "events") {
            const items = ev.items as EventDraft[];
            setMessages((ms) => [...ms, ...items.map((e) => ({ id: crypto.randomUUID(), role: "event" as const, content: e.title, event: e }))]);
          } else if (ev.t === "tasks") {
            const items = ev.items as { title: string; due: string | null }[];
            setMessages((ms) => [...ms, { id: crypto.randomUUID(), role: "notice", content: `${items.length === 1 ? "Tarefa anotada" : "Tarefas anotadas"}: ${items.map((t) => t.title).join("; ")}. Veja em Projetos › Tarefas.` }]);
          } else if (ev.t === "reminders") {
            const items = ev.items as { text: string; dueAt: string }[];
            const push = typeof Notification !== "undefined" && Notification.permission === "granted";
            const list = items.map((r) => `${r.text} (${dueLabel(r.dueAt)})`).join("; ");
            setMessages((ms) => [...ms, {
              id: crypto.randomUUID(), role: "notice",
              content: `${items.length === 1 ? "Lembrete criado" : "Lembretes criados"}: ${list}.${push ? "" : " Ative as notificações em Ajustes para receber o aviso no celular."}`,
            }]);
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
        // Contingência: uma nova tentativa automática se a rede caiu (ou o servidor falhou) antes de responder.
        // Erros da própria mensagem (4xx) não melhoram tentando de novo.
        const st = (e as { status?: number }).status ?? 0;
        if (ctrl.signal.aborted || answer || (st >= 400 && st < 500)) throw e;
        await new Promise((r) => setTimeout(r, 800));
        await attempt();
      }
      if (answer && /^come[cç]ar o dia\b/i.test(message)) {
        setMessages((ms) => [...ms, { id: crypto.randomUUID(), role: "notice", content: "Quer ouvir as notícias agora?", link: { href: props.morningLink || DEFAULT_MORNING, label: "Ouvir o Update Diário" } }]);
      }
    } catch (e) {
      if (!ctrl.signal.aborted) {
        setMessages((ms) => [...ms, { id: crypto.randomUUID(), role: "notice", content: chatErrorMessage((e as { status?: number }).status ?? 0) }]);
        setDraft(message);
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
      if (spoke && speaker) speaker.flush();
      else {
        setMode("idle");
        // Modo conversa com a voz da resposta desligada: volta a ouvir mesmo assim.
        if (answer && !ctrl.signal.aborted && handsFreeRef.current) setTimeout(() => listenRef.current(), 600);
      }
    }
  }, [busy, conversationId, prefs.voice, refreshPending, speaker, props.morningLink, target]);

  const sendRef = useRef(send);
  const listenRef = useRef(listen);
  useEffect(() => { sendRef.current = send; listenRef.current = listen; }, [send, listen]);

  // Toque na notificação da manhã (/app?start=briefing): abre a conversa e começa o dia.
  const started = useRef(false);
  useEffect(() => {
    if (!props.autoStart || started.current) return;
    started.current = true;
    window.history.replaceState(null, "", "/app");
    if (props.autoStart === "review") { setTab("hoje"); setReview(true); return; }
    setTab("conversa");
    setTimeout(() => void sendRef.current("Começar o dia"), 300);
  }, [props.autoStart]);

  // Dicas da primeira visita: marcadas no perfil para não repetir em outro aparelho.
  async function saveTips(next: string[]) {
    const db = supabaseBrowser();
    const { data: auth } = await db.auth.getUser();
    if (!auth.user) return;
    const { data } = await db.from("profiles").select("settings").eq("id", auth.user.id).maybeSingle();
    await db.from("profiles").update({ settings: { ...((data?.settings as object) ?? {}), tips: next } }).eq("id", auth.user.id);
  }
  function markTip(id: TipId) {
    const next = new Set(seen).add(id);
    setSeen(next);
    void saveTips([...next].filter((x) => (TIP_IDS as string[]).includes(x)));
  }
  function resetTips() {
    setSeen(new Set());
    void saveTips([]);
  }

  // Voz flutuante: fala com o GaDu de qualquer tela, sem sair dela.
  function dockTalk() {
    setDock(true);
    micClick();
  }

  function startDay() {
    speaker?.unlock();
    setTab("conversa");
    void send("Começar o dia");
  }
  function talk() {
    setTab("conversa");
    micClick();
  }

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

  function newConversation(next: Target = null) {
    abortRef.current?.abort();
    speaker?.cancel();
    setConversationId(null);
    setMessages([]);
    setMode("idle");
    setTarget(next);
  }

  /** Nova conversa sobre um projeto ou com um agente. */
  function talkAbout(next: NonNullable<Target>) {
    newConversation(next);
    setTab("conversa");
  }

  async function openConversation(id: number) {
    abortRef.current?.abort();
    speaker?.cancel();
    setMode("idle");
    const db = supabaseBrowser();
    void db.from("conversations").select("project_id, agent_id, projects(name), agents(name)").eq("id", id).maybeSingle().then(({ data: c }: { data: unknown }) => {
      const row = c as unknown as { project_id: number | null; agent_id: number | null; projects: { name: string } | null; agents: { name: string } | null } | null;
      setTarget(row?.agent_id && row.agents ? { kind: "agent", id: row.agent_id, name: row.agents.name } : row?.project_id && row.projects ? { kind: "project", id: row.project_id, name: row.projects.name } : null);
    });
    const { data, error } = await db
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
          <span className="brand">GaDu</span>
        </div>
        <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
          <span className={`mono state ${mode === "thinking" ? "hot" : ""}`}><i />{stateLabel}</span>
          <a className="icon-btn help-btn" href="/app/guia" aria-label="Guia do GaDu" title="Guia do GaDu">?</a>
        </div>
      </header>
      {!online && <div className="banner" role="status">Sem internet. O app continua aberto e as mensagens ficam no rascunho.</div>}
      {view && !seen.has(view) && <TipCard key={view} id={view} onDone={() => markTip(view)} />}
      {pageOpen && <main className="page doc-page">{props.page}</main>}

      {view === "conversa" && (
        <main className="main chat">
          <section className="face" aria-label="GaDu">
            <Avatar mode={mode} label={`GaDu: ${stateLabel}`} />
          </section>
          {target && (
            <div className="target-pill">
              <span className="mono">{target.kind === "agent" ? "Agente" : "Projeto"}</span>
              <b>{target.name}</b>
              {!conversationId && <button className="link-btn" onClick={() => setTarget(null)} aria-label="Conversar sem agente ou projeto">×</button>}
            </div>
          )}
          <div className="log" ref={logRef} aria-live="polite">
            {!messages.some((m) => m.role !== "notice") && (
              <div className="msg-b">
                <div className="mono via">GaDu</div>
                Oi{props.name ? `, ${props.name}` : ""}. Toque no microfone e fale, ou escreva. Tudo o que eu aprender sobre você passa pela sua aprovação antes de virar memória.
              </div>
            )}
            {!messages.some((m) => m.role !== "notice") && (
              <div className="row quick" aria-label="Atalhos">
                {QUICK.map((q) => (
                  <button key={q} className="chip" disabled={busy} onClick={() => { speaker?.unlock(); void send(q); }}>{q}</button>
                ))}
              </div>
            )}
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="msg-u">{m.content}</div>
              ) : m.role === "event" && m.event ? (
                <EventCard key={m.id} ev={m.event} />
              ) : m.role === "notice" ? (
                <div key={m.id} className="notice" role="status">
                  {m.content}
                  {m.link && <div style={{ marginTop: 8 }}><a className="btn btn-sm" href={m.link.href} target="_blank" rel="noopener noreferrer">{m.link.label}</a></div>}
                </div>
              ) : (
                <div key={m.id} className="msg-b">
                  <div className="mono via">GaDu{m.via ? ` · via ${m.via}` : ""}</div>
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

      {view === "hoje" && (
        <TodayPage review={review} onReviewDone={() => setReview(false)} onDock={dockTalk} onWrite={() => setTab("conversa")} name={props.name} pendingMemories={pending} busy={busy} onStartDay={startDay} onTalk={talk} onOpenMemory={() => { setProfileView("memoria"); setTab("perfil"); }} onOpenTasks={() => { setProjView("tarefas"); setTab("projetos"); }} onAsk={(q) => { speaker?.unlock(); setTab("conversa"); void send(q); }} />
      )}
      {view === "projetos" && <ProjectsPage key={projView} initialView={projView} onTalk={(p) => talkAbout({ kind: "project", ...p })} />}
      {view === "agentes" && <AgentsPage onTalk={(a) => talkAbout({ kind: "agent", ...a })} />}
      {view === "perfil" && (
        <div className="seg seg-top" role="tablist" aria-label="Perfil">
          {(props.admin ? (["memoria", "ajustes", "admin"] as const) : (["memoria", "ajustes"] as const)).map((v) => (
            <button key={v} role="tab" aria-selected={profileView === v} onClick={() => setProfileView(v)}>
              {v === "memoria" ? "Memória" : v === "ajustes" ? "Ajustes" : "Admin"}{v === "memoria" && pending > 0 ? ` · ${pending}` : ""}
            </button>
          ))}
        </div>
      )}
      {view === "perfil" && profileView === "memoria" && <MemoryPage blocked={props.initialBlocked} onChange={refreshPending} onOpenConversation={openConversation} />}
      {view === "perfil" && profileView === "admin" && props.admin && <AdminPage />}
      {view === "perfil" && profileView === "ajustes" && (
        <SettingsPage
          email={props.email}
          version={props.version}
          prefs={prefs}
          setPrefs={setPrefs}
          voiceOk={voiceOk}
          speaker={speaker}
          onNew={() => { newConversation(); setTab("conversa"); }}
          initialBlocked={props.initialBlocked}
          morningLink={props.morningLink}
          onResetTips={resetTips}
        />
      )}

      {view !== "conversa" && (
        <VoiceDock
          open={dock}
          mode={mode}
          listening={listening}
          busy={busy}
          draft={draft}
          last={[...messages].reverse().find((m) => m.role === "assistant" || m.role === "notice")}
          tip={!seen.has("voz")}
          onTipDone={() => markTip("voz")}
          onTalk={dockTalk}
          onStop={() => { if (listening) recRef.current?.stop(); else { abortRef.current?.abort(); speaker?.cancel(); setMode("idle"); } }}
          onOpen={() => { setDock(false); setTab("conversa"); }}
          onClose={() => setDock(false)}
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
        {TABS.map((t) => (
          <button key={t} className="tab" aria-current={view === t ? "page" : undefined} onClick={() => setTab(t)}>
            <Icon name={TAB_ICON[t]} size={20} />
            {TAB_LABEL[t]}
            {t === "perfil" && pending > 0 && <b className="badge">{pending}</b>}
          </button>
        ))}
      </nav>
    </div>
  );
}


/** Botão de voz flutuante e painel compacto: ouvir, ver a resposta e continuar, em qualquer tela. */
function VoiceDock(props: { tip: boolean; onTipDone: () => void; open: boolean; mode: FaceMode; listening: boolean; busy: boolean; draft: string; last?: Msg; onTalk: () => void; onStop: () => void; onOpen: () => void; onClose: () => void }) {
  const active = props.listening || props.busy || props.mode === "speaking";
  const label = props.listening ? "Escutando…" : props.mode === "thinking" ? "Pensando…" : props.mode === "speaking" ? "Respondendo…" : "Toque para falar";
  return (
    <>
      {props.open && (
        <div className="dock" role="dialog" aria-label="Falar com o GaDu">
          {props.tip && <TipCard id="voz" floating onDone={props.onTipDone} />}
          <div className="dock-head">
            <span className={`mono state ${props.mode === "thinking" ? "hot" : ""}`}><i />{label}</span>
            <button className="icon-btn" onClick={props.onClose} aria-label="Fechar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
          {props.listening && props.draft && <div className="msg-u" style={{ alignSelf: "flex-end" }}>{props.draft}</div>}
          {props.last && !props.listening && (
            <div className={props.last.role === "notice" ? "notice" : "msg-b dock-answer"}>{props.last.content || "…"}</div>
          )}
          <div className="row" style={{ flexWrap: "nowrap" }}>
            {active ? <button className="btn btn-sm" onClick={props.onStop}>Parar</button> : <button className="btn btn-sm btn-pri" onClick={props.onTalk}>Falar de novo</button>}
            <button className="btn btn-sm" onClick={props.onOpen}>Abrir conversa</button>
          </div>
        </div>
      )}
      <button className={`fab ${active ? "on" : ""}`} onClick={active ? props.onStop : props.onTalk} aria-label={active ? "Parar" : "Falar com o GaDu"}>
        {active && !props.listening ? (
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M12 3.5a3 3 0 0 0-3 3V12a3 3 0 0 0 6 0V6.5a3 3 0 0 0-3-3zM5.5 12a6.5 6.5 0 0 0 13 0M12 18.5V21" /></svg>
        )}
      </button>
    </>
  );
}
