"use client";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, ModuleScreen, Panel, Summary } from "./kit";
import { SITUACAO_TEXTO, type DiaEntrega, type Pedido } from "@/lib/compras/pedidos";
import styles from "./ComprasPage.module.css";

type Resposta =
  | { connected: true; hoje: string; pedidos: Pedido[]; calendario: { dias: DiaEntrega[]; semPrevisao: Pedido[] }; omitidos: number }
  | { connected: boolean; error: string };

const SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** "Hoje", "Amanhã" ou "quinta, 27/11". Datas em AAAA-MM-DD (Brasília). */
function rotuloDia(dia: string, hoje: string): string {
  const d = new Date(`${dia}T12:00:00Z`);
  const h = new Date(`${hoje}T12:00:00Z`);
  const diff = Math.round((d.getTime() - h.getTime()) / 86_400_000);
  const curto = `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff < 0) return `Previsto para ${curto} (já passou)`;
  return `${SEMANA[d.getUTCDay()]}, ${curto}`;
}

const ERRO: Record<string, string> = {
  revoked: "O acesso ao Google expirou. Conecte de novo para ver seus pedidos.",
  token: "Não consegui falar com o Google agora. Tente de novo em instantes.",
  api: "Não consegui ler seus e-mails agora. Tente de novo em instantes.",
};

/** Compras: pedidos já feitos, lidos dos seus e-mails (Gmail, só leitura). Nada é gravado. */
export function ComprasPage() {
  const [data, setData] = useState<Resposta | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setData(null);
    try {
      const r = await fetch("/api/compras", { cache: "no-store" });
      setData((await r.json()) as Resposta);
    } catch {
      setData({ connected: true, error: "api" });
    }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  async function copiar(codigo: string) {
    try { await navigator.clipboard.writeText(codigo); setCopiado(codigo); setTimeout(() => setCopiado(null), 2000); } catch { /* sem área de transferência: o código continua visível */ }
  }

  const ok = data && "pedidos" in data ? data : null;
  const abertos = ok ? ok.pedidos.filter((p) => p.situacao !== "entregue" && p.situacao !== "cancelado") : [];
  const hojeN = ok ? ok.calendario.dias.find((d) => d.dia === ok.hoje)?.pedidos.length ?? 0 : 0;

  return (
    <ModuleScreen title="Compras" text="Pedidos que você fez, lidos dos seus e-mails. O GaDu só lê: nada é gravado."
      summary={ok && ok.pedidos.length > 0 ? <Summary label="Resumo das compras" items={[{ n: abertos.length, label: abertos.length === 1 ? "a caminho" : "a caminho" }, { n: hojeN, label: hojeN === 1 ? "chega hoje" : "chegam hoje", tone: hojeN ? "hot" : undefined }, { n: ok.pedidos.length - abertos.length, label: "entregues ou cancelados", tone: "ok" }]} /> : undefined}>
      {data === null ? (
        <Panel><p className="muted" role="status" aria-busy="true">Lendo seus e-mails de pedidos…</p></Panel>
      ) : "error" in data && !data.connected ? (
        <Panel>
          <EmptyState icon="link" title="Conecte o Google" text="Para acompanhar seus pedidos, o GaDu lê os e-mails das lojas (só leitura)."
            action={<a className="btn btn-pri btn-sm" href="/api/google/connect">Conectar o Google</a>} />
        </Panel>
      ) : "error" in data ? (
        <Panel>
          <div className="notice" role="alert">{ERRO[data.error] ?? ERRO.api}</div>
          <button className="btn btn-sm" onClick={() => void carregar()}>Tentar de novo</button>
        </Panel>
      ) : data.pedidos.length === 0 ? (
        <Panel>
          <EmptyState icon="check" title="Nenhum pedido nos últimos 45 dias" text="Quando chegar um e-mail de confirmação ou de envio de uma loja, ele aparece aqui."
            phrase="Quando chega meu pedido?" />
        </Panel>
      ) : (
        <>
          {(data.calendario.dias.length > 0 || data.calendario.semPrevisao.length > 0) && (
            <Panel title="Próximas entregas" icon="calendar">
              <ol className={styles.dias}>
                {data.calendario.dias.map((d) => (
                  <li key={d.dia} className={d.dia === data.hoje ? styles.hoje : undefined}>
                    <b>{rotuloDia(d.dia, data.hoje)}</b>
                    <span>{d.pedidos.map((p) => p.loja).join(", ")}</span>
                  </li>
                ))}
                {data.calendario.semPrevisao.length > 0 && (
                  <li className={styles.sem}>
                    <b>Sem previsão no e-mail</b>
                    <span>{data.calendario.semPrevisao.map((p) => p.loja).join(", ")}</span>
                  </li>
                )}
              </ol>
            </Panel>
          )}
          <Panel title="Pedidos" icon="check">
            <ul className={styles.lista}>
              {data.pedidos.map((p) => (
                <li key={p.chave} className={styles.pedido} data-situacao={p.situacao}>
                  <div className={styles.topo}>
                    <b className={styles.loja}>{p.loja}</b>
                    <span className={styles.selo}>{SITUACAO_TEXTO[p.situacao]}</span>
                  </div>
                  <p className={styles.linha}>
                    {p.numero ? `Pedido ${p.numero}` : p.assunto}
                    {p.situacao !== "entregue" && p.situacao !== "cancelado" && (
                      <> · {p.previsao ? `previsão ${rotuloDia(p.previsao, data.hoje).toLowerCase()}` : "sem previsão no e-mail"}</>
                    )}
                  </p>
                  <div className={styles.acoes}>
                    {p.rastreio && (
                      <button className="btn btn-sm" onClick={() => void copiar(p.rastreio as string)} aria-label={`Copiar o código de rastreio ${p.rastreio}`}>
                        {copiado === p.rastreio ? "Código copiado" : `Rastreio ${p.rastreio}`}
                      </button>
                    )}
                    {p.thread && (
                      <a className="btn btn-sm" href={`https://mail.google.com/mail/u/0/#all/${p.thread}`} target="_blank" rel="noopener noreferrer">Abrir e-mail</a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {data.omitidos > 0 && <p className="muted small">{data.omitidos === 1 ? "1 e-mail ficou de fora" : `${data.omitidos} e-mails ficaram de fora`} pela sua regra de privacidade.</p>}
          </Panel>
        </>
      )}
    </ModuleScreen>
  );
}
