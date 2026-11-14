"use client";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { AGENT_PRESETS, AREAS } from "@/lib/presets";
import { EmptyState, PageHeader, Panel } from "./kit";
import { COLORS, colorVar, Icon, ICONS } from "./ui";

export type Agent = { id: number; name: string; area: string; instructions: string; color: string; icon: string; active: boolean };
type Draft = Omit<Agent, "id" | "active">;

const PRESETS: Draft[] = AGENT_PRESETS;
const COLOR_NAME: Record<string, string> = { sig: "ciano", hot: "laranja", violet: "violeta", blue: "azul", green: "verde", pink: "rosa" };

function Pencil() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" /></svg>;
}

export function AgentsPage({ onTalk }: { onTalk: (a: { id: number; name: string }) => void }) {
  const [items, setItems] = useState<Agent[] | null>(null);
  const [edit, setEdit] = useState<Agent | "new" | null>(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
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
    setAdding(true);
    const { error } = await db.from("agents").insert(rows);
    setAdding(false);
    if (error) setErr("Não consegui criar os agentes sugeridos.");
    void load();
  }

  if (edit) return <AgentForm agent={edit === "new" ? null : edit} onDone={(saved) => { setEdit(null); if (saved) void load(); }} />;

  const missing = items ? PRESETS.filter((p) => !items.find((a) => a.name.toLowerCase() === p.name.toLowerCase())) : [];

  return (
    <main className="page" id="conteudo">
      <div className="wrap">
        <PageHeader eyebrow="Agent Office" title="Agentes" text="Versões do GaDu com instruções próprias para cada área da sua vida. Todos usam a mesma memória, agenda e tarefas."
          actions={<button className="btn btn-pri" onClick={() => setEdit("new")}><Icon name="plus" size={18} />Novo agente</button>} />
        {err && <div className="notice" role="alert">{err}</div>}
        {items === null ? (
          <div className="ag-grid" aria-busy="true"><p className="sr" role="status">Carregando agentes…</p>{[0, 1, 2].map((i) => <div key={i} className="ag-card skel" aria-hidden="true" />)}</div>
        ) : items.length === 0 ? (
          <Panel>
            <EmptyState icon="agents" title="Nenhum agente ainda" text="Comece pelos sugeridos ou crie um do zero. Você pode editar as instruções quando quiser."
              action={<div className="form-actions">
                {missing.length > 0 && <button className="btn btn-pri" onClick={addPresets} disabled={adding}>{adding ? "Adicionando…" : "Adicionar sugeridos"}</button>}
                <button className="btn" onClick={() => setEdit("new")}>Criar do zero</button>
              </div>} />
          </Panel>
        ) : (
          <div className="ag-grid">
            {items.map((a) => (
              <article key={a.id} className={`ag-card ${a.active ? "" : "off"}`} style={{ ["--c" as string]: colorVar(a.color) }}>
                <div className="ag-top">
                  <span className="ag-ico"><Icon name={a.icon} size={22} /></span>
                  <div className="ag-id">
                    <h3>{a.name}</h3>
                    <span className="ag-area">{a.area}{a.active ? "" : " · pausado"}</span>
                  </div>
                  <button className="icon-btn" onClick={() => setEdit(a)} aria-label={`Editar ${a.name}`}><Pencil /></button>
                </div>
                <p className="ag-inst">{a.instructions || "Sem instruções. Toque em editar para dizer como ele deve ajudar."}</p>
                <button className="btn btn-sm ag-talk" disabled={!a.active} onClick={() => onTalk({ id: a.id, name: a.name })}><Icon name="chat" size={16} />{a.active ? "Conversar" : "Pausado"}</button>
              </article>
            ))}
          </div>
        )}
        {items && items.length > 0 && missing.length > 0 && (
          <Panel title="Sugestões" icon="spark" action={<button className="btn btn-sm" onClick={addPresets} disabled={adding}>{adding ? "Adicionando…" : "Adicionar todos"}</button>}>
            <p className="muted small">Agentes prontos para começar. Você pode editar ou apagar depois.</p>
            <div className="tagrow">
              {missing.map((p) => <span key={p.name} className="tag" style={{ ["--c" as string]: colorVar(p.color) }}><Icon name={p.icon} size={14} />{p.name}</span>)}
            </div>
          </Panel>
        )}
      </div>
    </main>
  );
}

function AgentForm({ agent, onDone }: { agent: Agent | null; onDone: (saved: boolean) => void }) {
  const [d, setD] = useState<Draft & { active: boolean }>(agent ?? { name: "", area: "Pessoal", instructions: "", color: "sig", icon: "spark", active: true });
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const db = supabaseBrowser();
  const set = (p: Partial<typeof d>) => setD({ ...d, ...p });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!d.name.trim()) return setErr("Dê um nome ao agente.");
    const row = { name: d.name.trim().slice(0, 60), area: d.area, instructions: d.instructions.trim().slice(0, 4000), color: d.color, icon: d.icon, active: d.active };
    setBusy(true);
    const { error } = agent ? await db.from("agents").update(row).eq("id", agent.id) : await db.from("agents").insert(row);
    setBusy(false);
    if (error) return setErr("Não salvou. Tente de novo.");
    onDone(true);
  }
  async function remove() {
    if (!agent) return;
    await db.from("agents").delete().eq("id", agent.id);
    onDone(true);
  }

  return (
    <main className="page" id="conteudo">
      <div className="wrap">
        <button className="back" onClick={() => onDone(false)}><Icon name="chevron" size={16} />Agentes</button>
        <PageHeader eyebrow="Agent Office" title={agent ? `Editar ${agent.name}` : "Novo agente"} text="Dê um nome, escolha a área e diga como ele deve pensar e falar." />
        <form className="ag-form" onSubmit={save} style={{ ["--c" as string]: colorVar(d.color) }}>
          <div className="grid-2">
            <Panel title="Identidade" icon="user">
              <div className="ag-preview" aria-hidden="true">
                <span className="ag-ico big"><Icon name={d.icon} size={26} /></span>
                <span><b>{d.name.trim() || "Nome do agente"}</b><small>{d.area}</small></span>
              </div>
              <label className="fld">
                <span>Nome</span>
                <input id="ag-name" className="field" placeholder="Ex.: Viagens" value={d.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} />
              </label>
              <div className="fld">
                <span id="ag-area-l">Área</span>
                <div className="chips" role="group" aria-labelledby="ag-area-l">{AREAS.map((a) => <button type="button" key={a} className="chip" aria-pressed={d.area === a} onClick={() => set({ area: a })}>{a}</button>)}</div>
              </div>
              <div className="fld">
                <span id="ag-icon-l">Ícone</span>
                <div className="chips" role="group" aria-labelledby="ag-icon-l">
                  {ICONS.map((i) => <button type="button" key={i} className="chip icon-chip" aria-pressed={d.icon === i} aria-label={`Ícone ${i}`} onClick={() => set({ icon: i })}><Icon name={i} size={18} /></button>)}
                </div>
              </div>
              <div className="fld">
                <span id="ag-color-l">Cor</span>
                <div className="swatches" role="group" aria-labelledby="ag-color-l">
                  {COLORS.map((c) => <button type="button" key={c} className="sw" aria-pressed={d.color === c} aria-label={`Cor ${COLOR_NAME[c] ?? c}`} style={{ ["--c" as string]: colorVar(c) }} onClick={() => set({ color: c })} />)}
                </div>
              </div>
              {agent && <label className="switch"><span>Ativo<small className="muted"> · pausado não aparece para conversar</small></span><input type="checkbox" checked={d.active} onChange={(e) => set({ active: e.target.checked })} /></label>}
            </Panel>
            <Panel title="Instruções" icon="book">
              <label className="fld">
                <span>Como ele deve pensar e falar</span>
                <textarea id="ag-inst" className="field" rows={12} maxLength={4000} placeholder="Ex.: ajude a planejar viagens com orçamento, roteiro dia a dia e lista do que levar." value={d.instructions} onChange={(e) => set({ instructions: e.target.value })} />
              </label>
              <p className="muted small">{d.instructions.length} de 4000 caracteres. Seja específico: tom, formato e o que evitar.</p>
            </Panel>
          </div>
          {err && <p className="form-err" role="alert">{err}</p>}
          <div className="form-actions">
            <button className="btn btn-pri" type="submit" disabled={busy}>{busy ? "Salvando…" : agent ? "Salvar" : "Criar agente"}</button>
            <button className="btn" type="button" onClick={() => onDone(false)}>Cancelar</button>
          </div>
        </form>
        {agent && (
          <Panel className="danger">
            {confirm ? (
              <>
                <p className="muted small">Apagar {agent.name}? As conversas com ele continuam no histórico.</p>
                <div className="form-actions">
                  <button className="btn btn-sm btn-bad" onClick={remove}>Apagar agente</button>
                  <button className="btn btn-sm" onClick={() => setConfirm(false)}>Cancelar</button>
                </div>
              </>
            ) : <button className="btn btn-sm btn-quiet" onClick={() => setConfirm(true)}>Apagar agente</button>}
          </Panel>
        )}
      </div>
    </main>
  );
}
