"use client";
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
  return (
    <main className="page" id="conteudo">
      <div className="wrap">
        <section className="modpage-hero" style={{ ["--c" as string]: colorVar(m.color) }}>
          <span className="row" style={{ gap: 12 }}><span className="mod-ico"><Icon name={m.icon} size={22} /></span><StatusPill status={m.status} /></span>
          <h1>{m.name}</h1>
          <p>{m.tagline}</p>
          {m.status === "parcial" && live.length > 0 && (
            <div className="row">{live.map((v) => <button key={v.id} className="btn btn-pri btn-sm" onClick={() => onOpen(v.id)}>Abrir {v.label}</button>)}</div>
          )}
        </section>

        {m.status === "planejado" && (
          <div className="honest" role="note">
            <Icon name="lock" size={18} />
            <span><b>Este módulo ainda não existe no GaDu.</b> Ele está no plano. Nada aqui funciona ainda e nenhum dado é guardado. Esta página mostra o que está previsto.</span>
          </div>
        )}

        <div className="modpage-cols">
          {m.available.length > 0 && (
            <section className="card">
              <h2>Já funciona</h2>
              <ul className="ticks ok">{m.available.map((t) => <li key={t}><Icon name="check" size={16} /><span>{t}</span></li>)}</ul>
            </section>
          )}
          <section className="card">
            <h2>{m.status === "planejado" ? "O que está previsto" : "Ainda no plano"}</h2>
            <ul className="ticks">{m.planned.map((t) => <li key={t}><Icon name="spark" size={16} /><span>{t}</span></li>)}</ul>
          </section>
          {m.needs.length > 0 && (
            <section className="card">
              <h2>Depende de</h2>
              <ul className="ticks">{m.needs.map((t) => <li key={t}><Icon name="lock" size={16} /><span>{t}</span></li>)}</ul>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
