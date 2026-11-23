"use client";
import { useEffect, useRef, useState } from "react";
import { describe, type ChatAction } from "@/lib/chat-actions";
import type { ViewId } from "@/lib/modules";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Icon } from "./ui";

/** Comando da confirmação falada: "sim" grava, "não" descarta (ou desfaz o que já foi criado). `n` muda a cada comando. */
export type VoiceCmd = { n: number; action: "yes" | "no" };
type Result = { ok: boolean; msg?: string; link?: string };
type State = "proposed" | "saving" | "created" | "discarded" | "error";

/** Comandos já executados: o mesmo cartão pode estar montado no painel e na Conversa; grava uma vez só. */
const handled = new Set<number>();

async function json(r: Response): Promise<Record<string, unknown>> {
  return r.json().catch(() => ({}));
}

/** Executa a ação, com a sessão da pessoa. Nada é gravado antes desta chamada (exceto o lembrete, que já existe). */
async function run(a: ChatAction): Promise<Result> {
  try {
    if (a.kind === "gasto") {
      const [ano, mes, dia] = a.g.data.split("-").map(Number);
      const r = await fetch("/api/finance/gastos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ano, mes, dia, valor: a.g.valor, categoria: a.g.categoria, descricao: a.g.descricao, meio: a.g.meio, origem: "conversa" }) });
      if (r.status === 401) { window.location.href = "/login"; return { ok: false }; }
      return r.ok ? { ok: true } : { ok: false, msg: r.status === 404 ? "Finanças está desligado no momento." : "Não consegui lançar. Tente de novo." };
    }
    if (a.kind === "meta") {
      const reg = a.d.acao === "registrar";
      const r = reg
        ? await fetch(`/api/goals/${a.d.goalId}/progresso`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ valor: a.d.valor, data: a.d.data, origem: "conversa" }) })
        : await fetch(`/api/goals/${a.d.goalId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "concluida" }) });
      if (r.status === 401) { window.location.href = "/login"; return { ok: false }; }
      return r.ok ? { ok: true } : { ok: false, msg: r.status === 404 ? "Não encontrei a meta (ou Metas está desligado)." : "Não consegui atualizar. Tente de novo." };
    }
    if (a.kind === "evento") {
      const r = await fetch("/api/calendar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: a.ev.title, start: a.ev.start, end: a.ev.end, ...(a.ev.location ? { location: a.ev.location } : {}) }) });
      const j = await json(r);
      return r.ok ? { ok: true, link: typeof j.link === "string" ? j.link : "" } : { ok: false, msg: (typeof j.message === "string" && j.message) || "Não consegui criar. Tente de novo." };
    }
    return { ok: true };
  } catch {
    return { ok: false, msg: "Sem conexão. Tente de novo." };
  }
}

/** Desfaz o que o servidor já criou (hoje, só o lembrete). */
async function undo(a: ChatAction): Promise<Result> {
  if (a.kind !== "lembrete") return { ok: true };
  const { error } = await supabaseBrowser().from("reminders").delete().eq("id", a.id);
  return error ? { ok: false, msg: "Não consegui apagar. Tente de novo." } : { ok: true };
}

/** Cartão de confirmação de uma ação da conversa. Um toque ou a voz ("sim"/"não") decidem. */
export function ActionCard({ a, cmd, onResult, onOpen }: { a: ChatAction; cmd?: VoiceCmd; onResult?: (action: "yes" | "no", ok: boolean) => void; onOpen?: (v: ViewId) => void }) {
  const v = describe(a);
  const [state, setState] = useState<State>(v.applied ? "created" : "proposed");
  const [undone, setUndone] = useState(false);
  const [msg, setMsg] = useState("");
  const [link, setLink] = useState("");
  const stateRef = useRef(state);
  stateRef.current = state;

  async function confirm(): Promise<boolean> {
    setState("saving");
    const r = await run(a);
    if (!r.ok) { setState("error"); setMsg(r.msg || ""); return false; }
    setLink(r.link || "");
    setState("created");
    return true;
  }
  async function revert(): Promise<boolean> {
    setState("saving");
    const r = await undo(a);
    if (!r.ok) { setState("error"); setMsg(r.msg || ""); return false; }
    setUndone(true);
    setState("discarded");
    return true;
  }
  function discard() { setState("discarded"); }

  // Confirmação falada: o app manda o comando; o cartão executa e avisa o resultado.
  const resultRef = useRef(onResult);
  resultRef.current = onResult;
  useEffect(() => {
    if (!cmd || handled.has(cmd.n)) return;
    handled.add(cmd.n);
    const s = stateRef.current;
    const done = (ok: boolean) => resultRef.current?.(cmd.action, ok);
    if (cmd.action === "yes") {
      if (v.applied || s === "created") return done(true);
      if (s === "discarded") return done(false);
      void confirm().then(done);
    } else {
      if (s === "discarded") return done(true);
      if (v.applied) { void revert().then(done); return; }
      if (s === "created") return done(false);
      discard();
      done(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmd?.n]);

  const label = state === "created" ? v.done : state === "discarded" ? v.undone : v.proposed;
  const pending = state === "proposed" || state === "error" || state === "saving";
  return (
    <div className={`evc ${state}`} data-kind={a.kind}>
      <div className="evc-top">
        <span className="evc-ico"><Icon name={state === "created" ? "check" : v.icon} size={18} /></span>
        <div className="evc-body">
          <span className="evc-label">{label}</span>
          <b className="evc-title">{v.title}</b>
          <span className="evc-when">{v.detail}</span>
        </div>
      </div>
      {v.applied ? (
        !undone && (state === "created" || state === "saving" || state === "error") && (
          <div className="evc-actions">
            <button className="btn btn-sm" disabled={state === "saving"} onClick={() => void revert()}>{state === "saving" ? v.busy : "Desfazer"}</button>
          </div>
        )
      ) : pending && (
        <div className="evc-actions">
          <button className="btn btn-sm btn-pri" disabled={state === "saving"} onClick={() => void confirm()}>{state === "saving" ? v.busy : v.confirm}</button>
          <button className="btn btn-sm" disabled={state === "saving"} onClick={discard}>Descartar</button>
        </div>
      )}
      {state === "created" && link && <a className="evc-link" href={link} target="_blank" rel="noopener noreferrer">Abrir no Google Agenda<Icon name="chevron" size={14} /></a>}
      {state === "created" && !link && v.open && onOpen && <button className="evc-link link-btn" onClick={() => onOpen(v.open!.view)}>{v.open.label}<Icon name="chevron" size={14} /></button>}
      {msg && state === "error" && <span className="evc-err" role="alert">{msg}</span>}
    </div>
  );
}
