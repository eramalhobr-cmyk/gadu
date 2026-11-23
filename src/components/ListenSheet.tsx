"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./ui";
import { Avatar } from "./RobotFace";
import type { FaceMode } from "./robot-engine";
import { VoiceCore } from "./VoiceCore";
import { rotuloModo, type ModoNucleo } from "@/lib/nivel-visual";

const WAIT_S = 3;

/** Tela de escuta (UX-3): um toque para falar, letra grande, envio automático depois da fala com alguns segundos para cancelar.
 * Só apresentação; o microfone, o envio e as preferências vêm do app. */
export function ListenSheet(props: {
  listening: boolean;
  /** Estado do rosto do GaDu (UX-7, palco de voz): o avatar grande reage ao ouvir, pensar e falar. */
  mode: FaceMode;
  /** Transcrição ao vivo (a mesma do campo de mensagem). */
  text: string;
  /** Texto final pronto para enviar (fim da fala). null enquanto ouve. */
  pending: string | null;
  handsFree: boolean;
  onHandsFree: (on: boolean) => void;
  onListen: () => void;
  onStop: () => void;
  onSend: (text: string) => void;
  onCancel: () => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  const [left, setLeft] = useState(WAIT_S);
  const sendRef = useRef(props.onSend);
  sendRef.current = props.onSend;
  // Contagem regressiva: envia sozinho em 3 s, a menos que a pessoa cancele ou edite.
  useEffect(() => {
    if (props.pending === null) return;
    const text = props.pending;
    setLeft(WAIT_S);
    let n = WAIT_S;
    const id = setInterval(() => {
      n -= 1;
      setLeft(n);
      if (n <= 0) { clearInterval(id); sendRef.current(text); }
    }, 1000);
    return () => clearInterval(id);
  }, [props.pending]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") props.onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props]);

  const heard = props.text.trim();
  const modo: ModoNucleo = props.listening ? "listening" : (props.mode as ModoNucleo);
  const status = props.pending !== null ? `Enviando em ${Math.max(left, 0)}…` : props.listening ? "Estou ouvindo…" : heard ? "Parei de ouvir." : "Não ouvi nada.";
  return (
    <div className="listen-wrap imersivo" role="dialog" aria-modal="true" aria-labelledby="listen-status">
      <div className="listen">
        <button className="icon-btn listen-x" onClick={props.onClose} aria-label="Fechar"><Icon name="x" /></button>
        {/* Modo voz imersivo (G1): núcleo JARVIS com anéis e espectro que reagem ao som real (voice-level). */}
        <span className="listen-chip" data-modo={modo} aria-hidden="true"><i />{rotuloModo(modo, props.listening)}</span>
        <VoiceCore modo={modo}>
          <div className={`listen-ava ${props.listening ? "on" : ""}`} aria-hidden="true">
            <Avatar mode={props.listening ? "listening" : props.mode} label="" />
          </div>
        </VoiceCore>
        <p className="listen-status" id="listen-status" role="status" aria-live="polite">{status}</p>
        <p className={`listen-text ${heard ? "" : "hint"}`}>{heard || (props.listening ? "Fale normalmente. Por exemplo: “me lembra amanhã às 9h de ligar para o médico”." : "Toque no microfone para falar de novo.")}</p>

        {props.pending !== null ? (
          <div className="listen-acts">
            <button className="btn btn-pri listen-main" onClick={() => props.onSend(props.pending as string)}><Icon name="send" size={22} />Enviar agora</button>
            <div className="listen-row">
              <button className="btn" onClick={props.onCancel}>Cancelar</button>
              <button className="btn" onClick={props.onEdit}>Corrigir o texto</button>
            </div>
          </div>
        ) : props.listening ? (
          <div className="listen-acts">
            <button className="listen-mic on" onClick={props.onStop} aria-label="Parar de ouvir"><Icon name="stop" size={36} /></button>
            <span className="listen-cap">Toque para parar</span>
          </div>
        ) : (
          <div className="listen-acts">
            <button className="listen-mic" onClick={props.onListen} aria-label="Falar de novo"><Icon name="mic" size={36} /></button>
            <span className="listen-cap">Toque para falar</span>
            {heard && <button className="btn" onClick={props.onEdit}>Corrigir e enviar</button>}
          </div>
        )}

        <label className="switch listen-hf">
          <span>Conversa contínua<small className="muted"> · depois de responder, o GaDu volta a ouvir</small></span>
          <input type="checkbox" role="switch" className="sr" checked={props.handsFree} onChange={(e) => props.onHandsFree(e.target.checked)} />
          <i className="tgl" aria-hidden="true" />
        </label>
      </div>
    </div>
  );
}
