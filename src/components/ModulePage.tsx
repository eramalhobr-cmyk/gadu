"use client";
import { Panel } from "./kit";
import { colorVar, Icon } from "./ui";
import { AREAS, MODULES, moduleById, STATUS_LABEL, type ModuleDef, type ModuleId, type ViewId } from "@/lib/modules";
import { PageHeader } from "./kit";

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
            <span className="mp-eyebrow">{office ? m.name : m.brand ?? "Módulo"} <StatusPill status={office ? "planejado" : m.status} /></span>
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
            {m.doc && <p className="mp-doc">Especificação técnica: <code>{m.doc}</code></p>}
          </div>
        </div>
      </div>
    </main>
  );
}

/** Tela Módulos (celular e computador): explora o produto por área, sem lista enorme.
 * As telas da barra de baixo (Hoje, Conversas, Tarefas) e a Plataforma (no menu da conta) não se repetem aqui. */
export function ModulesHub({ onOpen, pending = 0 }: { onOpen: (view: ViewId) => void; pending?: number }) {
  const skip: ViewId[] = ["hoje", "modulos", "conversa", "tarefas"];
  return (
    <main className="page" id="conteudo">
      <div className="wrap hub">
        <PageHeader title="Módulos" text="Tudo o que o GaDu faz, por área. O que ainda não existe aparece como planejado." />
        {AREAS.filter((a) => a.id !== "plataforma").map((a) => {
          const mods = a.modules.map(moduleById);
          const live = mods.filter((m) => m.status !== "planejado");
          const soon = mods.filter((m) => m.status === "planejado");
          type Tile = { key: string; view: ViewId; icon: string; name: string; text: string; m: ModuleDef };
          const tiles: Tile[] = live.flatMap((m): Tile[] => (m.id === "pessoal" ? m.views.filter((v) => !skip.includes(v.id)).map((v) => ({ key: v.id, view: v.id, icon: v.icon, name: v.label, text: "", m })) : [{ key: m.id, view: m.views[0].id, icon: m.icon, name: m.name, text: m.tagline, m }]));
          return (
            <section key={a.id} className="hub-area" aria-labelledby={`area-${a.id}`}>
              <div className="hub-head"><h2 id={`area-${a.id}`}>{a.name}</h2><p>{a.text}</p></div>
              {tiles.length > 0 && (
                <div className="hub-tiles">
                  {tiles.map((t) => (
                    <button key={t.key} className="hub-tile" style={{ ["--c" as string]: colorVar(t.m.color) }} onClick={() => onOpen(t.view)}>
                      <span className="hub-ico" aria-hidden="true"><Icon name={t.icon} size={22} /></span>
                      <span className="hub-t"><b>{t.name}</b>{t.text && <small>{t.text}</small>}</span>
                      {t.view === "memoria" && pending > 0 ? <b className="nav-badge" aria-label={`${pending} memórias para revisar`}>{pending}</b> : t.m.status !== "disponivel" && <StatusPill status={t.m.status} />}
                    </button>
                  ))}
                </div>
              )}
              {soon.length > 0 && (
                <div className="hub-soon">
                  {soon.map((m) => (
                    <button key={m.id} className="hub-soon-i" style={{ ["--c" as string]: colorVar(m.color) }} onClick={() => onOpen(m.views[0].id)}>
                      <Icon name={m.icon} size={18} /><span>{m.name}</span><StatusPill status={m.status} />
                    </button>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
