"use client";
import { useCallback, useEffect, useState } from "react";
import type { SourceItem } from "@/lib/core/format";
import type { ViewId } from "@/lib/modules";
import { Icon } from "./ui";
import { EmptyState, Panel } from "./kit";

type Data = { enabled: boolean; items?: SourceItem[]; more?: number; unavailable?: { source: string; reason: string; text: string }[] };

const ORIGIN: Partial<Record<ViewId, string>> = { tarefas: "Tarefas", agenda: "Agenda", hoje: "Hoje" };
const ICON: Record<SourceItem["kind"], string> = { atrasada: "check", tarefa_hoje: "check", prioridade: "check", lembrete: "bell", evento: "calendar", email: "chat" };

/** Cartão "Merece sua atenção": o mesmo Core do chat, sem IA (custo zero de modelo). Some se o servidor desligar o recurso. */
export function AttentionCard(props: { busy: boolean; onOpen: (view: ViewId) => void; onAsk: (q: string) => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    setFailed(false);
    try {
      const r = await fetch("/api/attention?limit=6", { cache: "no-store" });
      if (r.status === 401) return setData({ enabled: false });
      if (!r.ok) return setFailed(true);
      setData(await r.json());
    } catch { setFailed(true); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (data && !data.enabled) return null;
  const items = data?.items ?? [];
  const unavailable = data?.unavailable ?? [];
  const reconnect = unavailable.some((u) => u.reason !== "error");

  return (
    <>
      <div className="sec-head"><h2>Merece sua atenção</h2></div>
      <Panel className="attn-card" action={<button className="btn btn-sm" disabled={props.busy} onClick={() => props.onAsk("O que merece minha atenção hoje?")}><Icon name="spark" size={16} />Perguntar ao GaDu</button>}>
        {failed ? <p className="muted">Não consegui montar esta lista agora. <button className="link-btn" onClick={load}>Tentar de novo</button></p>
          : data === null ? <p className="muted">Carregando…</p>
          : items.length === 0 ? <EmptyState icon="sun" title="Nada pendente para hoje" text={unavailable.length ? "Nas fontes que consegui ler. Veja o aviso abaixo." : "Sem tarefas atrasadas ou de hoje, lembretes ou compromissos pela frente."} />
          : (
            <div className="rows">
              {items.map((s) => (
                <div className="row-i" key={s.tag}>
                  <span className="rec-ico" aria-hidden="true"><Icon name={ICON[s.kind]} size={18} /></span>
                  <div className="grow">
                    <span className="t wrap-t">{s.text}</span>
                    <span className="s">{s.label}</span>
                  </div>
                  {s.href
                    ? <a className="btn btn-sm" href={s.href} target="_blank" rel="noopener noreferrer">Gmail</a>
                    : <button className="btn btn-sm" onClick={() => props.onOpen(s.view)}>{ORIGIN[s.view] ?? "Abrir"}</button>}
                </div>
              ))}
              {(data.more ?? 0) > 0 && <p className="muted" style={{ margin: 0 }}>e mais {data.more} {data.more === 1 ? "item" : "itens"}. Pergunte ao GaDu para ver tudo.</p>}
            </div>
          )}
        {!failed && unavailable.length > 0 && (
          <ul className="attn-miss" aria-label="O que não consegui ler">
            {unavailable.map((u) => <li key={u.source}>{u.text}</li>)}
            {reconnect && <li><a className="btn btn-sm" href="/api/google/connect">Conectar Google</a></li>}
          </ul>
        )}
      </Panel>
    </>
  );
}
