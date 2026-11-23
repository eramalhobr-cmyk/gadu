"use client";
// Vitrine do design system v2 (UX-7 · G3). Os números são EXEMPLOS fixos e estão marcados como tal.
import { Bars, Kpi, KpiRow, Meter, PainelHead, Ring, Spark, Stack } from "./charts";
import { VoiceCore } from "./VoiceCore";
import { Icon } from "./ui";

const CORES = ["--bg", "--panel", "--surface-2", "--ink", "--ink-2", "--ink-3", "--hud", "--amb", "--ok", "--bad", "--mic-a", "--mic-b"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov"];
const brl = (n: number) => `R$ ${n.toLocaleString("pt-BR")}`;

export function DesignShowcase() {
  return (
    <main className="page ds" id="conteudo">
      <div className="wrap ds-wrap">
        <header className="ds-top">
          <h1>Design system v2 · JARVIS</h1>
          <p className="muted">Componentes e tokens do tema. <b>Todos os números desta página são exemplos.</b> Tema pelo cookie <code>gadu_theme</code>.</p>
        </header>

        <section className="ds-sec" aria-labelledby="ds-cores">
          <h2 id="ds-cores" className="ds-h">Cores</h2>
          <ul className="ds-cores">
            {CORES.map((c) => <li key={c}><i style={{ ["--c" as string]: `var(${c})` }} /><code>{c}</code></li>)}
          </ul>
        </section>

        <section className="ds-sec" aria-labelledby="ds-tipo">
          <h2 id="ds-tipo" className="ds-h">Tipografia</h2>
          <p className="ds-display">GaDu, seu assistente</p>
          <p className="ds-body">Texto de leitura em Instrument Sans, confortável no celular.</p>
          <p className="ds-mono">MONO · 18.950 · 75% · 17:03</p>
        </section>

        <section className="ds-sec" aria-labelledby="ds-acoes">
          <h2 id="ds-acoes" className="ds-h">Ações</h2>
          <div className="ds-row">
            <button className="btn btn-pri" type="button"><Icon name="mic" size={18} />Falar com o GaDu</button>
            <button className="btn" type="button">Secundário</button>
            <button className="btn btn-sm" type="button">Pequeno</button>
            <button className="icon-btn" type="button" aria-label="Fechar"><Icon name="x" /></button>
            <button className="say-chip" type="button"><Icon name="mic" size={14} />“Como estou nas metas?”</button>
            <button className="pnl-ouvir" type="button"><Icon name="som" size={16} />Ouvir</button>
          </div>
        </section>

        <section className="ds-sec pnl" aria-labelledby="ds-painel">
          <PainelHead id="ds-painel" title="Painel (exemplo)" dica="Diga: “mostra meu resumo de finanças”" fala="" />
          <div className="pnl-grid">
            <div className="hud-frame pnl-box">
              <KpiRow label="Indicadores de exemplo">
                <Kpi label="No ano" value={brl(18950)} sub="média R$ 1.723/mês"><Spark values={[1500, 1720, 1610, 1980, 1550, 1700, 1890, 1640, 1760, 1770, 1830]} label="Tendência de exemplo" /></Kpi>
                <Kpi label="Tetos" value="2/3" sub="acima de 80%" tone="hot" />
              </KpiRow>
              <div className="pnl-ring-row">
                <Ring pct={75} label="Contas pagas" sub="6 de 8" />
                <Ring pct={null} label="Sem registro" sub="mostra –" />
                <Ring pct={100} label="Batida" tone="ok" />
              </div>
            </div>
            <div className="hud-frame pnl-box">
              <h3 className="pnl-sub">Barras</h3>
              <Bars data={MESES.map((m, i) => ({ label: m, value: [1500, 1720, 1610, 1980, 1550, 1700, 1890, 1640, 1760, 1770, 1830][i] }))} label="Barras de exemplo" fmt={brl} />
            </div>
            <div className="hud-frame pnl-box">
              <h3 className="pnl-sub">Medidores e pilha</h3>
              <div className="stack">
                <Meter label="Passou do teto" value={455} max={400} fmt={brl} />
                <Meter label="Perto do teto" value={812} max={900} fmt={brl} />
                <Meter label="Tranquilo" value={140} max={350} fmt={brl} />
              </div>
              <Stack label="Pilha de exemplo" parts={[{ n: 2, label: "feitas", tone: "ok" }, { n: 3, label: "para hoje", tone: "sig" }, { n: 1, label: "atrasadas", tone: "bad" }, { n: 2, label: "outras", tone: "mut" }]} />
            </div>
          </div>
        </section>

        <section className="ds-sec" aria-labelledby="ds-voz">
          <h2 id="ds-voz" className="ds-h">Núcleo de voz</h2>
          <div className="ds-voz"><VoiceCore modo="idle"><div className="ds-nucleo" /></VoiceCore></div>
        </section>
      </div>
    </main>
  );
}
