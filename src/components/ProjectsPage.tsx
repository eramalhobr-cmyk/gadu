"use client";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { TasksPanel } from "./TasksPanel";
import { COLORS, colorVar, Icon } from "./ui";

type Project = { id: number; name: string; goal: string | null; next_steps: string | null; status: "active" | "paused" | "done"; color: string; tasks: { status: string }[] };
const STATUS = { active: "Ativo", paused: "Pausado", done: "Concluído" } as const;

export function ProjectsPage(props: { initialView?: "tarefas" | "projetos"; onTalk: (project: { id: number; name: string }) => void }) {
  const [view, setView] = useState<"tarefas" | "projetos">(props.initialView ?? "tarefas");
  const [items, setItems] = useState<Project[] | null>(null);
  const [open, setOpen] = useState<Project | null>(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");
  const db = supabaseBrowser();

  const load = useCallback(async () => {
    const { data, error } = await db.from("projects").select("id, name, goal, next_steps, status, color, tasks(status)").order("status").order("updated_at", { ascending: false }).limit(100);
    if (error) setErr("Não consegui carregar os projetos.");
    const list = (data ?? []) as unknown as Project[];
    setItems(list);
    setOpen((o) => (o ? list.find((p) => p.id === o.id) ?? null : null));
  }, [db]);
  useEffect(() => { void load(); }, [load]);

  if (open) return <ProjectDetail project={open} onBack={() => { setOpen(null); void load(); }} onSaved={load} onTalk={props.onTalk} />;

  return (
    <main className="page">
      <div className="seg" role="tablist" aria-label="Ver">
        {(["tarefas", "projetos"] as const).map((v) => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}>{v === "tarefas" ? "Tarefas" : "Projetos"}</button>
        ))}
      </div>
      {err && <div className="notice" role="alert">{err}</div>}
      {view === "tarefas" ? (
        <TasksPanel mode="all" title="Todas as tarefas" />
      ) : (
        <>
          {creating ? <ProjectForm onDone={(saved) => { setCreating(false); if (saved) void load(); }} /> : (
            <button className="btn btn-pri" onClick={() => setCreating(true)}>Novo projeto</button>
          )}
          {items === null ? <p className="muted">Carregando…</p> : items.length === 0 ? (
            <section className="card"><p className="muted" style={{ margin: 0 }}>Nenhum projeto ainda. Crie um para juntar tarefas, conversas e próximos passos de algo que você quer tirar do papel.</p></section>
          ) : (
            <div className="grid-cards">
              {items.map((p) => {
                const total = p.tasks.filter((t) => t.status !== "cancelled").length;
                const doneN = p.tasks.filter((t) => t.status === "done").length;
                return (
                  <button key={p.id} className="card proj" style={{ ["--c" as string]: colorVar(p.color) }} onClick={() => setOpen(p)}>
                    <span className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                      <span className="proj-name"><Icon name="folder" size={18} /> {p.name}</span>
                      <span className="mono muted">{STATUS[p.status]}</span>
                    </span>
                    {p.goal && <span className="conv-sum">{p.goal}</span>}
                    <span className="bar"><span style={{ display: "block", height: "100%", width: `${total ? (doneN / total) * 100 : 0}%`, background: "var(--c)" }} /></span>
                    <span className="mono muted">{doneN}/{total} tarefas</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
}

function ProjectForm({ project, onDone }: { project?: Project; onDone: (saved: boolean) => void }) {
  const [name, setName] = useState(project?.name ?? "");
  const [goal, setGoal] = useState(project?.goal ?? "");
  const [next, setNext] = useState(project?.next_steps ?? "");
  const [color, setColor] = useState(project?.color ?? "sig");
  const [status, setStatus] = useState(project?.status ?? "active");
  const [err, setErr] = useState("");
  const db = supabaseBrowser();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErr("Dê um nome ao projeto.");
    const row = { name: name.trim().slice(0, 80), goal: goal.trim().slice(0, 400) || null, next_steps: next.trim().slice(0, 1000) || null, color, status };
    const { error } = project ? await db.from("projects").update(row).eq("id", project.id) : await db.from("projects").insert(row);
    if (error) return setErr("Não salvou. Tente de novo.");
    onDone(true);
  }

  return (
    <form className="card" onSubmit={save}>
      <h2>{project ? "Editar projeto" : "Novo projeto"}</h2>
      <label className="sr" htmlFor="pj-name">Nome</label>
      <input id="pj-name" className="field" placeholder="Nome (ex.: Reforma da varanda)" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      <label className="sr" htmlFor="pj-goal">Objetivo</label>
      <input id="pj-goal" className="field" placeholder="Objetivo em uma frase" value={goal} maxLength={400} onChange={(e) => setGoal(e.target.value)} />
      {project && (
        <>
          <label className="sr" htmlFor="pj-next">Próximos passos</label>
          <textarea id="pj-next" className="field" rows={3} placeholder="Próximos passos" value={next} maxLength={1000} onChange={(e) => setNext(e.target.value)} />
          <div className="row">
            {(Object.keys(STATUS) as (keyof typeof STATUS)[]).map((s) => <button type="button" key={s} className="chip" aria-pressed={status === s} onClick={() => setStatus(s)}>{STATUS[s]}</button>)}
          </div>
        </>
      )}
      <div className="row" aria-label="Cor">
        {COLORS.map((c) => <button type="button" key={c} className="swatch" aria-pressed={color === c} aria-label={`Cor ${c}`} style={{ background: colorVar(c) }} onClick={() => setColor(c)} />)}
      </div>
      {err && <span className="muted" role="alert">{err}</span>}
      <div className="row">
        <button className="btn btn-pri" type="submit">Salvar</button>
        <button className="btn" type="button" onClick={() => onDone(false)}>Cancelar</button>
      </div>
    </form>
  );
}

function ProjectDetail({ project, onBack, onSaved, onTalk }: { project: Project; onBack: () => void; onSaved: () => void; onTalk: (p: { id: number; name: string }) => void }) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const db = supabaseBrowser();

  async function remove() {
    await db.from("projects").delete().eq("id", project.id);
    onBack();
  }

  return (
    <main className="page" style={{ ["--c" as string]: colorVar(project.color) }}>
      <button className="link-btn mono" style={{ textDecoration: "none" }} onClick={onBack}>‹ Projetos</button>
      {editing ? <ProjectForm project={project} onDone={(s) => { setEditing(false); if (s) onSaved(); }} /> : (
        <section className="card proj-head">
          <span className="mono" style={{ color: "var(--c)" }}>{STATUS[project.status]}</span>
          <h1 style={{ margin: 0, fontFamily: "var(--display)", fontSize: 24, fontWeight: 500 }}>{project.name}</h1>
          {project.goal && <p style={{ margin: 0 }}>{project.goal}</p>}
          {project.next_steps && <p className="muted" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{project.next_steps}</p>}
          <div className="row">
            <button className="btn btn-pri" onClick={() => onTalk({ id: project.id, name: project.name })}><Icon name="chat" size={18} /> Conversar sobre o projeto</button>
            <button className="btn" onClick={() => setEditing(true)}>Editar</button>
          </div>
        </section>
      )}
      <TasksPanel mode="project" projectId={project.id} title="Tarefas do projeto" onChange={() => onSaved()} />
      <div>
        {confirm ? (
          <div className="row">
            <button className="btn btn-sm" style={{ borderColor: "var(--bad)", color: "var(--bad)" }} onClick={remove}>Apagar projeto</button>
            <button className="btn btn-sm" onClick={() => setConfirm(false)}>Cancelar</button>
            <span className="muted" style={{ fontSize: 14 }}>As tarefas ficam, sem projeto.</span>
          </div>
        ) : <button className="link-btn" onClick={() => setConfirm(true)}>Apagar projeto</button>}
      </div>
    </main>
  );
}
