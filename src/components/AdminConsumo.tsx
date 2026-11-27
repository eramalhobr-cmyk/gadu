"use client";
import { useEffect, useState } from "react";
import { mesDe, quantidade, rotuloMes, usd, type ConsumoPessoa } from "@/lib/consumo";
import { Panel } from "./kit";

type Resposta = { mes: string; total: number; pessoas: ConsumoPessoa[]; tetoFonte: "banco" | "servidor"; completo: boolean };

const tom = (pct: number | null) => (pct === null ? "" : pct >= 100 ? "bad" : pct >= 80 ? "hot" : "ok");

/** Administração › consumo de IA do mês por pessoa (nome e e-mail apenas), por tipo e motor. Só leitura. */
export function AdminConsumo() {
  const atual = mesDe(new Date());
  const [mes, setMes] = useState(atual);
  const [d, setD] = useState<Resposta | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let vivo = true;
    setD(null); setErr(false);
    fetch(`/api/admin/consumo?mes=${encodeURIComponent(mes)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((j: Resposta) => { if (vivo) setD(j); })
      .catch(() => { if (vivo) setErr(true); });
    return () => { vivo = false; };
  }, [mes]);

  return (
    <Panel title="Consumo de IA por pessoa" icon="coin" id="adm-consumo"
      action={
        <label className="row nowrap">
          <span className="sr">Mês</span>
          <input className="field" type="month" value={mes} max={atual} onChange={(e) => e.target.value && setMes(e.target.value)} aria-label="Mês do consumo" />
        </label>
      }>
      {err ? <div className="notice" role="alert">Não consegui carregar o consumo.</div>
        : !d ? <p className="muted" role="status">Carregando…</p>
        : (
          <>
            <p className="muted fs-sm m0">Total de {rotuloMes(d.mes)}: <b className="tnum">{usd(d.total)}</b></p>
            {d.tetoFonte === "servidor" && <p className="muted fs-sm m0">Teto mostrado: o padrão do servidor. O teto próprio de cada pessoa ainda não é lido aqui.</p>}
            {!d.completo && <p className="muted fs-sm m0">Muito uso no mês: os números mostram só uma parte.</p>}
            {d.pessoas.length === 0 ? <p className="muted">Ninguém por aqui.</p> : (
              <div className="rows">
                {d.pessoas.map((p) => (
                  <details className="adm-consumo" key={p.id}>
                    <summary className="row-i">
                      <div className="grow">
                        <span className="t">{p.nome}</span>
                        <span className="s">{p.email && p.email !== p.nome ? `${p.email} · ` : ""}teto {p.teto === null ? "desconhecido" : usd(p.teto)}{p.tetoProprio ? " (próprio)" : ""}</span>
                      </div>
                      <span className="tnum">{usd(p.custo)}</span>
                      {p.pct !== null && <span className={`tag ${tom(p.pct)}`}>{p.pct}%</span>}
                    </summary>
                    {p.tipos.length === 0 ? <p className="muted small">Sem uso neste mês.</p> : (
                      <>
                        <h3 className="fs-sm m0">Por tipo</h3>
                        <div className="rows">
                          {p.tipos.map((t) => (
                            <div className="row-i" key={t.tipo}>
                              <div className="grow"><span className="t">{t.rotulo}</span><span className="s">{quantidade(t)}</span></div>
                              <span className="tnum">{usd(t.custo)}</span>
                            </div>
                          ))}
                        </div>
                        <h3 className="fs-sm m0">Por motor</h3>
                        <div className="rows">
                          {p.motores.map((m) => (
                            <div className="row-i" key={`${m.provedor}|${m.motor}`}>
                              <div className="grow"><span className="t break-all">{m.motor}</span><span className="s">{m.provedor} · {m.vezes} {m.vezes === 1 ? "uso" : "usos"}</span></div>
                              <span className="tnum">{usd(m.custo)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </details>
                ))}
              </div>
            )}
          </>
        )}
    </Panel>
  );
}
