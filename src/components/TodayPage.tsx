"use client";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Avatar } from "./RobotFace";
import { TasksPanel } from "./TasksPanel";
import { Icon, todayKey } from "./ui";
import { ModuleCards } from "./ModulePage";
import { EmptyState, Panel } from "./kit";
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
  const [review, setReview] = useState(false);
  const [projects, setProjects] = useState<number | null>(null);
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
  useEffect(() => {
    void db.from("projects").select("id", { count: "exact", head: true }).then(({ count }: { count: number | null }) => setProjects(count ?? 0));
  }, [db]);
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

  const date = now.toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
  const events = today?.events ?? [];
  const mails = [...(today?.emails ?? [])].sort((a, b) => Number(b.important) - Number(a.important));
  const upcoming = events.filter((e) => e.allDay || new Date(e.end) > now);
  const tips = today?.insights ?? [];
  const moment = momentOf(now);
  const nextEv = upcoming.find((e) => !e.allDay);
  const summary = [
    today?.connected ? (upcoming.length ? `${upcoming.length} ${upcoming.length === 1 ? "compromisso" : "compromissos"} pela frente` : "agenda livre") : null,
    `${progress.open} ${progress.open === 1 ? "tarefa" : "tarefas"} para hoje`,
  ].filter(Boolean).join(" · ");
  const showReview = props.review || review;

  return (
    <main className="page" id="conteudo">
      <div className="wrap dash">
        <section className="greet" aria-label="Saudação">
          <div className="greet-ava on-dark" aria-hidden="true"><Avatar mode={props.busy ? "thinking" : "idle"} compact /></div>
          <div className="greet-txt">
            <span className="greet-date">{date}</span>
            <h1>{greeting()}{props.name ? `, ${props.name}` : ""}.</h1>
            <p>{moment.lead} {summary ? `Agora: ${summary}.` : ""}</p>
          </div>
          <div className="greet-acts">
            {moment.id === "manha" ? (
              <button className="btn btn-pri" disabled={props.busy} onClick={props.onStartDay}><Icon name="sun" size={18} />Começar o dia</button>
            ) : moment.id === "tarde" ? (
              <button className="btn btn-pri" disabled={props.busy} onClick={() => props.onAsk("O que ainda falta fazer hoje?")}><Icon name="check" size={18} />O que falta hoje?</button>
            ) : (
              <button className="btn btn-pri" onClick={() => setReview(true)}><Icon name="check" size={18} />Revisar o dia</button>
            )}
            {moment.id === "noite" ? (
              <button className="btn" disabled={props.busy} onClick={() => props.onAsk("Me ajude a planejar amanhã.")}><Icon name="calendar" size={18} />Planejar amanhã</button>
            ) : (
              <button className="btn" onClick={() => props.onOpen("agenda")}><Icon name="calendar" size={18} />Ver agenda</button>
            )}
            <button className="btn btn-ghost" onClick={props.onDock}><Icon name="mic" size={18} />Falar</button>
          </div>
        </section>

        <section className="stats" aria-label="Visão rápida">
          <button className="stat" onClick={props.onOpenTasks}><Icon name="check" size={18} /><b>{progress.open}</b><span>tarefas hoje</span></button>
          <button className="stat" onClick={() => props.onOpen("agenda")}><Icon name="calendar" size={18} /><b>{today?.connected ? upcoming.length : "–"}</b><span>{today?.connected ? "compromissos" : "agenda desligada"}</span></button>
          <div className="stat"><Icon name="bell" size={18} /><b>{rems?.length ?? "–"}</b><span>lembretes</span></div>
          <button className="stat" onClick={() => props.onOpen("projetos")}><Icon name="folder" size={18} /><b>{projects ?? "–"}</b><span>projetos</span></button>
          {props.pendingMemories > 0 && <button className="stat hot" onClick={props.onOpenMemory}><Icon name="book" size={18} /><b>{props.pendingMemories}</b><span>memórias para revisar</span></button>}
        </section>

        {showReview && <ReviewCard onDone={() => { props.onReviewDone(); setReview(false); setTasksKey((k) => k + 1); }} />}

        <div className="sec-head"><h2>Precisa de atenção</h2></div>
        <div className="attn">
          <TasksPanel key={tasksKey} mode="today" title="Tarefas prioritárias" onSeeAll={props.onOpenTasks} onChange={(open, done) => setProgress({ open, done })} />

          <Panel title="Próximos compromissos" icon="calendar" action={today?.connected ? <button className="link" onClick={() => props.onOpen("agenda")}>Semana</button> : undefined}>
            {today === null ? <p className="muted">Carregando…</p>
              : !today.connected ? <EmptyState icon="calendar" title="Agenda não conectada" text="Conecte o Google para ver seus compromissos aqui." action={<a className="btn btn-sm btn-pri" href="/api/google/connect">Conectar</a>} />
              : today.error ? <p className="muted">Não consegui ler a agenda agora. <button className="link-btn" onClick={loadToday}>Tentar de novo</button></p>
              : upcoming.length === 0 ? <EmptyState icon="sun" title="Nada mais na agenda hoje" text="Bom momento para foco." />
              : (
                <ol className="timeline">
                  {upcoming.slice(0, 6).map((e, i) => {
                    const live = !e.allDay && new Date(e.start) <= now && new Date(e.end) > now;
                    return (
                      <li key={i} className={`${live ? "live" : ""} ${e === nextEv && !live ? "next" : ""}`}>
                        <span className="mono t">{e.allDay ? "dia todo" : hm(e.start)}</span>
                        <span className="ev">{e.title}{e.meet && <span className="mono muted"> · online</span>}{live && <span className="mono" style={{ color: "var(--sig)" }}> · agora</span>}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
          </Panel>

          <Panel title="Lembretes" icon="bell">
            {rems === null ? <p className="muted">Carregando…</p> : rems.length === 0 ? (
              <EmptyState icon="bell" title="Nenhum lembrete" text="Diga “me lembra amanhã às 9h de…” ou crie aqui." />
            ) : (
              <div className="rows">
                {rems.map((r) => (
                  <div className="row-i" key={r.id}>
                    <div className="grow">
                      <span className="t">{r.text}</span>
                      <span className="s" style={{ color: r.status === "sent" ? "var(--hot)" : undefined }}>{r.status === "sent" ? `avisado · ${dueLabel(r.due_at, now)}` : dueLabel(r.due_at, now)}</span>
                    </div>
                    <button className="btn btn-sm" onClick={() => setStatus(r.id, "done")} aria-label={`Concluir ${r.text}`}>Feito</button>
                    {r.status === "pending" && <button className="link-btn" onClick={() => setStatus(r.id, "cancelled")} aria-label={`Cancelar ${r.text}`}>Cancelar</button>}
                  </div>
                ))}
              </div>
            )}
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
          </Panel>

          {today?.connected && !today.error && (
            <Panel title="E-mails não lidos" icon="chat" action={<a className="link" href="https://mail.google.com/mail/u/0/#inbox" target="_blank" rel="noopener noreferrer">Gmail</a>}>
              {mails.length === 0 ? <EmptyState icon="check" title="Caixa em dia" text="Nada novo nos últimos 2 dias." /> : (
                <div className="rows">
                  {mails.slice(0, 5).map((m, i) => {
                    const done = tasked.has(m.thread ?? m.subject);
                    return (
                      <div key={i} className="row-i">
                        <a className="grow mail" href={mailLink(m)} target="_blank" rel="noopener noreferrer">
                          <span className="t">{m.from}{m.important && <span className="mono" style={{ color: "var(--hot)" }}> · importante</span>}</span>
                          <span className="s">{m.subject}</span>
                        </a>
                        <button className="link-btn" disabled={done} onClick={() => mailToTask(m)}>{done ? "✓ Tarefa" : "Virar tarefa"}</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          )}
        </div>

        <div className="sec-head"><h2>Recomendações do GaDu</h2></div>
        <Panel className="recs">
          {tips.length > 0 ? (
            <div className="rows">
              {tips.map((t, i) => (
                <div key={i} className="row-i">
                  <span className="rec-ico" aria-hidden="true"><Icon name={t.kind === "livre" ? "sun" : t.kind === "email" ? "chat" : t.kind === "atrasadas" ? "check" : "spark"} size={18} /></span>
                  <span className="grow">{t.text}</span>
                  <button className="btn btn-sm" disabled={props.busy} onClick={() => props.onAsk(`Me ajude com isto: ${t.text}`)}>Resolver</button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rows">
              {!today?.connected && today !== null && (
                <div className="row-i"><span className="rec-ico" aria-hidden="true"><Icon name="link" size={18} /></span><span className="grow">Conecte o Google para o GaDu avisar conflitos de agenda, janelas livres e e-mails parados.</span><a className="btn btn-sm" href="/api/google/connect">Conectar</a></div>
              )}
              <div className="row-i"><span className="rec-ico" aria-hidden="true"><Icon name="spark" size={18} /></span><span className="grow">{moment.id === "noite" ? "Antes de dormir, vale passar o que ficou pendente para amanhã." : "Peça ao GaDu para priorizar o seu dia a partir das tarefas e da agenda."}</span><button className="btn btn-sm" disabled={props.busy} onClick={() => props.onAsk(moment.id === "noite" ? "Me ajude a revisar o dia." : "Priorizar meu dia")}>{moment.id === "noite" ? "Revisar" : "Priorizar"}</button></div>
            </div>
          )}
          <div className="quick-wrap" aria-label="Peça ao GaDu">
            {HELP.map((h) => <button key={h.text} className="chip" disabled={props.busy} onClick={() => props.onAsk(h.text)}><Icon name={h.icon} size={16} />{h.text}</button>)}
          </div>
        </Panel>

        <div className="sec-head"><h2>Módulos do GaDu</h2><span className="muted">O que já funciona e o que está no plano</span></div>
        <ModuleCards onOpen={props.onOpen} />
      </div>
    </main>
  );
}

/** Momento do dia (Brasília): muda o tom da saudação e a ação principal. */
function momentOf(d: Date): { id: "manha" | "tarde" | "noite"; lead: string } {
  const h = Number(d.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", hour12: false }));
  if (h >= 5 && h < 12) return { id: "manha", lead: "Vamos organizar o dia." };
  if (h >= 12 && h < 18) return { id: "tarde", lead: "Acompanhe o que falta e o que vem a seguir." };
  return { id: "noite", lead: "Hora de revisar o dia e preparar amanhã." };
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
