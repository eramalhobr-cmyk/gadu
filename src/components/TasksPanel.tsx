"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { colorVar, shortDate, todayKey } from "./ui";

export type Task = { id: number; title: string; status: "open" | "done" | "cancelled"; priority: number; due_date: string | null; project_id: number | null; done_at: string | null; projects?: { name: string; color: string } | null };
type Mode = "today" | "all" | "project";

const PRIO = { 1: "alta", 2: "normal", 3: "baixa" } as Record<number, string>;

/** Ordena: atrasadas, hoje, com prazo, sem prazo; dentro de cada grupo, prioridade. */
export function sortTasks(list: Task[]): Task[] {
  return [...list].sort((a, b) => {
    const da = a.due_date ?? "9999", dbb = b.due_date ?? "9999";
    return da === dbb ? a.priority - b.priority : da < dbb ? -1 : 1;
  });
}

export function TasksPanel(props: { mode: Mode; projectId?: number; title?: string; onChange?: (open: number, doneToday: number) => void; onSeeAll?: () => void }) {
  const [items, setItems] = useState<Task[] | null>(null);
  const [done, setDone] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [prio, setPrio] = useState(2);
  const [err, setErr] = useState("");
  const db = supabaseBrowser();
  const onChangeRef = useRef(props.onChange);
  useEffect(() => { onChangeRef.current = props.onChange; }, [props.onChange]);

  const load = useCallback(async () => {
    let q = db.from("tasks").select("id, title, status, priority, due_date, project_id, done_at, projects(name, color)").eq("status", "open");
    if (props.mode === "project" && props.projectId) q = q.eq("project_id", props.projectId);
    const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
    let d = db.from("tasks").select("id, title, status, priority, due_date, project_id, done_at").eq("status", "done").gte("done_at", since);
    if (props.mode === "project" && props.projectId) d = d.eq("project_id", props.projectId);
    const [o, dn] = await Promise.all([q.limit(200), d.order("done_at", { ascending: false }).limit(20)]);
    if (o.error) setErr("Não consegui carregar as tarefas.");
    const open = sortTasks((o.data ?? []) as unknown as Task[]);
    setItems(open);
    setDone((dn.data ?? []) as Task[]);
    const today = todayKey();
    onChangeRef.current?.(open.filter((t) => !t.due_date || t.due_date <= today).length, ((dn.data ?? []) as Task[]).filter((t) => t.done_at && new Date(t.done_at).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) === today).length);
  }, [db, props.mode, props.projectId]);
  useEffect(() => { void load(); }, [load]);

  async function toggle(t: Task) {
    const next = t.status === "open" ? { status: "done", done_at: new Date().toISOString() } : { status: "open", done_at: null };
    setItems((xs) => xs?.filter((x) => x.id !== t.id) ?? null);
    const { error } = await db.from("tasks").update(next).eq("id", t.id);
    if (error) setErr("Não salvou. Tente de novo.");
    void load();
  }
  async function remove(t: Task) {
    await db.from("tasks").update({ status: "cancelled" }).eq("id", t.id);
    void load();
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const { error } = await db.from("tasks").insert({ title: title.trim().slice(0, 200), due_date: due || null, priority: prio, project_id: props.projectId ?? null });
    if (error) return setErr("Não salvou. Tente de novo.");
    setTitle(""); setDue(""); setPrio(2); setErr("");
    void load();
  }

  const today = todayKey();
  let list = items ?? [];
  if (props.mode === "today") {
    // Urgentes (atrasadas, de hoje ou prioridade alta); se forem poucas, completa com as próximas.
    const urgent = list.filter((t) => (t.due_date && t.due_date <= today) || t.priority === 1);
    list = (urgent.length >= 3 ? urgent : [...urgent, ...list.filter((t) => !urgent.includes(t))]).slice(0, 6);
  }
  const hidden = (items?.length ?? 0) - list.length;

  return (
    <section className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2>{props.title ?? "Tarefas"}</h2>
        {props.onSeeAll && <button className="link-btn mono" style={{ color: "var(--sig)", textDecoration: "none" }} onClick={props.onSeeAll}>Ver todas ›</button>}
      </div>
      {err && <div className="notice" role="alert">{err}</div>}
      {items === null ? <p className="muted">Carregando…</p> : list.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>{props.mode === "today" ? "Nada urgente. Diga “anota aí: …” para criar uma tarefa." : "Nenhuma tarefa aberta."}</p>
      ) : (
        <ul className="tasks">
          {list.map((t) => {
            const late = t.due_date && t.due_date < today;
            return (
              <li key={t.id}>
                <button className="tick" onClick={() => toggle(t)} aria-label={`Concluir ${t.title}`} />
                <span className="task-body">
                  <span>{t.title}</span>
                  <span className="mono task-meta">
                    {t.priority === 1 && <b style={{ color: "var(--hot)" }}>alta</b>}
                    {t.due_date && <span style={{ color: late ? "var(--bad)" : undefined }}>{late ? "atrasada · " : ""}{shortDate(t.due_date)}</span>}
                    {t.projects && props.mode !== "project" && <span style={{ color: colorVar(t.projects.color) }}>{t.projects.name}</span>}
                  </span>
                </span>
                {props.mode !== "today" && <button className="link-btn" onClick={() => remove(t)} aria-label={`Remover ${t.title}`}>×</button>}
              </li>
            );
          })}
        </ul>
      )}
      {props.mode === "today" && hidden > 0 && <span className="muted" style={{ fontSize: 14 }}>+{hidden} sem urgência</span>}
      {props.mode !== "today" && done.length > 0 && (
        <details>
          <summary className="mono muted">Concluídas nas últimas 24h ({done.length})</summary>
          <ul className="tasks">
            {done.map((t) => (
              <li key={t.id} className="done">
                <button className="tick on" onClick={() => toggle(t)} aria-label={`Reabrir ${t.title}`} />
                <span className="task-body"><span>{t.title}</span></span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <form className="rem-form" onSubmit={add}>
        <label className="sr" htmlFor={`task-${props.mode}-${props.projectId ?? 0}`}>Nova tarefa</label>
        <input id={`task-${props.mode}-${props.projectId ?? 0}`} className="field" placeholder="Nova tarefa" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
        {title.trim() && (
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <label className="sr" htmlFor="task-due">Prazo</label>
            <input id="task-due" className="field" type="date" value={due} min={today} onChange={(e) => setDue(e.target.value)} style={{ colorScheme: "dark" }} />
            <label className="sr" htmlFor="task-prio">Prioridade</label>
            <select id="task-prio" className="field" value={prio} onChange={(e) => setPrio(Number(e.target.value))} style={{ maxWidth: 130 }}>
              {[1, 2, 3].map((p) => <option key={p} value={p}>{PRIO[p]}</option>)}
            </select>
            <button className="btn" type="submit">Criar</button>
          </div>
        )}
      </form>
    </section>
  );
}
