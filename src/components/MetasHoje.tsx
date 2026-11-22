"use client";
// Resumo de Metas na tela Hoje: 1 a 3 metas que pedem atenção (atrasadas, vencidas ou com prazo próximo). Sem IA, sem custo.
import { useCallback, useEffect, useState } from "react";
import { SITUACAO_LABEL, type Situacao } from "@/lib/goals/types";
import { EmptyState, Panel } from "./kit";
import { Icon } from "./ui";

type Resumo = { enabled?: boolean; total: number; ativas: number; atrasadas: number; atencao: { id: string; titulo: string; situacao: Situacao; pct: number; semDados: boolean; prazo: string | null; texto: string }[] };

export function MetasHoje({ onOpen }: { onOpen: () => void }) {
  const [data, setData] = useState<Resumo | null>(null);
  const [off, setOff] = useState(false);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    setFailed(false);
    try {
      const r = await fetch("/api/goals/resumo", { cache: "no-store" });
      if (r.status === 401 || r.status === 404) return setOff(true); // sem sessão ou Metas desligado: some
      if (!r.ok) return setFailed(true);
      setData(await r.json());
    } catch { setFailed(true); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (off) return null;
  return (
    <>
      <div className="sec-head"><h2>Suas metas</h2></div>
      <Panel className="mt-hoje" action={<button className="btn btn-sm" onClick={onOpen}>Abrir Metas</button>}>
        {failed ? <p className="muted">Não consegui carregar suas metas agora. <button className="link-btn" onClick={load}>Tentar de novo</button></p>
          : data === null ? <p className="muted">Carregando…</p>
          : data.ativas === 0 ? <EmptyState icon="target" title="Nenhuma meta ativa" text="Crie uma meta com prazo e o GaDu avisa aqui quando ela pedir atenção." action={<button className="btn btn-sm" onClick={onOpen}>Criar uma meta</button>} />
          : data.atencao.length === 0 ? <p className="muted" style={{ margin: 0 }}>Nenhuma das suas {data.ativas} metas ativas pede atenção agora.</p>
          : (
            <div className="rows">
              {data.atencao.map((m) => (
                <button className="row-i mt-hoje-i" key={m.id} onClick={onOpen}>
                  <span className="rec-ico" aria-hidden="true"><Icon name="target" size={18} /></span>
                  <div className="grow">
                    <span className="t wrap-t">{m.titulo}</span>
                    <span className="s">{m.semDados ? "Sem registros" : `${m.pct}%`}{m.prazo ? ` · prazo ${m.prazo.slice(8, 10)}/${m.prazo.slice(5, 7)}` : ""}</span>
                  </div>
                  <span className={`mt-sit ${m.situacao}`}>{SITUACAO_LABEL[m.situacao]}</span>
                </button>
              ))}
            </div>
          )}
      </Panel>
    </>
  );
}
