"use client";
import { useState } from "react";
import { Icon } from "./ui";

export type EventDraft = { title: string; start: string; end: string; location: string | null };
const TZ = "America/Sao_Paulo";

export function eventWhen(start: string, end: string): string {
  const s = new Date(start), e = new Date(end);
  const day = s.toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "long", day: "numeric", month: "short" }).replace(".", "");
  const hm = (d: Date) => d.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  return `${day} · ${hm(s)}–${hm(e)}`;
}

/** Proposta de evento: só vai para a agenda quando a pessoa toca em "Criar". */
export function EventCard({ ev }: { ev: EventDraft }) {
  const [state, setState] = useState<"proposed" | "saving" | "created" | "discarded" | "error">("proposed");
  const [msg, setMsg] = useState("");
  const [link, setLink] = useState("");

  async function create() {
    setState("saving");
    try {
      const r = await fetch("/api/calendar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: ev.title, start: ev.start, end: ev.end, ...(ev.location ? { location: ev.location } : {}) }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setState("error"); setMsg(j.message || "Não consegui criar. Tente de novo."); return; }
      setLink(j.link || "");
      setState("created");
    } catch {
      setState("error");
      setMsg("Sem conexão. Tente de novo.");
    }
  }

  return (
    <div className={`event-card ${state}`}>
      <div className="row" style={{ gap: 10, flexWrap: "nowrap", alignItems: "flex-start" }}>
        <span className="event-ico"><Icon name="sun" size={18} /></span>
        <div style={{ minWidth: 0 }}>
          <div className="mono" style={{ color: "var(--sig)" }}>{state === "created" ? "Criado na agenda" : state === "discarded" ? "Descartado" : "Evento para confirmar"}</div>
          <div style={{ fontWeight: 500 }}>{ev.title}</div>
          <div className="muted" style={{ fontSize: 14 }}>{eventWhen(ev.start, ev.end)}{ev.location ? ` · ${ev.location}` : ""}</div>
        </div>
      </div>
      {(state === "proposed" || state === "error" || state === "saving") && (
        <div className="row">
          <button className="btn btn-sm btn-pri" disabled={state === "saving"} onClick={create}>{state === "saving" ? "Criando…" : "Criar na agenda"}</button>
          <button className="btn btn-sm" disabled={state === "saving"} onClick={() => setState("discarded")}>Descartar</button>
        </div>
      )}
      {state === "created" && link && <a className="mono" href={link} target="_blank" rel="noopener noreferrer">Abrir no Google Agenda ›</a>}
      {msg && state === "error" && <span className="muted" role="alert" style={{ fontSize: 14 }}>{msg}</span>}
    </div>
  );
}
