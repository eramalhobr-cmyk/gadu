"use client";
import { useState } from "react";
import { formatBRL } from "@/lib/finance/money";
import { MEIO_LABEL, type Meio } from "@/lib/finance/types";
import { Icon } from "./ui";

export type GastoDraft = { valor: number; categoria: string; descricao: string; meio: Meio; data: string };

/** Proposta de gasto vinda da conversa: só é gravada quando a pessoa toca em "Lançar" (POST /api/finance/gastos, com a sessão dela). */
export function GastoCard({ g, onOpen }: { g: GastoDraft; onOpen?: () => void }) {
  const [state, setState] = useState<"proposed" | "saving" | "created" | "discarded" | "error">("proposed");
  const [msg, setMsg] = useState("");

  async function launch() {
    setState("saving");
    const [ano, mes, dia] = g.data.split("-").map(Number);
    try {
      const r = await fetch("/api/finance/gastos", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ano, mes, dia, valor: g.valor, categoria: g.categoria, descricao: g.descricao, meio: g.meio, origem: "conversa" }),
      });
      if (r.status === 401) { window.location.href = "/login"; return; }
      if (!r.ok) { setState("error"); setMsg(r.status === 404 ? "Finanças está desligado no momento." : "Não consegui lançar. Tente de novo."); return; }
      setState("created");
    } catch {
      setState("error");
      setMsg("Sem conexão. Tente de novo.");
    }
  }

  const label = state === "created" ? "Gasto lançado" : state === "discarded" ? "Descartado" : "Gasto para confirmar";
  const [, m, d] = g.data.split("-");
  return (
    <div className={`evc ${state}`}>
      <div className="evc-top">
        <span className="evc-ico"><Icon name={state === "created" ? "check" : "coin"} size={18} /></span>
        <div className="evc-body">
          <span className="evc-label">{label}</span>
          <b className="evc-title">{formatBRL(g.valor)} · {g.categoria}</b>
          <span className="evc-when">{d}/{m} · {MEIO_LABEL[g.meio]}{g.descricao ? ` · ${g.descricao}` : ""}</span>
        </div>
      </div>
      {(state === "proposed" || state === "error" || state === "saving") && (
        <div className="evc-actions">
          <button className="btn btn-sm btn-pri" disabled={state === "saving"} onClick={launch}>{state === "saving" ? "Lançando…" : "Lançar"}</button>
          <button className="btn btn-sm" disabled={state === "saving"} onClick={() => setState("discarded")}>Descartar</button>
        </div>
      )}
      {state === "created" && onOpen && <button className="evc-link link-btn" onClick={onOpen}>Ver no Financeiro<Icon name="chevron" size={14} /></button>}
      {msg && state === "error" && <span className="evc-err" role="alert">{msg}</span>}
    </div>
  );
}
