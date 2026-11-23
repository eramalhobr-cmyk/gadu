"use client";
// O cartão de confirmação do GaDu (UX-5): um desenho só para a conversa, as telas e a tela de escuta.
// ActionCard (ações propostas pela IA) e todo "Apagar?" das telas usam estas duas peças.
import type { ReactNode } from "react";
import { Icon } from "./ui";

export type CardKind = "proposed" | "saving" | "created" | "discarded" | "error";

/** A moldura: ícone, rótulo, título e detalhe. As ações entram como filhos. */
export function CardFrame(props: { state?: CardKind; icon: string; label: string; title: string; detail?: string; kind?: string; danger?: boolean; children?: ReactNode }) {
  const state = props.state ?? "proposed";
  return (
    <div className={`evc ${state} ${props.danger ? "danger" : ""}`} data-kind={props.kind}>
      <div className="evc-top">
        <span className="evc-ico"><Icon name={state === "created" ? "check" : props.icon} size={18} /></span>
        <div className="evc-body">
          <span className="evc-label">{props.label}</span>
          <b className="evc-title">{props.title}</b>
          {props.detail && <span className="evc-when">{props.detail}</span>}
        </div>
      </div>
      {props.children}
    </div>
  );
}

/** Pergunta com dois botões: o verbo da ação (principal) e "Cancelar". Para apagar, arquivar, desconectar. */
export function ConfirmCard(props: { icon?: string; label?: string; title: string; detail?: string; confirmLabel: string; cancelLabel?: string; danger?: boolean; busy?: boolean; busyLabel?: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <CardFrame icon={props.icon ?? "x"} label={props.label ?? "Confirme"} title={props.title} detail={props.detail} danger={props.danger} state={props.busy ? "saving" : "proposed"}>
      <div className="evc-actions">
        <button type="button" className={`btn btn-sm ${props.danger ? "btn-bad" : "btn-pri"}`} disabled={props.busy} onClick={props.onConfirm}>{props.busy ? props.busyLabel ?? "Aguarde…" : props.confirmLabel}</button>
        <button type="button" className="btn btn-sm" disabled={props.busy} onClick={props.onCancel}>{props.cancelLabel ?? "Cancelar"}</button>
      </div>
    </CardFrame>
  );
}
