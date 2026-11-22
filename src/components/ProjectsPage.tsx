"use client";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { EmptyState, PageHeader, Panel } from "./kit";
import { TasksPanel } from "./TasksPanel";
import { COLORS, colorVar, Icon } from "./ui";

type Project = { id: number; name: string; goal: string | null; next_steps: string | null; status: "active" | "paused" | "done"; color: string; tasks: { status: string }[] };
const STATUS = { active: "Ativo", paused: "Pausado", done: "Concluído" } as const;
const COLOR_NAME: Record<string, string> = { sig: "ciano", hot: "laranja", violet: "violeta", blue: "azul", green: "verde", pink: "rosa" };

const progress = (p: Project) => {
  const total = p.tasks.filter((t) => t.status !== "cancelled").length;
  const done = p.tasks.filter((t) => t.status === "done").length;
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
};

/** Telas Tarefas e Projetos (menu Pessoal). O app escolhe qual mostrar por initialView. */
export function ProjectsPage(props: { initialView?: "tarefas" | "projetos"; onTalk: (project: { id: number; name: string }) => void }) {
  const view = props.initialView ?? "tarefas";
  return view === "tarefas" ? <TasksScreen /> : <ProjectsScreen onTalk={props.onTalk} />;
}

function TasksScreen() {
  const [stats, setStats] = useState<{ open: number; done: number } | null>(null);
  return (
    <main className="page" id="conteudo">
      <div className="wrap">
        <PageHeader eyebrow="Pessoal" title="Tarefas" text="Tudo o que você precisa fazer, das atrasadas às sem prazo." />
        <div className="split">
          <TasksPanel mode="all" title="Suas tarefas" onChange={(open, done) => setStats({ open, done })} />
          <aside className="split-side">
            <Panel title="Resumo" icon="spark">
              <div className="stats">
                <div className="stat"><span className="n">{stats ? stats.open : "–"}</span><span className="l">para hoje ou sem prazo</span></div>
                <div className="stat ok"><span className="n">{stats ? stats.done : "–"}</span><span className="l">concluídas hoje</span></div>
              </div>
            </Panel>
            <Panel title="Pela voz" icon="mic">
              <ul className="hints">
                <li>“Anota aí: renovar o seguro até sexta”</li>
                <li>“Quais tarefas estão atrasadas?”</li>
                <li>“Me ajuda a priorizar o dia”</li>
              </ul>
              <p className="muted small">As urgentes também aparecem no Hoje.</p>
            </Panel>
          </aside>
        </div>
      </div>
    </main>
  );
}

function ProjectsScreen({ onTalk }: { onTalk: (project: { id: number; name: string }) => void }) {
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

  if (open) return <ProjectDetail project={open} onBack={() => { setOpen(null); void load(); }} onSaved={load} onTalk={onTalk} />;

  const groups = (["active", "paused", "done"] as const)
    .map((s) => ({ s, list: (items ?? []).filter((p) => p.status === s) }))
    .filter((g) => g.list.length > 0);

  return (
    <main className="page" id="conteudo">
      <div className="wrap">
        <PageHeader eyebrow="Pessoal" title="Projetos" text="Junte tarefas, conversas e próximos passos de algo que você quer tirar do papel."
          actions={!creating && <button className="btn btn-pri" onClick={() => setCreating(true)}><Icon name="plus" size={18} />Novo projeto</button>} />
        {err && <div className="notice" role="alert">{err}</div>}
        {creating && <ProjectForm onDone={(saved) => { setCreating(false); if (saved) void load(); }} />}
        {items === null ? (
          <div className="pj-grid" aria-busy="true"><p className="sr" role="status">Carregando projetos…</p>{[0, 1, 2].map((i) => <div key={i} className="pj-card skel" aria-hidden="true" />)}</div>
        ) : items.length === 0 ? (
          !creating && (
            <Panel>
              <EmptyState icon="folder" title="Nenhum projeto ainda" text="Um projeto reúne objetivo, tarefas e conversas. Ex.: reforma da varanda, mudança, um curso."
                action={<button className="btn btn-pri" onClick={() => setCreating(true)}><Icon name="plus" size={18} />Criar o primeiro projeto</button>} />
            </Panel>
          )
        ) : groups.map((g) => (
          <section key={g.s} className="pj-section" aria-label={STATUS[g.s]}>
            {groups.length > 1 && <h2 className="sec-title">{g.s === "active" ? "Em andamento" : g.s === "paused" ? "Pausados" : "Concluídos"}<span className="tl-count">{g.list.length}</span></h2>}
            <div className="pj-grid">
              {g.list.map((p) => {
                const pr = progress(p);
                return (
                  <button key={p.id} className={`pj-card ${p.status}`} style={{ ["--c" as string]: colorVar(p.color) }} onClick={() => setOpen(p)}>
                    <span className="pj-top">
                      <span className="pj-ico"><Icon name="folder" size={20} /></span>
                      <span className={`pj-status ${p.status}`}>{STATUS[p.status]}</span>
                    </span>
                    <span className="pj-name">{p.name}</span>
                    <span className="pj-goal">{p.goal || "Sem objetivo definido."}</span>
                    <span className="pj-foot">
                      <span className="pj-bar" aria-hidden="true"><span style={{ width: `${pr.pct}%` }} /></span>
                      <span className="pj-count">{pr.total ? `${pr.done} de ${pr.total} tarefas` : "Sem tarefas"}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
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
  const [busy, setBusy] = useState(false);
  const db = supabaseBrowser();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErr("Dê um nome ao projeto.");
    const row = { name: name.trim().slice(0, 80), goal: goal.trim().slice(0, 400) || null, next_steps: next.trim().slice(0, 1000) || null, color, status };
    setBusy(true);
    const { error } = project ? await db.from("projects").update(row).eq("id", project.id) : await db.from("projects").insert(row);
    setBusy(false);
    if (error) return setErr("Não salvou. Tente de novo.");
    onDone(true);
  }

  return (
    <form className="panel form-panel" onSubmit={save} style={{ ["--c" as string]: colorVar(color) }}>
      <div className="panel-head"><h2><Icon name="folder" size={18} />{project ? "Editar projeto" : "Novo projeto"}</h2></div>
      <div className="form-grid">
        <label className="fld">
          <span>Nome</span>
          <input id="pj-name" className="field" placeholder="Ex.: Reforma da varanda" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoFocus={!project} />
        </label>
        <label className="fld">
          <span>Objetivo</span>
          <input id="pj-goal" className="field" placeholder="Em uma frase" value={goal} maxLength={400} onChange={(e) => setGoal(e.target.value)} />
        </label>
        {project && (
          <label className="fld full">
            <span>Próximos passos</span>
            <textarea id="pj-next" className="field" rows={4} placeholder="Um passo por linha" value={next} maxLength={1000} onChange={(e) => setNext(e.target.value)} />
          </label>
        )}
        {project && (
          <div className="fld">
            <span id="pj-status-l">Situação</span>
            <div className="seg2" role="group" aria-labelledby="pj-status-l">
              {(Object.keys(STATUS) as (keyof typeof STATUS)[]).map((s) => <button type="button" key={s} aria-pressed={status === s} onClick={() => setStatus(s)}>{STATUS[s]}</button>)}
            </div>
          </div>
        )}
        <div className="fld">
          <span id="pj-color-l">Cor</span>
          <div className="swatches" role="group" aria-labelledby="pj-color-l">
            {COLORS.map((c) => <button type="button" key={c} className="sw" aria-pressed={color === c} aria-label={`Cor ${COLOR_NAME[c] ?? c}`} style={{ ["--c" as string]: colorVar(c) }} onClick={() => setColor(c)} />)}
          </div>
        </div>
      </div>
      {err && <p className="form-err" role="alert">{err}</p>}
      <div className="form-actions">
        <button className="btn btn-pri" type="submit" disabled={busy}>{busy ? "Salvando…" : project ? "Salvar" : "Criar projeto"}</button>
        <button className="btn" type="button" onClick={() => onDone(false)}>Cancelar</button>
      </div>
    </form>
  );
}

function ProjectDetail({ project, onBack, onSaved, onTalk }: { project: Project; onBack: () => void; onSaved: () => void; onTalk: (p: { id: number; name: string }) => void }) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const db = supabaseBrowser();
  const pr = progress(project);

  async function remove() {
    await db.from("projects").delete().eq("id", project.id);
    onBack();
  }

  return (
    <main className="page" id="conteudo" style={{ ["--c" as string]: colorVar(project.color) }}>
      <div className="wrap">
        <button className="back" onClick={onBack}><Icon name="chevron" size={16} />Projetos</button>
        {editing ? <ProjectForm project={project} onDone={(s) => { setEditing(false); if (s) onSaved(); }} /> : (
          <div className="pj-hero">
            <PageHeader eyebrow={`Projeto · ${STATUS[project.status]}`} title={project.name} text={project.goal || undefined}
              actions={<>
                <button className="btn btn-pri" onClick={() => onTalk({ id: project.id, name: project.name })}><Icon name="chat" size={18} />Conversar</button>
                <button className="btn" onClick={() => setEditing(true)}>Editar</button>
              </>} />
          </div>
        )}
        <div className="split">
          <TasksPanel mode="project" projectId={project.id} title="Tarefas do projeto" onChange={() => onSaved()} />
          <aside className="split-side">
            <Panel title="Progresso" icon="spark">
              <div className="pj-progress">
                <span className="n">{pr.pct}%</span>
                <span className="pj-bar big" aria-hidden="true"><span style={{ width: `${pr.pct}%` }} /></span>
                <span className="muted small">{pr.total ? `${pr.done} de ${pr.total} tarefas concluídas` : "Nenhuma tarefa ainda"}</span>
              </div>
            </Panel>
            <Panel title="Próximos passos" icon="chevron">
              {project.next_steps
                ? <p className="pre">{project.next_steps}</p>
                : <EmptyState icon="spark" title="Sem próximos passos" text="Toque em Editar para escrever, ou peça ao GaDu numa conversa." />}
            </Panel>
            <Panel className="danger">
              {confirm ? (
                <>
                  <p className="muted small">Apagar este projeto? As tarefas ficam, sem projeto.</p>
                  <div className="form-actions">
                    <button className="btn btn-sm btn-bad" onClick={remove}>Apagar projeto</button>
                    <button className="btn btn-sm" onClick={() => setConfirm(false)}>Cancelar</button>
                  </div>
                </>
              ) : <button className="btn btn-sm btn-quiet" onClick={() => setConfirm(true)}>Apagar projeto</button>}
            </Panel>
          </aside>
        </div>
      </div>
    </main>
  );
}
