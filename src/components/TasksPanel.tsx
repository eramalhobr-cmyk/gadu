"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { EmptyState, Panel } from "./kit";
import { colorVar, Icon, shortDate, todayKey } from "./ui";

export type Task = { id: number; link?: string | null; title: string; status: "open" | "done" | "cancelled"; priority: number; due_date: string | null; project_id: number | null; done_at: string | null; projects?: { name: string; color: string } | null };
type Mode = "today" | "all" | "project";

const PRIO = { 1: "Alta", 2: "Normal", 3: "Baixa" } as Record<number, string>;

/** Ordena: atrasadas, hoje, com prazo, sem prazo; dentro de cada grupo, prioridade. */
export function sortTasks(list: Task[]): Task[] {
  return [...list].sort((a, b) => {
    const da = a.due_date ?? "9999", dbb = b.due_date ?? "9999";
    return da === dbb ? a.priority - b.priority : da < dbb ? -1 : 1;
  });
}

/** Grupos da lista completa: atrasadas, hoje, próximas e sem prazo. */
function groupTasks(list: Task[], today: string) {
  const groups: { id: string; label: string; items: Task[] }[] = [
    { id: "late", label: "Atrasadas", items: [] },
    { id: "today", label: "Hoje", items: [] },
    { id: "next", label: "Próximas", items: [] },
    { id: "none", label: "Sem prazo", items: [] },
  ];
  for (const t of list) {
    const g = !t.due_date ? 3 : t.due_date < today ? 0 : t.due_date === today ? 1 : 2;
    groups[g].items.push(t);
  }
  return groups.filter((g) => g.items.length > 0);
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
    let q = db.from("tasks").select("id, title, status, priority, due_date, project_id, done_at, link, projects(name, color)").eq("status", "open");
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
  const compact = props.mode === "today";
  let list = items ?? [];
  if (compact) {
    // Urgentes (atrasadas, de hoje ou prioridade alta); se forem poucas, completa com as próximas.
    const urgent = list.filter((t) => (t.due_date && t.due_date <= today) || t.priority === 1);
    list = (urgent.length >= 3 ? urgent : [...urgent, ...list.filter((t) => !urgent.includes(t))]).slice(0, 6);
  }
  const hidden = (items?.length ?? 0) - list.length;
  const fid = `task-${props.mode}-${props.projectId ?? 0}`;

  const row = (t: Task) => {
    const late = Boolean(t.due_date && t.due_date < today);
    const isToday = t.due_date === today;
    return (
      <li key={t.id} className="tl-item">
        <button className="tl-tick" onClick={() => toggle(t)} aria-label={`Concluir ${t.title}`}><span aria-hidden="true" /></button>
        <span className="tl-body">
          <span className="tl-title">{t.title}</span>
          {(t.priority === 1 || t.due_date || (t.projects && props.mode !== "project") || t.link) && (
            <span className="tl-meta">
              {t.priority === 1 && <span className="tl-tag hot">Alta</span>}
              {t.due_date && <span className={`tl-tag ${late ? "bad" : isToday ? "sig" : ""}`}><Icon name="calendar" size={13} />{late ? "Atrasada · " : isToday ? "Hoje" : ""}{isToday ? "" : shortDate(t.due_date)}</span>}
              {t.projects && props.mode !== "project" && <span className="tl-tag proj" style={{ ["--c" as string]: colorVar(t.projects.color) }}><i aria-hidden="true" />{t.projects.name}</span>}
              {t.link && <a className="tl-tag link" href={t.link} target="_blank" rel="noopener noreferrer">Abrir e-mail<Icon name="chevron" size={12} /></a>}
            </span>
          )}
        </span>
        {!compact && <button className="icon-btn tl-del" onClick={() => remove(t)} aria-label={`Remover ${t.title}`}><Icon name="x" size={16} /></button>}
      </li>
    );
  };

  const form = (
    <form className={`tl-add ${title.trim() ? "open" : ""}`} onSubmit={add}>
      <div className="tl-add-main">
        <Icon name="plus" size={18} />
        <label className="sr" htmlFor={fid}>Nova tarefa</label>
        <input id={fid} className="tl-add-input" placeholder={compact ? "Nova tarefa" : "Adicionar tarefa"} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
      </div>
      {title.trim() && (
        <div className="tl-add-opts">
          <label className="tl-opt">
            <span>Prazo</span>
            <input id={`${fid}-due`} className="field" type="date" value={due} min={today} onChange={(e) => setDue(e.target.value)} />
          </label>
          <label className="tl-opt">
            <span>Prioridade</span>
            <select id={`${fid}-prio`} className="field" value={prio} onChange={(e) => setPrio(Number(e.target.value))}>
              {[1, 2, 3].map((p) => <option key={p} value={p}>{PRIO[p]}</option>)}
            </select>
          </label>
          <button className="btn btn-pri tl-add-btn" type="submit">Criar</button>
        </div>
      )}
    </form>
  );

  return (
    <Panel title={props.title ?? "Tarefas"} icon="check" className={`tl-panel ${compact ? "compact" : ""}`}
      action={props.onSeeAll && <button className="link" onClick={props.onSeeAll}>Ver todas<Icon name="chevron" size={14} /></button>}>
      {!compact && form}
      {err && <div className="notice" role="alert">{err}</div>}
      {items === null ? <p className="muted" role="status">Carregando tarefas…</p> : list.length === 0 ? (
        compact
          ? <EmptyState icon="check" title="Nada urgente" text="Diga “anota aí: …” para criar uma tarefa." />
          : <EmptyState icon="check" title="Nenhuma tarefa aberta" text={props.mode === "project" ? "Adicione a primeira tarefa deste projeto acima." : "Escreva acima ou diga ao GaDu: “anota aí: …”."} />
      ) : compact ? (
        <ul className="tl">{list.map(row)}</ul>
      ) : (
        <div className="tl-groups">
          {groupTasks(list, today).map((g) => (
            <section key={g.id} className={`tl-group ${g.id}`} aria-label={g.label}>
              <h3 className="tl-group-head"><span>{g.label}</span><span className="tl-count">{g.items.length}</span></h3>
              <ul className="tl">{g.items.map(row)}</ul>
            </section>
          ))}
        </div>
      )}
      {compact && hidden > 0 && <span className="tl-more">+{hidden} sem urgência</span>}
      {!compact && done.length > 0 && (
        <details className="tl-done">
          <summary><Icon name="chevron" size={14} />Concluídas nas últimas 24h<span className="tl-count">{done.length}</span></summary>
          <ul className="tl">
            {done.map((t) => (
              <li key={t.id} className="tl-item done">
                <button className="tl-tick on" onClick={() => toggle(t)} aria-label={`Reabrir ${t.title}`}><span aria-hidden="true"><Icon name="check" size={14} /></span></button>
                <span className="tl-body"><span className="tl-title">{t.title}</span></span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {compact && form}
    </Panel>
  );
}
