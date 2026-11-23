// Peças de interface compartilhadas da UX/UI v2.1. Use em todas as telas para manter um desenho só.
"use client";
import { createContext, useContext } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Icon } from "./ui";

/** Abre a tela de escuta do GaDu. O GaduApp fornece; fora dele (testes, páginas soltas) não há botão de falar. */
const TalkContext = createContext<(() => void) | null>(null);
export const TalkProvider = TalkContext.Provider;

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

/**
 * Estado vazio: o que é, por que está vazio e o que fazer.
 * Com `phrase`, mostra um exemplo do que dizer e o botão "Falar com o GaDu" (convite padrão dos módulos).
 */
export function EmptyState(props: { icon?: string; title: string; text?: ReactNode; action?: ReactNode; phrase?: string }) {
  const talk = useContext(TalkContext);
  return (
    <div className="empty">
      <span className="ico" aria-hidden="true"><Icon name={props.icon ?? "spark"} size={20} /></span>
      <b>{props.title}</b>
      {props.text && <p>{props.text}</p>}
      {props.phrase && <p className="empty-say">Diga: <q>{props.phrase}</q></p>}
      {(props.action || (props.phrase && talk)) && (
        <div className="empty-actions">
          {props.action}
          {props.phrase && talk && <button type="button" className="btn btn-sm" onClick={talk}><Icon name="mic" size={16} />Falar com o GaDu</button>}
        </div>
      )}
    </div>
  );
}

/** A ação principal da tela: uma só por tela, no cabeçalho. */
export function PrimaryAction(props: { children: ReactNode; onClick?: () => void; icon?: string; disabled?: boolean; expanded?: boolean }) {
  return (
    <button type="button" className="btn btn-pri" onClick={props.onClick} disabled={props.disabled} aria-expanded={props.expanded}>
      <Icon name={props.icon ?? "plus"} size={18} />{props.children}
    </button>
  );
}

/** Resumo da tela: dois a quatro números curtos logo abaixo do cabeçalho. */
export function Summary(props: { items: { n: ReactNode; label: string; tone?: "ok" | "hot" | "bad" }[]; label?: string }) {
  return (
    <div className="mod-sum" role="group" aria-label={props.label ?? "Resumo"}>
      {props.items.map((i) => (
        <div key={i.label} className={`mod-sum-i ${i.tone ?? ""}`}><b>{i.n}</b><span>{i.label}</span></div>
      ))}
    </div>
  );
}

/**
 * Padrão único de tela de módulo (UX-5): cabeçalho com título e uma frase, UMA ação principal, resumo e o conteúdo
 * (lista e estado vazio com convite para falar). Use em Tarefas, Projetos, Metas, Financeiro, Memória e Agentes.
 */
export function ModuleScreen(props: { title: string; text?: ReactNode; eyebrow?: string; action?: ReactNode; summary?: ReactNode; children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <main className={`page ${props.className ?? ""}`} id="conteudo" style={props.style}>
      <div className="wrap stack">
        <PageHeader eyebrow={props.eyebrow} title={props.title} text={props.text} actions={props.action} />
        {props.summary}
        {props.children}
      </div>
    </main>
  );
}

/** Botão Voltar de telas de detalhe (Projeto, Meta, Agenda): um desenho só. */
export function BackButton(props: { onClick: () => void; children: ReactNode }) {
  return <button type="button" className="back" onClick={props.onClick}><Icon name="chevron" size={16} />{props.children}</button>;
}

/** Campo de formulário: rótulo em cima, controle embaixo. `hint` vira "(opcional)" ao lado do rótulo. */
export function Field(props: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="fld">
      <span>{props.label}{props.hint && <> <em className="opt">({props.hint})</em></>}</span>
      {props.children}
    </label>
  );
}
