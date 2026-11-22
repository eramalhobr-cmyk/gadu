"use client";
import { Panel } from "./kit";
import { colorVar, Icon } from "./ui";
import { DOCK_VIEWS, MAIN_VIEWS, MODULES, moduleOf, STATUS_LABEL, viewDef, type ModuleDef, type ModuleId, type ViewId } from "@/lib/modules";
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

/** Itens de "Mais", na ordem dos menus. Texto curto, em linguagem simples. */
const MORE_TEXT: Partial<Record<ViewId, string>> = {
  agenda: "Seus compromissos da semana",
  financeiro: "Contas e gastos do mês",
  metas: "Seus objetivos e o progresso",
  projetos: "Tarefas separadas por projeto",
  memoria: "O que o GaDu sabe sobre você",
  agentes: "Ajudantes para cada assunto",
};

/** Tela "Mais" (UX-1): tudo o que funciona e não cabe na barra de baixo, em blocos grandes; a conta no mesmo lugar.
 * O que ainda não existe fica numa linha discreta "Em breve", no fim. */
export function ModulesHub(props: {
  onOpen: (view: ViewId) => void;
  onHistory: () => void;
  pending?: number;
  hide?: ModuleId[];
  /** MODELING_3D_ENABLED=1: entrada "3D" (Beta) que abre /app/3d. Desligado, o 3D não aparece em Mais (nem em "Em breve"). */
  show3d?: boolean;
  admin?: boolean;
  name?: string;
  email?: string;
}) {
  const { onOpen, pending = 0, hide = [] } = props;
  const views = MAIN_VIEWS.filter((v) => !DOCK_VIEWS.includes(v) && !hide.includes(moduleOf(v).id));
  const soon = MODULES.filter((m) => m.status === "planejado" && !hide.includes(m.id) && m.id !== "studio3d");
  const initial = (props.name || props.email || "G").trim().charAt(0).toUpperCase();
  const tile = (key: string, icon: string, name: string, text: string, color: string, onClick: () => void, badge?: React.ReactNode) => (
    <button key={key} className="more-tile" style={{ ["--c" as string]: colorVar(color) }} onClick={onClick}>
      <span className="hub-ico" aria-hidden="true"><Icon name={icon} size={24} /></span>
      <span className="hub-t"><b>{name}</b><small>{text}</small></span>
      {badge}
    </button>
  );
  return (
    <main className="page" id="conteudo">
      <div className="wrap hub more">
        <h1 className="sr">Mais</h1>
        <div className="more-tiles">
          {views.map((v) => {
            const d = viewDef(v);
            return tile(v, d.icon, d.label, MORE_TEXT[v] ?? "", moduleOf(v).color, () => onOpen(v),
              v === "memoria" && pending > 0 ? <b className="nav-badge" aria-label={`${pending} memórias para revisar`}>{pending}</b> : undefined);
          })}
          {props.show3d && (
            <a className="more-tile" href="/app/3d" style={{ ["--c" as string]: colorVar("hot") }}>
              <span className="hub-ico" aria-hidden="true"><Icon name="cube" size={24} /></span>
              <span className="hub-t"><b>3D</b><small>Peças para imprimir na A1</small></span>
              <span className="pill parcial">Beta</span>
            </a>
          )}
          {tile("historico", "history", "Conversas anteriores", "Abrir uma conversa antiga", "sig", props.onHistory)}
        </div>
        <div className="more-tiles">
          {tile("ajustes", "gear", "Configurações", "Conta, voz, Google e avisos", "pink", () => onOpen("ajustes"),
            <span className="more-initial" aria-hidden="true">{initial}</span>)}
          {props.admin && tile("admin", "lock", "Administração", "Pessoas e convites", "pink", () => onOpen("admin"))}
          <a className="more-tile" href="/app/guia" style={{ ["--c" as string]: colorVar("blue") }}>
            <span className="hub-ico" aria-hidden="true"><Icon name="book" size={24} /></span>
            <span className="hub-t"><b>Ajuda</b><small>Guia passo a passo</small></span>
          </a>
        </div>
        {soon.length > 0 && (
          <p className="more-soon">
            <span>Em breve:</span>
            {soon.map((m) => <button key={m.id} className="link-btn" onClick={() => onOpen(m.views[0].id)}>{m.name}</button>)}
          </p>
        )}
      </div>
    </main>
  );
}
