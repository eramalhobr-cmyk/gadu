"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { COLORS, colorVar, Icon } from "./ui";

type Ev = { id?: string; title: string; start: string; end: string; allDay: boolean; where?: string; meet: boolean };
const TZ = "America/Sao_Paulo";
const H0 = 6, H1 = 24, HOUR = 52; // faixa visível e altura de 1 hora (px)

const key = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const fromKey = (k: string) => new Date(`${k}T12:00:00-03:00`);
const addDays = (k: string, n: number) => key(new Date(fromKey(k).getTime() + n * 86_400_000));
/** Segunda-feira da semana de k. */
function monday(k: string) {
  const wd = fromKey(k).getUTCDay(); // 12h em Brasília = 15h UTC: mesmo dia
  return addDays(k, -((wd + 6) % 7));
}
const minutesOf = (iso: string) => {
  const [h, m] = new Date(iso).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).split(":").map(Number);
  return h * 60 + m;
};
const hm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const colorOf = (title: string) => COLORS[[...title].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

export function AgendaView({ onBack }: { onBack: () => void }) {
  const today = key(new Date());
  const [sel, setSel] = useState(today);
  const week = monday(sel);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week]);
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [err, setErr] = useState("");
  const [form, setForm] = useState<{ date: string; time: string } | null>(null);
  const [nowMin, setNowMin] = useState(() => minutesOf(new Date().toISOString()));

  const load = useCallback(async () => {
    setEvents(null);
    try {
      const r = await fetch(`/api/calendar?from=${week}&days=7`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) { setErr(j.message || "Não consegui ler a agenda."); setEvents([]); return; }
      setErr(""); setEvents(j.events);
    } catch {
      setErr("Sem conexão."); setEvents([]);
    }
  }, [week]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const id = setInterval(() => setNowMin(minutesOf(new Date().toISOString())), 60_000); return () => clearInterval(id); }, []);

  const byDay = useMemo(() => {
    const m = new Map<string, Ev[]>();
    for (const e of events ?? []) {
      const k = e.allDay ? e.start.slice(0, 10) : key(new Date(e.start));
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return m;
  }, [events]);

  const month = fromKey(sel).toLocaleDateString("pt-BR", { timeZone: TZ, month: "long", year: "numeric" });

  return (
    <main className="page agenda">
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <button className="link-btn mono" style={{ textDecoration: "none" }} onClick={onBack}>‹ Hoje</button>
        <span className="mono" style={{ color: "var(--sig)" }}>{month}</span>
        <button className="btn btn-sm btn-pri" onClick={() => setForm({ date: sel, time: "09:00" })}>+ Evento</button>
      </div>

      <div className="week-strip">
        <button className="icon-btn" onClick={() => setSel(addDays(sel, -7))} aria-label="Semana anterior">‹</button>
        {days.map((d) => {
          const n = byDay.get(d)?.length ?? 0;
          const dt = fromKey(d);
          return (
            <button key={d} className={`day-pill ${d === sel ? "sel" : ""} ${d === today ? "today" : ""}`} onClick={() => setSel(d)} aria-pressed={d === sel}>
              <span className="mono">{dt.toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "short" }).replace(".", "").slice(0, 3)}</span>
              <b>{dt.toLocaleDateString("pt-BR", { timeZone: TZ, day: "numeric" })}</b>
              <span className="dots">{Array.from({ length: Math.min(n, 3) }, (_, i) => <i key={i} />)}</span>
            </button>
          );
        })}
        <button className="icon-btn" onClick={() => setSel(addDays(sel, 7))} aria-label="Próxima semana">›</button>
      </div>

      {err && <div className="notice" role="alert">{err}</div>}
      {form && <EventForm initial={form} onDone={(saved) => { setForm(null); if (saved) void load(); }} />}

      <section className="card cal">
        {events === null ? <p className="muted">Carregando…</p> : (
          <div className="cal-grid" style={{ ["--hour" as string]: `${HOUR}px` }}>
            <div className="cal-hours" aria-hidden="true">
              <div className="cal-allday-gap" />
              {Array.from({ length: H1 - H0 }, (_, i) => <span key={i} style={{ height: HOUR }}>{String(H0 + i).padStart(2, "0")}h</span>)}
            </div>
            {days.map((d) => {
              const list = byDay.get(d) ?? [];
              const allDay = list.filter((e) => e.allDay);
              const timed = list.filter((e) => !e.allDay);
              return (
                <div key={d} className={`cal-day ${d === sel ? "sel" : ""}`} aria-label={fromKey(d).toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "long", day: "numeric" })}>
                  <div className="cal-day-head mono">{fromKey(d).toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "short", day: "numeric" }).replace(".", "")}</div>
                  <div className="cal-allday">{allDay.map((e, i) => <span key={i} className="cal-chip" style={{ ["--c" as string]: colorVar(colorOf(e.title)) }}>{e.title}</span>)}</div>
                  <div className="cal-body" style={{ height: (H1 - H0) * HOUR }}>
                    {Array.from({ length: H1 - H0 }, (_, i) => (
                      <button key={i} className="cal-slot" style={{ top: i * HOUR, height: HOUR }} onClick={() => setForm({ date: d, time: `${String(H0 + i).padStart(2, "0")}:00` })} aria-label={`Novo evento às ${H0 + i}h`} />
                    ))}
                    {timed.map((e, i) => {
                      const s = Math.max(H0 * 60, minutesOf(e.start)), en = Math.min(H1 * 60, Math.max(s + 20, minutesOf(e.end) || 24 * 60));
                      return (
                        <div key={i} className={`cal-ev ${Date.parse(e.end) < Date.now() ? "past" : ""}`} style={{ top: ((s - H0 * 60) / 60) * HOUR, height: Math.max(22, ((en - s) / 60) * HOUR - 2), ["--c" as string]: colorVar(colorOf(e.title)) }}>
                          <b>{e.title}</b>
                          <span className="mono">{hm(e.start)}–{hm(e.end)}{e.meet ? " · online" : ""}</span>
                          {e.where && <span className="muted">{e.where}</span>}
                        </div>
                      );
                    })}
                    {d === today && nowMin >= H0 * 60 && <div className="cal-now" style={{ top: ((nowMin - H0 * 60) / 60) * HOUR }} />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>Toque num horário vazio para criar um evento. Ou diga: “marca dentista quinta às 9”.</p>
    </main>
  );
}

function EventForm({ initial, onDone }: { initial: { date: string; time: string }; onDone: (saved: boolean) => void }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [dur, setDur] = useState(60);
  const [where, setWhere] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setMsg("Dê um título ao evento.");
    const start = new Date(`${date}T${time}:00-03:00`);
    const end = new Date(start.getTime() + dur * 60_000);
    setBusy(true);
    try {
      const r = await fetch("/api/calendar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: title.trim(), start: start.toISOString(), end: end.toISOString(), ...(where.trim() ? { location: where.trim() } : {}) }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return setMsg(j.message || "Não consegui criar.");
      onDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={save}>
      <h2>Novo evento</h2>
      <input className="field" placeholder="Título" aria-label="Título" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} autoFocus />
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <input className="field" type="date" aria-label="Dia" value={date} onChange={(e) => setDate(e.target.value)} style={{ colorScheme: "dark" }} />
        <input className="field" type="time" aria-label="Início" value={time} onChange={(e) => setTime(e.target.value)} style={{ colorScheme: "dark", maxWidth: 130 }} />
      </div>
      <div className="row">{[30, 60, 90, 120].map((m) => <button type="button" key={m} className="chip" aria-pressed={dur === m} onClick={() => setDur(m)}>{m < 60 ? `${m} min` : `${m / 60}h`.replace(".5", "h30").replace("hh", "h")}</button>)}</div>
      <input className="field" placeholder="Local (opcional)" aria-label="Local" value={where} maxLength={160} onChange={(e) => setWhere(e.target.value)} />
      {msg && <span className="muted" role="alert">{msg}</span>}
      <div className="row">
        <button className="btn btn-pri" type="submit" disabled={busy}><Icon name="check" size={18} /> {busy ? "Criando…" : "Criar na agenda"}</button>
        <button className="btn" type="button" onClick={() => onDone(false)}>Cancelar</button>
      </div>
    </form>
  );
}
