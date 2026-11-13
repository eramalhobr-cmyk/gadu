"use client";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { AgendaView } from "./AgendaView";
import { Avatar } from "./RobotFace";
import { TasksPanel } from "./TasksPanel";
import { Icon, Ring, todayKey } from "./ui";
import { ModuleCards } from "./ModulePage";
import type { ViewId } from "@/lib/modules";

const HELP = [
  { icon: "spark", text: "Priorizar meu dia" },
  { icon: "check", text: "Revisar minhas tarefas abertas" },
  { icon: "grid", text: "Planejar minha semana" },
  { icon: "chat", text: "Quais e-mails pedem resposta?" },
];

type Ev = { title: string; start: string; end: string; allDay: boolean; where?: string; meet: boolean };
type Mail = { thread?: string; from: string; subject: string; snippet: string; important: boolean };
type Insight = { kind: string; text: string };
type Today = { connected: boolean; events?: Ev[]; emails?: Mail[]; insights?: Insight[]; error?: string };
type Reminder = { id: number; text: string; due_at: string; status: "pending" | "sent" | "done" | "cancelled" };
type LateTask = { id: number; title: string; due_date: string | null };

const TZ = "America/Sao_Paulo";
const hm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const mailLink = (m: Mail) => (m.thread ? `https://mail.google.com/mail/u/0/#inbox/${m.thread}` : "https://mail.google.com/mail/u/0/#inbox");

/** "hoje 14:00", "amanhã 09:00", "sex 14/11 09:00". */
export function dueLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const today = dayKey(now);
  const tomorrow = dayKey(new Date(now.getTime() + 86_400_000));
  const k = dayKey(d);
  if (k === today) return `hoje ${hm(iso)}`;
  if (k === tomorrow) return `amanhã ${hm(iso)}`;
  return `${d.toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "")} ${hm(iso)}`;
}

function greeting(): string {
  const h = Number(new Date().toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", hour12: false }));
  return h < 5 ? "Boa noite" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export function TodayPage(props: {
  name: string;
  pendingMemories: number;
  busy: boolean;
  review: boolean;
  onReviewDone: () => void;
  onStartDay: () => void;
  onTalk: () => void;
  onDock: () => void;
  onWrite: () => void;
  onOpenMemory: () => void;
  onOpenTasks: () => void;
  onAsk: (q: string) => void;
  onOpen: (view: ViewId) => void;
}) {
  const [progress, setProgress] = useState({ open: 0, done: 0 });
  const [today, setToday] = useState<Today | null>(null);
  const [rems, setRems] = useState<Reminder[] | null>(null);
  const [text, setText] = useState("");
  const [when, setWhen] = useState("");
  const [msg, setMsg] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [agenda, setAgenda] = useState(false);
  const [tasked, setTasked] = useState<Set<string>>(new Set());
  const [tasksKey, setTasksKey] = useState(0);
  const db = supabaseBrowser();

  const loadToday = useCallback(async () => {
    try {
      const r = await fetch("/api/today?days=1", { cache: "no-store" });
      setToday(await r.json());
    } catch {
      setToday({ connected: true, error: "rede" });
    }
  }, []);
  const loadRems = useCallback(async () => {
    const since = new Date(Date.now() - 12 * 3_600_000).toISOString();
    const { data } = await db.from("reminders").select("id, text, due_at, status").in("status", ["pending", "sent"]).gte("due_at", since).order("due_at").limit(30);
    setRems((data as Reminder[]) ?? []);
  }, [db]);

  useEffect(() => { void loadToday(); void loadRems(); }, [loadToday, loadRems]);
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(id); }, []);

  async function setStatus(id: number, status: "done" | "cancelled") {
    await db.from("reminders").update({ status }).eq("id", id);
    void loadRems();
  }

  async function addReminder(e: React.FormEvent) {
    e.preventDefault();
    const due = new Date(when);
    if (!text.trim() || Number.isNaN(due.getTime())) return setMsg("Escreva o lembrete e escolha dia e hora.");
    if (due.getTime() < Date.now() + 30_000) return setMsg("Escolha um horário no futuro.");
    const { error } = await db.from("reminders").insert({ text: text.trim().slice(0, 300), due_at: due.toISOString() });
    if (error) return setMsg("Não salvou. Tente de novo.");
    setText(""); setWhen(""); setMsg("");
    void loadRems();
  }

  /** E-mail vira tarefa, com link para abrir o e-mail depois. */
  async function mailToTask(m: Mail) {
    const key = m.thread ?? m.subject;
    const { error } = await db.from("tasks").insert({ title: `Responder ${m.from}: ${m.subject}`.slice(0, 200), origin: "E-mail", link: mailLink(m), priority: m.important ? 1 : 2, due_date: todayKey() });
    if (!error) { setTasked((s) => new Set(s).add(key)); setTasksKey((k) => k + 1); }
  }

  if (agenda) return <AgendaView onBack={() => { setAgenda(false); void loadToday(); }} />;

  const date = now.toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
  const events = today?.events ?? [];
  const mails = [...(today?.emails ?? [])].sort((a, b) => Number(b.important) - Number(a.important));
  const nextIdx = events.findIndex((e) => !e.allDay && new Date(e.end) > now);
  const tips = today?.insights ?? [];

  return (
    <main className="page" id="conteudo">
      <div className="wrap dash">
        <section className="dash-hero on-dark">
          <div className="txt">
            <span className="mono muted">{date}</span>
            <h1>{greeting()}{props.name ? `, ${props.name}` : ""}.</h1>
            <span className="muted">{today?.connected ? `${events.length} ${events.length === 1 ? "compromisso" : "compromissos"} hoje · ` : ""}{progress.open} {progress.open === 1 ? "tarefa pendente" : "tarefas pendentes"}</span>
            <div className="cta">
              <button className="btn btn-pri" disabled={props.busy} onClick={props.onStartDay}><Icon name="sun" size={18} />Começar o dia</button>
              <button className="btn" onClick={props.onDock}><Icon name="mic" size={18} />Falar com o GaDu</button>
            </div>
          </div>
          <div className="ava" aria-hidden="true"><Avatar mode={props.busy ? "thinking" : "idle"} compact /></div>
        </section>

        <div className="kpis">
          <button className="kpi sig" onClick={props.onOpenTasks}><span className="n">{progress.open}</span><span className="l">tarefas para hoje</span></button>
          <div className="kpi"><span className="n">{today?.connected ? events.length : "–"}</span><span className="l">{today?.connected ? "compromissos hoje" : "agenda não conectada"}</span></div>
          <div className="kpi"><span className="n">{rems?.length ?? "–"}</span><span className="l">lembretes ativos</span></div>
          <button className={`kpi ${props.pendingMemories > 0 ? "hot" : ""}`} onClick={props.onOpenMemory}><span className="n">{props.pendingMemories}</span><span className="l">memórias para revisar</span></button>
        </div>

        <div className="quick-row" aria-label="Peça ao GaDu">
          {HELP.map((h) => (
            <button key={h.text} className="chip" disabled={props.busy} onClick={() => props.onAsk(h.text)}><Icon name={h.icon} size={16} />{h.text}</button>
          ))}
          <button className="chip" onClick={props.onWrite}><Icon name="chat" size={16} />Escrever para o GaDu</button>
        </div>

        {props.review && <ReviewCard onDone={() => { props.onReviewDone(); setTasksKey((k) => k + 1); }} />}

        <div className="dash-grid">
      <div className="col">
        {tips.length > 0 && (
          <section className="card insights">
            <h2>Insights do GaDu</h2>
            {tips.map((t, i) => (
              <div key={i} className="insight"><Icon name={t.kind === "livre" ? "sun" : t.kind === "email" ? "chat" : t.kind === "atrasadas" ? "check" : "spark"} size={16} /><span>{t.text}</span></div>
            ))}
          </section>
        )}
        <section className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>Agenda de hoje</h2>
            {today?.connected && <button className="link-btn mono" style={{ color: "var(--sig)", textDecoration: "none" }} onClick={() => setAgenda(true)}>Ver semana ›</button>}
          </div>
          {today === null ? <p className="muted">Carregando…</p>
            : !today.connected ? <ConnectHint />
            : today.error ? <p className="muted">Não consegui ler a agenda agora. <button className="link-btn" onClick={loadToday}>Tentar de novo</button></p>
            : events.length === 0 ? <p className="muted">Nada marcado hoje. Bom dia para foco.</p>
            : (
              <ol className="timeline">
                {events.map((e, i) => {
                  const past = !e.allDay && new Date(e.end) <= now;
                  const live = !e.allDay && new Date(e.start) <= now && new Date(e.end) > now;
                  return (
                    <li key={i} className={`${past ? "past" : ""} ${live ? "live" : ""} ${i === nextIdx && !live ? "next" : ""}`}>
                      <span className="mono t">{e.allDay ? "dia todo" : hm(e.start)}</span>
                      <span className="ev">{e.title}{e.meet && <span className="mono muted"> · online</span>}{live && <span className="mono" style={{ color: "var(--sig)" }}> · agora</span>}</span>
                    </li>
                  );
                })}
              </ol>
            )}
        </section>
        <section className="card">
          <h2>Lembretes</h2>
          {rems === null ? <p className="muted">Carregando…</p> : rems.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>Nenhum lembrete. Diga “me lembra amanhã às 9h de…” ou crie aqui.</p>
          ) : rems.map((r) => (
            <div className="item rem" key={r.id}>
              <div style={{ minWidth: 0 }}>
                <div>{r.text}</div>
                <div className="mono" style={{ color: r.status === "sent" ? "var(--hot)" : "var(--ink-3)" }}>{r.status === "sent" ? `avisado · ${dueLabel(r.due_at, now)}` : dueLabel(r.due_at, now)}</div>
              </div>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <button className="btn btn-sm" onClick={() => setStatus(r.id, "done")} aria-label={`Concluir ${r.text}`}>Feito</button>
                {r.status === "pending" && <button className="link-btn" onClick={() => setStatus(r.id, "cancelled")} aria-label={`Cancelar ${r.text}`}>Cancelar</button>}
              </div>
            </div>
          ))}
          <form onSubmit={addReminder} className="rem-form">
            <label className="sr" htmlFor="rem-text">Novo lembrete</label>
            <input id="rem-text" className="field" placeholder="Lembrar de…" value={text} maxLength={300} onChange={(e) => setText(e.target.value)} />
            {text.trim() && (
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <label className="sr" htmlFor="rem-when">Quando</label>
                <input id="rem-when" className="field" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
                <button className="btn" type="submit" disabled={!when}>Criar</button>
              </div>
            )}
            {msg && <span className="muted" role="status">{msg}</span>}
          </form>
        </section>
      </div>

      <div className="col">
        <TasksPanel key={tasksKey} mode="today" title="Tarefas prioritárias" onSeeAll={props.onOpenTasks} onChange={(open, done) => setProgress({ open, done })} />
        <section className="card progress">
          <Ring value={progress.done} total={progress.done + progress.open} label="Progresso do dia" />
          <div>
            <h2>Progresso do dia</h2>
            <div className="mono" style={{ color: "var(--sig)" }}>{progress.done} concluídas</div>
            <div className="mono muted">{progress.open} pendentes para hoje</div>
          </div>
        </section>
      </div>

      <div className="col wide">
        <section className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>E-mails não lidos</h2>
            {today?.connected && <a className="mono" href="https://mail.google.com/mail/u/0/#inbox" target="_blank" rel="noopener noreferrer">Abrir Gmail ›</a>}
          </div>
          {today === null ? <p className="muted">Carregando…</p>
            : !today.connected ? <p className="muted" style={{ margin: 0 }}>Conecte o Google para ver aqui.</p>
            : today.error ? <p className="muted">Não consegui ler os e-mails agora.</p>
            : mails.length === 0 ? <p className="muted">Caixa de entrada em dia nos últimos 2 dias.</p>
            : mails.slice(0, 8).map((m, i) => {
              const done = tasked.has(m.thread ?? m.subject);
              return (
                <div key={i} className="item mail-row">
                  <a className="mail" href={mailLink(m)} target="_blank" rel="noopener noreferrer">
                    <span className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                      <span className="conv-title">{m.from}</span>
                      {m.important && <span className="mono" style={{ color: "var(--hot)" }}>importante</span>}
                    </span>
                    <span>{m.subject}</span>
                    {m.snippet && <span className="conv-sum">{m.snippet}</span>}
                  </a>
                  <button className="link-btn" disabled={done} onClick={() => mailToTask(m)}>{done ? "✓ Virou tarefa" : "Virar tarefa"}</button>
                </div>
              );
            })}
        </section>
      </div>
        </div>

        <div className="sec-head"><h2>Módulos do GaDu</h2><span className="muted">O que já funciona e o que está no plano</span></div>
        <ModuleCards onOpen={props.onOpen} />
      </div>
    </main>
  );
}

/** Revisão da noite: o que ficou para hoje vai para amanhã, vira feito ou fica sem prazo. */
function ReviewCard({ onDone }: { onDone: () => void }) {
  const [items, setItems] = useState<LateTask[] | null>(null);
  const db = supabaseBrowser();
  const load = useCallback(async () => {
    const { data } = await db.from("tasks").select("id, title, due_date").eq("status", "open").lte("due_date", todayKey()).order("due_date").limit(30);
    setItems((data as LateTask[]) ?? []);
  }, [db]);
  useEffect(() => { void load(); }, [load]);

  const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA", { timeZone: TZ });
  async function act(t: LateTask, kind: "done" | "tomorrow" | "nodate") {
    const patch = kind === "done" ? { status: "done", done_at: new Date().toISOString() } : kind === "tomorrow" ? { due_date: tomorrow } : { due_date: null };
    setItems((xs) => xs?.filter((x) => x.id !== t.id) ?? null);
    await db.from("tasks").update(patch).eq("id", t.id);
  }
  async function allTomorrow() {
    if (!items?.length) return;
    await db.from("tasks").update({ due_date: tomorrow }).in("id", items.map((t) => t.id));
    setItems([]);
  }

  return (
    <section className="card review">
      <h2>Revisão do dia</h2>
      {items === null ? <p className="muted">Carregando…</p> : items.length === 0 ? (
        <p style={{ margin: 0 }}>Tudo em dia. Bom descanso!</p>
      ) : (
        <>
          {items.map((t) => (
            <div className="item" key={t.id}>
              <span>{t.title}</span>
              <div className="row">
                <button className="btn btn-sm btn-pri" onClick={() => act(t, "tomorrow")}>Amanhã</button>
                <button className="btn btn-sm" onClick={() => act(t, "done")}>Feito</button>
                <button className="link-btn" onClick={() => act(t, "nodate")}>Sem prazo</button>
              </div>
            </div>
          ))}
          <div><button className="btn btn-sm" onClick={allTomorrow}>Passar tudo para amanhã</button></div>
        </>
      )}
      <div><button className="link-btn" onClick={onDone}>Fechar revisão</button></div>
    </section>
  );
}

function ConnectHint() {
  return (
    <div className="row" style={{ justifyContent: "space-between" }}>
      <span className="muted">Conecte o Google para ver agenda e e-mails aqui.</span>
      <a className="btn btn-sm btn-pri" href="/api/google/connect">Conectar</a>
    </div>
  );
}
