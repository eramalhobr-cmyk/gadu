"use client";
import { useEffect } from "react";
import type { ActionView } from "@/lib/chat-actions";
import { CardFrame } from "./ConfirmCard";
import { Icon } from "./ui";

/** Confirmação falada (UX-3): a pergunta em letra grande, o que a pessoa está dizendo e botões grandes Sim/Não
 * para quem prefere tocar. Só apresentação; o microfone e a fala vêm do app. */
export function ConfirmSheet(props: {
  question: string;
  /** O mesmo cartão da conversa (UX-5): o que está sendo confirmado, com os mesmos textos. */
  view?: ActionView;
  /** "asking" = o GaDu está lendo; "listening" = esperando sim/não; "working" = gravando. */
  stage: "asking" | "listening" | "working";
  heard: string;
  step: number;
  total: number;
  onYes: () => void;
  onNo: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") props.onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props]);
  const status = props.stage === "working" ? "Gravando…" : props.stage === "listening" ? "Diga sim ou não" : "Confirme";
  return (
    <div className="listen-wrap" role="dialog" aria-modal="true" aria-labelledby="confirm-q">
      <div className="listen confirm-sheet">
        <button className="icon-btn listen-x" onClick={props.onClose} aria-label="Fechar e decidir depois"><Icon name="x" /></button>
        <p className="listen-status" role="status" aria-live="polite">
          {props.stage === "listening" && <span className="confirm-dot" aria-hidden="true" />}{status}{props.total > 1 ? ` · ${props.step} de ${props.total}` : ""}
        </p>
        <p className="listen-text" id="confirm-q">{props.question}</p>
        {props.view && <CardFrame icon={props.view.icon} label={props.view.proposed} title={props.view.title} detail={props.view.detail} />}
        {props.heard && <p className="confirm-heard">“{props.heard}”</p>}
        <div className="confirm-acts">
          <button className="btn btn-pri listen-main" disabled={props.stage === "working"} onClick={props.onYes}><Icon name="check" size={22} />Sim</button>
          <button className="btn listen-main" disabled={props.stage === "working"} onClick={props.onNo}><Icon name="x" size={22} />Não</button>
        </div>
        <span className="listen-cap">Para mudar algo, diga por exemplo “muda para 60 reais”.</span>
      </div>
    </div>
  );
}
