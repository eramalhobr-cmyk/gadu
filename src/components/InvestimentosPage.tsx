"use client";

import { useEffect, useState } from "react";
import { PEDIDO_PESQUISA } from "@/lib/investimentos/pesquisa";
import { ACOMPANHADOS, type Papel } from "@/lib/investimentos/cotacoes";
import type { RespostaSinais, SinalAcao } from "@/lib/investimentos/analise";
import type { SinalId } from "@/lib/investimentos/sinais";
import { GRUPOS, type GrupoId } from "@/lib/investimentos/universo";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percentual = new Intl.NumberFormat("pt-BR", { style: "percent", signDisplay: "exceptZero", maximumFractionDigits: 2 });
const pct1 = new Intl.NumberFormat("pt-BR", { style: "percent", signDisplay: "exceptZero", maximumFractionDigits: 1 });
const data = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const dataCurta = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" });
const formatar = (v: number | null) => v === null ? "Sem dados" : percentual.format(v / 100);
const moeda = (v: number, m: string) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: m || "BRL" }).format(v);
const AVISO = "Estudo automático com dados públicos. Não é recomendação de investimento.";

// Cor + símbolo + texto: o sinal nunca depende só da cor.
const SINAL: Record<SinalId, { texto: string; icone: string }> = {
  compra: { texto: "Compra", icone: "▲" },
  manter: { texto: "Manter", icone: "■" },
  venda: { texto: "Venda", icone: "▼" },
  sem_dados: { texto: "Sem sinal", icone: "–" },
};

type EstadoSinais = { estado: "carregando" } | { estado: "erro"; mensagem: string } | { estado: "ok"; dados: RespostaSinais };

export function InvestimentosPage({ onAsk, busy }: { onAsk: (mensagem: string) => void; busy: boolean }) {
  const [grupo, setGrupo] = useState<GrupoId>("acompanhados");
  const [sinais, setSinais] = useState<Partial<Record<GrupoId, EstadoSinais>>>({});
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setSinais((s) => ({ ...s, [grupo]: { estado: "carregando" } }));
    fetch(`/api/investimentos/sinais?grupo=${grupo}`, { signal: ctrl.signal }).then(async (r) => {
      const j = await r.json().catch(() => null);
      if (ctrl.signal.aborted) return;
      if (!r.ok || !j || !Array.isArray(j.itens)) {
        setSinais((s) => ({ ...s, [grupo]: { estado: "erro", mensagem: r.status === 404 ? "Os sinais estão desligados agora." : "Não consegui calcular os sinais." } }));
        return;
      }
      setSinais((s) => ({ ...s, [grupo]: { estado: "ok", dados: j } }));
    }).catch(() => {
      if (!ctrl.signal.aborted) setSinais((s) => ({ ...s, [grupo]: { estado: "erro", mensagem: "Não consegui calcular os sinais." } }));
    });
    return () => ctrl.abort();
  }, [grupo, versao]);

  const atual = sinais[grupo] ?? { estado: "carregando" as const };

  return (
    <main className="page" id="conteudo">
      <div className="wrap stack">
        <header className="ph">
          <div><h2>Investimentos</h2><p>Sinais de compra, manter ou venda calculados com preços públicos.</p></div>
          <div className="row wrap-actions">
            <button className="btn" onClick={() => setVersao((v) => v + 1)}>Atualizar</button>
          </div>
        </header>
        <p className="notice inv-aviso" role="note"><b>Atenção:</b> {AVISO}</p>

        <div className="seg" role="tablist" aria-label="Grupos de ações">
          {GRUPOS.map((g) => (
            <button key={g.id} role="tab" id={`tab-inv-${g.id}`} aria-selected={grupo === g.id} aria-controls={`pn-inv-${g.id}`} onClick={() => setGrupo(g.id)}>{g.nome}</button>
          ))}
        </div>

        <section role="tabpanel" id={`pn-inv-${grupo}`} aria-labelledby={`tab-inv-${grupo}`} className="stack">
          {atual.estado === "carregando" && <p role="status" className="muted">Calculando sinais…</p>}
          {atual.estado === "erro" && <div className="notice" role="alert">{atual.mensagem} <button className="link-btn" onClick={() => setVersao((v) => v + 1)}>Tentar de novo</button></div>}
          {atual.estado === "ok" && (atual.dados.itens.length === 0
            ? <p className="muted" role="status">Nenhum dado disponível agora. Tente mais tarde.</p>
            : <>
              <div className="market-grid">
                {atual.dados.itens.map((a) => <CartaoSinal key={a.ticker} a={a} busy={busy} onAsk={onAsk} />)}
              </div>
              {atual.dados.indisponiveis.length > 0 && <p className="muted">Sem dados agora: {atual.dados.indisponiveis.join(", ")}.</p>}
              <p className="muted small">
                Referência: {atual.dados.referencias.map((r) => r.disponivel ? r.nome : `${r.nome} (indisponível)`).join(", ")}. {atual.dados.fundamentos}
              </p>
            </>)}
          <ComoFunciona />
          {grupo === "acompanhados" && <CotacoesBrapi busy={busy} onAsk={onAsk} />}
        </section>
      </div>
    </main>
  );
}

function CartaoSinal({ a, busy, onAsk }: { a: SinalAcao; busy: boolean; onAsk: (m: string) => void }) {
  const s = SINAL[a.sinal];
  const b = a.backtest;
  return (
    <article className="hud-frame card market-card inv-card" aria-labelledby={`inv-${a.ticker}`}>
      <div className="inv-top">
        <div>
          <h3 id={`inv-${a.ticker}`}>{a.ticker}</h3>
          <p className="muted">{a.nome}</p>
        </div>
        <span className={`inv-sinal inv-${a.sinal}`}><span aria-hidden="true">{s.icone}</span> {s.texto}</span>
      </div>
      <p className="inv-preco">
        <strong className="num">{moeda(a.preco, a.moeda)}</strong>
        {a.variacaoDia !== null && <span className="muted"> {pct1.format(a.variacaoDia)} no último pregão</span>}
      </p>
      {a.sinal !== "sem_dados" && <p className="inv-conf">Confiança <b>{a.confianca}%</b></p>}
      <ul className="inv-motivos">{a.motivos.map((m) => <li key={m}>{m}</li>)}</ul>
      <MiniGrafico ticker={a.ticker} precos={a.grafico.precos} media={a.grafico.sma200} />
      {b ? (
        <div className="inv-bt">
          <p><b>Teste da regra</b> <span className="muted">({dataCurta.format(new Date(b.inicio))} a {dataCurta.format(new Date(b.fim))}, custo 0,1% por troca)</span></p>
          <dl>
            <div><dt>Regra</dt><dd>{pct1.format(b.retornoRegra)}</dd></div>
            <div><dt>Comprar e segurar</dt><dd>{pct1.format(b.retornoSegurar)}</dd></div>
            <div><dt>Maior queda (regra × segurar)</dt><dd>{pct1.format(b.quedaRegra)} × {pct1.format(b.quedaSegurar)}</dd></div>
            <div><dt>Acerto · trocas</dt><dd>{b.acerto === null ? "—" : `${Math.round(b.acerto * 100)}%`} · {b.trocas}</dd></div>
          </dl>
          <p className={b.perdeuDaReferencia ? "inv-perdeu" : "inv-ganhou"}>
            {b.perdeuDaReferencia ? "A regra perdeu de comprar e segurar." : "A regra ganhou de comprar e segurar."}
          </p>
        </div>
      ) : <p className="muted">Histórico curto para testar a regra.</p>}
      <small className="muted">{a.fonte} · {data.format(new Date(a.horario))}</small>
      <button className="btn btn-sm inv-ask" disabled={busy} onClick={() => onAsk(`Como está a ${a.nome} (${a.ticker})? Explique o sinal.`)}>Perguntar ao GaDu</button>
    </article>
  );
}

/** Preço do último ano (linha cheia) e média de 200 dias (tracejada). */
function MiniGrafico({ ticker, precos, media }: { ticker: string; precos: number[]; media: (number | null)[] }) {
  if (precos.length < 2) return null;
  const valores = [...precos, ...media.filter((v): v is number => v !== null)];
  const min = Math.min(...valores), max = Math.max(...valores);
  const W = 100, H = 36, esc = (v: number) => H - 2 - ((v - min) / (max - min || 1)) * (H - 4);
  const x = (i: number) => (i / (precos.length - 1)) * W;
  const linha = precos.map((v, i) => `${x(i).toFixed(2)},${esc(v).toFixed(2)}`).join(" ");
  const linhaMedia = media.map((v, i) => (v === null ? null : `${x(i).toFixed(2)},${esc(v).toFixed(2)}`)).filter(Boolean).join(" ");
  const variacao = precos[precos.length - 1] / precos[0] - 1;
  return (
    <figure className="inv-graf">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${ticker}: preço no último ano, ${pct1.format(variacao)}${linhaMedia ? ", com a média de 200 dias" : ""}`}>
        {linhaMedia && <polyline points={linhaMedia} className="inv-graf-media" vectorEffect="non-scaling-stroke" />}
        <polyline points={linha} className="inv-graf-preco" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="muted small">1 ano · <span className="inv-leg-preco">preço</span>{linhaMedia && <> · <span className="inv-leg-media">média de 200 dias</span></>}</figcaption>
    </figure>
  );
}

function ComoFunciona() {
  return (
    <details className="inv-como">
      <summary>Como o sinal é calculado</summary>
      <p>Quatro “analistas” dão uma nota de -1 a +1: <b>Tendência</b> (médias de 50 e 200 dias), <b>Momento</b> (alta ou queda em 3, 6 e 12 meses, MACD e RSI), <b>Força relativa</b> (contra o Ibovespa ou o S&amp;P 500) e <b>Risco</b> (volatilidade e distância da máxima).</p>
      <p>A média ponderada vira Compra (nota ≥ 0,25), Venda (≤ -0,25) ou Manter. O teste aplica a regra dia a dia só com o que se sabia naquele dia, cobra 0,1% por troca e compara com comprar e segurar.</p>
      <p>Não usa balanços nem notícias. Resultado passado não garante resultado futuro.</p>
    </details>
  );
}

/** Primeira versão (brapi): variação por pregões dos três papéis acompanhados e a comparação pelo GaDu. */
function CotacoesBrapi({ onAsk, busy }: { onAsk: (mensagem: string) => void; busy: boolean }) {
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
    <details className="inv-como">
      <summary>Variação por pregões (brapi)</summary>
      <div className="row wrap-actions">
        <button className="btn" onClick={() => { setCotacoes(null); setErro(""); setVersao((v) => v + 1); }}>Atualizar cotações</button>
        <button className="btn btn-pri" disabled={busy || !cotacoes?.some(Boolean)} onClick={() => onAsk(PEDIDO_PESQUISA)}>Comparar com o GaDu</button>
      </div>
      {erro ? <p className="notice" role="status">{erro}</p> : cotacoes === null && <p role="status">Carregando cotações…</p>}
      <div className="market-grid">
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
    </details>
  );
}
