"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { rotuloData, type AjusteFilhos, type Consulta, type ConfigFilhos, type FimDeSemana } from "@/lib/filhos/agenda";
import { AGENDA_FILHOS_ATUALIZADA } from "@/lib/filhos/carregar";
import { MSG } from "@/lib/errors";
import { EmptyState, Field, ModuleScreen, Panel, Summary } from "./kit";
import styles from "./FilhosPage.module.css";

const API = "/api/agenda-filhos";
type Dados = { config: ConfigFilhos | null; ajustes: AjusteFilhos[]; hoje: string; fins: FimDeSemana[]; consulta: Consulta | null };
const quem = (comigo: boolean) => (comigo ? "Com você" : "Com o outro responsável");

/** Agenda de filhos: fins de semana alternados, trocas pontuais, mudança permanente e consulta de datas e feriados. */
export function FilhosPage() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erroLeitura, setErroLeitura] = useState(false);
  const [revisao, setRevisao] = useState(0);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [cfg, setCfg] = useState({ ancora: "", inicio: "sexta", fim: "domingo", feriadoSegue: true });
  const [editar, setEditar] = useState(false);
  const [consultaDia, setConsultaDia] = useState("");
  const [consulta, setConsulta] = useState<Consulta | null>(null);
  const [mudanca, setMudanca] = useState({ data: "", comigo: "true" });

  useEffect(() => {
    const atualizar = () => setRevisao((n) => n + 1);
    window.addEventListener(AGENDA_FILHOS_ATUALIZADA, atualizar);
    return () => window.removeEventListener(AGENDA_FILHOS_ATUALIZADA, atualizar);
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    setErroLeitura(false);
    void (async () => {
      try {
        const r = await fetch(`${API}?semanas=12`, { cache: "no-store", signal: ctrl.signal });
        if (!r.ok) throw new Error("leitura");
        const d = (await r.json()) as Dados;
        if (ctrl.signal.aborted) return;
        setDados(d);
        if (d.config) setCfg({ ancora: d.config.ancora, inicio: d.config.inicio, fim: d.config.fim, feriadoSegue: d.config.feriadoSegue });
      } catch {
        if (!ctrl.signal.aborted) setErroLeitura(true);
      }
    })();
    return () => ctrl.abort();
  }, [revisao]);

  const gravar = useCallback(async (caminho: string, method: "PUT" | "POST" | "DELETE", mensagem: string, body?: object) => {
    setGravando(true); setErro(""); setAviso("");
    try {
      const r = await fetch(caminho, { method, ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}) });
      if (!r.ok) {
        const d: { message?: string } = await r.json().catch(() => ({}));
        setErro(d.message ?? MSG.save);
        return false;
      }
      setAviso(mensagem);
      window.dispatchEvent(new Event(AGENDA_FILHOS_ATUALIZADA));
      return true;
    } catch {
      setErro(MSG.offlineDo);
      return false;
    } finally {
      setGravando(false);
    }
  }, []);

  async function salvarConfig(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!cfg.ancora) return;
    if (await gravar(API, "PUT", "Referência salva.", cfg)) setEditar(false);
  }

  async function consultar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!consultaDia) return;
    setConsulta(null);
    try {
      const r = await fetch(`${API}?semanas=1&consulta=${consultaDia}`, { cache: "no-store" });
      const d = (await r.json()) as Dados;
      setConsulta(d.consulta);
    } catch {
      setErro("Não consegui consultar agora. Tente de novo.");
    }
  }

  async function mudarRecorrencia(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!mudanca.data) return;
    if (await gravar(`${API}/ajustes`, "POST", "Alternância mudada a partir dessa data.", { tipo: "recorrencia", data: mudanca.data, comigo: mudanca.comigo === "true" })) setMudanca({ data: "", comigo: "true" });
  }

  function trocar(f: FimDeSemana) {
    const troca = dados?.ajustes.find((a) => a.tipo === "troca" && a.data === f.sabado);
    if (troca) void gravar(`${API}/ajustes/${troca.id}`, "DELETE", "Troca desfeita. Voltou ao combinado.");
    else void gravar(`${API}/ajustes`, "POST", "Fim de semana trocado.", { tipo: "troca", data: f.sabado, comigo: !f.comigo });
  }

  const config = dados?.config ?? null;
  const proximoMeu = dados?.fins.find((f) => f.comigo);
  const recorrencias = dados?.ajustes.filter((a) => a.tipo === "recorrencia") ?? [];

  const formConfig = (
    <form className={styles.form} onSubmit={salvarConfig}>
      <Field label="Um dia de um fim de semana em que as crianças ficam com você">
        <input type="date" required value={cfg.ancora} onChange={(e) => setCfg({ ...cfg, ancora: e.target.value })} disabled={gravando} />
      </Field>
      <Field label="Começa na">
        <select value={cfg.inicio} onChange={(e) => setCfg({ ...cfg, inicio: e.target.value })} disabled={gravando}>
          <option value="sexta">Sexta</option><option value="sabado">Sábado</option>
        </select>
      </Field>
      <Field label="Termina no">
        <select value={cfg.fim} onChange={(e) => setCfg({ ...cfg, fim: e.target.value })} disabled={gravando}>
          <option value="domingo">Domingo</option><option value="segunda">Segunda</option>
        </select>
      </Field>
      <label className={styles.check}>
        <input type="checkbox" checked={cfg.feriadoSegue} onChange={(e) => setCfg({ ...cfg, feriadoSegue: e.target.checked })} disabled={gravando} />
        <span>Feriado colado ao fim de semana fica com quem tem o fim de semana</span>
      </label>
      <button className="btn btn-pri" disabled={gravando || !cfg.ancora}>Salvar referência</button>
    </form>
  );

  return (
    <ModuleScreen title="Agenda de filhos" text={<>Diga <q>O fim de semana que vem é meu?</q> ou <q>Troca o fim de semana de 6 de dezembro</q>.</>}
      summary={config && dados ? <Summary label="Resumo da agenda" items={[
        { n: dados.fins[0] ? quem(dados.fins[0].comigo) : "—", label: "Este fim de semana" },
        { n: proximoMeu ? rotuloData(proximoMeu.de) : "—", label: "Próximo com você" },
      ]} /> : undefined}>
      <div role="status" className={styles.status}>{aviso}</div>
      {erro && <p role="alert">{erro}</p>}
      {erroLeitura ? (
        <EmptyState title="Não consegui abrir a agenda" action={<button className="btn" onClick={() => setRevisao((n) => n + 1)}>Tentar de novo</button>} />
      ) : !dados ? <p role="status">Carregando agenda…</p> : !config ? (
        <Panel title="Comece pela referência" icon="calendar">
          <p className="muted">Escolha um fim de semana em que as crianças ficam com você. O GaDu alterna a partir dele.</p>
          {formConfig}
        </Panel>
      ) : (
        <>
          <Panel title="Próximos fins de semana" icon="calendar">
            <ul className={styles.lista}>
              {dados.fins.map((f) => (
                <li key={f.sabado} className={styles.fim} data-comigo={f.comigo}>
                  <div className={styles.info}>
                    <b>{rotuloData(f.de)} a {rotuloData(f.ate)}</b>
                    <span className={styles.selo}>{quem(f.comigo)}{f.origem === "troca" ? " · troca" : ""}</span>
                    {f.feriados.map((x) => <small key={x.data}>Feriado: {x.nome} ({rotuloData(x.data)})</small>)}
                  </div>
                  <button type="button" className="btn btn-sm" disabled={gravando} onClick={() => trocar(f)}
                    aria-label={f.origem === "troca" ? `Desfazer a troca de ${rotuloData(f.de)}` : `Trocar o fim de semana de ${rotuloData(f.de)}`}>
                    {f.origem === "troca" ? "Desfazer troca" : "Trocar"}
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Consultar uma data" icon="target">
            <form className={styles.form} onSubmit={consultar}>
              <Field label="Data"><input type="date" required value={consultaDia} onChange={(e) => setConsultaDia(e.target.value)} /></Field>
              <button className="btn">Consultar</button>
            </form>
            {consulta && (
              <p className={styles.resposta} role="status">
                {rotuloData(consulta.dia)}{consulta.feriado ? ` (${consulta.feriado})` : ""}: <b>{consulta.comigo === null ? "sem regra definida" : quem(consulta.comigo).toLowerCase()}</b> · {consulta.motivo}.
              </p>
            )}
          </Panel>

          <Panel title="Mudar a alternância a partir de uma data" icon="gear">
            <p className="muted">Para quando o combinado mudar de vez. Os fins de semana antes dessa data ficam como estavam.</p>
            <form className={styles.form} onSubmit={mudarRecorrencia}>
              <Field label="A partir do fim de semana de"><input type="date" required value={mudanca.data} onChange={(e) => setMudanca({ ...mudanca, data: e.target.value })} disabled={gravando} /></Field>
              <Field label="Esse fim de semana fica">
                <select value={mudanca.comigo} onChange={(e) => setMudanca({ ...mudanca, comigo: e.target.value })} disabled={gravando}>
                  <option value="true">Com você</option><option value="false">Com o outro responsável</option>
                </select>
              </Field>
              <button className="btn" disabled={gravando || !mudanca.data}>Mudar a partir daí</button>
            </form>
            {recorrencias.length > 0 && (
              <ul className={styles.lista}>
                {recorrencias.map((r) => (
                  <li key={r.id} className={styles.fim}>
                    <span>Desde {rotuloData(r.data)}: começa {r.comigo ? "com você" : "com o outro responsável"}</span>
                    <button type="button" className="btn btn-sm" disabled={gravando} aria-label={`Remover a mudança de ${rotuloData(r.data)}`}
                      onClick={() => void gravar(`${API}/ajustes/${r.id}`, "DELETE", "Mudança removida.")}>Remover</button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Referência" icon="gear" action={!editar ? <button className="btn btn-sm" onClick={() => setEditar(true)}>Editar</button> : undefined}>
            {editar ? formConfig : (
              <p className="muted">Fim de semana de {rotuloData(config.ancora)} com você · de {config.inicio === "sexta" ? "sexta" : "sábado"} a {config.fim} · feriado colado {config.feriadoSegue ? "segue o fim de semana" : "sem regra"}. Feriados nacionais apenas.</p>
            )}
          </Panel>
        </>
      )}
    </ModuleScreen>
  );
}
