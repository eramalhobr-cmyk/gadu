"use client";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Visual } from "./RobotFace";
import { TasksPanel } from "./TasksPanel";
import { Icon, Ring } from "./ui";

const HELP = [
  { icon: "spark", text: "Priorizar meu dia" },
  { icon: "check", text: "Revisar minhas tarefas abertas" },
  { icon: "grid", text: "Planejar minha semana" },
  { icon: "chat", text: "Quais e-mails pedem resposta?" },
];

type Ev = { title: string; start: string; end: string; allDay: boolean; where?: string; meet: boolean };
type Mail = { thread?: string; from: string; subject: string; snippet: string; important: boolean };
type Today = { connected: boolean; events?: Ev[]; emails?: Mail[]; error?: string };
type Reminder = { id: number; text: string; due_at: string; status: "pending" | "sent" | "done" | "cancelled" };

const TZ = "America/Sao_Paulo";
const hm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });

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
  onStartDay: () => void;
  onTalk: () => void;
  onOpenMemory: () => void;
  onOpenTasks: () => void;
  onAsk: (q: string) => void;
}) {
  const [progress, setProgress] = useState({ open: 0, done: 0 });
  const [today, setToday] = useState<Today | null>(null);
  const [rems, setRems] = useState<Reminder[] | null>(null);
  const [text, setText] = useState("");
  const [when, setWhen] = useState("");
  const [msg, setMsg] = useState("");
  const [now, setNow] = useState(() => new Date());
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

  const date = now.toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
  const events = today?.events ?? [];
  const mails = [...(today?.emails ?? [])].sort((a, b) => Number(b.important) - Number(a.important));
  const nextIdx = events.findIndex((e) => !e.allDay && new Date(e.end) > now);

  return (
    <main className="page today">
      <div className="col">
      <section className="hero">
        <div className="hero-brain" aria-hidden="true"><Visual kind="brain" mode="idle" compact label="" /></div>
        <div className="hero-text">
          <div className="mono muted">{date}</div>
          <h1>{greeting()}{props.name ? `, ${props.name}` : ""}.</h1>
        </div>
      </section>
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <button className="btn btn-pri" style={{ flex: 1 }} disabled={props.busy} onClick={props.onStartDay}>Começar o dia</button>
        <button className="btn" onClick={props.onTalk} aria-label="Falar com o GaDu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M12 3.5a3 3 0 0 0-3 3V12a3 3 0 0 0 6 0V6.5a3 3 0 0 0-3-3zM5.5 12a6.5 6.5 0 0 0 13 0M12 18.5V21" /></svg>
          Falar
        </button>
      </div>

        <section className="card progress">
          <Ring value={progress.done} total={progress.done + progress.open} label="Progresso do dia" />
          <div>
            <h2>Progresso do dia</h2>
            <div className="mono" style={{ color: "var(--sig)" }}>{progress.done} concluídas</div>
            <div className="mono muted">{progress.open} pendentes para hoje</div>
          </div>
        </section>
        <section className="card help">
          <h2>Como posso ajudar?</h2>
          {HELP.map((h) => (
            <button key={h.text} className="help-item" disabled={props.busy} onClick={() => props.onAsk(h.text)}>
              <Icon name={h.icon} size={18} /><span>{h.text}</span><span aria-hidden="true">›</span>
            </button>
          ))}
        </section>
      {props.pendingMemories > 0 && (
        <button className="card card-link" onClick={props.onOpenMemory}>
          <span><b style={{ color: "var(--hot)" }}>{props.pendingMemories}</b> {props.pendingMemories === 1 ? "memória para revisar" : "memórias para revisar"}</span>
          <span aria-hidden="true">›</span>
        </button>
      )}
      </div>
      <div className="col">
      <section className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Agenda de hoje</h2>
          {today?.connected && <a className="mono" href="https://calendar.google.com/calendar/r/day" target="_blank" rel="noopener noreferrer">Abrir agenda ›</a>}
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
              <div style={{ textDecoration: r.status === "sent" ? "none" : undefined }}>{r.text}</div>
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
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <label className="sr" htmlFor="rem-when">Quando</label>
            <input id="rem-when" className="field" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            <button className="btn" type="submit" disabled={!text.trim() || !when}>Criar</button>
          </div>
          {msg && <span className="muted" role="status">{msg}</span>}
        </form>
      </section>
      </div>
      <div className="col">
        <TasksPanel mode="today" title="Tarefas prioritárias" onSeeAll={props.onOpenTasks} onChange={(open, done) => setProgress({ open, done })} />
      <section className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>E-mails não lidos</h2>
          {today?.connected && <a className="mono" href="https://mail.google.com/mail/u/0/#inbox" target="_blank" rel="noopener noreferrer">Abrir Gmail ›</a>}
        </div>
        {today === null ? <p className="muted">Carregando…</p>
          : !today.connected ? <p className="muted" style={{ margin: 0 }}>Conecte o Google para ver aqui.</p>
          : today.error ? <p className="muted">Não consegui ler os e-mails agora.</p>
          : mails.length === 0 ? <p className="muted">Caixa de entrada em dia nos últimos 2 dias.</p>
          : mails.slice(0, 8).map((m, i) => (
            <a key={i} className="item mail" href={m.thread ? `https://mail.google.com/mail/u/0/#inbox/${m.thread}` : "https://mail.google.com/mail/u/0/#inbox"} target="_blank" rel="noopener noreferrer">
              <span className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                <span className="conv-title">{m.from}</span>
                {m.important && <span className="mono" style={{ color: "var(--hot)" }}>importante</span>}
              </span>
              <span>{m.subject}</span>
              {m.snippet && <span className="conv-sum">{m.snippet}</span>}
            </a>
          ))}
      </section>
      </div>
    </main>
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
