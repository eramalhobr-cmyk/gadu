"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "./RobotFace";
import { ActionCard, initialCard, runAction, undoAction, type CardState } from "./ActionCard";
import { ConfirmSheet } from "./ConfirmSheet";
import type { ActionView, ChatAction, EventDraft, GastoDraft } from "@/lib/chat-actions";
import type { Ajuste } from "@/lib/acoes";
import { actionQuestion, describe, splitNavegacao } from "@/lib/chat-actions";
import { GIVE_UP_LINE, parseAnswer, resultLine, RETRY_LINE } from "@/lib/voice-confirm";
import { SourcesDetail, type SourcesData } from "./SourcesDetail";
import { AdminPage } from "./AdminPage";
import type { FaceMode } from "./robot-engine";
import { canListen, canSpeak, createRecognizer, SHORT_REPLY, Speaker, stripSourceTags } from "@/lib/speech";
import { chatFailure, MSG, micErrorMessage, parseRetryCommand, RETRY_LABEL, spokenFailure, type Failure } from "@/lib/errors";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ConversationsDrawer } from "./ConversationsDrawer";
import { OverlayHistory } from "@/lib/overlay-history";
import { MemoryPage } from "./MemoryPage";
import { SettingsPage, type Prefs } from "./SettingsPage";
import { TodayPage } from "./TodayPage";
import { AgentsPage } from "./AgentsPage";
import { ProjectsPage } from "./ProjectsPage";
import { AgendaView } from "./AgendaView";
import { FinanceiroPage } from "./FinanceiroPage";
import { MetasPage } from "./MetasPage";
import { TalkProvider } from "./kit";
import type { MetaDraft } from "@/lib/goals/types";
import { Icon } from "./ui";
import { TipCard } from "./TipCard";
import { TIP_IDS, type TipId } from "@/lib/tips";
import { Assistant } from "./Assistant";
import { ListenSheet } from "./ListenSheet";
import { UndoToast } from "./UndoToast";
import { Onboarding } from "./Onboarding";
import { withOnboarding, type OnboardingStatus } from "@/lib/onboarding";
import { parseUndoCommand, showUndo, undoBus } from "@/lib/undo";
import { ModulePage, ModulesHub, StatusPill } from "./ModulePage";
import { contextOf } from "@/lib/assistant-context";
import { canonicalView, isOverview, MAIN_VIEWS, MODULES, moduleOf, parseView, viewDef, type ViewId } from "@/lib/modules";
import { applyTheme, readTheme, type Theme } from "@/lib/theme";

export type Msg = { id: string; role: "user" | "assistant" | "notice" | "action"; content: string; /** Texto a reenviar pelo botão "Tentar de novo" (erro do chat). */ retry?: string; via?: string; link?: { href: string; label: string }; action?: ChatAction; sources?: SourcesData };

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
const TIP_OF: Partial<Record<ViewId, TipId>> = { hoje: "hoje", conversa: "conversa", tarefas: "tarefas", projetos: "projetos", agentes: "agentes", memoria: "perfil", ajustes: "perfil" };
const LS_ASSIST = "gadu.assist";
const LS_ASSIST_W = "gadu.assistW";
const LS_NAV_MINI = "gadu.navMini";
type Target = { kind: "project" | "agent"; id: number; name: string } | null;

const LS_DRAFT = "gadu.draft";
const LS_PREFS = "gadu.prefs";
const DEFAULT_PREFS: Prefs = { voice: true, handsFree: false, voiceURI: "", rate: 1, autoSend: false, shortVoice: true };

function readPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(LS_PREFS) || "{}");
    const rate = Number(p.rate);
    return {
      voice: p.voice !== false,
      handsFree: Boolean(p.handsFree),
      voiceURI: typeof p.voiceURI === "string" ? p.voiceURI : "",
      rate: Number.isFinite(rate) && rate >= 0.7 && rate <= 1.6 ? rate : 1,
      // Envio automático só com escolha explícita (padrão: desligado; o texto fica no campo para revisar).
      autoSend: p.autoSend === true,
      // Respostas faladas curtas (UX-3): ligado por padrão; o detalhe fica na tela.
      shortVoice: p.shortVoice !== false,
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
  /** FINANCE_ENABLED: false esconde a tela Financeiro e o módulo na navegação. */
  financeEnabled: boolean;
  /** GOALS_ENABLED: false esconde a tela Metas, o módulo na navegação e o resumo do Hoje. */
  goalsEnabled: boolean;
  /** MODELING_3D_ENABLED=1: mostra a entrada "3D" (Beta) em Mais. Desligado por padrão. */
  modeling3dEnabled?: boolean;
  seenTips: string[];
  /** Pessoa nova: abre o guia de primeiro uso (3 passos) ao entrar. */
  showOnboarding?: boolean;
  /** Página de conteúdo (guia, como funciona) dentro do mesmo cabeçalho e menu. */
  page?: React.ReactNode;
}) {
  const [tab, setTabState] = useState<ViewId>(props.initialView);
  const [assist, setAssist] = useState(false);
  /** Largura do painel do assistente no computador (arrastável), em px. */
  const [assistW, setAssistW] = useState(384);
  const [navMini, setNavMini] = useState(false);
  const [theme, setTheme] = useState<Theme>(props.initialTheme);
  const [pageOpen, setPageOpen] = useState(Boolean(props.page));
  // Com uma página de conteúdo aberta, nenhuma aba aparece; tocar numa aba volta ao app.
  const view: ViewId | null = pageOpen ? null : tab;
  /** Troca de aba. Se estiver numa página de conteúdo, volta para o app e ajusta o endereço. */
  function setTab(t: ViewId) {
    if (t === "admin" && !props.admin) t = "ajustes";
    setPageOpen(false);
    window.history.replaceState(null, "", `/app?tab=${t}`);
    setTabState(t);
  }
  function openAssist(on: boolean) {
    setAssist(on);
    try { localStorage.setItem(LS_ASSIST, on ? "1" : "0"); } catch {}
  }
  function toggleTheme(next?: Theme) {
    const t = next ?? (theme === "dark" ? "light" : "dark");
    setTheme(t);
    applyTheme(t);
  }
  const [seen, setSeen] = useState<Set<string>>(() => new Set(props.seenTips));
  const [onboarding, setOnboarding] = useState(Boolean(props.showOnboarding));
  const [name, setName] = useState(props.name);
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
  /** Tela de escuta (UX-3): aberta pelo microfone central e pelo "Falar com o GaDu". `heard` = fala final esperando o envio. */
  const [voiceSheet, setVoiceSheet] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const voiceSheetRef = useRef(false);
  useEffect(() => { voiceSheetRef.current = voiceSheet; }, [voiceSheet]);
  /** Confirmação falada (UX-3): fila das ações a confirmar, etapa atual e comandos enviados aos cartões. */
  const [confirm, setConfirm] = useState<{ question: string; view?: ActionView; stage: "asking" | "listening" | "working"; heard: string; step: number; total: number } | null>(null);
  /** Estado de cada cartão de ação (o mesmo no painel e na Conversa). */
  const [cards, setCards] = useState<Record<string, CardState>>({});
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const confirmQ = useRef<{ id: string; a: ChatAction }[]>([]);
  const confirmStage = useRef<null | "asking" | "listening" | "working" | "result">(null);
  const confirmListenRef = useRef(false);
  const confirmStep = useRef(0);
  const confirmTotal = useRef(0);
  const confirmTries = useRef(0);
  const confirmFns = useRef({ next: () => false as boolean, answer: (_t: string) => {}, noAnswer: () => {}, idle: () => false as boolean });
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
      // No celular o assistente começa fechado: abrir é sempre uma ação da pessoa.
      const saved = localStorage.getItem(LS_ASSIST);
      if (window.innerWidth >= 1024) setAssist(saved ? saved === "1" : window.innerWidth >= 1360);
      const w = Number(localStorage.getItem(LS_ASSIST_W));
      if (w >= 320 && w <= 640) setAssistW(w);
      setNavMini(localStorage.getItem(LS_NAV_MINI) === "1");
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
    if (speaker) { speaker.prefs = { voiceURI: prefs.voiceURI, rate: prefs.rate }; speaker.maxChars = prefs.shortVoice ? SHORT_REPLY : 0; }
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
        // Confirmação falada: a resposta (sim, não, muda para…) não vai para o campo de mensagem.
        if (confirmListenRef.current) {
          setConfirm((c) => (c ? { ...c, heard: text } : c));
          if (final && text) { confirmListenRef.current = false; confirmFns.current.answer(text); }
          return;
        }
        setDraft(text);
        // Tela de escuta aberta: a fala final vai para a contagem de 3 s (dá para cancelar ou corrigir).
        if (final && text && voiceSheetRef.current) { setHeard(text); return; }
        // Envio automático só se a pessoa escolheu (ou no modo mãos-livres, que depende disso).
        if (final && text && (prefsRef.current.autoSend || prefsRef.current.handsFree)) void sendRef.current(text, { voice: true });
      },
      onEnd: () => {
        if (!mine()) return;
        setListening(false);
        setMode((m) => (m === "listening" ? "idle" : m));
        if (confirmListenRef.current) { confirmListenRef.current = false; confirmFns.current.noAnswer(); }
      },
      onError: (code) => {
        if (!mine()) return;
        setListening(false);
        setMode("idle");
        if (confirmListenRef.current) { confirmListenRef.current = false; confirmFns.current.noAnswer(); return; }
        const text = micErrorMessage(code);
        if (text) setMessages((ms) => [...ms, { id: crypto.randomUUID(), role: "notice", content: text }]);
        // Quem está usando a voz ouve o aviso (menos o "não ouvi nada", que se repetiria no modo conversa).
        if (text && code !== "no-speech" && prefsRef.current.voice) speaker?.announce(text);
      },
    });
    if (!rec) return;
    recRef.current = rec;
    // Nunca deixa o microfone aberto indefinidamente: para sozinho depois de 20 s.
    setTimeout(() => { if (recRef.current === rec) { try { rec.stop(); } catch {} } }, 20_000);
    try {
      rec.start();
      setListening(true);
      setMode("listening");
    } catch {
      setListening(false);
    }
  }, [busy, speaker, voiceOk]);

  /** Motivo da última falha de um cartão, para a fala. */
  const cardErr = useRef("");
  /** A última mensagem que não chegou ao GaDu, para "tenta de novo" (falado ou escrito) e para o botão. */
  const lastFailRef = useRef<{ message: string; voice: boolean } | null>(null);
  /** Mostra o erro do chat com o que fazer agora; fala se a pessoa está usando voz. A mensagem fica guardada no rascunho. */
  const failChat = useCallback((f: Failure, message: string, voice: boolean) => {
    lastFailRef.current = f.retry ? { message, voice } : null;
    setDraft(message);
    setMessages((ms) => [...ms, { id: crypto.randomUUID(), role: "notice", content: f.text, ...(f.retry ? { retry: message } : {}) }]);
    if (voice && prefsRef.current.voice) speaker?.announce(spokenFailure(f));
  }, [speaker]);
  const send = useCallback(async (text: string, opts: { voice?: boolean } = {}) => {
    const message = text.trim();
    // "Desfaz": desfaz a última ação enquanto o aviso "Feito · Desfazer" está à mão. Sem modelo e sem custo.
    if (message && parseUndoCommand(message) && undoBus.active) {
      setDraft("");
      void undoBus.undo().then((ok) => { if (ok && opts.voice && prefsRef.current.voice) speaker?.announce("Desfeito."); });
      return;
    }
    // "Tenta de novo": repete a última mensagem que falhou (sem modelo para entender o comando).
    if (message && lastFailRef.current && !busy && parseRetryCommand(message)) {
      const f = lastFailRef.current;
      lastFailRef.current = null;
      setDraft("");
      void sendRef.current(f.message, { voice: opts.voice ?? f.voice });
      return;
    }
    if (!message || busy) return;
    if (!navigator.onLine) {
      failChat({ text: MSG.offline, retry: true }, message, Boolean(opts.voice));
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
    // Ações propostas nesta resposta que a confirmação falada vai ler (só quando a pessoa falou).
    const toConfirm: { id: string; a: ChatAction }[] = [];
    const addActions = (list: ChatAction[], content: (a: ChatAction) => string) => {
      const ms = list.map((a) => ({ id: crypto.randomUUID(), role: "action" as const, content: content(a), action: a }));
      // Cartão só de informação (resultado de cálculo) não pede "sim": a resposta já foi falada.
      if (opts.voice) toConfirm.push(...ms.filter((m) => !describe(m.action).info).map((m) => ({ id: m.id, a: m.action })));
      setMessages((prev) => [...prev, ...ms]);
    };
    // Respostas faladas curtas, menos no briefing da manhã (que é feito para ouvir inteiro).
    if (speaker) speaker.maxChars = prefsRef.current.shortVoice && !/^come[cç]ar o dia\b/i.test(message) ? SHORT_REPLY : 0;
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
          } else if (ev.t === "sources") {
            setMessages((ms) => ms.map((m) => (m.id === botId ? { ...m, sources: { items: ev.items, unavailable: ev.unavailable } } : m)));
          } else if (ev.t === "events") {
            addActions((ev.items as EventDraft[]).map((e) => ({ kind: "evento" as const, ev: e })), (a) => (a.kind === "evento" ? a.ev.title : ""));
          } else if (ev.t === "gastos") {
            addActions((ev.items as GastoDraft[]).map((g) => ({ kind: "gasto" as const, g })), (a) => (a.kind === "gasto" ? a.g.categoria : ""));
          } else if (ev.t === "metas") {
            addActions((ev.items as MetaDraft[]).map((d) => ({ kind: "meta" as const, d })), (a) => (a.kind === "meta" ? a.d.titulo : ""));
          } else if (ev.t === "tasks") {
            // Tarefa já anotada: cartão com Desfazer.
            const items = ev.items as { id: number; title: string; due: string | null }[];
            addActions(items.map((t) => ({ kind: "tarefa_criada" as const, id: t.id, titulo: t.title, prazo: t.due })), (a) => (a.kind === "tarefa_criada" ? a.titulo : ""));
          } else if (ev.t === "reminders") {
            // Lembrete já criado: cartão com Desfazer (e "está certo?" na confirmação falada).
            const items = ev.items as { id: number; text: string; dueAt: string }[];
            addActions(items.map((r) => ({ kind: "lembrete" as const, id: r.id, text: r.text, dueAt: r.dueAt })), (a) => (a.kind === "lembrete" ? a.text : ""));
            const push = typeof Notification !== "undefined" && Notification.permission === "granted";
            if (!push) setMessages((ms) => [...ms, { id: crypto.randomUUID(), role: "notice", content: "Ative as notificações em Configurações para receber o aviso do lembrete no celular." }]);
          } else if (ev.t === "acoes") {
            // "Tudo por voz": ações de qualquer módulo, resolvidas no servidor; a pessoa confirma.
            // "Abre o Financeiro" não grava nada: abre a tela na hora, sem cartão. Gravações sempre viram cartão.
            const { cards: rest, destino, guia } = splitNavegacao(ev.items as ChatAction[]);
            if (rest.length) addActions(rest, (a) => a.kind);
            if (destino) setTab(destino);
            if (guia) openGuideRef.current();
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
      lastFailRef.current = null;
      if (answer && /^come[cç]ar o dia\b/i.test(message)) {
        setMessages((ms) => [...ms, { id: crypto.randomUUID(), role: "notice", content: "Quer ouvir as notícias agora?", link: { href: props.morningLink || DEFAULT_MORNING, label: "Ouvir o Update Diário" } }]);
      }
    } catch (e) {
      if (!ctrl.signal.aborted) {
        failChat(chatFailure((e as { status?: number }).status ?? 0), message, Boolean(opts.voice));
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
      // Confirmação falada: depois que a resposta terminar de ser falada, o GaDu lê cada ação e espera "sim" ou "não".
      const voiceConfirm = toConfirm.length > 0 && !ctrl.signal.aborted && prefsRef.current.voice && canSpeak() && canListen();
      if (voiceConfirm) { confirmQ.current = toConfirm; confirmStep.current = 0; confirmTotal.current = toConfirm.length; }
      if (spoke && speaker) speaker.flush();
      else if (voiceConfirm) { setMode("idle"); setTimeout(() => confirmFns.current.next(), 300); }
      else {
        setMode("idle");
        // Modo conversa com a voz da resposta desligada: volta a ouvir mesmo assim.
        if (answer && !ctrl.signal.aborted && handsFreeRef.current) setTimeout(() => { if (modeRef.current === "idle" && !busyRef.current && !listeningRef.current) listenRef.current(); }, 600);
      }
    }
  }, [busy, conversationId, failChat, prefs.voice, refreshPending, speaker, props.morningLink, target]);

  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  const busyRef = useRef(busy);
  useEffect(() => { busyRef.current = busy; }, [busy]);
  const listeningRef = useRef(listening);
  useEffect(() => { listeningRef.current = listening; }, [listening]);
  const prefsRef = useRef(prefs);
  useEffect(() => { prefsRef.current = prefs; }, [prefs]);
  const tabRef = useRef(tab);
  useEffect(() => { tabRef.current = tab; }, [tab]);
  const sendRef = useRef(send);
  const listenRef = useRef(listen);
  useEffect(() => { sendRef.current = send; listenRef.current = listen; }, [send, listen]);

  // Fim de cada fala: a confirmação falada tem prioridade; depois, o modo mãos-livres volta a ouvir.
  useEffect(() => {
    if (!speaker) return;
    speaker.onStart = () => setMode("speaking");
    speaker.onIdle = () => {
      setMode("idle");
      if (confirmFns.current.idle()) return;
      if (handsFreeRef.current) setTimeout(() => { if (modeRef.current === "idle" && !busyRef.current && !listeningRef.current) listenRef.current(); }, 400);
    };
  }, [speaker]);

  // Ajustes pedidos pela conversa ("aumenta a letra" é aplicado no cartão; voz, conversa contínua e tema chegam aqui).
  useEffect(() => {
    const on = (e: Event) => {
      const j = (e as CustomEvent<Ajuste>).detail;
      if (j.opcao === "tema") { setTheme(j.valor); applyTheme(j.valor); return; }
      const key = j.opcao === "maos_livres" ? "handsFree" : j.opcao === "respostas_curtas" ? "shortVoice" : j.opcao === "voz" ? "voice" : null;
      if (key && typeof j.valor === "boolean") setPrefs({ ...prefsRef.current, [key]: j.valor });
    };
    window.addEventListener("gadu:ajuste", on);
    return () => window.removeEventListener("gadu:ajuste", on);
  }, []);

  // ---- Confirmação falada (src/lib/voice-confirm.ts) ----
  function closeConfirm() {
    confirmStage.current = null;
    confirmQ.current = [];
    confirmListenRef.current = false;
    setConfirm(null);
  }
  function say(line: string, stage: "asking" | "result") {
    confirmStage.current = stage;
    if (speaker && canSpeak()) speaker.announce(line);
    else confirmFns.current.idle();
  }
  /** Lê a próxima ação da fila. Sem nada na fila, fecha e devolve false. */
  function nextConfirm(): boolean {
    const item = confirmQ.current[0];
    if (!item) { closeConfirm(); return false; }
    confirmStep.current += 1;
    confirmTries.current = 0;
    const question = actionQuestion(item.a);
    setConfirm({ question, view: describe(item.a), stage: "asking", heard: "", step: confirmStep.current, total: confirmTotal.current });
    say(`${question} Diga sim ou não.`, "asking");
    return true;
  }
  function listenConfirm() {
    confirmStage.current = "listening";
    confirmListenRef.current = true;
    setConfirm((c) => (c ? { ...c, stage: "listening", heard: "" } : c));
    listenRef.current();
  }
  function retryOrGiveUp() {
    confirmTries.current += 1;
    if (confirmTries.current < 2) { setConfirm((c) => (c ? { ...c, stage: "asking" } : c)); say(RETRY_LINE, "asking"); return; }
    confirmQ.current = [];
    say(GIVE_UP_LINE, "result");
  }
  function answerConfirm(text: string) {
    const item = confirmQ.current[0];
    if (!item) return;
    const ans = parseAnswer(text);
    if (!ans) { retryOrGiveUp(); return; }
    if (ans.kind === "change") {
      // "muda para 60 reais": descarta a proposta e manda o pedido para a conversa, que propõe de novo.
      // O que o servidor já criou (lembrete, tarefa anotada) é desfeito; senão o novo pedido duplicaria o item.
      void (initialCard(item.a).state === "created" ? cardOp(item.id, item.a, "undo") : cardOp(item.id, item.a, "discard"));
      closeConfirm();
      void sendRef.current(text, { voice: true });
      return;
    }
    confirmStage.current = "working";
    setConfirm((c) => (c ? { ...c, stage: "working" } : c));
    const action = ans.kind;
    void decide(item.id, item.a, action).then((ok) => cardResult(item.id, action, ok));
  }
  /** "sim" grava (o que já existe fica); "não" descarta ou, no que o servidor já criou, desfaz. */
  async function decide(id: string, a: ChatAction, action: "yes" | "no"): Promise<boolean> {
    const st = (cardsRef.current[id] ?? initialCard(a)).state;
    const applied = initialCard(a).state === "created";
    if (action === "yes") {
      if (applied || st === "created") return true;
      if (st === "discarded") return false;
      return cardOp(id, a, "confirm");
    }
    if (st === "discarded") return true;
    if (applied) return cardOp(id, a, "undo");
    if (st === "created") return false;
    return cardOp(id, a, "discard");
  }
  /** Toque no cartão (ou decisão falada): grava, descarta ou desfaz, e guarda o estado do cartão. */
  async function cardOp(id: string, a: ChatAction, op: "confirm" | "discard" | "undo"): Promise<boolean> {
    const set = (c: CardState) => setCards((m) => ({ ...m, [id]: c }));
    if (op === "discard") { set({ state: "discarded" }); return true; }
    if ((cardsRef.current[id]?.state) === "saving") return false;
    set({ state: "saving" });
    const r = op === "confirm" ? await runAction(a) : await undoAction(a);
    if (!r.ok) { cardErr.current = r.msg ?? ""; set({ state: "error", msg: r.msg }); return false; }
    set(op === "confirm" ? { state: "created", link: r.link } : { state: "discarded", undone: true });
    // "Feito · Desfazer": o aviso único por alguns segundos, quando a ação dá para desfazer sem perder nada.
    if (op === "confirm" && r.undo) {
      const undo = r.undo;
      showUndo(`${describe(a).done}.`, async () => {
        const u = await undo();
        if (u.ok) { set({ state: "discarded", undone: true }); if (a.kind === "memoria_aprovar") void refreshPending(); }
        return u;
      });
    }
    if (op === "confirm") {
      if (a.kind === "nova_conversa") { newConversation(); setTab("conversa"); }
      else if (a.kind === "memoria_aprovar" || a.kind === "memoria_recusar" || a.kind === "memoria_esquecer") void refreshPending();
    }
    return true;
  }
  /** O cartão gravou (ou descartou): fala o resultado e segue para a próxima. */
  function cardResult(id: string, action: "yes" | "no", ok: boolean) {
    const item = confirmQ.current[0];
    if (!item || item.id !== id) return;
    confirmQ.current = confirmQ.current.slice(1);
    say(resultLine(item.a.kind, action, ok, ok ? "" : cardErr.current), "result");
  }
  /** Toque em Sim/Não na tela de confirmação. */
  function tapConfirm(yes: boolean) {
    if (confirmListenRef.current) { confirmListenRef.current = false; try { recRef.current?.abort(); } catch {} }
    speaker?.cancel();
    answerConfirm(yes ? "sim" : "não");
  }
  function cancelConfirm() {
    if (confirmListenRef.current) { confirmListenRef.current = false; try { recRef.current?.abort(); } catch {} }
    closeConfirm();
    speaker?.cancel();
    setMode("idle");
  }
  confirmFns.current = {
    next: nextConfirm,
    answer: answerConfirm,
    noAnswer: () => { if (confirmStage.current === "listening") retryOrGiveUp(); },
    idle: () => {
      const st = confirmStage.current;
      if (st === "asking") { setTimeout(listenConfirm, 250); return true; }
      if (st === "result" || (st === null && confirmQ.current.length > 0)) return nextConfirm();
      return st === "listening" || st === "working";
    },
  };

  // Toque na notificação da manhã (/app?start=briefing): abre a conversa e começa o dia.
  const started = useRef(false);
  useEffect(() => {
    if (!props.autoStart || started.current) return;
    started.current = true;
    if (props.autoStart === "review") { setTab("hoje"); setReview(true); return; }
    setTab("conversa");
    setTimeout(() => void sendRef.current("Começar o dia"), 300);
  }, [props.autoStart]);

  const closeGuideRef = useRef<(s: OnboardingStatus) => void>(() => {});
  const openGuideRef = useRef<() => void>(() => {});
  // Primeiro uso guiado (UX-4): a marca "feito" e o nome ficam no perfil (settings.onboarding e display_name), sem migração.
  async function saveName(n: string): Promise<boolean> {
    const db = supabaseBrowser();
    const { data: auth } = await db.auth.getUser();
    if (!auth.user) return false;
    const { error } = await db.from("profiles").update({ display_name: n }).eq("id", auth.user.id);
    if (error) return false;
    setName(n.split(" ")[0]);
    return true;
  }
  async function closeGuide(status: OnboardingStatus) {
    setOnboarding(false);
    speaker?.cancel();
    const db = supabaseBrowser();
    const { data: auth } = await db.auth.getUser();
    if (!auth.user) return;
    const { data } = await db.from("profiles").select("settings").eq("id", auth.user.id).maybeSingle();
    // O guia toma o lugar das dicas soltas: quem passou por ele não vê os cartões de dica de cada tela.
    await db.from("profiles").update({ settings: { ...withOnboarding(data?.settings, status), tips: TIP_IDS } }).eq("id", auth.user.id);
    setSeen(new Set(TIP_IDS));
  }
  closeGuideRef.current = (s) => void closeGuide(s);
  openGuideRef.current = openGuide;
  function openGuide() { speaker?.unlock(); setOnboarding(true); }

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

  // Voz em um toque (UX-3): abre a tela de escuta, de qualquer tela. Sem reconhecimento de voz, abre o lugar de escrever.
  function dockTalk() {
    speaker?.unlock();
    if (!voiceOk) { if (tabRef.current === "conversa") document.getElementById("msg")?.focus(); else openAssist(true); return; }
    if (busy || mode === "speaking") { abortRef.current?.abort(); speaker?.cancel(); setMode("idle"); }
    setHeard(null);
    setDraft("");
    setVoiceSheet(true);
    listen();
  }
  /** Envia o que foi falado: fecha a tela de escuta e mostra a resposta no painel (ou na Conversa). */
  function sendHeard(text: string) {
    setVoiceSheet(false);
    setHeard(null);
    if (tabRef.current !== "conversa") openAssist(true);
    void send(text, { voice: true });
  }
  function closeVoice() {
    try { recRef.current?.stop(); } catch {}
    setVoiceSheet(false);
    setHeard(null);
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
    // Respondendo (pensando ou falando): o toque interrompe e para. Não abre o microfone junto.
    if (busy || mode === "speaking") { abortRef.current?.abort(); speaker?.cancel(); setMode("idle"); return; }
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
  const title = view ? viewDef(view).label : "Ajuda";
  const tip = view ? TIP_OF[view] : undefined;
  const showAssist = assist && view !== "conversa";
  const stop = () => { if (listening) recRef.current?.stop(); else { abortRef.current?.abort(); speaker?.cancel(); setMode("idle"); } };
  const initial = (name || props.email || "G").trim().charAt(0).toUpperCase();

  // Botão Voltar (Android e navegador): fecha primeiro o que estiver aberto por cima (conversas, assistente no celular);
  // sem nada aberto, volta para a tela anterior.
  const isPhone = () => typeof window !== "undefined" && window.innerWidth < 1024;
  const layers = (onboarding ? 1 : 0) + (confirm ? 1 : 0) + (voiceSheet ? 1 : 0) + (drawer ? 1 : 0) + (showAssist && isPhone() ? 1 : 0);
  const overlayRef = useRef({ onboarding, confirm: !!confirm, voice: voiceSheet, drawer, assist: showAssist });
  overlayRef.current = { onboarding, confirm: !!confirm, voice: voiceSheet, drawer, assist: showAssist && isPhone() };
  // Uma entrada de histórico por camada aberta (src/lib/overlay-history.ts).
  const ohRef = useRef<OverlayHistory | null>(null);
  const confirmCancelRef = useRef(cancelConfirm);
  confirmCancelRef.current = cancelConfirm;
  useEffect(() => {
    const oh = new OverlayHistory({
      history: window.history,
      onBack: () => {
        const o = overlayRef.current;
        // Voltar do Android fecha o guia (conta como "pulou"); as outras camadas vêm antes dele na pilha.
        if (o.onboarding && !o.confirm && !o.voice && !o.drawer) closeGuideRef.current("skipped");
        else if (o.confirm) confirmCancelRef.current();
        else if (o.voice) { try { recRef.current?.stop(); } catch {} setVoiceSheet(false); setHeard(null); }
        else if (o.drawer) setDrawer(false);
        else if (o.assist) openAssist(false);
        else {
          const t = parseView(new URLSearchParams(window.location.search).get("tab") ?? undefined, props.admin);
          if (t) { setPageOpen(false); setTabState(t); }
        }
      },
      // Fechar uma camada pela interface volta no histórico; o endereço precisa continuar o da tela atual.
      onSettled: () => {
        const q = new URLSearchParams(window.location.search).get("tab");
        if (window.location.pathname === "/app" && q && q !== tabRef.current) window.history.replaceState(window.history.state, "", `/app?tab=${tabRef.current}`);
      },
    });
    ohRef.current = oh;
    const onPop = () => oh.handlePopState();
    window.addEventListener("popstate", onPop);
    return () => { window.removeEventListener("popstate", onPop); ohRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { ohRef.current?.sync(layers); }, [layers]);
  // Mudou de tela com o microfone aberto e sem nenhum controle de voz à vista: para de ouvir.
  useEffect(() => {
    if (listeningRef.current && !(tab === "conversa" || showAssist || voiceSheetRef.current)) recRef.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
  // Teclado abriu (Android/iPhone): o campo em foco continua à vista, sem ficar atrás do teclado.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const keepVisible = () => {
      const el = document.activeElement;
      if (el instanceof HTMLElement && el.matches("textarea, input:not([type=checkbox]):not([type=range]):not([type=radio])")) el.scrollIntoView({ block: "nearest", behavior: "auto" });
    };
    vv.addEventListener("resize", keepVisible);
    return () => vv.removeEventListener("resize", keepVisible);
  }, []);
  // Segundo plano, tela bloqueada ou saída do app: o microfone nunca fica aberto. Ao voltar, a fala pausada continua.
  useEffect(() => {
    const hide = () => { try { recRef.current?.stop(); } catch {} };
    const onVis = () => { if (document.visibilityState === "hidden") hide(); else speaker?.resumeIfPaused(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", hide);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", hide);
      try { recRef.current?.abort(); } catch {}
    };
  }, [speaker]);
  function toggleNavMini() {
    setNavMini((v) => { try { localStorage.setItem(LS_NAV_MINI, v ? "0" : "1"); } catch {} return !v; });
  }
  /** Painel do assistente no computador: arrastar a borda muda a largura (320 a 640 px), sem espremer a área de trabalho. */
  function startResize(e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = assistW;
    let last = startW;
    const max = () => Math.max(320, Math.min(640, window.innerWidth - (navMini ? 76 : 280) - 560));
    const move = (ev: PointerEvent) => { last = Math.round(Math.min(max(), Math.max(320, startW + (startX - ev.clientX)))); setAssistW(last); };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      try { localStorage.setItem(LS_ASSIST_W, String(last)); } catch {}
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
  function stepAssistW(delta: number) {
    setAssistW((w) => { const n = Math.min(640, Math.max(320, w + delta)); try { localStorage.setItem(LS_ASSIST_W, String(n)); } catch {} return n; });
  }

  /** Tela que acende no menu: Perfil e Integrações são a mesma tela de Configurações. */
  const current = view ? canonicalView(view) : null;
  const hidden = (v: ViewId) => (v === "financeiro" && !props.financeEnabled) || (v === "metas" && !props.goalsEnabled);
  /** Menu lateral do computador (UX-1): lista simples, na mesma ordem e com os mesmos nomes do celular. Sem grupos e sem planejados. */
  const navItem = (v: { id: ViewId; label: string; icon: string }, extra?: React.ReactNode) => (
    <button key={v.id} className="nav-item" aria-current={current === v.id ? "page" : undefined} onClick={() => setTab(v.id)} title={navMini ? v.label : undefined}>
      <Icon name={v.icon} size={19} /><span>{v.label}</span>
      {v.id === "memoria" && pending > 0 && <b className="nav-badge" aria-label={`${pending} memórias para revisar`}>{pending}</b>}
      {extra}
    </button>
  );
  const soonCount = MODULES.filter((m) => m.status === "planejado").length;
  const navList = () => (
    <div className="nav-scroll">
      <div className="nav-flat">{MAIN_VIEWS.filter((v) => !hidden(v)).map((v) => navItem(viewDef(v)))}</div>
      <div className="nav-extra">
        <button className="nav-item" onClick={() => setDrawer(true)} aria-expanded={drawer} title={navMini ? "Conversas anteriores" : undefined}><Icon name="history" size={19} /><span>Conversas anteriores</span></button>
        {navItem(viewDef("ajustes"))}
        {props.admin && navItem(viewDef("admin"))}
        <a className="nav-item" href="/app/guia" title={navMini ? "Ajuda" : undefined}><Icon name="book" size={19} /><span>Ajuda</span></a>
        {soonCount > 0 && (
          <button className="nav-item soon" aria-current={current === "modulos" ? "page" : undefined} onClick={() => setTab("modulos")} title={navMini ? "Em breve" : undefined}>
            <Icon name="spark" size={19} /><span>Em breve</span>
          </button>
        )}
      </div>
    </div>
  );
  const navUser = (
    <div className="nav-user">
      <span className="initial" aria-hidden="true">{initial}</span>
      <button className="who" onClick={() => setTab("ajustes")}><b>{name || "Você"}</b><small>{props.email}</small></button>
      <button className="icon-btn" onClick={() => toggleTheme()} aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"} title={theme === "dark" ? "Tema claro" : "Tema escuro"}><Icon name={theme === "dark" ? "sun" : "moon"} /></button>
    </div>
  );
  /** Microfone central da barra de baixo (UX-1): um toque fala; tocar e segurar abre o painel do assistente para escrever. */
  const pressRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; long: boolean }>({ timer: null, long: false });
  function micDown() {
    pressRef.current.long = false;
    if (pressRef.current.timer) clearTimeout(pressRef.current.timer);
    pressRef.current.timer = setTimeout(() => { pressRef.current.long = true; pressRef.current.timer = null; if (view !== "conversa") openAssist(true); else document.getElementById("msg")?.focus(); }, 550);
  }
  function micCancel() {
    if (pressRef.current.timer) { clearTimeout(pressRef.current.timer); pressRef.current.timer = null; }
  }
  function micTap() {
    micCancel();
    if (pressRef.current.long) { pressRef.current.long = false; return; }
    if (active) { stop(); return; }
    // Sem reconhecimento de voz no navegador: abre o lugar de escrever, em vez de um aviso.
    dockTalk();
  }
  return (
    <div className={`app ${showAssist ? "with-assist" : ""} ${navMini ? "nav-mini" : ""}`} style={{ ["--assist-w" as string]: `${assistW}px` }}>
      <a className="skip" href="#conteudo">Pular para o conteúdo</a>

      <aside className="nav on-dark" aria-label="Módulos">
        <div className="nav-top">
          <a className="nav-brand" href="/app" aria-label="GaDu, início"><span className="brand">GaDu</span></a>
          <button className="icon-btn nav-collapse" onClick={toggleNavMini} aria-label={navMini ? "Expandir o menu" : "Recolher o menu"} aria-pressed={navMini} title={navMini ? "Expandir o menu" : "Recolher o menu"}><Icon name="panel" /></button>
        </div>
        <button className="btn btn-pri nav-new" onClick={() => { newConversation(); setTab("conversa"); }} aria-label="Nova conversa" title={navMini ? "Nova conversa" : undefined}><Icon name="plus" size={18} /><span>Nova conversa</span></button>
        {navList()}
        <div className="nav-foot">{navUser}</div>
      </aside>

      <div className="frame">
        <header className="bar">
          <a className="bar-brand" href="/app" aria-label="GaDu, início">
            <span className="brand">GaDu</span>
          </a>
          {/* Tocar no título volta ao topo da tela (atalho de quem rolou muito). */}
          <div className="bar-title" onClick={() => document.getElementById("conteudo")?.scrollTo({ top: 0, behavior: "smooth" })}>
            <h1>{title}</h1>
          </div>
          <div className="bar-actions">
            {/* Estado só quando há algo acontecendo (escutando, pensando, respondendo). */}
            {active && <span className={`mono state ${mode === "thinking" ? "hot" : ""}`} role="status"><i />{stateLabel}</span>}
            <button className="icon-btn desk-only" onClick={() => toggleTheme()} aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}><Icon name={theme === "dark" ? "sun" : "moon"} /></button>
            {view !== "conversa" && (
              <button className="icon-btn desk-only" onClick={() => openAssist(!assist)} aria-label={assist ? "Fechar o assistente" : "Abrir o assistente"} aria-pressed={assist}><Icon name="panel" /></button>
            )}
            <a className="icon-btn desk-only" href="/app/guia" aria-label="Guia do GaDu" title="Guia do GaDu"><b aria-hidden="true">?</b></a>
          </div>
        </header>
        {!online && <div className="banner" role="status">{MSG.offlineBanner}</div>}
        {tip && !seen.has(tip) && <TipCard key={`tip-${tip}`} id={tip} onDone={() => markTip(tip)} />}
        {pageOpen && <main className="page doc-page" id="conteudo">{props.page}</main>}

        {view === "conversa" && (
          <main className="chat2" id="conteudo">
            <aside className="chat-stage on-dark" aria-label="GaDu">
              <div className="chat-ava"><Avatar mode={mode} label={`GaDu: ${stateLabel}`} /></div>
              <div className="meta">
                <b className="who">GaDu</b>
                <span className={`state ${mode === "thinking" ? "hot" : ""}`}><i />{stateLabel}</span>
                {target && (
                  <div className="target-pill">
                    <span className="mono">{target.kind === "agent" ? "Agente" : "Projeto"}</span>
                    <b>{target.name}</b>
                    {!conversationId && <button className="link-btn" onClick={() => setTarget(null)} aria-label="Conversar sem agente ou projeto">×</button>}
                  </div>
                )}
              </div>
              <div className="acts">
                <button className="btn btn-sm" onClick={() => newConversation()} aria-label="Nova conversa"><Icon name="plus" size={16} /><span>Nova</span></button>
                <button className="btn btn-sm" onClick={() => setDrawer(true)} aria-label="Histórico de conversas"><Icon name="history" size={16} /><span>Histórico</span></button>
              </div>
            </aside>
            <section className="chat-col">
              <div className="chat-log" ref={logRef} aria-live="polite">
                {!messages.some((m) => m.role !== "notice") && (
                  <div className="chat-empty">
                    <h2>Oi{name ? `, ${name}` : ""}. Como posso ajudar?</h2>
                    <p>Escreva ou toque no microfone do campo abaixo. Tudo o que eu aprender sobre você passa pela sua aprovação antes de virar memória.</p>
                    <div className="sug-grid" aria-label="Sugestões">
                      {[...QUICK, "Anota aí: "].map((q) => (
                        <button key={q} className="sug" disabled={busy} onClick={() => { speaker?.unlock(); if (q.endsWith(" ")) { setDraft(q); document.getElementById("msg")?.focus(); } else void send(q); }}>
                          <Icon name={q.startsWith("Começar") ? "sun" : q.includes("agenda") ? "calendar" : q.includes("e-mail") ? "chat" : "check"} size={18} />
                          <span>{q.endsWith(" ") ? "Anotar uma tarefa" : q}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((m) =>
                  m.role === "user" ? <div key={m.id} className="bub u">{m.content}</div>
                  : m.role === "action" && m.action ? <ActionCard key={m.id} a={m.action} st={cards[m.id]} onConfirm={() => void cardOp(m.id, m.action!, "confirm")} onDiscard={() => void cardOp(m.id, m.action!, "discard")} onUndo={() => void cardOp(m.id, m.action!, "undo")} onOpen={setTab} />
                  : m.role === "notice" ? (
                    <div key={m.id} className="notice" role="status">
                      {m.content}
                      {m.retry && messages[messages.length - 1]?.id === m.id && <div className="mt-2"><button className="btn btn-sm btn-pri" disabled={busy} onClick={() => { lastFailRef.current = null; void send(m.retry!); }}>{RETRY_LABEL}</button></div>}
                      {m.link && <div className="mt-2"><a className="btn btn-sm" href={m.link.href} target="_blank" rel="noopener noreferrer">{m.link.label}</a></div>}
                    </div>
                  ) : <div key={m.id} className="bub b"><span className="via" title={m.via ? `Modelo: ${m.via}` : undefined}>GaDu</span>{m.content ? stripSourceTags(m.content) : "…"}{m.sources && <SourcesDetail data={m.sources} onOpen={setTab} />}</div>,
                )}
              </div>
              <form className="chat-form" onSubmit={(e) => { e.preventDefault(); void send(draft); }}>
                {listening && <div className="listening-bar" role="status"><span className="dot-rec" aria-hidden="true" />Escutando… fale e eu escrevo aqui.<button type="button" className="link-btn" onClick={micClick}>Parar</button></div>}
                <div className="chat-box">
                  <button type="button" className={`round ${listening ? "on" : ""}`} onClick={micClick} aria-label={listening ? "Parar de ouvir" : busy || mode === "speaking" ? "Parar resposta" : "Falar"} aria-pressed={listening}>
                    <Icon name={(busy || mode === "speaking") && !listening ? "stop" : "mic"} />
                  </button>
                  <label className="sr" htmlFor="msg">Mensagem</label>
                  <textarea id="msg" rows={1} value={draft} placeholder={listening ? "Escutando…" : "Escreva ou fale com o GaDu"} maxLength={4000} autoComplete="off" autoCapitalize="sentences"
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 900) { e.preventDefault(); void send(draft); } }} />
                  <button type="submit" className="round pri" aria-label="Enviar" disabled={busy || !draft.trim()}><Icon name="send" /></button>
                </div>
              </form>
            </section>
          </main>
        )}

        <TalkProvider value={dockTalk}>
        {view === "hoje" && (
          <TodayPage review={review} onReviewDone={() => setReview(false)} onDock={dockTalk} onWrite={() => openAssist(true)} name={name} pendingMemories={pending} busy={busy} onStartDay={startDay} onTalk={talk}
            onOpenMemory={() => setTab("memoria")} onOpenTasks={() => setTab("tarefas")} onOpen={setTab} goalsEnabled={props.goalsEnabled}
            onAsk={(q) => { speaker?.unlock(); openAssist(true); void send(q); }} />
        )}
        {(view === "tarefas" || view === "projetos") && <ProjectsPage key={`pp-${view}`} initialView={view} onTalk={(p) => talkAbout({ kind: "project", ...p })} />}
        {view === "agenda" && <AgendaView onBack={() => setTab("hoje")} />}
        {view === "modulos" && <ModulesHub onOpen={setTab} onHistory={() => setDrawer(true)} pending={pending} admin={props.admin} name={name} email={props.email}
          hide={[...(props.financeEnabled ? [] : ["financeiro" as const]), ...(props.goalsEnabled ? [] : ["metas" as const])]} show3d={Boolean(props.modeling3dEnabled)} />}
        {view === "agentes" && <AgentsPage onTalk={(a) => talkAbout({ kind: "agent", ...a })} />}
        {view === "financeiro" && props.financeEnabled && <FinanceiroPage />}
        {view === "metas" && props.goalsEnabled && <MetasPage onAsk={(q) => { if (q.endsWith(" ")) { setDraft(q); openAssist(true); } else { speaker?.unlock(); openAssist(true); void send(q); } }} onOpenTasks={() => setTab("tarefas")} />}
        {view && isOverview(view) && <ModulePage id={moduleOf(view).id} onOpen={setTab} />}
        {view === "memoria" && <MemoryPage blocked={props.initialBlocked} onChange={refreshPending} onOpenConversation={openConversation} />}
        {view === "admin" && props.admin && <AdminPage />}
        {(view === "ajustes" || view === "perfil" || view === "integracoes") && (
          <SettingsPage name={name} email={props.email} version={props.version} prefs={prefs} setPrefs={setPrefs} voiceOk={voiceOk} speaker={speaker}
            section={view} theme={theme} onTheme={toggleTheme} admin={props.admin} onOpen={setTab}
            onNew={() => { newConversation(); setTab("conversa"); }} initialBlocked={props.initialBlocked} morningLink={props.morningLink} onResetTips={resetTips} onGuide={openGuide} />
        )}
        </TalkProvider>
      </div>

      <Assistant
        cards={cards} onCard={(id, a, op) => void cardOp(id, a, op)}
        open={showAssist} width={assistW} onResizeStart={startResize} onResizeStep={stepAssistW} context={contextOf(tab)} messages={messages} draft={draft} mode={mode} listening={listening} busy={busy} voiceOk={voiceOk}
        onDraft={setDraft} onSend={(t) => { speaker?.unlock(); void send(t); }} onMic={micClick} onStop={stop}
        onClose={() => openAssist(false)}
        onOpenView={(v) => { openAssist(false); setTab(v); }} onOpenConversation={() => { openAssist(false); setTab("conversa"); }} onNew={() => newConversation()}
      />
      {!showAssist && view !== "conversa" && (
        <button className={`orb-fab ${active ? "on" : ""}`} onClick={() => openAssist(true)} aria-label="Abrir o assistente GaDu">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/avatar/gadu-480.webp" alt="" />
        </button>
      )}

      {/* Barra de baixo do celular (UX-1): Hoje · Conversa · [microfone] · Tarefas · Mais. */}
      <nav className="dockbar" aria-label="Navegação">
        <button className="dock-item" aria-current={view === "hoje" ? "page" : undefined} onClick={() => setTab("hoje")}><Icon name="sun" size={22} /><span>Hoje</span></button>
        <button className="dock-item" aria-current={view === "conversa" ? "page" : undefined} onClick={() => setTab("conversa")}><Icon name="chat" size={22} /><span>Conversa</span></button>
        {/* Microfone grande: um toque fala com o GaDu; tocar e segurar abre o painel para escrever. Durante a resposta, o toque para. */}
        <button className={`dock-mic s-${listening ? "listening" : mode}`} onPointerDown={micDown} onPointerLeave={micCancel} onPointerCancel={micCancel} onClick={micTap}
          onContextMenu={(e) => e.preventDefault()}
          aria-label={listening ? "Parar de ouvir" : busy || mode === "speaking" ? "Parar a resposta" : "Falar com o GaDu"} aria-pressed={listening}>
          <Icon name={active && !listening ? "stop" : "mic"} size={28} />
        </button>
        <button className="dock-item" aria-current={view === "tarefas" ? "page" : undefined} onClick={() => setTab("tarefas")}><Icon name="check" size={22} /><span>Tarefas</span></button>
        <button className="dock-item" aria-current={view && !["hoje", "conversa", "tarefas"].includes(view) ? "page" : undefined} onClick={() => setTab("modulos")}>
          <Icon name="grid" size={22} /><span>Mais</span>{pending > 0 && <b className="badge" aria-label={`${pending} memórias para revisar`}>{pending}</b>}
        </button>
      </nav>

      <UndoToast />
      {onboarding && <Onboarding name={name} speaker={speaker} voiceOn={prefs.voice} onSaveName={saveName} onClose={(st) => void closeGuide(st)} />}
      {voiceSheet && (
        <ListenSheet listening={listening} text={draft} pending={heard} handsFree={prefs.handsFree}
          onHandsFree={(on) => setPrefs({ ...prefs, handsFree: on })}
          onListen={() => { setHeard(null); setDraft(""); listen(); }} onStop={() => recRef.current?.stop()}
          onSend={sendHeard} onCancel={() => setHeard(null)}
          onEdit={() => { closeVoice(); if (tabRef.current === "conversa") document.getElementById("msg")?.focus(); else openAssist(true); }}
          onClose={closeVoice} />
      )}
      {confirm && (
        <ConfirmSheet question={confirm.question} view={confirm.view} stage={confirm.stage} heard={confirm.heard} step={confirm.step} total={confirm.total}
          onYes={() => tapConfirm(true)} onNo={() => tapConfirm(false)} onClose={cancelConfirm} />
      )}
      {drawer && (
        <ConversationsDrawer currentId={conversationId} onClose={() => setDrawer(false)} onOpen={openConversation}
          onNew={() => { newConversation(); setTab("conversa"); setDrawer(false); }} onDeleted={(id) => { if (id === conversationId) newConversation(); }} />
      )}
    </div>
  );
}
