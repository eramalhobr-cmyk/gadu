"use client";
import { useState } from "react";
import { MSG } from "@/lib/errors";
import type { ViewId } from "@/lib/modules";
import type { Insight } from "@/lib/insights";
import { ACEITAR, type Decisao } from "@/lib/percepcoes";
import { showNotice, showUndo } from "@/lib/undo";
import { Icon } from "./ui";
import { Panel } from "./kit";

const ICON: Record<Insight["kind"], string> = { conflito: "calendar", livre: "calendar", atrasadas: "check", email: "chat", cheio: "calendar" };

/** Percepções do GaDu na tela Hoje: atrasos, conflito na agenda, e-mail importante parado, janela livre e dia cheio,
 * calculadas sem IA. Cada uma tem Aceitar (a ação do tipo) e Ignorar (não volta hoje), as duas com Desfazer (UX-4).
 * Pela conversa vale o mesmo: "passa as atrasadas para hoje", "ignora o aviso do e-mail". */
export function PercepcoesCard(props: { items: Insight[]; onOpen: (view: ViewId) => void; onChanged: () => void }) {
  const [feitos, setFeitos] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const lista = props.items.filter((i) => !feitos.has(i.kind));
  if (!lista.length) return null;

  const responder = async (i: Insight, decisao: Decisao) => {
    setBusy(i.kind);
    try {
      const r = await fetch("/api/insights", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tipo: i.kind, decisao, ...(i.ref ? { ref: i.ref } : {}) }) });
      if (r.status === 401) { window.location.href = "/login"; return; }
      const j = (await r.json().catch(() => ({}))) as { desfazer?: unknown; message?: string };
      if (!r.ok) { showNotice(j.message || MSG.save); return; }
      setFeitos((s) => new Set(s).add(i.kind));
      props.onChanged();
      const texto = decisao === "ignorada" ? "Aviso ignorado hoje." : `${ACEITAR[i.kind]?.feito ?? "Feito"}.`;
      showUndo(texto, async () => {
        const u = await fetch("/api/insights/desfazer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tipo: i.kind, desfazer: j.desfazer ?? {} }) });
        if (!u.ok) throw new Error("desfazer");
        setFeitos((s) => { const n = new Set(s); n.delete(i.kind); return n; });
        props.onChanged();
      });
      if (decisao === "aceita" && i.kind === "conflito") props.onOpen("agenda");
    } catch {
      showNotice(MSG.offlineDo);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel title="O GaDu percebeu" icon="spark">
      <div className="rows">
        {lista.map((i) => {
          const ac = ACEITAR[i.kind];
          return (
            <div className="row-i attn-i one" key={i.kind}>
              <span className="rec-ico" aria-hidden="true"><Icon name={ICON[i.kind]} size={20} /></span>
              <div className="grow"><span className="t wrap-t">{i.text}</span></div>
              <div className="attn-acts">
                {ac && <button className="btn btn-sm btn-pri" disabled={busy !== null} onClick={() => void responder(i, "aceita")}>{ac.rotulo}</button>}
                <button className="btn btn-sm" disabled={busy !== null} onClick={() => void responder(i, "ignorada")} aria-label={`Ignorar hoje: ${i.text}`}>Ignorar</button>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
