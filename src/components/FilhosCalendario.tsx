"use client";

import { useMemo, useState } from "react";
import { mesCalendario, resumoMes, rotuloData, type AjusteFilhos, type ConfigFilhos, type DiaCalendario } from "@/lib/filhos/agenda";
import styles from "./FilhosCalendario.module.css";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const SEMANA_LONGA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** Calendário do mês: cada fim de semana pintado com a cor de quem fica com as crianças. Tocar escolhe o fim de semana. */
export function FilhosCalendario(props: {
  config: ConfigFilhos;
  ajustes: AjusteFilhos[];
  hoje: string;
  gravando: boolean;
  onTrocar: (sabado: string, comigo: boolean) => void;
  onDesfazer: (id: string) => void;
}) {
  const [mes, setMes] = useState(() => ({ ano: +props.hoje.slice(0, 4), mes: +props.hoje.slice(5, 7) }));
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const semanas = useMemo(() => mesCalendario(mes.ano, mes.mes, props.config, props.ajustes, props.hoje), [mes, props.config, props.ajustes, props.hoje]);
  const resumo = resumoMes(semanas);
  const mudar = (delta: number) => {
    setEscolhido(null);
    setMes((m) => { const t = m.ano * 12 + (m.mes - 1) + delta; return { ano: Math.floor(t / 12), mes: (t % 12) + 1 }; });
  };
  const doFim = escolhido ? semanas.flat().filter((d) => d.sabado === escolhido) : [];
  const sel = doFim.find((d) => d.dia === escolhido) ?? doFim[0];
  const troca = escolhido ? props.ajustes.find((a) => a.tipo === "troca" && a.data === escolhido) : undefined;
  const feriados = doFim.filter((d) => d.feriado);

  const rotulo = (d: DiaCalendario) => {
    const dono = d.comigo === null ? "" : d.comigo ? ", com você" : ", com o outro responsável";
    return `${SEMANA_LONGA[new Date(`${d.dia}T12:00:00Z`).getUTCDay()]}, ${+d.dia.slice(8, 10)} de ${MESES[+d.dia.slice(5, 7) - 1]}${dono}${d.troca ? ", troca" : ""}${d.feriado ? `, feriado: ${d.feriado}` : ""}${d.hoje ? ", hoje" : ""}`;
  };

  return (
    <div className={styles.cal}>
      <div className={styles.topo}>
        <button type="button" className={styles.nav} onClick={() => mudar(-1)} aria-label="Mês anterior">‹</button>
        <h3 className={styles.mes} aria-live="polite">{MESES[mes.mes - 1]} <span>{mes.ano}</span></h3>
        <button type="button" className={styles.nav} onClick={() => mudar(1)} aria-label="Próximo mês">›</button>
      </div>
      <p className={styles.resumo}>
        <span className={styles.chipVoce}>{resumo.comigo} com você</span>
        <span className={styles.chipOutro}>{resumo.outro} com o outro responsável</span>
      </p>
      <div className={styles.grade} role="grid" aria-label={`Agenda de filhos, ${MESES[mes.mes - 1]} de ${mes.ano}`}>
        <div className={styles.linha} role="row">
          {SEMANA.map((s, i) => <span key={i} className={styles.cab} role="columnheader" aria-label={SEMANA_LONGA[i]}>{s}</span>)}
        </div>
        {semanas.map((semana) => (
          <div className={styles.linha} role="row" key={semana[0].dia}>
            {semana.map((d) => {
              const classe = [styles.dia, d.doMes ? "" : styles.fora, d.comigo === true ? styles.voce : d.comigo === false ? styles.outro : "",
                d.faixa ? styles[d.faixa] : "", d.troca ? styles.troca : "", d.hoje ? styles.hoje : "", d.sabado && d.sabado === escolhido ? styles.sel : ""].join(" ");
              const n = +d.dia.slice(8, 10);
              return d.sabado ? (
                <button type="button" role="gridcell" key={d.dia} className={classe} aria-label={rotulo(d)} aria-pressed={d.sabado === escolhido}
                  onClick={() => setEscolhido(d.sabado === escolhido ? null : d.sabado)}>
                  {n}{d.feriado && <i className={styles.feriado} aria-hidden="true" />}
                </button>
              ) : (
                <span role="gridcell" key={d.dia} className={classe} aria-label={rotulo(d)}>{n}{d.feriado && <i className={styles.feriado} aria-hidden="true" />}</span>
              );
            })}
          </div>
        ))}
      </div>
      <ul className={styles.legenda} aria-label="Legenda">
        <li><i className={styles.lVoce} />Com você</li>
        <li><i className={styles.lOutro} />Com o outro</li>
        <li><i className={styles.lTroca} />Troca</li>
        <li><i className={styles.lFeriado} />Feriado</li>
      </ul>
      {sel && doFim.length > 0 && (
        <div className={styles.detalhe} data-comigo={Boolean(sel.comigo)} role="region" aria-label="Fim de semana escolhido">
          <div>
            <b>{rotuloData(doFim[0].dia)} a {rotuloData(doFim[doFim.length - 1].dia)}</b>
            <span>{sel.comigo ? "Com você" : "Com o outro responsável"}{troca ? " · troca" : ""}</span>
            {feriados.map((f) => <small key={f.dia}>Feriado: {f.feriado}</small>)}
          </div>
          {troca ? (
            <button type="button" className="btn" disabled={props.gravando} onClick={() => props.onDesfazer(troca.id)}>Desfazer troca</button>
          ) : (
            <button type="button" className="btn btn-pri" disabled={props.gravando} onClick={() => escolhido && props.onTrocar(escolhido, !sel.comigo)}>Trocar</button>
          )}
        </div>
      )}
    </div>
  );
}
