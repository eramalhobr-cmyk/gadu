"use client";
import { useEffect, useState } from "react";
import { quantidade, rotuloMes, usd, type ResumoTipo } from "@/lib/consumo";
import { Meter } from "./charts";

type Detalhe = {
  mes: string;
  gasto: number;
  teto: number;
  reservado: number;
  falta: number | null;
  tipos: ResumoTipo[];
  meses: { mes: string; rotulo: string; custo: number; vezes: number }[];
  completo: boolean;
};

/** Ajustes › Custos de IA: gasto do mês por tipo, teto, quanto falta e os últimos 3 meses. Só leitura. */
export function UsoDetalhado() {
  const [d, setD] = useState<Detalhe | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let vivo = true;
    fetch("/api/usage/detalhe?meses=3", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((j: Detalhe) => { if (vivo) setD(j); })
      .catch(() => { if (vivo) setErr(true); });
    return () => { vivo = false; };
  }, []);

  return (
    <section className="card uso-det" aria-labelledby="h-uso-det">
      <h2 id="h-uso-det">Seu uso por tipo</h2>
      {err ? <div className="notice" role="alert">Não consegui carregar o uso detalhado.</div>
        : !d ? <p className="muted" role="status">Carregando…</p>
        : (
          <>
            <Meter value={d.gasto + d.reservado} max={d.teto} label={`Teto de ${rotuloMes(d.mes)}`} fmt={usd} />
            <p className="muted fs-sm m0">
              Gasto: {usd(d.gasto)} · Falta: {usd(d.falta ?? 0)}
              {d.reservado > 0 ? ` · ${usd(d.reservado)} em respostas em andamento` : ""}
            </p>
            {d.tipos.length === 0 ? <p className="muted">Nenhum uso de IA neste mês.</p> : (
              <div className="rows">
                {d.tipos.map((t) => (
                  <div className="row-i" key={t.tipo}>
                    <div className="grow">
                      <span className="t">{t.rotulo}</span>
                      <span className="s">{quantidade(t)}</span>
                    </div>
                    <span className="tnum">{usd(t.custo)}</span>
                  </div>
                ))}
              </div>
            )}
            <h3 className="fs-15 m0">Últimos 3 meses</h3>
            <div className="rows">
              {d.meses.map((m) => (
                <div className="row-i" key={m.mes}>
                  <div className="grow">
                    <span className="t">{m.rotulo}</span>
                    <span className="s">{m.vezes} {m.vezes === 1 ? "uso" : "usos"}</span>
                  </div>
                  <span className="tnum">{usd(m.custo)}</span>
                </div>
              ))}
            </div>
            {!d.completo && <p className="muted fs-sm m0">Muito uso no período: mostrando só uma parte.</p>}
            <p className="muted fs-sm m0">O teto vale para o mês todo e soma todos os tipos. O gasto volta a zero no dia 1.</p>
          </>
        )}
    </section>
  );
}
