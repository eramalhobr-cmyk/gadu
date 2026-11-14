"use client";
import { Panel } from "./kit";
import { colorVar, Icon } from "./ui";
import { MODULES, STATUS_LABEL, type ModuleDef, type ModuleId, type ViewId } from "@/lib/modules";

/** Selo de status de um módulo. Sempre o status real. */
export function StatusPill({ status }: { status: ModuleDef["status"] }) {
  return <span className={`pill ${status}`}>{STATUS_LABEL[status]}</span>;
}

/** Cartões dos módulos (painel e home). Módulo planejado aparece tracejado e com o selo. */
export function ModuleCards({ onOpen, skip }: { onOpen?: (view: ViewId) => void; skip?: ModuleId[] }) {
  return (
    <div className="mods">
      {MODULES.filter((m) => !skip?.includes(m.id)).map((m) => {
        const inner = (
          <>
            <span className="top"><span className="mod-ico"><Icon name={m.icon} size={22} /></span><StatusPill status={m.status} /></span>
            <b>{m.name}</b>
            <p>{m.tagline}</p>
          </>
        );
        const style = { ["--c" as string]: colorVar(m.color) };
        return onOpen
          ? <button key={m.id} className={`mod ${m.status}`} style={style} onClick={() => onOpen(m.views[0].id)}>{inner}</button>
          : <div key={m.id} className={`mod ${m.status}`} style={style}>{inner}</div>;
      })}
    </div>
  );
}

/** Página de um módulo planejado ou parcial: diz com clareza o que existe e o que ainda não existe. */
export function ModulePage({ id, onOpen }: { id: ModuleId; onOpen: (view: ViewId) => void }) {
  const m = MODULES.find((x) => x.id === id) ?? MODULES[0];
  const live = m.views.filter((v) => v.id !== id && v.id !== "office");
  // No Agent Office, esta página é a tela "Equipes e delegações", que ainda não existe.
  const office = m.id === "office";
  const title = office ? (m.views.find((v) => v.id === "office")?.label ?? m.name) : m.name;
  return (
    <main className="page" id="conteudo">
      <div className="wrap" style={{ ["--c" as string]: colorVar(m.color) }}>
        <section className="mp-hero">
          <span className="mp-ico" aria-hidden="true"><Icon name={m.icon} size={26} /></span>
          <div className="mp-text">
            <span className="mp-eyebrow">{office ? m.name : "Módulo"} <StatusPill status={office ? "planejado" : m.status} /></span>
            <h1>{title}</h1>
            <p>{office ? "Equipes de agentes, delegação entre eles e uma caixa de aprovações. Ainda não existe; os agentes individuais já funcionam." : m.tagline}</p>
          </div>
          {live.length > 0 && (
            <div className="mp-actions">{live.map((v) => <button key={v.id} className="btn btn-pri" onClick={() => onOpen(v.id)}><Icon name={v.icon} size={18} />Abrir {v.label}</button>)}</div>
          )}
        </section>

        {(m.status === "planejado" || office) && (
          <div className="honest" role="note">
            <Icon name="lock" size={18} />
            <span><b>{office ? "Esta tela ainda não existe no GaDu." : "Este módulo ainda não existe no GaDu."}</b> Está no plano. Nada aqui funciona ainda e nenhum dado é guardado. Abaixo, o que está previsto.</span>
          </div>
        )}

        <div className="grid-2">
          <Panel title={m.status === "planejado" ? "O que está previsto" : "Ainda no plano"} icon="spark">
            <ol className="roadmap">
              {m.planned.map((t) => <li key={t}><span className="rm-dot" aria-hidden="true" /><span className="rm-t">{t}</span><span className="rm-tag">Previsto</span></li>)}
            </ol>
          </Panel>
          <div className="stack">
            {m.available.length > 0 && (
              <Panel title="Já funciona" icon="check">
                <ul className="plist ok">{m.available.map((t) => <li key={t}><Icon name="check" size={16} /><span>{t}</span></li>)}</ul>
              </Panel>
            )}
            {m.needs.length > 0 && (
              <Panel title="Depende de" icon="lock">
                <ul className="plist">{m.needs.map((t) => <li key={t}><Icon name="lock" size={16} /><span>{t}</span></li>)}</ul>
              </Panel>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
