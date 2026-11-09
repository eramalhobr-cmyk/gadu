"use client";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { AGENT_PRESETS, AREAS } from "@/lib/presets";
import { COLORS, colorVar, Icon, ICONS } from "./ui";

export type Agent = { id: number; name: string; area: string; instructions: string; color: string; icon: string; active: boolean };
type Draft = Omit<Agent, "id" | "active">;

const PRESETS: Draft[] = AGENT_PRESETS;

export function AgentsPage({ onTalk }: { onTalk: (a: { id: number; name: string }) => void }) {
  const [items, setItems] = useState<Agent[] | null>(null);
  const [edit, setEdit] = useState<Agent | "new" | null>(null);
  const [err, setErr] = useState("");
  const db = supabaseBrowser();

  const load = useCallback(async () => {
    const { data, error } = await db.from("agents").select("id, name, area, instructions, color, icon, active").order("active", { ascending: false }).order("name");
    if (error) setErr("Não consegui carregar os agentes.");
    setItems((data as Agent[]) ?? []);
  }, [db]);
  useEffect(() => { void load(); }, [load]);

  async function addPresets() {
    const have = new Set((items ?? []).map((a) => a.name.toLowerCase()));
    const rows = PRESETS.filter((p) => !have.has(p.name.toLowerCase()));
    if (!rows.length) return;
    const { error } = await db.from("agents").insert(rows);
    if (error) setErr("Não consegui criar os agentes sugeridos.");
    void load();
  }

  if (edit) return <AgentForm agent={edit === "new" ? null : edit} onDone={(saved) => { setEdit(null); if (saved) void load(); }} />;

  return (
    <main className="page">
      <p className="muted" style={{ margin: 0 }}>Agentes são versões do GaDu com instruções próprias para uma área da sua vida. Eles usam a mesma memória, agenda e tarefas.</p>
      {err && <div className="notice" role="alert">{err}</div>}
      {items === null ? <p className="muted">Carregando…</p> : (
        <div className="grid-agents">
          {items.map((a) => (
            <div key={a.id} className={`agent ${a.active ? "" : "off"}`} style={{ ["--c" as string]: colorVar(a.color) }}>
              <span className="agent-icon"><Icon name={a.icon} size={26} /></span>
              <span className="agent-name">{a.name}</span>
              <span className="mono muted">{a.active ? a.area : "pausado"}</span>
              <span className="row" style={{ gap: 6, justifyContent: "center" }}>
                <button className="btn btn-sm" disabled={!a.active} onClick={() => onTalk({ id: a.id, name: a.name })}>Conversar</button>
                <button className="icon-btn" style={{ width: 40, height: 40 }} onClick={() => setEdit(a)} aria-label={`Editar ${a.name}`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" /></svg>
                </button>
              </span>
            </div>
          ))}
          <button className="agent new" onClick={() => setEdit("new")}>
            <span className="agent-icon" style={{ fontSize: 26 }}>+</span>
            <span className="agent-name">Novo agente</span>
          </button>
        </div>
      )}
      {items && PRESETS.some((p) => !items.find((a) => a.name.toLowerCase() === p.name.toLowerCase())) && (
        <section className="card">
          <h2>Sugestões</h2>
          <p className="muted" style={{ margin: 0 }}>{PRESETS.filter((p) => !items.find((a) => a.name.toLowerCase() === p.name.toLowerCase())).map((p) => p.name).join(", ")}.</p>
          <div><button className="btn" onClick={addPresets}>Adicionar sugeridos</button></div>
        </section>
      )}
    </main>
  );
}

function AgentForm({ agent, onDone }: { agent: Agent | null; onDone: (saved: boolean) => void }) {
  const [d, setD] = useState<Draft & { active: boolean }>(agent ?? { name: "", area: "Pessoal", instructions: "", color: "sig", icon: "spark", active: true });
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState(false);
  const db = supabaseBrowser();
  const set = (p: Partial<typeof d>) => setD({ ...d, ...p });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!d.name.trim()) return setErr("Dê um nome ao agente.");
    const row = { name: d.name.trim().slice(0, 60), area: d.area, instructions: d.instructions.trim().slice(0, 4000), color: d.color, icon: d.icon, active: d.active };
    const { error } = agent ? await db.from("agents").update(row).eq("id", agent.id) : await db.from("agents").insert(row);
    if (error) return setErr("Não salvou. Tente de novo.");
    onDone(true);
  }
  async function remove() {
    if (!agent) return;
    await db.from("agents").delete().eq("id", agent.id);
    onDone(true);
  }

  return (
    <main className="page">
      <form className="card" onSubmit={save} style={{ ["--c" as string]: colorVar(d.color) }}>
        <h2>{agent ? "Editar agente" : "Novo agente"}</h2>
        <label className="sr" htmlFor="ag-name">Nome</label>
        <input id="ag-name" className="field" placeholder="Nome (ex.: Viagens)" value={d.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} />
        <div className="row">{AREAS.map((a) => <button type="button" key={a} className="chip" aria-pressed={d.area === a} onClick={() => set({ area: a })}>{a}</button>)}</div>
        <label htmlFor="ag-inst" className="muted" style={{ fontSize: 14 }}>Instruções: como ele deve pensar e falar</label>
        <textarea id="ag-inst" className="field" rows={6} maxLength={4000} placeholder="Ex.: ajude a planejar viagens com orçamento, roteiro dia a dia e lista do que levar." value={d.instructions} onChange={(e) => set({ instructions: e.target.value })} />
        <div className="row" aria-label="Ícone">
          {ICONS.map((i) => <button type="button" key={i} className="chip icon-chip" aria-pressed={d.icon === i} aria-label={`Ícone ${i}`} onClick={() => set({ icon: i })}><Icon name={i} size={18} /></button>)}
        </div>
        <div className="row" aria-label="Cor">
          {COLORS.map((c) => <button type="button" key={c} className="swatch" aria-pressed={d.color === c} aria-label={`Cor ${c}`} style={{ background: colorVar(c) }} onClick={() => set({ color: c })} />)}
        </div>
        {agent && <label className="switch"><span>Ativo</span><input type="checkbox" checked={d.active} onChange={(e) => set({ active: e.target.checked })} /></label>}
        {err && <span className="muted" role="alert">{err}</span>}
        <div className="row">
          <button className="btn btn-pri" type="submit">Salvar</button>
          <button className="btn" type="button" onClick={() => onDone(false)}>Cancelar</button>
        </div>
      </form>
      {agent && (confirm ? (
        <div className="row">
          <button className="btn btn-sm" style={{ borderColor: "var(--bad)", color: "var(--bad)" }} onClick={remove}>Apagar agente</button>
          <button className="btn btn-sm" onClick={() => setConfirm(false)}>Cancelar</button>
        </div>
      ) : <div><button className="link-btn" onClick={() => setConfirm(true)}>Apagar agente</button></div>)}
    </main>
  );
}
