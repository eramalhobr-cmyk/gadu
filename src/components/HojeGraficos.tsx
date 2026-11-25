"use client";

import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/finance/money";
import { ACOMPANHADOS, type Papel } from "@/lib/investimentos/cotacoes";
import { Stack } from "./charts";

type GastoMes = { pago: number; previsto: number };
type Mercado =
  | { estado: "carregando" | "desconectado" | "indisponivel" }
  | { estado: "carregado"; papeis: Papel[] };
const percentual = new Intl.NumberFormat("pt-BR", { style: "percent", signDisplay: "exceptZero", maximumFractionDigits: 2 });
const horario = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export function HojeGraficos({ gasto, financeiro, falhaFinanceiro, onOpen }: {
  gasto: GastoMes | null;
  financeiro: boolean;
  falhaFinanceiro: boolean;
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
