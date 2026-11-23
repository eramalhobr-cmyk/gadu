"use client";
// Gráficos leves (SVG e CSS, sem biblioteca) para os painéis de resumo do tema JARVIS.
// Cada gráfico tem nome acessível com os números e, quando há série, uma tabela escondida para leitores de tela.
import type { ReactNode } from "react";
import { descreve, escala, linha, type Ponto } from "@/lib/painel";
import { EVENTO_FALAR } from "@/lib/painel-fala";
import { Icon } from "./ui";

/** Cartão de indicador: rótulo em mono, número grande e uma linha de apoio. */
export function Kpi(props: { label: string; value: ReactNode; sub?: ReactNode; tone?: "ok" | "hot" | "bad"; children?: ReactNode }) {
  return (
    <div className={`gkpi hud-frame ${props.tone ?? ""}`}>
      <span className="gkpi-l">{props.label}</span>
      <b className="gkpi-v">{props.value}</b>
      {props.sub && <span className="gkpi-s">{props.sub}</span>}
      {props.children}
    </div>
  );
}

export function KpiRow(props: { label: string; children: ReactNode }) {
  return <div className="gkpi-row" role="group" aria-label={props.label}>{props.children}</div>;
}

/** Anel de progresso (0 a 100). pct null = sem dados: mostra "–", nunca 0%. */
export function Ring(props: { pct: number | null; label: string; sub?: ReactNode; size?: number; tone?: "ok" | "hot" | "bad" }) {
  const size = props.size ?? 76, r = 15.9155, p = props.pct ?? 0;
  return (
    <figure className={`gring ${props.tone ?? ""}`} style={{ ["--sz" as string]: `${size}px` }}>
      <svg viewBox="0 0 36 36" width={size} height={size} role="img" aria-label={props.pct === null ? `${props.label}: sem registros` : `${props.label}: ${props.pct}%`}>
        <circle cx="18" cy="18" r={r} className="gring-bg" />
        {props.pct !== null && <circle cx="18" cy="18" r={r} className="gring-fg" strokeDasharray={`${p} ${100 - p}`} strokeDashoffset="25" />}
        <text x="18" y="20.5" textAnchor="middle" className="gring-t">{props.pct === null ? "–" : `${props.pct}%`}</text>
      </svg>
      <figcaption><span className="gring-l">{props.label}</span>{props.sub && <span className="gring-s">{props.sub}</span>}</figcaption>
    </figure>
  );
}

/** Colunas verticais (ex.: gasto por mês, tarefas feitas por dia). */
export function Bars(props: { data: Ponto[]; label: string; fmt: (n: number) => string; destaque?: number }) {
  const h = escala(props.data);
  if (!h) return null;
  return (
    <figure className={`bars ${props.data.length > 7 ? "dense" : ""}`}>
      <div className="bars-g" role="img" aria-label={`${props.label}. ${descreve(props.data, props.fmt)}`}>
        {props.data.map((p, i) => (
          <div key={p.label + i} className={`bar-c ${i === (props.destaque ?? props.data.length - 1) ? "on" : ""}`}>
            <span className="bar-v num">{p.value > 0 ? props.fmt(p.value) : ""}</span>
            <span className="bar-t"><i style={{ height: `${Math.max(p.value > 0 ? 4 : 0, h[i])}%` }} /></span>
            <span className="bar-x">{p.label}</span>
          </div>
        ))}
      </div>
      <table className="sr"><caption>{props.label}</caption><tbody>{props.data.map((p, i) => <tr key={i}><th>{p.label}</th><td>{props.fmt(p.value)}</td></tr>)}</tbody></table>
    </figure>
  );
}

/** Linha curta de tendência. */
export function Spark(props: { values: number[]; label: string }) {
  const pts = linha(props.values);
  if (!pts) return null;
  return <svg className="spark" viewBox="0 0 120 32" width="120" height="32" role="img" aria-label={props.label}><polyline points={pts} /></svg>;
}

/** Barra de gasto contra um teto, com a marca do teto. */
export function Meter(props: { value: number; max: number; label: string; fmt: (n: number) => string }) {
  const pct = props.max > 0 ? Math.round((props.value / props.max) * 100) : 0;
  const tone = pct >= 100 ? "bad" : pct >= 80 ? "hot" : "ok";
  const escalaMax = Math.max(props.max, props.value) || 1;
  return (
    <div className={`meter ${tone}`} role="img" aria-label={`${props.label}: ${props.fmt(props.value)} de ${props.fmt(props.max)} (${pct}%)`}>
      <div className="meter-h"><span>{props.label}</span><span className="num">{pct}%</span></div>
      <div className="meter-t"><i style={{ width: `${(props.value / escalaMax) * 100}%` }} /><b style={{ left: `${(props.max / escalaMax) * 100}%` }} aria-hidden="true" /></div>
      <div className="meter-s num">{props.fmt(props.value)} / {props.fmt(props.max)}</div>
    </div>
  );
}

/** Barra empilhada (ex.: feitas × abertas × atrasadas). */
export function Stack(props: { parts: { n: number; label: string; tone: "ok" | "sig" | "hot" | "bad" | "mut" }[]; label: string }) {
  const total = props.parts.reduce((a, p) => a + p.n, 0);
  if (total <= 0) return null;
  return (
    <div className="stack-c">
      <div className="stack-b" role="img" aria-label={`${props.label}: ${props.parts.map((p) => `${p.n} ${p.label}`).join(", ")}`}>
        {props.parts.filter((p) => p.n > 0).map((p) => <i key={p.label} className={p.tone} style={{ ["--g" as string]: p.n }} />)}
      </div>
      <ul className="stack-l" aria-hidden="true">{props.parts.map((p) => <li key={p.label}><i className={p.tone} />{p.label} <b className="num">{p.n}</b></li>)}</ul>
    </div>
  );
}

/** Cabeçalho do painel: título, frase de voz e o botão "Ouvir" (lê o resumo com a voz escolhida, sem modelo). */
export function PainelHead(props: { id: string; title: string; dica: string; fala: string }) {
  return (
    <div className="pnl-hd">
      <h2 className="pnl-h" id={props.id}>{props.title} <small>{props.dica}</small></h2>
      {props.fala && (
        <button type="button" className="pnl-ouvir" aria-label={`Ouvir: ${props.title}`}
          onClick={() => window.dispatchEvent(new CustomEvent(EVENTO_FALAR, { detail: props.fala }))}>
          <Icon name="som" size={16} />Ouvir
        </button>
      )}
    </div>
  );
}
