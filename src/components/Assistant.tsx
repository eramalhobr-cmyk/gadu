"use client";
import { RETRY_LABEL } from "@/lib/errors";
import { stripSourceTags } from "@/lib/speech";
import { useEffect, useRef, useState } from "react";
import type { FaceMode } from "./robot-engine";
import { ActionCard, type CardState } from "./ActionCard";
import type { ChatAction } from "@/lib/chat-actions";
import { SourcesDetail } from "./SourcesDetail";
import type { ViewId } from "@/lib/modules";
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
  financeiro: ["Quanto gastei este mês?", "Como estão minhas contas?", "Gastei "],
  metas: ["Como estão minhas metas?", "Quais metas estão atrasadas?", "Registrar progresso: "],
};

/** Assistente Universal: voz e texto em qualquer tela. Três estados, uma conversa só (mesmo histórico, sessão e regras):
 * 1. compacto: o orbe da barra de baixo (ou o botão flutuante no computador), em GaduApp;
 * 2. rápido: este painel (de baixo no celular, lateral no computador), com as últimas trocas;
 * 3. completo: a tela Conversa. Aqui fica só a apresentação; envio, voz e histórico vêm do app. */
export function Assistant(props: {
  open: boolean;
  width: number;
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
  onResizeStart: (e: React.PointerEvent) => void;
  onResizeStep: (delta: number) => void;
  onOpenConversation: () => void;
  onOpenView: (view: ViewId) => void;
  onNew: () => void;
  /** Confirmação falada: comandos para os cartões e o aviso de volta. */
  cards: Record<string, CardState>;
  onCard: (id: string, a: ChatAction, op: "confirm" | "discard" | "undo") => void;
}) {
  const log = useRef<HTMLDivElement>(null);
  // Celular: modo rápido mostra só as últimas trocas; o histórico inteiro fica na tela Conversa.
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const real = props.messages.filter((m) => m.role !== "notice" || m === props.messages[props.messages.length - 1]);
  const shown = phone ? real.slice(-4) : props.messages.slice(-14);
  const hidden = phone ? Math.max(0, real.length - shown.length) : 0;
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [props.messages, props.open]);
  // Celular com teclado aberto: o painel sobe junto e cabe na área visível (visualViewport).
  const [kb, setKb] = useState<{ inset: number; height: number } | null>(null);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv || !props.open) return;
    const on = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKb(inset > 80 && window.innerWidth < 1024 ? { inset, height: vv.height } : null);
    };
    on();
    vv.addEventListener("resize", on);
    vv.addEventListener("scroll", on);
    return () => { vv.removeEventListener("resize", on); vv.removeEventListener("scroll", on); };
  }, [props.open]);
  // Arrastar para baixo pela alça fecha o painel (celular).
  const drag = useRef<number | null>(null);

  const mod = moduleOf(props.context.view);
  const state = props.listening ? "Escutando" : props.mode === "thinking" ? "Pensando" : props.mode === "speaking" ? "Respondendo" : "";
  const active = props.listening || props.busy || props.mode === "speaking";
  const sugs = SUGGEST[props.context.view] ?? [];

  return (
    <aside className={`assist ${props.open ? "open" : ""} ${kb ? "kb" : ""}`} aria-label="Assistente GaDu" aria-hidden={!props.open} inert={!props.open}
      style={kb ? { bottom: kb.inset + 8, height: Math.min(kb.height - 16, 520) } : undefined}>
      <div className="assist-resize" role="separator" aria-orientation="vertical" aria-label="Largura do painel do assistente" aria-valuemin={320} aria-valuemax={640} aria-valuenow={props.width} tabIndex={0}
        onPointerDown={props.onResizeStart}
        onKeyDown={(e) => { if (e.key === "ArrowLeft") { e.preventDefault(); props.onResizeStep(32); } if (e.key === "ArrowRight") { e.preventDefault(); props.onResizeStep(-32); } }} />
      <button className="assist-grab" aria-label="Fechar o assistente" onClick={props.onClose}
        onTouchStart={(e) => { drag.current = e.touches[0].clientY; }}
        onTouchEnd={(e) => { if (drag.current !== null && e.changedTouches[0].clientY - drag.current > 60) props.onClose(); drag.current = null; }}>
        <span aria-hidden="true" />
      </button>
      <header className="assist-head">
        <span className={`assist-ava s-${props.listening ? "listening" : props.mode}`} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/avatar/gadu-480.webp" alt="" width={36} height={36} />
        </span>
        <div className="t">
          <b>GaDu {state && <span className={`assist-state ${props.mode === "thinking" ? "hot" : ""}`} role="status">· {state}</span>}</b>
          <small title="O GaDu sabe em que tela você está, mas pode falar de qualquer assunto">Em {contextLabel(props.context)}</small>
        </div>
        <button className="icon-btn desk-only" onClick={props.onNew} aria-label="Nova conversa" title="Nova conversa"><Icon name="plus" /></button>
        <button className="icon-btn" onClick={props.onOpenConversation} aria-label="Abrir a conversa completa" title="Abrir a conversa completa"><Icon name="full" /></button>
        <button className="icon-btn" onClick={props.onClose} aria-label="Fechar o assistente" title="Fechar"><Icon name="x" /></button>
      </header>

      <div className="assist-log" ref={log} aria-live="polite">
        {hidden > 0 && <button className="assist-more" onClick={props.onOpenConversation}>Ver as {hidden} mensagens anteriores na conversa completa</button>}
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
          : m.role === "action" && m.action ? <ActionCard key={m.id} a={m.action} st={props.cards[m.id]} onConfirm={() => props.onCard(m.id, m.action!, "confirm")} onDiscard={() => props.onCard(m.id, m.action!, "discard")} onUndo={() => props.onCard(m.id, m.action!, "undo")} onOpen={props.onOpenView} />
          : m.role === "notice" ? (
            <div key={m.id} className="notice" role="status">
              {m.content}
              {m.retry && shown[shown.length - 1]?.id === m.id && <div style={{ marginTop: 8 }}><button className="btn btn-sm btn-pri" disabled={props.busy} onClick={() => props.onSend(m.retry!)}>{RETRY_LABEL}</button></div>}
              {m.link && <div style={{ marginTop: 8 }}><a className="btn btn-sm" href={m.link.href} target="_blank" rel="noopener noreferrer">{m.link.label}</a></div>}
            </div>
          ) : <div key={m.id} className="bub b"><span className="via" title={m.via ? `Modelo: ${m.via}` : undefined}>GaDu</span>{m.content ? stripSourceTags(m.content) : "…"}{m.sources && <SourcesDetail data={m.sources} onOpen={props.onOpenView} />}</div>,
        )}
      </div>

      <form className="assist-composer" onSubmit={(e) => { e.preventDefault(); props.onSend(props.draft); }}>
        {props.listening && <div className="listening-bar" role="status"><span className="dot-rec" aria-hidden="true" />Escutando… o texto aparece no campo para você revisar.</div>}
        <div className="assist-row">
          <button type="button" className={`round ${props.listening ? "on" : ""}`} onClick={active && !props.listening ? props.onStop : props.onMic} aria-pressed={props.listening}
            aria-label={props.listening ? "Parar de ouvir" : active ? "Parar resposta" : "Falar"} title={props.voiceOk ? undefined : "Este navegador não reconhece voz"}>
            <Icon name={active && !props.listening ? "stop" : "mic"} />
          </button>
          <label className="sr" htmlFor="assist-msg">Mensagem para o GaDu</label>
          <textarea
            id="assist-msg" className="field" rows={1} maxLength={4000} enterKeyHint="send" autoComplete="off" autoCapitalize="sentences"
            value={props.draft}
            placeholder={props.listening ? "Escutando…" : "Pergunte ou peça algo"}
            onChange={(e) => props.onDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); props.onSend(props.draft); } }}
          />
          <button type="submit" className="round pri" aria-label="Enviar" disabled={props.busy || !props.draft.trim()}><Icon name="send" /></button>
        </div>
      </form>
    </aside>
  );
}
