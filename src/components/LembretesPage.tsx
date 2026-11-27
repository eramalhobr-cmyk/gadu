"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiErrorMessage, loadFailed, MSG, RETRY_LABEL } from "@/lib/errors";
import {
  agruparLembretes, contagem, horarioFuturo, LEMBRETE_TEXTO_MAX, LEMBRETES_ATUALIZADOS, lerQuando, paraCampo, situacaoTexto,
  sugestaoQuando, textoLembrete, type Lembrete,
} from "@/lib/lembretes";
import { showNotice, showUndo, UNDO_TEXT } from "@/lib/undo";
import { ConfirmCard } from "./ConfirmCard";
import { EmptyState, Field, ModuleScreen, Panel, PrimaryAction, Summary } from "./kit";
import styles from "./LembretesPage.module.css";

const API = "/api/lembretes";
const FRASE = "Me lembra amanhã às 9h de pagar a conta de luz";

type Resultado = { ok: true; lembrete?: Lembrete } | { ok: false; msg: string };

async function chamar(caminho: string, method: "POST" | "PATCH", body: object): Promise<Resultado> {
  try {
    const r = await fetch(caminho, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j: unknown = await r.json().catch(() => ({}));
    if (r.status === 401) return { ok: false, msg: MSG.session };
    if (!r.ok) return { ok: false, msg: apiErrorMessage(j, MSG.save) };
    return { ok: true, lembrete: (j as { lembrete?: Lembrete }).lembrete };
  } catch {
    return { ok: false, msg: MSG.offlineDo };
  }
}

/** Desfazer: devolve um objeto com `ok`, que o aviso único entende. */
const reverter = (id: number, body: object, depois: () => void) => async () => {
  const r = await chamar(`${API}/${id}`, "PATCH", body);
  depois();
  return { ok: r.ok };
};

/** Validação do formulário (a mesma regra do servidor). */
function validar(texto: string, quando: string): { texto: string; quando: string } | string {
  const t = textoLembrete(texto);
  if (!t) return "Escreva o lembrete, até 300 letras.";
  const q = lerQuando(quando);
  if (!q) return "Escolha dia e hora.";
  if (!horarioFuturo(q)) return "Escolha um horário no futuro.";
  return { texto: t, quando: q };
}

/** Tela de Lembretes (UX-5): próximos, atrasados e recentes, em horário de Brasília. Tudo também pela conversa. */
export function LembretesPage() {
  const [rows, setRows] = useState<Lembrete[] | null>(null);
  const [erroLeitura, setErroLeitura] = useState(false);
  const [revisao, setRevisao] = useState(0);
  const [agora, setAgora] = useState(() => Date.now());
  const [novo, setNovo] = useState(false);
  const [texto, setTexto] = useState("");
  const [quando, setQuando] = useState("");
  const [erroNovo, setErroNovo] = useState("");
  const [editando, setEditando] = useState<{ id: number; texto: string; quando: string; erro: string } | null>(null);
  const [apagar, setApagar] = useState<number | null>(null);
  const [gravando, setGravando] = useState(false);

  const recarregar = useCallback(() => setRevisao((n) => n + 1), []);

  useEffect(() => {
    const onMuda = () => recarregar();
    const onVolta = () => { if (document.visibilityState === "visible") recarregar(); };
    window.addEventListener(LEMBRETES_ATUALIZADOS, onMuda);
    document.addEventListener("visibilitychange", onVolta);
    const relogio = setInterval(() => setAgora(Date.now()), 60_000);
    return () => {
      window.removeEventListener(LEMBRETES_ATUALIZADOS, onMuda);
      document.removeEventListener("visibilitychange", onVolta);
      clearInterval(relogio);
    };
  }, [recarregar]);

  useEffect(() => {
    const ctrl = new AbortController();
    void (async () => {
      try {
        const r = await fetch(API, { cache: "no-store", signal: ctrl.signal });
        if (!r.ok) throw new Error("leitura");
        const j: { lembretes?: Lembrete[] } = await r.json();
        if (ctrl.signal.aborted) return;
        setRows(Array.isArray(j.lembretes) ? j.lembretes : []);
        setErroLeitura(false);
        setAgora(Date.now());
      } catch {
        if (!ctrl.signal.aborted) setErroLeitura(true);
      }
    })();
    return () => ctrl.abort();
  }, [revisao]);

  function abrirNovo() {
    setNovo((v) => !v);
    setTexto("");
    setQuando(sugestaoQuando());
    setErroNovo("");
  }

  async function criar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (gravando) return;
    const v = validar(texto, quando);
    if (typeof v === "string") return setErroNovo(v);
    setGravando(true);
    const r = await chamar(API, "POST", v);
    setGravando(false);
    if (!r.ok) return setErroNovo(r.msg);
    setNovo(false);
    setTexto("");
    setErroNovo("");
    recarregar();
    const id = r.lembrete?.id;
    if (id) showUndo("Lembrete criado.", reverter(id, { status: "cancelled" }, recarregar));
    else showNotice("Lembrete criado.");
  }

  async function mudarStatus(l: Lembrete, status: "done" | "cancelled") {
    if (gravando) return;
    setGravando(true);
    const r = await chamar(`${API}/${l.id}`, "PATCH", { status });
    setGravando(false);
    setApagar(null);
    if (!r.ok) return showNotice(r.msg);
    recarregar();
    showUndo(status === "done" ? UNDO_TEXT.done : "Lembrete apagado.", reverter(l.id, { status: l.status }, recarregar));
  }

  async function salvarEdicao(e: FormEvent<HTMLFormElement>, l: Lembrete) {
    e.preventDefault();
    if (gravando || !editando) return;
    const v = validar(editando.texto, editando.quando);
    if (typeof v === "string") return setEditando({ ...editando, erro: v });
    setGravando(true);
    const r = await chamar(`${API}/${l.id}`, "PATCH", v);
    setGravando(false);
    if (!r.ok) return setEditando({ ...editando, erro: r.msg });
    setEditando(null);
    recarregar();
    showUndo("Lembrete mudado.", reverter(l.id, { texto: l.text, quando: l.due_at, status: l.status, desfazer: true }, recarregar));
  }

  const grupos = rows ? agruparLembretes(rows, agora) : null;

  const item = (l: Lembrete) => {
    if (editando?.id === l.id) {
      return (
        <li className={styles.item} key={l.id}>
          <form className={styles.form} onSubmit={(e) => void salvarEdicao(e, l)} aria-label={`Editar ${l.text}`}>
            <Field label="O que lembrar?">
              <input required maxLength={LEMBRETE_TEXTO_MAX} value={editando.texto} disabled={gravando} autoFocus
                onChange={(e) => setEditando({ ...editando, texto: e.target.value })} />
            </Field>
            <Field label="Quando?" hint="horário de Brasília">
              <input type="datetime-local" required value={editando.quando} disabled={gravando}
                onChange={(e) => setEditando({ ...editando, quando: e.target.value })} />
            </Field>
            {editando.erro && <p role="alert" className={styles.erro}>{editando.erro}</p>}
            <div className={styles.acoes}>
              <button className="btn btn-sm btn-pri" disabled={gravando}>Salvar</button>
              <button type="button" className="btn btn-sm" disabled={gravando} onClick={() => setEditando(null)}>Cancelar</button>
            </div>
          </form>
        </li>
      );
    }
    const atrasado = l.status === "pending" && Date.parse(l.due_at) < agora;
    const aberto = l.status === "pending" || l.status === "sent";
    return (
      <li className={styles.item} key={l.id} data-status={l.status}>
        <div className={styles.texto}>
          <span className={styles.t}>{l.text}</span>
          <small className={atrasado || l.status === "sent" ? styles.quente : undefined}>{situacaoTexto(l, agora)}</small>
        </div>
        {apagar === l.id ? (
          <ConfirmCard danger icon="bell" title={`Apagar ${l.text}?`} detail="Você pode desfazer logo depois." confirmLabel="Apagar" busy={gravando} busyLabel="Apagando…"
            onConfirm={() => void mudarStatus(l, "cancelled")} onCancel={() => setApagar(null)} />
        ) : (
          <div className={styles.acoes}>
            {aberto && <button type="button" className="btn btn-sm btn-pri" disabled={gravando} aria-label={`Concluir ${l.text}`} onClick={() => void mudarStatus(l, "done")}>Feito</button>}
            {aberto && <button type="button" className="btn btn-sm" disabled={gravando} aria-label={`Editar ${l.text}`}
              onClick={() => { setApagar(null); setEditando({ id: l.id, texto: l.text, quando: horarioFuturo(l.due_at, agora) ? paraCampo(l.due_at) : sugestaoQuando(agora), erro: "" }); }}>Editar</button>}
            <button type="button" className="btn btn-sm btn-ghost" disabled={gravando} aria-label={`Apagar ${l.text}`} onClick={() => { setEditando(null); setApagar(l.id); }}>Apagar</button>
          </div>
        )}
      </li>
    );
  };

  const vazio = grupos !== null && !grupos.proximos.length && !grupos.atrasados.length && !grupos.recentes.length;

  return (
    <ModuleScreen title="Lembretes" text={<>Eu aviso no celular na hora certa. Diga <q>{FRASE}</q> ou crie aqui.</>}
      action={<PrimaryAction onClick={abrirNovo} expanded={novo}>Novo lembrete</PrimaryAction>}
      summary={grupos && !vazio ? (
        <Summary label="Resumo dos lembretes" items={[
          { n: grupos.proximos.length, label: "próximos" },
          { n: grupos.atrasados.length, label: "atrasados", tone: grupos.atrasados.length ? "bad" : undefined },
          { n: grupos.recentes.length, label: "recentes", tone: "ok" },
        ]} />
      ) : undefined}>
      {novo && (
        <Panel title="Novo lembrete" icon="plus">
          <form className={styles.form} onSubmit={(e) => void criar(e)}>
            <Field label="O que lembrar?">
              <input required maxLength={LEMBRETE_TEXTO_MAX} value={texto} disabled={gravando} autoFocus placeholder="Pagar a conta de luz"
                onChange={(e) => setTexto(e.target.value)} />
            </Field>
            <Field label="Quando?" hint="horário de Brasília">
              <input type="datetime-local" required value={quando} disabled={gravando} onChange={(e) => setQuando(e.target.value)} />
            </Field>
            {erroNovo && <p role="alert" className={styles.erro}>{erroNovo}</p>}
            <div className={styles.acoes}>
              <button className="btn btn-pri" disabled={gravando || !texto.trim() || !quando}>{gravando ? "Criando…" : "Criar"}</button>
              <button type="button" className="btn" disabled={gravando} onClick={() => setNovo(false)}>Cancelar</button>
            </div>
          </form>
        </Panel>
      )}

      {erroLeitura && rows === null ? (
        <Panel><EmptyState icon="bell" title={loadFailed("os lembretes")} action={<button className="btn" onClick={recarregar}>{RETRY_LABEL}</button>} /></Panel>
      ) : grupos === null ? (
        <Panel><p role="status">Carregando lembretes…</p></Panel>
      ) : vazio ? (
        <Panel>
          <EmptyState icon="bell" title="Nenhum lembrete por aqui" text="Peça ao GaDu ou toque em Novo lembrete. Eu aviso na hora." phrase={FRASE} />
        </Panel>
      ) : (
        <>
          {erroLeitura && <p role="alert">{loadFailed("os lembretes")}</p>}
          {grupos.atrasados.length > 0 && (
            <Panel title={`Atrasados · ${grupos.atrasados.length}`} icon="bell">
              <p className={styles.nota}>A hora passou e o aviso não saiu. Conclua, mude o horário ou apague.</p>
              <ul className={styles.lista} aria-label="Atrasados">{grupos.atrasados.map(item)}</ul>
            </Panel>
          )}
          <Panel title="Próximos" icon="bell">
            {grupos.proximos.length ? (
              <ul className={styles.lista} aria-label="Próximos">{grupos.proximos.map(item)}</ul>
            ) : (
              <EmptyState icon="bell" title="Nada marcado para depois" phrase={FRASE} />
            )}
          </Panel>
          {grupos.recentes.length > 0 && (
            <Panel title="Avisados e concluídos" icon="check">
              <p className={styles.nota}>{contagem(grupos.recentes.length)} dos últimos 7 dias.</p>
              <ul className={styles.lista} aria-label="Avisados e concluídos">{grupos.recentes.map(item)}</ul>
            </Panel>
          )}
        </>
      )}
    </ModuleScreen>
  );
}
