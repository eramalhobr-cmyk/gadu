// Peças de interface compartilhadas da UX/UI v2.1. Use em todas as telas para manter um desenho só.
import type { ReactNode } from "react";
import { Icon } from "./ui";

/** Cabeçalho de página: título, descrição curta e ações. */
export function PageHeader(props: { eyebrow?: string; title: string; text?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="ph">
      <div className="ph-text">
        {props.eyebrow && <span className="ph-eyebrow">{props.eyebrow}</span>}
        <h1>{props.title}</h1>
        {props.text && <p>{props.text}</p>}
      </div>
      {props.actions && <div className="ph-actions">{props.actions}</div>}
    </header>
  );
}

/** Painel (cartão) com título, ícone e ação opcional. */
export function Panel(props: { title?: string; icon?: string; action?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={`panel ${props.className ?? ""}`} id={props.id}>
      {(props.title || props.action) && (
        <div className="panel-head">
          {props.title && <h2>{props.icon && <Icon name={props.icon} size={18} />}{props.title}</h2>}
          {props.action}
        </div>
      )}
      {props.children}
    </section>
  );
}

/** Estado vazio: o que é, por que está vazio e o que fazer. */
export function EmptyState(props: { icon?: string; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="ico" aria-hidden="true"><Icon name={props.icon ?? "spark"} size={20} /></span>
      <b>{props.title}</b>
      {props.text && <p>{props.text}</p>}
      {props.action}
    </div>
  );
}
