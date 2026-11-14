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
import { AgendaView } from "./AgendaView";
import { Icon } from "./ui";
import { TipCard } from "./TipCard";
import { TIP_IDS, type TipId } from "@/lib/tips";
import { Assistant } from "./Assistant";
import { ModulePage, StatusPill } from "./ModulePage";
import { colorVar } from "./ui";
import { contextOf } from "@/lib/assistant-context";
import { isOverview, MODULES, moduleOf, viewDef, type ViewId } from "@/lib/modules";
import { applyTheme, readTheme, type Theme } from "@/lib/theme";

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
/** Dica da primeira visita de cada tela. */
const TIP_OF: Partial<Record<ViewId, TipId>> = { hoje: "hoje", conversa: "conversa", tarefas: "projetos", projetos: "projetos", agentes: "agentes", memoria: "perfil", ajustes: "perfil" };
const LS_ASSIST = "gadu.assist";
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
  initialView: ViewId;
  initialTheme: Theme;
  autoStart: "briefing" | "review" | null;
  admin: boolean;
  seenTips: string[];
  /** Página de conteúdo (guia, como funciona) dentro do mesmo cabeçalho e menu. */
  page?: React.ReactNode;
}) {
  const [tab, setTabState] = useState<ViewId>(props.initialView);
  const [assist, setAssist] = useState(false);
  const [assistFull, setAssistFull] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [theme, setTheme] = useState<Theme>(props.initialTheme);
  const [pageOpen, setPageOpen] = useState(Boolean(props.page));
  // Com uma página de conteúdo aberta, nenhuma aba aparece; tocar numa aba volta ao app.
  const view: ViewId | null = pageOpen ? null : tab;
  /** Troca de aba. Se estiver numa página de conteúdo, volta para o app e ajusta o endereço. */
  function setTab(t: ViewId) {
    if (t === "admin" && !props.admin) t = "ajustes";
    setPageOpen(false);
    window.history.replaceState(null, "", `/app?tab=${t}`);
    setSheet(false);
    setTabState(t);
  }
  function openAssist(on: boolean) {
    setAssist(on);
    if (!on) setAssistFull(false);
    try { localStorage.setItem(LS_ASSIST, on ? "1" : "0"); } catch {}
  }
  function toggleTheme(next?: Theme) {
    const t = next ?? (theme === "dark" ? "light" : "dark");
    setTheme(t);
    applyTheme(t);
  }
  const [seen, setSeen] = useState<Set<string>>(() => new Set(props.seenTips));
  const [review, setReview] = useState(false);
  const [target, setTarget] = useState<Target>(null);
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
    setTheme(readTheme(props.initialTheme));
    // Assistente: aberto por padrão em telas largas; depois vale a escolha da pessoa.
    try {
      const saved = localStorage.getItem(LS_ASSIST);
      setAssist(saved ? saved === "1" : window.innerWidth >= 1360);
    } catch {}
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
        body: JSON.stringify({ message, conversationId, context: contextOf(tabRef.current), projectId: !conversationId && target?.kind === "project" ? target.id : null, agentId: !conversationId && target?.kind === "agent" ? target.id : null }),
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

  const tabRef = useRef(tab);
  useEffect(() => { tabRef.current = tab; }, [tab]);
  const sendRef = useRef(send);
  const listenRef = useRef(listen);
  useEffect(() => { sendRef.current = send; listenRef.current = listen; }, [send, listen]);

  // Toque na notificação da manhã (/app?start=briefing): abre a conversa e começa o dia.
  const started = useRef(false);
  useEffect(() => {
    if (!props.autoStart || started.current) return;
    started.current = true;
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
    openAssist(true);
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
  const active = listening || busy || mode === "speaking";
  const mod = view ? moduleOf(view) : null;
  const title = view ? viewDef(view).label : "Ajuda";
  const tip = view ? TIP_OF[view] : undefined;
  const showAssist = assist && view !== "conversa";
  const stop = () => { if (listening) recRef.current?.stop(); else { abortRef.current?.abort(); speaker?.cancel(); setMode("idle"); } };
  const initial = (props.name || props.email || "G").trim().charAt(0).toUpperCase();

  /** Menu de módulos: o mesmo no computador (lateral) e no celular (folha). */
  const moduleNav = (
    <div className="nav-scroll">
      {MODULES.filter((m) => m.status !== "planejado").map((m) => (
        <div className="nav-mod" key={m.id} style={{ ["--c" as string]: colorVar(m.color) }}>
          <div className="nav-mod-head"><i className="dot" aria-hidden="true" /><span className="name">{m.name}</span>{m.status !== "disponivel" && <StatusPill status={m.status} />}</div>
          {m.views.filter((v) => !v.adminOnly || props.admin).map((v) => (
            <button key={v.id} className="nav-item" aria-current={view === v.id ? "page" : undefined} onClick={() => setTab(v.id)}>
              <Icon name={v.icon} size={19} />
              <span>{v.label}</span>
              {v.id === "memoria" && pending > 0 && <b className="nav-badge" aria-label={`${pending} memórias para revisar`}>{pending}</b>}
            </button>
          ))}
        </div>
      ))}
      <div className="nav-mod">
        <div className="nav-mod-head"><span className="name">No plano</span></div>
        {MODULES.filter((m) => m.status === "planejado").map((m) => (
          <button key={m.id} className="nav-item soon" aria-current={view === m.views[0].id ? "page" : undefined} onClick={() => setTab(m.views[0].id)} style={{ ["--c" as string]: colorVar(m.color) }}>
            <Icon name={m.icon} size={19} />
            <span>{m.id === "studio" ? "Studio" : m.name}</span>
            <StatusPill status={m.status} />
          </button>
        ))}
      </div>
    </div>
  );
  const navFoot = (
    <div className="nav-foot">
      <button className="nav-item" onClick={() => { setSheet(false); setDrawer(true); }} aria-expanded={drawer}><Icon name="history" size={19} /><span>Conversas anteriores</span></button>
      <a className="nav-item" href="/app/guia"><Icon name="book" size={19} /><span>Guia e como funciona</span></a>
      <div className="nav-user">
        <span className="initial" aria-hidden="true">{initial}</span>
        <span className="who"><b>{props.name || "Você"}</b><small>{props.email}</small></span>
        <button className="icon-btn" onClick={() => toggleTheme()} aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"} title={theme === "dark" ? "Tema claro" : "Tema escuro"}><Icon name={theme === "dark" ? "sun" : "moon"} /></button>
      </div>
    </div>
  );

  return (
    <div className={`app ${showAssist ? "with-assist" : ""}`}>
      <a className="skip" href="#conteudo">Pular para o conteúdo</a>

      <aside className="nav on-dark" aria-label="Módulos">
        <a className="nav-brand" href="/app" aria-label="GaDu, início">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/avatar/logo-96.webp" alt="" width={40} height={40} />
          <span className="brand">GaDu</span>
        </a>
        <button className="btn btn-pri" onClick={() => { newConversation(); setTab("conversa"); }}><Icon name="plus" size={18} />Nova conversa</button>
        {moduleNav}
        {navFoot}
      </aside>

      <div className="frame">
        <header className="bar">
          <a className="bar-brand" href="/app" aria-label="GaDu, início">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/avatar/logo-96.webp" alt="" width={32} height={32} />
          </a>
          <div className="bar-title">
            {mod && <span className="crumb">{mod.name}</span>}
            <h1>{title}</h1>
          </div>
          <div className="bar-actions">
            <span className={`mono state ${mode === "thinking" ? "hot" : ""}`}><i />{stateLabel}</span>
            <button className="icon-btn" onClick={() => toggleTheme()} aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}><Icon name={theme === "dark" ? "sun" : "moon"} /></button>
            {view !== "conversa" && (
              <button className="icon-btn" onClick={() => openAssist(!assist)} aria-label={assist ? "Fechar o assistente" : "Abrir o assistente"} aria-pressed={assist}><Icon name="panel" /></button>
            )}
            <a className="icon-btn" href="/app/guia" aria-label="Guia do GaDu" title="Guia do GaDu"><b aria-hidden="true">?</b></a>
          </div>
        </header>
        {!online && <div className="banner" role="status">Sem internet. O app continua aberto e as mensagens ficam no rascunho.</div>}
        {tip && !seen.has(tip) && <TipCard key={tip} id={tip} onDone={() => markTip(tip)} />}
        {pageOpen && <main className="page doc-page" id="conteudo">{props.page}</main>}

        {view === "conversa" && (
          <main className="chat2" id="conteudo">
            <aside className="chat-stage on-dark" aria-label="GaDu">
              <div className="chat-ava"><Avatar mode={mode} label={`GaDu: ${stateLabel}`} /></div>
              <div className="meta">
                <b>GaDu</b>
                <span className={`mono state ${mode === "thinking" ? "hot" : ""}`} style={{ display: "inline-flex" }}><i />{stateLabel}</span>
                {target && (
                  <div className="target-pill">
                    <span className="mono">{target.kind === "agent" ? "Agente" : "Projeto"}</span>
                    <b>{target.name}</b>
                    {!conversationId && <button className="link-btn" onClick={() => setTarget(null)} aria-label="Conversar sem agente ou projeto">×</button>}
                  </div>
                )}
                <div className="acts">
                  <button className="btn btn-sm" onClick={() => newConversation()}><Icon name="plus" size={16} />Nova</button>
                  <button className="btn btn-sm" onClick={() => setDrawer(true)}><Icon name="history" size={16} />Histórico</button>
                </div>
              </div>
              <div className="sugs" aria-label="Atalhos">
                {QUICK.map((q) => <button key={q} className="chip" disabled={busy} onClick={() => { speaker?.unlock(); void send(q); }}>{q}</button>)}
              </div>
            </aside>
            <section className="chat-col">
              <div className="chat-log" ref={logRef} aria-live="polite">
                {!messages.some((m) => m.role !== "notice") && (
                  <>
                    <div className="bub b"><span className="via">GaDu</span>Oi{props.name ? `, ${props.name}` : ""}. Toque no microfone e fale, ou escreva. Tudo o que eu aprender sobre você passa pela sua aprovação antes de virar memória.</div>
                    <div className="row quick" aria-label="Atalhos">
                      {QUICK.map((q) => <button key={q} className="chip" disabled={busy} onClick={() => { speaker?.unlock(); void send(q); }}>{q}</button>)}
                    </div>
                  </>
                )}
                {messages.map((m) =>
                  m.role === "user" ? <div key={m.id} className="bub u">{m.content}</div>
                  : m.role === "event" && m.event ? <EventCard key={m.id} ev={m.event} />
                  : m.role === "notice" ? (
                    <div key={m.id} className="notice" role="status">
                      {m.content}
                      {m.link && <div style={{ marginTop: 8 }}><a className="btn btn-sm" href={m.link.href} target="_blank" rel="noopener noreferrer">{m.link.label}</a></div>}
                    </div>
                  ) : <div key={m.id} className="bub b"><span className="via">GaDu{m.via ? ` · via ${m.via}` : ""}</span>{m.content || "…"}</div>,
                )}
              </div>
              <form className="chat-form" onSubmit={(e) => { e.preventDefault(); void send(draft); }}>
                <div className="chat-box">
                  <button type="button" className={`round ${listening ? "on" : ""}`} onClick={micClick} aria-label={listening ? "Parar de ouvir" : busy ? "Parar resposta" : "Falar"}>
                    <Icon name={busy && !listening ? "stop" : "mic"} />
                  </button>
                  <label className="sr" htmlFor="msg">Mensagem</label>
                  <textarea id="msg" rows={1} value={draft} placeholder={listening ? "Escutando…" : "Fale ou escreva"} maxLength={4000}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 900) { e.preventDefault(); void send(draft); } }} />
                  <button type="submit" className="round pri" aria-label="Enviar" disabled={busy || !draft.trim()}><Icon name="send" /></button>
                </div>
              </form>
            </section>
          </main>
        )}

        {view === "hoje" && (
          <TodayPage review={review} onReviewDone={() => setReview(false)} onDock={dockTalk} onWrite={() => openAssist(true)} name={props.name} pendingMemories={pending} busy={busy} onStartDay={startDay} onTalk={talk}
            onOpenMemory={() => setTab("memoria")} onOpenTasks={() => setTab("tarefas")} onOpen={setTab}
            onAsk={(q) => { speaker?.unlock(); openAssist(true); void send(q); }} />
        )}
        {(view === "tarefas" || view === "projetos") && <ProjectsPage key={view} initialView={view} onTalk={(p) => talkAbout({ kind: "project", ...p })} />}
        {view === "agenda" && <main className="page" id="conteudo"><div className="wrap"><AgendaView onBack={() => setTab("hoje")} /></div></main>}
        {view === "agentes" && <AgentsPage onTalk={(a) => talkAbout({ kind: "agent", ...a })} />}
        {view && isOverview(view) && <ModulePage id={moduleOf(view).id} onOpen={setTab} />}
        {view === "memoria" && <MemoryPage blocked={props.initialBlocked} onChange={refreshPending} onOpenConversation={openConversation} />}
        {view === "admin" && props.admin && <AdminPage />}
        {(view === "ajustes" || view === "perfil" || view === "integracoes") && (
          <SettingsPage name={props.name} email={props.email} version={props.version} prefs={prefs} setPrefs={setPrefs} voiceOk={voiceOk} speaker={speaker}
            section={view} theme={theme} onTheme={toggleTheme} admin={props.admin} onOpen={setTab}
            onNew={() => { newConversation(); setTab("conversa"); }} initialBlocked={props.initialBlocked} morningLink={props.morningLink} onResetTips={resetTips} />
        )}
      </div>

      <Assistant
        open={showAssist} full={assistFull} context={contextOf(tab)} messages={messages} draft={draft} mode={mode} listening={listening} busy={busy} voiceOk={voiceOk}
        onDraft={setDraft} onSend={(t) => { speaker?.unlock(); void send(t); }} onMic={micClick} onStop={stop}
        onClose={() => openAssist(false)} onToggleFull={() => setAssistFull((v) => !v)}
        onOpenConversation={() => { setAssistFull(false); setTab("conversa"); }} onNew={() => newConversation()}
      />
      {!showAssist && view !== "conversa" && (
        <button className={`orb-fab ${active ? "on" : ""}`} onClick={() => openAssist(true)} aria-label="Abrir o assistente GaDu">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/avatar/logo-96.webp" alt="" />
        </button>
      )}

      <nav className="dockbar" aria-label="Navegação">
        <button className="dock-item" aria-current={view === "hoje" ? "page" : undefined} onClick={() => setTab("hoje")}><Icon name="sun" size={20} />Hoje</button>
        <button className="dock-item" aria-current={view === "conversa" ? "page" : undefined} onClick={() => setTab("conversa")}><Icon name="chat" size={20} />Conversa</button>
        <button className={`dock-orb ${active ? "on" : ""}`} onClick={() => (view === "conversa" ? micClick() : active ? stop() : openAssist(!assist))} aria-label={view === "conversa" ? "Falar" : active ? "Parar" : assist ? "Fechar o assistente" : "Abrir o assistente GaDu"} aria-pressed={showAssist}>
          {active ? <Icon name={listening ? "mic" : "stop"} size={24} /> : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/avatar/logo-96.webp" alt="" />
          )}
        </button>
        <button className="dock-item" aria-current={view === "tarefas" ? "page" : undefined} onClick={() => setTab("tarefas")}><Icon name="check" size={20} />Tarefas</button>
        <button className="dock-item" aria-current={sheet || (view && !["hoje", "conversa", "projetos"].includes(view)) ? "page" : undefined} onClick={() => setSheet(true)} aria-expanded={sheet}>
          <Icon name="grid" size={20} />Módulos{pending > 0 && <b className="badge">{pending}</b>}
        </button>
      </nav>

      {sheet && (
        <div className="sheet-wrap" onClick={() => setSheet(false)}>
          <aside className="sheet on-dark" role="dialog" aria-modal="true" aria-label="Módulos" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <span className="brand">GaDu</span>
              <button className="icon-btn" onClick={() => setSheet(false)} aria-label="Fechar"><Icon name="x" /></button>
            </div>
            {moduleNav}
            {navFoot}
          </aside>
        </div>
      )}

      {drawer && (
        <ConversationsDrawer currentId={conversationId} onClose={() => setDrawer(false)} onOpen={openConversation}
          onNew={() => { newConversation(); setTab("conversa"); setDrawer(false); }} onDeleted={(id) => { if (id === conversationId) newConversation(); }} />
      )}
    </div>
  );
}
