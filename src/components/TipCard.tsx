"use client";
import { TIPS, type TipId } from "@/lib/tips";
import { Icon } from "./ui";

/** Cartão de dica da primeira visita. "Entendi" fecha para sempre; "Ver guia" abre o passo a passo. */
export function TipCard({ id, onDone, floating = false }: { id: TipId; onDone: () => void; floating?: boolean }) {
  const t = TIPS[id];
  return (
    <div className={`tip ${floating ? "floating" : ""}`} role="note" aria-label={`Dica: ${t.title}`}>
      <span className="tip-ico"><Icon name="spark" size={18} /></span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <b>{t.title}</b>
        <p>{t.text}</p>
        <div className="row">
          <button className="btn btn-sm btn-pri" onClick={onDone}>Entendi</button>
          <a className="btn btn-sm" href="/app/guia">Ver guia</a>
        </div>
      </div>
    </div>
  );
}
