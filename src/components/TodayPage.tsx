"use client";
import { MSG } from "@/lib/errors";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { showNotice, showUndo, UNDO_TEXT } from "@/lib/undo";
import { Avatar } from "./RobotFace";
import { Icon, todayKey } from "./ui";
import { EmptyState, Panel } from "./kit";
import { Kpi, KpiRow } from "./charts";
import { AttentionCard } from "./AttentionCard";
import { PercepcoesCard } from "./PercepcoesCard";
import type { Insight } from "@/lib/insights";
import type { ViewId } from "@/lib/modules";
import { dayProgress, laterToday, progressText, startOfTodayIso } from "@/lib/hoje-faixas";

type Ev = { title: string; start: string; end: string; allDay: boolean; where?: string; meet: boolean };
type Mail = { thread?: string; from: string; subject: string; snippet: string; important: boolean };
type Today = { connected: boolean; events?: Ev[]; emails?: Mail[]; insights?: Insight[]; error?: string };
type Reminder = { id: number; text: string; due_at: string; status: "pending" | "sent" | "done" | "cancelled" };
type GoalSum = { ativas: number; atrasadas: number; atencao: { id: string; titulo: string; pct: number; semDados: boolean; texto: string }[] };
type LateTask = { id: number; title: string; due_date: string | null };

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

/** Atalhos de voz do Hoje: frases prontas, ditas com um toque. */
const SAY = [
  { icon: "spark", text: "Priorizar meu dia" },
  { icon: "chat", text: "Quais e-mails pedem resposta?" },
  { icon: "calendar", text: "Planejar minha semana" },
];

/** Tela Hoje (UX-2): no máximo 5 blocos e cerca de 2 telas no celular.
 * (1) saudação com "Falar com o GaDu"; (2) Agora; (3) lista única "Merece sua atenção"; (4) atalhos de voz; (5) Ver tudo. */
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
  goalsEnabled: boolean;
  financeEnabled?: boolean;
}) {
  const [today, setToday] = useState<Today | null>(null);
  const [rems, setRems] = useState<Reminder[] | null>(null);
  const [openTasks, setOpenTasks] = useState<number | null>(null);
  const [attn, setAttn] = useState<number | null>(null);
  const [showRems, setShowRems] = useState(false);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [when, setWhen] = useState("");
  const [msg, setMsg] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [review, setReview] = useState(false);
  const [attnKey, setAttnKey] = useState(0);
  const [doneToday, setDoneToday] = useState<number | null>(null);
  const [goals, setGoals] = useState<GoalSum | null>(null);
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
    void db.from("tasks").select("id", { count: "exact", head: true }).eq("status", "open").lte("due_date", todayKey())
      .then(({ count }: { count: number | null }) => setOpenTasks(count ?? 0));
  }, [db, attnKey]);
  useEffect(() => {
    void db.from("tasks").select("id", { count: "exact", head: true }).eq("status", "done").gte("done_at", startOfTodayIso(new Date()))
      .then(({ count }: { count: number | null }) => setDoneToday(count ?? 0));
  }, [db, attnKey]);
  useEffect(() => {
    if (!props.goalsEnabled) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/goals/resumo", { cache: "no-store" });
        const j = r.ok ? await r.json() : null;
        if (alive && j?.enabled) setGoals({ ativas: j.ativas ?? 0, atrasadas: j.atrasadas ?? 0, atencao: Array.isArray(j.atencao) ? j.atencao : [] });
      } catch { /* sem metas: a faixa mostra só as tarefas */ }
    })();
    return () => { alive = false; };
  }, [props.goalsEnabled, attnKey]);
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(id); }, []);

  async function setStatus(id: number, status: "done" | "cancelled") {
    const prev = rems?.find((r) => r.id === id)?.status ?? "pending";
    const { error } = await db.from("reminders").update({ status }).eq("id", id);
    if (error) showNotice(UNDO_TEXT.failSave);
    else showUndo(status === "done" ? UNDO_TEXT.done : "Lembrete cancelado.", async () => {
      const r = await db.from("reminders").update({ status: prev }).eq("id", id);
      void loadRems(); setAttnKey((k) => k + 1);
      return r;
    });
    void loadRems();
    setAttnKey((k) => k + 1);
  }

  async function addReminder(e: React.FormEvent) {
    e.preventDefault();
    const due = new Date(when);
    if (!text.trim() || Number.isNaN(due.getTime())) return setMsg("Escreva o lembrete e escolha dia e hora.");
    if (due.getTime() < Date.now() + 30_000) return setMsg("Escolha um horário no futuro.");
    const { error } = await db.from("reminders").insert({ text: text.trim().slice(0, 300), due_at: due.toISOString() });
    if (error) return setMsg(MSG.save);
    setText(""); setWhen(""); setMsg(""); setAdding(false);
    void loadRems();
    setAttnKey((k) => k + 1);
  }

  const date = now.toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
  const events = today?.events ?? [];
  const upcoming = events.filter((e) => e.allDay || new Date(e.end) > now);
  const moment = momentOf(now);
  const nextEv = upcoming.find((e) => !e.allDay);
  const summary = attn === null ? "" : attn === 0 ? "Nada pendente por enquanto." : `${attn} ${attn === 1 ? "coisa pede" : "coisas pedem"} sua atenção.`;
  const showReview = props.review || review;
  const later = laterToday(events, rems ?? [], now, nextEv?.start);
  const pct = doneToday === null || openTasks === null ? null : dayProgress(doneToday, openTasks);

  return (
    <main className="page" id="conteudo">
      <div className="wrap dash today2">
        {/* Faixa 1 · Agora (UX-7): saudação, próximo compromisso e a lista do que pede atenção. */}
        <section className="band band-agora" aria-labelledby="band-agora">
        <h2 id="band-agora" className="band-t"><i aria-hidden="true" />Agora</h2>
        {/* (1) Saudação: o botão principal é falar. A ação do momento fica ao lado. */}
        <section className="greet" aria-label="Saudação">
          <div className="greet-ava on-dark" aria-hidden="true"><Avatar mode={props.busy ? "thinking" : "idle"} compact /></div>
          <div className="greet-txt">
            <span className="greet-date">{date}</span>
            <h1>{greeting()}{props.name ? `, ${props.name}` : ""}.</h1>
            <p>{moment.lead} {summary}</p>
          </div>
          <div className="greet-acts">
            <button className="btn btn-pri talk-big" onClick={props.onDock}><Icon name="mic" size={22} />Falar com o GaDu</button>
            {moment.id === "manha" ? (
              <button className="btn" disabled={props.busy} onClick={props.onStartDay}><Icon name="sun" size={18} />Começar o dia</button>
            ) : moment.id === "tarde" ? (
              <button className="btn" disabled={props.busy} onClick={() => props.onAsk("O que ainda falta fazer hoje?")}><Icon name="check" size={18} />O que falta hoje?</button>
            ) : (
              <button className="btn" onClick={() => setReview(true)}><Icon name="check" size={18} />Revisar o dia</button>
            )}
          </div>
        </section>

        {/* (2) Agora: o próximo compromisso real. Sem agenda conectada, um convite curto para conectar. */}
        {today?.connected ? (
          <section className="now-card" aria-label="Agora">
            <span className="now-ico" aria-hidden="true"><Icon name="calendar" size={18} /></span>
            {nextEv ? (
              <p><small>{new Date(nextEv.start) <= now ? "Acontecendo agora" : `Próximo, às ${hm(nextEv.start)}`}</small><b>{nextEv.title}</b></p>
            ) : (
              <p><small>Agora</small><b>{upcoming.length ? "Só compromissos de dia inteiro hoje" : "Agenda livre pelo resto do dia"}</b></p>
            )}
            <button className="btn btn-sm" onClick={() => props.onOpen("agenda")}>Agenda</button>
          </section>
        ) : today !== null && (
          <section className="now-card" aria-label="Agora">
            <span className="now-ico" aria-hidden="true"><Icon name="link" size={18} /></span>
            <p><small>Agenda e e-mails</small><b>Conecte o Google para ver aqui</b></p>
            <a className="btn btn-sm btn-pri" href="/api/google/connect">Conectar</a>
          </section>
        )}

        {showReview && <ReviewCard onDone={() => { props.onReviewDone(); setReview(false); setAttnKey((k) => k + 1); }} />}

        {/* (3) Uma lista só: tarefas, lembretes, compromissos, e-mails, metas e memórias, com Feito/Adiar no item. */}
        <AttentionCard key={attnKey} busy={props.busy} onOpen={props.onOpen} onAsk={props.onAsk} goalsEnabled={props.goalsEnabled} financeEnabled={props.financeEnabled} pendingMemories={props.pendingMemories} onCount={setAttn} />

        </section>

        {/* Faixa 2 · Depois: o que ainda vem hoje e as percepções do dia. */}
        <section className="band band-depois" aria-labelledby="band-depois">
          <h2 id="band-depois" className="band-t"><i aria-hidden="true" />Depois</h2>
          {later.length ? (
            <ol className="later">
              {later.map((i) => (
                <li key={`${i.kind}-${i.at}-${i.title}`} className="later-i">
                  <time dateTime={i.at}>{hm(i.at)}</time>
                  <Icon name={i.kind === "evento" ? "calendar" : "bell"} size={16} />
                  <span>{i.title}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted band-empty">Nada marcado para mais tarde. Diga: “Me lembra às 18h de…”</p>
          )}
          {/* Percepções do dia (sem IA) com Aceitar/Ignorar e Desfazer. */}
          <PercepcoesCard items={today?.insights ?? []} onOpen={props.onOpen} onChanged={() => setAttnKey((k) => k + 1)} />
          <button className="say-chip" disabled={props.busy} onClick={() => props.onAsk("O que tenho mais tarde hoje?")}><Icon name="mic" size={14} />“O que tenho mais tarde hoje?”</button>
        </section>

        {/* Faixa 3 · Progresso: tarefas feitas hoje e metas que pedem atenção. */}
        <section className="band band-prog" id="painel" aria-labelledby="band-prog">
          <h2 id="band-prog" className="band-t"><i aria-hidden="true" />Progresso</h2>
          {/* Resumo do dia em números (tema JARVIS): só contagens reais; "–" enquanto carrega ou sem fonte. */}
          <KpiRow label="Resumo do dia">
            <Kpi label="Compromissos" value={today?.connected ? upcoming.length : "–"} sub={today?.connected ? "ainda hoje" : "agenda não conectada"} />
            <Kpi label="Pedem atenção" value={attn ?? "–"} tone={attn ? "hot" : undefined} />
            <Kpi label="Tarefas abertas" value={openTasks ?? "–"} />
            <Kpi label="Feitas hoje" value={doneToday ?? "–"} tone="ok" />
          </KpiRow>
          <div className="prog-day">
            <div className="prog-ring" role="img" aria-label={pct === null ? "Sem tarefas para hoje" : `${pct}% das tarefas de hoje feitas`} style={{ ["--p" as string]: `${pct ?? 0}` }}><b>{pct === null ? "–" : `${pct}%`}</b></div>
            <p>{doneToday === null || openTasks === null ? "Carregando…" : progressText(doneToday, openTasks)}</p>
          </div>
          {goals && (
            <div className="prog-goals">
              {goals.atencao.slice(0, 2).map((g) => (
                <button key={g.id} className="prog-goal" onClick={() => props.onOpen("metas")}>
                  <span className="t">{g.titulo}</span>
                  {!g.semDados && <span className="bar" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, g.pct))}%` }} /></span>}
                  <span className="s">{g.texto}</span>
                </button>
              ))}
              {goals.atencao.length === 0 && <p className="muted">{goals.ativas ? `${goals.ativas} ${goals.ativas === 1 ? "meta ativa" : "metas ativas"}, todas no ritmo.` : "Nenhuma meta ativa. Diga: “Quero correr 50 km este mês”."}</p>}
            </div>
          )}
          <button className="say-chip" disabled={props.busy} onClick={() => props.onAsk(goals ? "Como estou nas minhas metas?" : "Como foi o meu dia até agora?")}><Icon name="mic" size={14} />{goals ? "“Como estou nas minhas metas?”" : "“Como foi o meu dia até agora?”"}</button>
        </section>

        {/* Só 1 ação principal e até 2 secundárias à vista (UX-4): o resto fica em "Mais opções". */}
        <details className="more-opts">
          <summary>Mais opções</summary>
        {/* (4) Atalhos de voz. */}
        <section className="voicesc" aria-labelledby="say-h">
          <h2 id="say-h">Peça com um toque</h2>
          <div className="voicesc-list">
            {SAY.map((h) => <button key={h.text} className="voicesc-i" disabled={props.busy} onClick={() => props.onAsk(h.text)}><Icon name={h.icon} size={20} /><span>{h.text}</span></button>)}
          </div>
        </section>

        {/* (5) Ver tudo: os números levam para a lista completa. Lembretes abrem aqui mesmo. */}
        <section className="see-all" aria-labelledby="see-h">
          <h2 id="see-h">Ver tudo</h2>
          <div className="see-grid">
            <button className="see-i" onClick={props.onOpenTasks}><Icon name="check" size={20} /><b>{openTasks ?? "–"}</b><span>{openTasks === 1 ? "tarefa para hoje" : "tarefas para hoje"}</span></button>
            <button className="see-i" onClick={() => props.onOpen("agenda")}><Icon name="calendar" size={20} /><b>{today?.connected ? upcoming.length : "–"}</b><span>{today?.connected ? (upcoming.length === 1 ? "compromisso" : "compromissos") : "agenda desligada"}</span></button>
            <button className="see-i" aria-expanded={showRems} aria-controls="rem-list" onClick={() => setShowRems((v) => !v)}><Icon name="bell" size={20} /><b>{rems?.length ?? "–"}</b><span>{rems?.length === 1 ? "lembrete" : "lembretes"}</span></button>
            <button className="see-i" onClick={() => props.onOpen("modulos")}><Icon name="grid" size={20} /><b aria-hidden="true">+</b><span>Mais</span></button>
          </div>
          {showRems && (
            <Panel title={`Lembretes${rems?.length ? ` · ${rems.length}` : ""}`} icon="bell" id="rem-list" action={!adding ? <button className="btn btn-sm btn-pri" onClick={() => setAdding(true)}><Icon name="plus" size={16} />Novo lembrete</button> : undefined}>
              {rems === null ? <p className="muted">Carregando…</p> : rems.length === 0 ? (
                <EmptyState icon="bell" title="Nenhum lembrete" text="Eu aviso na hora que você escolher." phrase="Me lembra amanhã às 9h de ligar para o dentista" />
              ) : (
                <div className="rows">
                  {rems.map((r) => (
                    <div className="row-i" key={r.id}>
                      <div className="grow">
                        <span className="t">{r.text}</span>
                        <span className={`s ${r.status === "sent" ? "c-hot" : ""}`}>{r.status === "sent" ? `avisado · ${dueLabel(r.due_at, now)}` : dueLabel(r.due_at, now)}</span>
                      </div>
                      <button className="btn btn-sm" onClick={() => setStatus(r.id, "done")} aria-label={`Concluir ${r.text}`}>Feito</button>
                      {r.status === "pending" && <button className="btn btn-sm btn-ghost" onClick={() => setStatus(r.id, "cancelled")} aria-label={`Cancelar ${r.text}`}>Cancelar</button>}
                    </div>
                  ))}
                </div>
              )}
              {adding && (
                <form onSubmit={addReminder} className="rem-form">
                  <label className="sr" htmlFor="rem-text">Novo lembrete</label>
                  <input id="rem-text" className="field" placeholder="Lembrar de…" value={text} maxLength={300} onChange={(e) => setText(e.target.value)} autoFocus />
                  <div className="row nowrap">
                    <label className="sr" htmlFor="rem-when">Quando</label>
                    <input id="rem-when" className="field" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
                    <button className="btn" type="submit" disabled={!text.trim() || !when}>Criar</button>
                  </div>
                  {msg && <span className="muted" role="status">{msg}</span>}
                </form>
              )}
            </Panel>
          )}
        </section>
        </details>
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
    const back = kind === "done" ? { status: "open", done_at: null } : { due_date: t.due_date };
    setItems((xs) => xs?.filter((x) => x.id !== t.id) ?? null);
    const { error } = await db.from("tasks").update(patch).eq("id", t.id);
    if (error) { showNotice(UNDO_TEXT.failSave); void load(); return; }
    showUndo(kind === "done" ? UNDO_TEXT.done : kind === "tomorrow" ? UNDO_TEXT.later : "Ficou sem prazo.", async () => { const r = await db.from("tasks").update(back).eq("id", t.id); void load(); return r; });
  }
  async function allTomorrow() {
    if (!items?.length) return;
    const before = items.map((t) => ({ id: t.id, due_date: t.due_date }));
    const { error } = await db.from("tasks").update({ due_date: tomorrow }).in("id", before.map((t) => t.id));
    if (error) return showNotice(UNDO_TEXT.failSave);
    setItems([]);
    showUndo("Tudo passou para amanhã.", async () => {
      const rs = await Promise.all(before.map((t) => db.from("tasks").update({ due_date: t.due_date }).eq("id", t.id)));
      void load();
      return rs.find((r) => r.error) ?? { ok: true };
    });
  }

  return (
    <section className="card review">
      <h2>Revisão do dia</h2>
      {items === null ? <p className="muted">Carregando…</p> : items.length === 0 ? (
        <p className="m0">Tudo em dia. Bom descanso!</p>
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
