"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, PageHeader, Panel } from "./kit";
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
const fmt = (k: string, o: Intl.DateTimeFormatOptions) => fromKey(k).toLocaleDateString("pt-BR", { timeZone: TZ, ...o }).replace(".", "");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Tela Agenda (Pessoal › Agenda): a semana do Google Agenda, com criação de eventos. */
export function AgendaView({ onBack }: { onBack: () => void }) {
  const today = key(new Date());
  const [sel, setSel] = useState(today);
  const week = monday(sel);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week]);
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [err, setErr] = useState("");
  const [conn, setConn] = useState<"ok" | "none" | "revoked">("ok");
  const [form, setForm] = useState<{ date: string; time: string } | null>(null);
  const [nowMin, setNowMin] = useState(() => minutesOf(new Date().toISOString()));

  const load = useCallback(async () => {
    setEvents(null);
    try {
      const r = await fetch(`/api/calendar?from=${week}&days=7`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) {
        if (j.error === "not_connected") { setConn("none"); setErr(""); }
        else if (j.error === "revoked") { setConn("revoked"); setErr(""); }
        else setErr(j.message || "Não consegui ler a agenda.");
        setEvents([]);
        return;
      }
      setConn("ok"); setErr(""); setEvents(j.events);
    } catch {
      setErr("Sem conexão. Tente de novo."); setEvents([]);
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

  const month = cap(fmt(sel, { month: "long", year: "numeric" }));
  const range = `${fmt(days[0], { day: "numeric", month: "short" })} a ${fmt(days[6], { day: "numeric", month: "short" })}`;
  const selCount = byDay.get(sel)?.length ?? 0;
  const connected = conn === "ok";

  return (
    <div className="agenda-v">
      <button className="back" onClick={onBack}><Icon name="chevron" size={16} />Hoje</button>
      <PageHeader eyebrow="Pessoal" title="Agenda" text={connected ? `${month} · sua semana no Google Agenda.` : "Sua semana do Google Agenda, dentro do GaDu."}
        actions={connected && <>
          {week !== monday(today) && <button className="btn" onClick={() => setSel(today)}>Esta semana</button>}
          <button className="btn btn-pri" onClick={() => setForm({ date: sel, time: "09:00" })}><Icon name="plus" size={18} />Novo evento</button>
        </>} />

      {!connected ? (
        <Panel className="agenda-empty">
          <EmptyState icon="calendar"
            title={conn === "none" ? "Conecte sua agenda do Google" : "O acesso ao Google expirou"}
            text={conn === "none"
              ? "Veja seus compromissos da semana e crie eventos por aqui ou pela voz. Nada entra na agenda sem a sua confirmação."
              : "Reconecte para voltar a ver e criar eventos. Leva um minuto."}
            action={<a className="btn btn-pri" href="/api/google/connect"><Icon name="link" size={18} />{conn === "none" ? "Conectar" : "Reconectar"}</a>} />
          <ul className="perks" aria-label="O que você ganha">
            <li><Icon name="calendar" size={16} />Semana visual, com a hora de agora</li>
            <li><Icon name="mic" size={16} />Pela voz: “marca dentista quinta às 9”</li>
            <li><Icon name="lock" size={16} />Eventos só são criados com o seu sim</li>
          </ul>
        </Panel>
      ) : (
        <>
          <div className="week-nav">
            <button className="icon-btn" onClick={() => setSel(addDays(sel, -7))} aria-label="Semana anterior"><span className="flip"><Icon name="chevron" size={18} /></span></button>
            <span className="week-range" aria-live="polite">{range}</span>
            <button className="icon-btn" onClick={() => setSel(addDays(sel, 7))} aria-label="Próxima semana"><Icon name="chevron" size={18} /></button>
          </div>
          <div className="week-days" role="group" aria-label="Dias da semana">
            {days.map((d) => {
              const n = byDay.get(d)?.length ?? 0;
              return (
                <button key={d} className={`wd ${d === sel ? "sel" : ""} ${d === today ? "today" : ""}`} onClick={() => setSel(d)} aria-pressed={d === sel}
                  aria-label={`${fmt(d, { weekday: "long", day: "numeric" })}${n ? `, ${n} ${n === 1 ? "evento" : "eventos"}` : ""}`}>
                  <span className="wd-name">{fmt(d, { weekday: "short" }).slice(0, 3)}</span>
                  <b>{fmt(d, { day: "numeric" })}</b>
                  <span className="wd-dots" aria-hidden="true">{Array.from({ length: Math.min(n, 3) }, (_, i) => <i key={i} />)}</span>
                </button>
              );
            })}
          </div>

          {err && <div className="notice" role="alert">{err}</div>}
          {form && <EventForm initial={form} onDone={(saved) => { setForm(null); if (saved) void load(); }} />}

          <section className="panel cal-panel" aria-label="Calendário da semana">
            <div className="cal-sum">
              <b>{cap(fmt(sel, { weekday: "long", day: "numeric", month: "long" }))}</b>
              <span className="muted">{events === null ? "Carregando…" : selCount ? `${selCount} ${selCount === 1 ? "evento" : "eventos"}` : "Dia livre"}</span>
            </div>
            {events === null ? <p className="muted cal-loading" role="status">Carregando a agenda…</p> : (
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
                    <div key={d} className={`cal-day ${d === sel ? "sel" : ""} ${d === today ? "today" : ""}`} aria-label={fmt(d, { weekday: "long", day: "numeric" })}>
                      <div className="cal-day-head">{fmt(d, { weekday: "short", day: "numeric" })}</div>
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
                              <span className="cal-ev-t">{hm(e.start)}–{hm(e.end)}{e.meet ? " · online" : ""}</span>
                              {e.where && <span className="cal-ev-w">{e.where}</span>}
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
          <p className="hint"><Icon name="mic" size={16} />Toque num horário vazio para criar um evento. Ou diga: “marca dentista quinta às 9”.</p>
        </>
      )}
    </div>
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
    <form className="panel form-panel" onSubmit={save}>
      <div className="panel-head"><h2><Icon name="calendar" size={18} />Novo evento</h2></div>
      <div className="form-grid">
        <label className="fld full">
          <span>Título</span>
          <input className="field" placeholder="Ex.: Dentista" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </label>
        <label className="fld">
          <span>Dia</span>
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="fld">
          <span>Início</span>
          <input className="field" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <div className="fld">
          <span id="ev-dur-l">Duração</span>
          <div className="seg2" role="group" aria-labelledby="ev-dur-l">
            {[30, 60, 90, 120].map((m) => <button type="button" key={m} aria-pressed={dur === m} onClick={() => setDur(m)}>{m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)}h${m % 60}` : `${m / 60}h`}</button>)}
          </div>
        </div>
        <label className="fld">
          <span>Local <i className="opt">opcional</i></span>
          <input className="field" placeholder="Endereço ou link" value={where} maxLength={160} onChange={(e) => setWhere(e.target.value)} />
        </label>
      </div>
      {msg && <p className="form-err" role="alert">{msg}</p>}
      <div className="form-actions">
        <button className="btn btn-pri" type="submit" disabled={busy}><Icon name="check" size={18} />{busy ? "Criando…" : "Criar na agenda"}</button>
        <button className="btn" type="button" onClick={() => onDone(false)}>Cancelar</button>
      </div>
    </form>
  );
}
