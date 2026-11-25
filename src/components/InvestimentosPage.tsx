"use client";

import { useEffect, useState } from "react";
import { PEDIDO_PESQUISA } from "@/lib/investimentos/pesquisa";
import { ACOMPANHADOS, type Papel } from "@/lib/investimentos/cotacoes";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percentual = new Intl.NumberFormat("pt-BR", { style: "percent", signDisplay: "exceptZero", maximumFractionDigits: 2 });
const data = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const formatar = (v: number | null) => v === null ? "Sem dados" : percentual.format(v / 100);

export function InvestimentosPage({ onAsk, busy }: { onAsk: (mensagem: string) => void; busy: boolean }) {
  const [cotacoes, setCotacoes] = useState<(Papel | null)[] | null>(null);
  const [erro, setErro] = useState("");
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/investimentos", { signal: ctrl.signal }).then(async (r) => {
      const j = await r.json();
      if (ctrl.signal.aborted) return;
      if (!r.ok) {
        setErro(j.error === "fonte_desligada" ? "A fonte de cotações ainda precisa ser conectada." : "Não consegui carregar as cotações.");
        return;
      }
      setCotacoes(j.cotacoes);
    }).catch(() => {
      if (!ctrl.signal.aborted) setErro("Não consegui carregar as cotações.");
    });
    return () => ctrl.abort();
  }, [versao]);

  return (
    <main className="page" id="conteudo">
      <div className="wrap">
        <header className="ph">
          <div><h2>Ações acompanhadas</h2><p>Cotações da B3 e variação de preço nos últimos 21, 63 e 252 pregões.</p></div>
          <div className="row wrap-actions">
            <button className="btn" onClick={() => { setCotacoes(null); setErro(""); setVersao((v) => v + 1); }}>Atualizar</button>
            <button className="btn btn-pri" disabled={busy || !cotacoes?.some(Boolean)} onClick={() => onAsk(PEDIDO_PESQUISA)}>Comparar com o GaDu</button>
          </div>
        </header>
        {erro ? <p className="notice" role="status">{erro}</p> : cotacoes === null && <p role="status">Carregando cotações…</p>}
        <div className="today-module-grid market-grid">
          {ACOMPANHADOS.map(({ ticker, nome }) => {
            const papel = cotacoes?.find((p) => p?.ticker === ticker);
            const periodos = papel?.periodos ?? [];
            return (
              <article className="hud-frame card market-card" key={ticker}>
                <h3>{ticker}</h3>
                <p>{nome}</p>
                {papel ? <>
                  <strong className="num">{reais.format(papel.preco)}</strong>
                  <span> No dia {formatar(papel.dia)}</span>
                  <dl>{periodos.map((p) => <div key={p.sessoes}><dt>{p.sessoes} pregões</dt><dd>{formatar(p.variacao)}</dd></div>)}</dl>
                  {papel.perdaMaxima63 !== null && <p>Maior queda desde um pico em 63 pregões: {formatar(papel.perdaMaxima63)}</p>}
                  <small className="muted">{papel.baseAjustada ? "Série ajustada" : "Fechamentos sem ajuste verificado"} · brapi · {data.format(new Date(papel.horario))}</small>
                </> : <p className="muted">{erro || cotacoes ? "Cotação indisponível" : "Aguardando cotação"}</p>}
              </article>
            );
          })}
        </div>
        <p className="muted">Variações históricas podem usar a série ajustada do provedor. As cotações podem ter atraso.</p>
      </div>
    </main>
  );
}
