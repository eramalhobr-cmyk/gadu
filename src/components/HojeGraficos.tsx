"use client";

import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/finance/money";
import type { Acumulado, StatusTeto } from "@/lib/finance/tetos";
import { ACOMPANHADOS, type Papel } from "@/lib/investimentos/cotacoes";
import { Bars, Meter, Stack } from "./charts";

type GastoMes = { pago: number; previsto: number };
type Mercado =
  | { estado: "carregando" | "desconectado" | "indisponivel" }
  | { estado: "carregado"; papeis: Papel[] };
const percentual = new Intl.NumberFormat("pt-BR", { style: "percent", signDisplay: "exceptZero", maximumFractionDigits: 2 });
const horario = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

async function lerResumo<T>(url: string, signal: AbortSignal): Promise<T | null> {
  try {
    const resposta = await fetch(url, { cache: "no-store", signal });
    return resposta.ok ? await resposta.json() : null;
  } catch {
    return null;
  }
}

function GastosDiaADia({ mesFinanceiro }: { mesFinanceiro: string }) {
  const [ano, mes] = mesFinanceiro.split("-").map(Number);
  const [historico, setHistorico] = useState<Acumulado | null>();
  const [tetos, setTetos] = useState<StatusTeto[] | null>();

  useEffect(() => {
    const ctrl = new AbortController();
    void lerResumo<Acumulado>(`/api/finance/ano?ano=${ano}`, ctrl.signal).then((dados) => {
      if (!ctrl.signal.aborted) setHistorico(Array.isArray(dados?.porMes) ? dados : null);
    });
    void lerResumo<{ tetos: StatusTeto[] }>(`/api/finance/tetos?ano=${ano}&mes=${mes}`, ctrl.signal).then((dados) => {
      if (!ctrl.signal.aborted) setTetos(Array.isArray(dados?.tetos) ? dados.tetos.slice(0, 2) : null);
    });
    return () => ctrl.abort();
  }, [ano, mes]);

  const meses = historico?.porMes.filter((m) => m.mes <= mes).slice(-6) ?? [];
  const total = meses.reduce((soma, m) => soma + m.total, 0);

  return (
    <section className="band hud-frame today-chart" aria-labelledby="hoje-gastos">
      <h2 className="band-t" id="hoje-gastos">Gastos do dia a dia</h2>
      {total > 0 ? (
        <>
          <p className="muted"><b className="num">{formatBRL(total)}</b> no período · {ano}</p>
          <Bars label={`Gastos do dia a dia por mês em ${ano}`} fmt={formatBRL}
            data={meses.map((m) => ({ label: m.nome.slice(0, 3), value: m.total }))} />
        </>
      ) : <p className="muted">{historico === undefined ? "Carregando histórico…"
        : historico === null ? "Não consegui consultar o histórico."
          : "Nenhum gasto do dia a dia neste período."}</p>}
      <h3 className="pnl-sub">Limites por categoria neste mês</h3>
      {tetos?.length ? (
        <div className="stack">
          {tetos.map((t) => <Meter key={t.id} label={t.categoria} value={t.gasto} max={t.valor} fmt={formatBRL} />)}
        </div>
      ) : <p className="muted">{tetos === undefined ? "Carregando limites…"
        : tetos === null ? "Não consegui consultar os limites."
          : "Nenhum limite por categoria definido."}</p>}
    </section>
  );
}

export function HojeGraficos({ gasto, financeiro, falhaFinanceiro, mesFinanceiro, onOpen }: {
  gasto: GastoMes | null;
  financeiro: boolean;
  falhaFinanceiro: boolean;
  mesFinanceiro: string;
  onOpen: (view: "financeiro" | "investimentos") => void;
}) {
  const [mercado, setMercado] = useState<Mercado>({ estado: "carregando" });
  useEffect(() => {
    const ctrl = new AbortController();
    async function ler() {
      try {
        const resposta = await fetch("/api/investimentos", { signal: ctrl.signal });
        const data = await resposta.json();
        if (ctrl.signal.aborted) return;
        if (!resposta.ok || !Array.isArray(data.cotacoes)) {
          setMercado({ estado: data.error === "fonte_desligada" ? "desconectado" : "indisponivel" });
          return;
        }
        setMercado({ estado: "carregado", papeis: (data.cotacoes as (Papel | null)[]).filter((p): p is Papel => p !== null) });
      } catch {
        if (!ctrl.signal.aborted) setMercado({ estado: "indisponivel" });
      }
    }
    void ler();
    return () => ctrl.abort();
  }, []);
  const papeis = mercado.estado === "carregado" ? mercado.papeis : [];
  const escala = Math.max(1, ...papeis.map((p) => Math.abs(p.dia ?? 0)));
  const temVariacao = papeis.some((p) => p.dia !== null);

  return (
    <div className="today-charts">
      {financeiro && (
        <section className="band hud-frame today-chart" aria-labelledby="hoje-financas">
          <div className="today-chart-head">
            <h2 className="band-t" id="hoje-financas">Finanças do mês</h2>
            <button className="btn btn-sm" onClick={() => onOpen("financeiro")}>Abrir Financeiro</button>
          </div>
          {gasto ? gasto.previsto > 0 || gasto.pago > 0 ? (
            <Stack label="Despesas do mês, pagas e a pagar" fmt={formatBRL} parts={[
              { n: gasto.pago, label: "Pago", tone: "ok" },
              { n: Math.max(0, gasto.previsto - gasto.pago), label: "A pagar", tone: "hot" },
            ]} />
          ) : <p className="muted">Nenhuma despesa registrada neste mês.</p>
            : <p className="muted">{falhaFinanceiro ? "Não consegui consultar as despesas do mês." : "Carregando despesas do mês…"}</p>}
        </section>
      )}
      {financeiro && <GastosDiaADia key={mesFinanceiro} mesFinanceiro={mesFinanceiro} />}
      <section className="band hud-frame today-chart" aria-labelledby="hoje-investimentos">
        <div className="today-chart-head">
          <h2 className="band-t" id="hoje-investimentos">Investimentos</h2>
          <button className="btn btn-sm" onClick={() => onOpen("investimentos")}>Abrir Investimentos</button>
        </div>
        {mercado.estado === "carregando" ? <p className="muted">Carregando cotações…</p>
          : mercado.estado === "desconectado" ? <p className="muted">Conecte a brapi para ver a variação das ações.</p>
            : temVariacao ? (
              <>
                <p className="muted">Variação no dia · fonte brapi</p>
                <ul className="today-market" aria-label="Variação percentual diária das ações acompanhadas">
                  {ACOMPANHADOS.map(({ ticker }) => {
                    const papel = papeis.find((p) => p.ticker === ticker);
                    const variacao = papel?.dia ?? null;
                    return (
                      <li key={ticker}>
                        <span className="num">{ticker}</span>
                        <span className="today-market-track" aria-hidden="true">
                          {variacao !== null && <i className={variacao < 0 ? "queda" : "alta"} style={{ width: `${Math.abs(variacao) / escala * 50}%` }} />}
                        </span>
                        <span className="today-market-value">
                          <b className="num">{variacao === null ? "Sem dados" : percentual.format(variacao / 100)}</b>
                          {papel && <time className="muted" dateTime={papel.horario}>{horario.format(new Date(papel.horario))}</time>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : <p className="muted">A variação do dia está indisponível.</p>}
      </section>
    </div>
  );
}
