// Mapa do GaDu (UX-7): como as telas se ligam, com a conversa e a voz no centro. Cada nó abre a tela; cada ligação diz o que significa e o que falar.
import { MAP_LINKS } from "@/lib/ligacoes";
import type { ViewId } from "@/lib/modules";
import { Icon } from "./ui";

type Node = { name: string; view: ViewId; icon: string; color: string };
const NODES: Node[] = [
  { name: "Hoje", view: "hoje", icon: "sun", color: "var(--sig)" },
  { name: "Tarefas", view: "tarefas", icon: "check", color: "var(--hot)" },
  { name: "Projetos", view: "projetos", icon: "folder", color: "var(--c-blue)" },
  { name: "Metas", view: "metas", icon: "target", color: "var(--hot)" },
  { name: "Financeiro", view: "financeiro", icon: "coin", color: "var(--c-green)" },
  { name: "Agentes", view: "agentes", icon: "agents", color: "var(--c-violet)" },
  { name: "Memória", view: "memoria", icon: "book", color: "var(--c-green)" },
  { name: "Agenda", view: "agenda", icon: "calendar", color: "var(--c-blue)" },
];
const W = 360, C = W / 2, R = 132;
const pos = (i: number) => {
  const a = (i / NODES.length) * Math.PI * 2 - Math.PI / 2;
  return { x: C + Math.cos(a) * R, y: C + Math.sin(a) * R };
};
const at = (name: string) => {
  const i = NODES.findIndex((n) => n.name === name);
  return i < 0 ? { x: C, y: C } : pos(i);
};

export function GaduMap({ hide = [] }: { hide?: ViewId[] }) {
  const nodes = NODES.filter((n) => !hide.includes(n.view));
  const names = new Set(nodes.map((n) => n.name).concat("Conversa"));
  const links = MAP_LINKS.filter((l) => names.has(l.from) && names.has(l.to));
  return (
    <div className="gmap">
      <svg className="gmap-svg" viewBox={`0 0 ${W} ${W}`} role="img" aria-label="Mapa do GaDu: a conversa e a voz no centro, ligadas a todas as telas; Metas ligam Projetos, Tarefas e Agenda; Tarefas, Agenda e Financeiro avisam no Hoje.">
        <circle cx={C} cy={C} r={R} className="gmap-ring" />
        {nodes.map((n) => { const p = pos(NODES.indexOf(n)); return <line key={`v-${n.name}`} x1={C} y1={C} x2={p.x} y2={p.y} className="gmap-spoke" />; })}
        {links.filter((l) => l.to !== "Conversa").map((l) => {
          const a = at(l.from), b = at(l.to);
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          const cx = mx + (C - mx) * 0.35, cy = my + (C - my) * 0.35;
          return <path key={`${l.from}-${l.to}`} d={`M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`} className="gmap-link" />;
        })}
        <circle cx={C} cy={C} r={44} className="gmap-core" />
        <image href="/avatar/logo-96.webp" x={C - 26} y={C - 34} width={52} height={52} />
        <text x={C} y={C + 32} textAnchor="middle" className="gmap-core-t">Conversa e voz</text>
        {nodes.map((n) => {
          const p = pos(NODES.indexOf(n));
          return (
            <a key={n.name} href={`/app?tab=${n.view}`} aria-label={`Abrir ${n.name}`}>
              <circle cx={p.x} cy={p.y} r={26} className="gmap-node" style={{ ["--c" as string]: n.color }} />
              <text x={p.x} y={p.y + 4} textAnchor="middle" className="gmap-node-t">{n.name}</text>
            </a>
          );
        })}
      </svg>
      <ul className="gmap-list">
        {links.map((l) => (
          <li key={`${l.from}-${l.to}`}>
            <b>{l.from} <Icon name="chevron" size={13} /> {l.to}</b>
            <span>{l.what}</span>
            <span className="say2"><Icon name="mic" size={13} /> “{l.say}”</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
