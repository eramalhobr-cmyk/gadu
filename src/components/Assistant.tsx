"use client";
import { useEffect, useRef } from "react";
import type { FaceMode } from "./robot-engine";
import { EventCard } from "./EventCard";
import { Icon } from "./ui";
import type { Msg } from "./GaduApp";
import { contextLabel, type AssistantContext } from "@/lib/assistant-context";
import { moduleOf } from "@/lib/modules";

/** Sugestões por tela. Só para o que existe: módulo planejado não oferece ações. */
const SUGGEST: Partial<Record<AssistantContext["view"], string[]>> = {
  hoje: ["Como está o meu dia?", "Priorizar meu dia", "Quais e-mails pedem resposta?"],
  projetos: ["Quais tarefas estão atrasadas?", "Anota aí: ", "Planejar minha semana"],
  memoria: ["O que você sabe sobre mim?", "Lembre que "],
  agentes: ["Que agentes combinam com a minha rotina?"],
  ajustes: ["Quanto já gastei com IA neste mês?"],
};

/** Assistente Universal: voz e texto em qualquer tela. Painel lateral no computador, painel de baixo no celular.
 * Reutiliza a mesma conversa do app (mensagens, envio, microfone); aqui fica só a apresentação. */
export function Assistant(props: {
  open: boolean;
  full: boolean;
  context: AssistantContext;
  messages: Msg[];
  draft: string;
  mode: FaceMode;
  listening: boolean;
  busy: boolean;
  voiceOk: boolean;
  onDraft: (v: string) => void;
  onSend: (text: string) => void;
  onMic: () => void;
  onStop: () => void;
  onClose: () => void;
  onToggleFull: () => void;
  onOpenConversation: () => void;
  onNew: () => void;
}) {
  const log = useRef<HTMLDivElement>(null);
  const shown = props.messages.slice(-14);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [props.messages, props.open, props.full]);

  const mod = moduleOf(props.context.view);
  const state = props.listening ? "Escutando" : props.mode === "thinking" ? "Pensando" : props.mode === "speaking" ? "Respondendo" : "Pronto";
  const active = props.listening || props.busy || props.mode === "speaking";
  const sugs = SUGGEST[props.context.view] ?? [];

  return (
    <aside className={`assist ${props.open ? "open" : ""} ${props.full ? "full" : ""}`} aria-label="Assistente GaDu" aria-hidden={!props.open}>
      <header className="assist-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/avatar/logo-96.webp" alt="" width={36} height={36} />
        <div className="t">
          <b>GaDu <span className={`mono assist-state ${props.mode === "thinking" ? "hot" : ""}`}>· {state}</span></b>
          <small title="O assistente sabe em que tela você está">Você está em {contextLabel(props.context)}</small>
        </div>
        <button className="icon-btn only-mobile" onClick={props.onToggleFull} aria-label={props.full ? "Reduzir painel" : "Expandir painel"} aria-expanded={props.full}>
          <span style={{ display: "grid", transform: props.full ? "rotate(180deg)" : undefined }}><Icon name="expand" /></span>
        </button>
        <button className="icon-btn" onClick={props.onNew} aria-label="Nova conversa" title="Nova conversa"><Icon name="plus" /></button>
        <button className="icon-btn" onClick={props.onOpenConversation} aria-label="Abrir a conversa em tela cheia" title="Abrir a conversa em tela cheia"><Icon name="chat" /></button>
        <button className="icon-btn" onClick={props.onClose} aria-label="Fechar o assistente"><Icon name="x" /></button>
      </header>

      <div className="assist-log" ref={log} aria-live="polite">
        {shown.length === 0 ? (
          <div className="assist-empty">
            <p><b>Fale ou escreva daqui mesmo.</b> Eu respondo sem você sair desta tela.</p>
            {mod.status === "planejado" ? (
              <p className="muted">{mod.name} ainda está no plano e não tem dados. Posso ajudar com o que já existe: seu dia, tarefas, agenda e memória.</p>
            ) : sugs.length > 0 && (
              <div className="assist-sug" aria-label="Sugestões">
                {sugs.map((s) => (
                  <button key={s} disabled={props.busy} onClick={() => (s.endsWith(" ") ? props.onDraft(s) : props.onSend(s))}>{s.endsWith(" ") ? `${s}…` : s}</button>
                ))}
              </div>
            )}
          </div>
        ) : shown.map((m) =>
          m.role === "user" ? <div key={m.id} className="bub u">{m.content}</div>
          : m.role === "event" && m.event ? <EventCard key={m.id} ev={m.event} />
          : m.role === "notice" ? (
            <div key={m.id} className="notice" role="status">
              {m.content}
              {m.link && <div style={{ marginTop: 8 }}><a className="btn btn-sm" href={m.link.href} target="_blank" rel="noopener noreferrer">{m.link.label}</a></div>}
            </div>
          ) : <div key={m.id} className="bub b"><span className="via">GaDu{m.via ? ` · via ${m.via}` : ""}</span>{m.content || "…"}</div>,
        )}
        {props.listening && props.draft && <div className="bub u" style={{ opacity: 0.7 }}>{props.draft}</div>}
      </div>

      <form className="assist-composer" onSubmit={(e) => { e.preventDefault(); props.onSend(props.draft); }}>
        <button type="button" className={`round ${props.listening ? "on" : ""}`} onClick={active && !props.listening ? props.onStop : props.onMic} aria-label={props.listening ? "Parar de ouvir" : active ? "Parar resposta" : "Falar"} title={props.voiceOk ? undefined : "Este navegador não reconhece voz"}>
          <Icon name={active && !props.listening ? "stop" : "mic"} />
        </button>
        <label className="sr" htmlFor="assist-msg">Mensagem para o GaDu</label>
        <textarea
          id="assist-msg" className="field" rows={1} maxLength={4000}
          value={props.listening ? "" : props.draft}
          placeholder={props.listening ? "Escutando…" : "Pergunte ou peça algo"}
          onChange={(e) => props.onDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); props.onSend(props.draft); } }}
        />
        <button type="submit" className="round pri" aria-label="Enviar" disabled={props.busy || !props.draft.trim()}><Icon name="send" /></button>
      </form>
    </aside>
  );
}
