"use client";
import { useState } from "react";
import { fmtNum } from "@/lib/goals/numero";
import type { MetaDraft } from "@/lib/goals/types";
import { Icon } from "./ui";

/** Proposta de atualização de meta vinda da conversa: só é gravada quando a pessoa toca em "Confirmar"
 * (POST /api/goals/:id/progresso ou PATCH /api/goals/:id, com a sessão dela). */
export function MetaCard({ d, onOpen }: { d: MetaDraft; onOpen?: () => void }) {
  const [state, setState] = useState<"proposed" | "saving" | "created" | "discarded" | "error">("proposed");
  const [msg, setMsg] = useState("");
  const registrar = d.acao === "registrar";

  async function confirm() {
    setState("saving");
    try {
      const r = registrar
        ? await fetch(`/api/goals/${d.goalId}/progresso`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ valor: d.valor, data: d.data, origem: "conversa" }) })
        : await fetch(`/api/goals/${d.goalId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "concluida" }) });
      if (r.status === 401) { window.location.href = "/login"; return; }
      if (!r.ok) { setState("error"); setMsg(r.status === 404 ? "Não encontrei a meta (ou Metas está desligado)." : "Não consegui atualizar. Tente de novo."); return; }
      setState("created");
    } catch {
      setState("error");
      setMsg("Sem conexão. Tente de novo.");
    }
  }

  const label = state === "created" ? (registrar ? "Progresso registrado" : "Meta concluída") : state === "discarded" ? "Descartado" : registrar ? "Registro para confirmar" : "Conclusão para confirmar";
  const quando = d.data ? `${d.data.slice(8, 10)}/${d.data.slice(5, 7)}` : "";
  const valor = d.valor === null ? "" : `${fmtNum(d.valor)}${d.unidade ? (d.unidade === "%" ? "%" : ` ${d.unidade}`) : ""}`;
  return (
    <div className={`evc ${state}`}>
      <div className="evc-top">
        <span className="evc-ico"><Icon name={state === "created" ? "check" : "target"} size={18} /></span>
        <div className="evc-body">
          <span className="evc-label">{label}</span>
          <b className="evc-title">{d.titulo}</b>
          <span className="evc-when">{registrar ? `${valor} · ${quando}${d.agregacao === "ultimo" ? " · medida atual" : ""}` : "Marcar a meta como concluída"}</span>
        </div>
      </div>
      {(state === "proposed" || state === "error" || state === "saving") && (
        <div className="evc-actions">
          <button className="btn btn-sm btn-pri" disabled={state === "saving"} onClick={confirm}>{state === "saving" ? "Salvando…" : "Confirmar"}</button>
          <button className="btn btn-sm" disabled={state === "saving"} onClick={() => setState("discarded")}>Descartar</button>
        </div>
      )}
      {state === "created" && onOpen && <button className="evc-link link-btn" onClick={onOpen}>Ver em Metas<Icon name="chevron" size={14} /></button>}
      {msg && state === "error" && <span className="evc-err" role="alert">{msg}</span>}
    </div>
  );
}
