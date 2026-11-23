"use client";
// Metas (base): lista por situação e categoria, detalhe com histórico e tarefas, criar/editar e registrar progresso.
// Tudo passa pelas rotas /api/goals/* (sessão obrigatória, RLS); nada de chave no navegador. Progresso só com registro (data e origem).
import { MSG, loadFailed } from "@/lib/errors";
import { useCallback, useEffect, useMemo, useState } from "react";
import { dataBR, progressoTexto, ritmoTexto } from "@/lib/goals/calc";
import { fmtNum } from "@/lib/goals/numero";
import {
  CATEGORIAS, CATEGORIA_LABEL, MEDICAO_LABEL, MEDICOES, ORIGEM_LABEL, SITUACAO_LABEL,
  type Categoria, type Marco, type Medicao, type MetaView, type Registro, type Status, type TarefaVinculada,
} from "@/lib/goals/types";
import { ConfirmCard } from "./ConfirmCard";
import { BackButton, EmptyState, Field, ModuleScreen, PageHeader, Panel, PrimaryAction, Summary } from "./kit";
import { showUndo } from "@/lib/undo";
import { Icon, todayKey } from "./ui";

type Detalhe = { meta: MetaView; registros: Registro[]; marcos: Marco[]; tarefas: TarefaVinculada[]; tarefasAbertas: { id: number; title: string; due_date: string | null }[] };
type Aba = Exclude<Status, "arquivada"> | "arquivada";
const ABAS: [Aba, string][] = [["ativa", "Ativas"], ["pausada", "Pausadas"], ["concluida", "Concluídas"], ["arquivada", "Arquivadas"]];

async function api(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const r = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init?.headers }, cache: "no-store" });
  if (r.status === 401) window.location.href = "/login";
  return { ok: r.ok, status: r.status, json: await r.json().catch(() => ({})) };
}
const catLabel = (g: MetaView["goal"]) => (g.categoria === "personalizada" && g.categoria_nome ? g.categoria_nome : CATEGORIA_LABEL[g.categoria]);

export function MetasPage(props: { onAsk: (q: string) => void; onOpenTasks: () => void }) {
  const [aba, setAba] = useState<Aba>("ativa");
  const [cat, setCat] = useState<Categoria | "todas">("todas");
  const [metas, setMetas] = useState<MetaView[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [toast, setToast] = useState<{ text: string; err?: boolean } | null>(null);

  const load = useCallback(async () => {
    const r = await api(aba === "arquivada" ? "/api/goals?status=arquivada" : "/api/goals");
    if (r.status === 404) return setErro("Metas está desligado no momento.");
    if (!r.ok) return setErro(loadFailed("as metas"));
    setErro(null);
    setMetas((r.json.metas as MetaView[]) ?? []);
  }, [aba]);
  useEffect(() => { setMetas(null); void load(); }, [load]);

  const say = (text: string, err = false) => { setToast({ text, err }); window.setTimeout(() => setToast(null), 4000); };
  const lista = useMemo(() => (metas ?? []).filter((m) => m.goal.status === aba && (cat === "todas" || m.goal.categoria === cat)), [metas, aba, cat]);
  const categoriasUsadas = useMemo(() => [...new Set((metas ?? []).filter((m) => m.goal.status === aba).map((m) => m.goal.categoria))], [metas, aba]);

  if (aberta) return <MetaDetalhe id={aberta} onBack={() => { setAberta(null); void load(); }} onChanged={load} say={say} toast={toast} onOpenTasks={props.onOpenTasks} onAsk={props.onAsk} />;

  const todas = metas ?? [];
  const resumo = [
    { n: todas.filter((m) => m.goal.status === "ativa").length, label: "ativas" },
    { n: todas.filter((m) => m.goal.status === "ativa" && (m.ritmo.situacao === "atrasada" || m.ritmo.situacao === "vencida")).length, label: "atrasadas", tone: "hot" as const },
    { n: todas.filter((m) => m.goal.status === "concluida").length, label: "concluídas", tone: "ok" as const },
  ];
  return (
    <ModuleScreen title="Metas" text="Objetivos com prazo, ritmo e progresso real: só conta o que você registra."
      action={<PrimaryAction onClick={() => setCriando(true)}>Nova meta</PrimaryAction>}
      summary={metas && metas.length > 0 && aba !== "arquivada" ? <Summary items={resumo} /> : undefined}>
        {toast && <p className={`fin-toast ${toast.err ? "err" : ""}`} role="status">{toast.text}</p>}
        {criando && (
          <Panel title="Nova meta" icon="target">
            <MetaForm onClose={() => setCriando(false)} onSaved={async (id) => { setCriando(false); say("Meta criada."); await load(); setAberta(id); }} say={say} />
          </Panel>
        )}
        <div className="seg2" role="tablist" aria-label="Situação">
          {ABAS.map(([k, l]) => <button key={k} role="tab" aria-selected={aba === k} aria-pressed={aba === k} onClick={() => { setAba(k); setCat("todas"); }}>{l}</button>)}
        </div>
        {categoriasUsadas.length > 1 && (
          <div className="fin-filters" role="group" aria-label="Categoria">
            <button className="chip" aria-pressed={cat === "todas"} onClick={() => setCat("todas")}>Todas</button>
            {categoriasUsadas.map((c) => <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{CATEGORIA_LABEL[c]}</button>)}
          </div>
        )}
        {erro ? <Panel><p className="muted">{erro} <button className="link-btn" onClick={load}>Tentar de novo</button></p></Panel>
          : metas === null ? <Panel><p className="muted">Carregando…</p></Panel>
          : lista.length === 0 ? (
            <Panel>
              {aba === "ativa" && (metas ?? []).filter((m) => m.goal.status !== "arquivada").length === 0
                ? <EmptyState icon="target" title="Você ainda não tem metas" text="Crie a primeira: um número com prazo (ler 12 livros), marcos de um plano ou tarefas ligadas ao objetivo. O progresso só aparece quando você registra." phrase="Cria uma meta de ler 12 livros até dezembro" />
                : <EmptyState icon="target" title={aba === "ativa" ? "Nenhuma meta ativa aqui" : aba === "pausada" ? "Nenhuma meta pausada" : aba === "concluida" ? "Nenhuma meta concluída ainda" : "Nenhuma meta arquivada"} text={cat !== "todas" ? "Tente outra categoria." : undefined} />}
            </Panel>
          ) : (
            <div className="mt-list">
              {lista.map((m) => <CartaoMeta key={m.goal.id} m={m} onOpen={() => setAberta(m.goal.id)} />)}
            </div>
          )}
    </ModuleScreen>
  );
}

function Barra({ m }: { m: MetaView }) {
  return (
    <div className="mt-bar" role="progressbar" aria-label="Progresso" aria-valuemin={0} aria-valuemax={100} aria-valuenow={m.progresso.semDados ? 0 : m.progresso.pct} aria-valuetext={progressoTexto(m)}>
      <div className={m.ritmo.situacao} style={{ width: `${m.progresso.semDados ? 0 : m.progresso.pct}%` }} />
    </div>
  );
}

function CartaoMeta({ m, onOpen }: { m: MetaView; onOpen: () => void }) {
  const g = m.goal;
  return (
    <button className="panel mt-card" onClick={onOpen}>
      <span className="mt-top"><b className="mt-t">{g.titulo}</b><span className={`mt-sit ${m.ritmo.situacao}`}>{SITUACAO_LABEL[m.ritmo.situacao]}</span></span>
      <span className="mt-sub">{catLabel(g)}{g.prazo ? ` · prazo ${dataBR(g.prazo)}/${g.prazo.slice(0, 4)}` : " · sem prazo"}</span>
      <Barra m={m} />
      <span className="mt-num">{progressoTexto(m)}{!m.progresso.semDados && g.medicao !== "percentual" ? ` · ${m.progresso.pct}%` : ""}</span>
      {ritmoTexto(m) !== SITUACAO_LABEL[m.ritmo.situacao] && <span className="mt-sub">{ritmoTexto(m)}</span>}
    </button>
  );
}

function MetaDetalhe(props: { id: string; onBack: () => void; onChanged: () => void; say: (t: string, e?: boolean) => void; toast: { text: string; err?: boolean } | null; onOpenTasks: () => void; onAsk: (q: string) => void }) {
  const { id, say } = props;
  const [d, setD] = useState<Detalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [confirma, setConfirma] = useState<null | "arquivar">(null);

  const load = useCallback(async () => {
    const r = await api(`/api/goals/${id}`);
    if (r.status === 404) return setErro("Não encontrei esta meta.");
    if (!r.ok) return setErro(loadFailed("a meta"));
    setErro(null);
    setD(r.json as unknown as Detalhe);
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  /** Executa uma gravação, avisa o resultado e recarrega. */
  async function run(p: Promise<{ ok: boolean; json: Record<string, unknown> }>, okText: string, undo?: () => Promise<{ ok: boolean; json: Record<string, unknown> }>): Promise<boolean> {
    const r = await p;
    if (!r.ok) { say(typeof r.json.message === "string" ? r.json.message : MSG.save, true); return false; }
    // Com como desfazer: o aviso único "Feito · Desfazer". Sem: o aviso simples desta tela.
    if (undo) showUndo(okText, async () => { const u = await undo(); await load(); props.onChanged(); return u; });
    else say(okText);
    await load();
    props.onChanged();
    return true;
  }
  const patchStatus = (s: Status) => api(`/api/goals/${id}`, { method: "PATCH", body: JSON.stringify({ status: s }) });
  const status = (s: Status, texto: string) => { const antes = d?.meta.goal.status; return run(patchStatus(s), texto, antes ? () => patchStatus(antes as Status) : undefined); };

  if (erro) return <main className="page" id="conteudo"><div className="wrap stack"><BackButton onClick={props.onBack}>Metas</BackButton><Panel><p className="muted">{erro} <button className="link-btn" onClick={load}>Tentar de novo</button></p></Panel></div></main>;
  if (!d) return <main className="page" id="conteudo"><div className="wrap stack"><BackButton onClick={props.onBack}>Metas</BackButton><Panel><p className="muted">Carregando…</p></Panel></div></main>;

  const { meta: m } = d, g = m.goal, numerica = g.medicao === "numerica" || g.medicao === "percentual";
  const podeRegistrar = numerica && (g.status === "ativa" || g.status === "pausada");
  return (
    <main className="page" id="conteudo">
      <div className="wrap stack">
        <BackButton onClick={props.onBack}>Metas</BackButton>
        <PageHeader eyebrow={`${catLabel(g)} · ${MEDICAO_LABEL[g.medicao]}`} title={g.titulo} text={g.descricao ?? undefined}
          actions={<span className={`mt-sit ${m.ritmo.situacao}`}>{SITUACAO_LABEL[m.ritmo.situacao]}</span>} />
        {props.toast && <p className={`fin-toast ${props.toast.err ? "err" : ""}`} role="status">{props.toast.text}</p>}

        <Panel>
          <Barra m={m} />
          <p className="mt-big">{progressoTexto(m)}{!m.progresso.semDados && g.medicao !== "percentual" ? ` · ${m.progresso.pct}%` : ""}</p>
          <p className="muted small m0">{ritmoTexto(m)}</p>
          {m.progresso.ultimoRegistro && <p className="muted small m0">Último registro em {dataBR(m.progresso.ultimoRegistro)}.</p>}
          {m.progresso.semDados && numerica && <p className="fin-warn"><Icon name="spark" size={16} />Sem registros ainda: o GaDu não estima progresso. Registre o que você fez.</p>}
          {m.ritmo.situacao === "batida" && g.status === "ativa" && (
            <div className="fin-warn mt-done"><Icon name="check" size={16} /><span>Você chegou ao alvo. Quer marcar a meta como concluída?</span><button className="btn btn-sm btn-pri" onClick={() => void status("concluida", "Meta concluída.")}>Concluir meta</button></div>
          )}
          {m.ritmo.porSemana !== null && m.ritmo.diasRestantes !== null && m.ritmo.diasRestantes >= 0 && ["no_ritmo", "atrasada", "sem_dados"].includes(m.ritmo.situacao) && !m.progresso.semDados && (
            <p className="muted small m0">Projeção, não medição: para chegar no prazo, precisa de cerca de {fmtNum(m.ritmo.porSemana)}{g.medicao === "numerica" && g.unidade ? ` ${g.unidade}` : g.medicao === "percentual" ? " pontos" : g.medicao === "marcos" ? " marco(s)" : " tarefa(s)"} por semana.</p>
          )}
        </Panel>

        {podeRegistrar && <Panel title="Registrar progresso" icon="plus"><FormRegistro d={d} run={run} id={id} /></Panel>}
        {g.medicao === "marcos" && <PanelMarcos d={d} run={run} id={id} />}
        <PanelTarefas d={d} run={run} id={id} onOpenTasks={props.onOpenTasks} />
        {numerica && (
          <Panel title="Histórico" icon="history">
            {d.registros.length === 0 ? <EmptyState icon="history" title="Nenhum registro" text="Cada registro guarda a data e de onde veio (você ou a conversa)." />
              : (
                <div className="rows">
                  {d.registros.slice(0, 50).map((r) => (
                    <div className="fin-row" key={r.id}>
                      <span className="grow"><span className="t">{g.agregacao === "soma" && g.medicao === "numerica" ? "+" : ""}{fmtNum(r.valor)}{g.medicao === "percentual" ? "%" : g.unidade ? ` ${g.unidade}` : ""}</span><span className="s">{dataBR(r.data)}/{r.data.slice(0, 4)} · {ORIGEM_LABEL[r.origem]}{r.nota ? ` · ${r.nota}` : ""}</span></span>
                      <button className="btn btn-sm btn-quiet" onClick={() => void run(api(`/api/goals/${id}/progresso/${r.id}`, { method: "DELETE" }), "Registro apagado.")} aria-label={`Apagar o registro de ${dataBR(r.data)}`}>Apagar</button>
                    </div>
                  ))}
                  {d.registros.length > 50 && <p className="muted small m0">Mostrando os 50 mais recentes.</p>}
                </div>
              )}
          </Panel>
        )}

        {editando ? <Panel title="Editar meta" icon="target"><MetaForm goal={g} onClose={() => setEditando(false)} onSaved={async () => { setEditando(false); say("Meta salva."); await load(); props.onChanged(); }} say={say} /></Panel> : null}
        <div className="form-actions mt-actions">
          {!editando && g.status !== "arquivada" && <button className="btn" onClick={() => setEditando(true)}>Editar</button>}
          {g.status === "ativa" && <button className="btn" onClick={() => void status("pausada", "Meta pausada.")}>Pausar</button>}
          {g.status === "pausada" && <button className="btn" onClick={() => void status("ativa", "Meta retomada.")}>Retomar</button>}
          {g.status === "ativa" && m.ritmo.situacao !== "batida" && <button className="btn" onClick={() => void status("concluida", "Meta concluída.")}>Marcar como concluída</button>}
          {g.status === "concluida" && <button className="btn" onClick={() => void status("ativa", "Meta reaberta.")}>Reabrir</button>}
          {g.status === "arquivada" ? <button className="btn" onClick={() => void status("ativa", "Meta restaurada.")}>Restaurar</button>
            : confirma !== "arquivar" && <button className="btn btn-bad" onClick={() => setConfirma("arquivar")}>Arquivar</button>}
        </div>
        {confirma === "arquivar" && g.status !== "arquivada" && (
          <ConfirmCard danger icon="folder" title="Arquivar esta meta?" detail="Some das listas. Nada é apagado e dá para restaurar." confirmLabel="Arquivar"
            onConfirm={async () => { if (await status("arquivada", "Meta arquivada.")) props.onBack(); }} onCancel={() => setConfirma(null)} />
        )}
        <button className="btn btn-sm" onClick={() => props.onAsk(`Como está minha meta de ${g.titulo.slice(0, 40)}?`)}><Icon name="spark" size={16} />Perguntar ao GaDu sobre esta meta</button>
      </div>
    </main>
  );
}

type Run = (p: Promise<{ ok: boolean; json: Record<string, unknown> }>, okText: string, undo?: () => Promise<{ ok: boolean; json: Record<string, unknown> }>) => Promise<boolean>;

function FormRegistro({ d, run, id }: { d: Detalhe; run: Run; id: string }) {
  const g = d.meta.goal;
  const [valor, setValor] = useState("");
  const [data, setData] = useState(todayKey());
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const rotulo = g.medicao === "percentual" ? "Percentual atual (0 a 100)" : g.agregacao === "soma" ? `Quanto você fez${g.unidade ? ` (${g.unidade})` : ""}` : `Medida atual${g.unidade ? ` (${g.unidade})` : ""}`;
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const ok = await run(api(`/api/goals/${id}/progresso`, { method: "POST", body: JSON.stringify({ valor, data, origem: "manual", nota: nota.trim() || null }) }), "Progresso registrado.");
    setBusy(false);
    if (ok) { setValor(""); setNota(""); }
  }
  return (
    <form className="fin-edit" onSubmit={salvar} aria-label="Registrar progresso">
      <div className="two">
        <label className="fld"><span>{rotulo}</span><input className="field" inputMode="decimal" autoComplete="off" value={valor} onChange={(e) => setValor(e.target.value)} required placeholder="0" /></label>
        <Field label="Data"><input className="field" type="date" value={data} max={todayKey()} onChange={(e) => setData(e.target.value)} required /></Field>
      </div>
      <label className="fld"><span>Nota <em className="opt">(opcional)</em></span><input className="field" value={nota} maxLength={200} onChange={(e) => setNota(e.target.value)} /></label>
      <div className="form-actions"><button className="btn btn-pri" type="submit" disabled={busy}>{busy ? "Salvando…" : "Registrar"}</button></div>
      <p className="muted small m0">{g.agregacao === "soma" && g.medicao === "numerica" ? "O valor é somado aos registros anteriores." : "Vale a medida mais recente."} Também dá para falar: “registra 2 na meta de {g.titulo.slice(0, 30)}”.</p>
    </form>
  );
}

function PanelMarcos({ d, run, id }: { d: Detalhe; run: Run; id: string }) {
  const [novo, setNovo] = useState("");
  return (
    <Panel title="Marcos" icon="check">
      {d.marcos.length === 0 && <EmptyState icon="check" title="Nenhum marco" text="Quebre a meta em etapas e marque cada uma ao concluir." />}
      <div className="rows">
        {d.marcos.map((mc) => (
          <div className={`fin-row ${mc.concluido_em ? "paid" : ""}`} key={mc.id}>
            <label className="fin-chk grow"><input type="checkbox" checked={Boolean(mc.concluido_em)} onChange={(e) => { const novo = e.target.checked; const marco = (concluido: boolean) => api(`/api/goals/${id}/marcos/${mc.id}`, { method: "PATCH", body: JSON.stringify({ concluido }) }); void run(marco(novo), novo ? "Marco concluído." : "Marco reaberto.", () => marco(!novo)); }} />
              <span className="grow"><span className="t">{mc.titulo}</span>{mc.concluido_em && <span className="s">Concluído em {dataBR(mc.concluido_em.slice(0, 10))}</span>}</span></label>
            <button className="btn btn-sm btn-quiet" onClick={() => void run(api(`/api/goals/${id}/marcos/${mc.id}`, { method: "DELETE" }), "Marco apagado.")} aria-label={`Apagar o marco ${mc.titulo}`}>Apagar</button>
          </div>
        ))}
      </div>
      <form className="mt-add" onSubmit={async (e) => { e.preventDefault(); if (await run(api(`/api/goals/${id}/marcos`, { method: "POST", body: JSON.stringify({ titulo: novo }) }), "Marco adicionado.")) setNovo(""); }}>
        <input className="field" value={novo} maxLength={120} onChange={(e) => setNovo(e.target.value)} placeholder="Novo marco" aria-label="Novo marco" required />
        <button className="btn btn-sm" type="submit">Adicionar</button>
      </form>
    </Panel>
  );
}

function PanelTarefas({ d, run, id, onOpenTasks }: { d: Detalhe; run: Run; id: string; onOpenTasks: () => void }) {
  const [sel, setSel] = useState("");
  const porTarefas = d.meta.goal.medicao === "tarefas";
  return (
    <Panel title="Tarefas vinculadas" icon="folder" action={<button className="btn btn-sm" onClick={onOpenTasks}>Abrir Tarefas</button>}>
      {porTarefas && <p className="muted small m0">O progresso desta meta é o total de tarefas concluídas entre as vinculadas.</p>}
      {d.tarefas.length === 0 ? <EmptyState icon="check" title="Nenhuma tarefa vinculada" text={porTarefas ? "Vincule tarefas para que a meta tenha progresso." : "Vincule tarefas do dia a dia a esta meta."} />
        : (
          <div className="rows">
            {d.tarefas.map((t) => (
              <div className={`fin-row ${t.status === "done" ? "paid" : ""}`} key={t.task_id}>
                <span className="grow"><span className="t">{t.title}</span><span className="s">{t.status === "done" ? "Concluída" : t.status === "cancelled" ? "Cancelada" : t.due_date ? `Prazo ${dataBR(t.due_date)}` : "Aberta"}</span></span>
                <button className="btn btn-sm btn-quiet" onClick={() => void run(api(`/api/goals/${id}/tarefas/${t.task_id}`, { method: "DELETE" }), "Tarefa desvinculada.")} aria-label={`Desvincular ${t.title}`}>Desvincular</button>
              </div>
            ))}
          </div>
        )}
      {d.tarefasAbertas.length > 0 && (
        <form className="mt-add" onSubmit={async (e) => { e.preventDefault(); if (sel && await run(api(`/api/goals/${id}/tarefas`, { method: "POST", body: JSON.stringify({ task_id: Number(sel) }) }), "Tarefa vinculada.")) setSel(""); }}>
          <select className="field" value={sel} onChange={(e) => setSel(e.target.value)} aria-label="Tarefa para vincular"><option value="">Vincular uma tarefa aberta…</option>{d.tarefasAbertas.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select>
          <button className="btn btn-sm" type="submit" disabled={!sel}>Vincular</button>
        </form>
      )}
    </Panel>
  );
}

function MetaForm({ goal, onClose, onSaved, say }: { goal?: MetaView["goal"]; onClose: () => void; onSaved: (id: string) => void | Promise<void>; say: (t: string, e?: boolean) => void }) {
  const edit = Boolean(goal);
  const [titulo, setTitulo] = useState(goal?.titulo ?? "");
  const [descricao, setDescricao] = useState(goal?.descricao ?? "");
  const [categoria, setCategoria] = useState<Categoria>(goal?.categoria ?? "desenvolvimento");
  const [catNome, setCatNome] = useState(goal?.categoria_nome ?? "");
  const [medicao, setMedicao] = useState<Medicao>(goal?.medicao ?? "numerica");
  const [unidade, setUnidade] = useState(goal?.unidade ?? "");
  const [agregacao, setAgregacao] = useState<"soma" | "ultimo">(goal?.agregacao ?? "soma");
  const [inicial, setInicial] = useState(goal ? String(goal.valor_inicial) : "0");
  const [alvo, setAlvo] = useState(goal?.valor_alvo != null ? String(goal.valor_alvo) : "");
  const [prazo, setPrazo] = useState(goal?.prazo ?? "");
  const [marcos, setMarcos] = useState("");
  const [busy, setBusy] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const comum = { titulo, descricao: descricao.trim() || null, categoria, categoria_nome: categoria === "personalizada" ? catNome : null, prazo: prazo || null };
    const r = edit
      ? await api(`/api/goals/${goal!.id}`, { method: "PATCH", body: JSON.stringify({ ...comum, ...(goal!.medicao === "numerica" ? { unidade: unidade.trim() || null, valor_alvo: alvo } : {}) }) })
      : await api("/api/goals", { method: "POST", body: JSON.stringify({
        ...comum, medicao,
        ...(medicao === "numerica" ? { unidade: unidade.trim() || null, agregacao, valor_inicial: inicial || "0", valor_alvo: alvo } : {}),
        ...(medicao === "marcos" ? { marcos: marcos.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 20) } : {}),
      }) });
    setBusy(false);
    if (!r.ok) return say(typeof r.json.message === "string" ? r.json.message : "Não consegui salvar. Confira os dados.", true);
    const id = edit ? goal!.id : String(((r.json.meta as MetaView | null)?.goal.id) ?? "");
    await onSaved(id);
  }
  return (
    <form className="fin-edit" onSubmit={salvar} aria-label={edit ? "Editar meta" : "Nova meta"}>
      <Field label="Meta"><input className="field" value={titulo} maxLength={120} onChange={(e) => setTitulo(e.target.value)} required placeholder="Ex.: Ler 12 livros" /></Field>
      <label className="fld"><span>Por que importa <em className="opt">(opcional)</em></span><textarea className="field" rows={2} value={descricao} maxLength={600} onChange={(e) => setDescricao(e.target.value)} /></label>
      <label className="fld"><span>Categoria</span>
        <select className="field" value={categoria} onChange={(e) => setCategoria(e.target.value as Categoria)}>{CATEGORIAS.map((c) => <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>)}</select>
      </label>
      {categoria === "personalizada" && <Field label="Nome da categoria"><input className="field" value={catNome} maxLength={40} onChange={(e) => setCatNome(e.target.value)} required /></Field>}
      {!edit && (
        <label className="fld"><span>Como medir</span>
          <select className="field" value={medicao} onChange={(e) => setMedicao(e.target.value as Medicao)}>{MEDICOES.map((k) => <option key={k} value={k}>{MEDICAO_LABEL[k]}</option>)}</select>
        </label>
      )}
      {medicao === "numerica" && (
        <>
          <div className="two">
            <Field label="Alvo"><input className="field" inputMode="decimal" autoComplete="off" value={alvo} onChange={(e) => setAlvo(e.target.value)} required placeholder="12" /></Field>
            <label className="fld"><span>Unidade <em className="opt">(opcional)</em></span><input className="field" value={unidade} maxLength={20} onChange={(e) => setUnidade(e.target.value)} placeholder="livros, km, R$" /></label>
          </div>
          {!edit && (
            <>
              <Field label="Valor de partida"><input className="field" inputMode="decimal" autoComplete="off" value={inicial} onChange={(e) => setInicial(e.target.value)} placeholder="0" /></Field>
              <div className="seg" role="group" aria-label="Como os registros contam">
                <button type="button" aria-selected={agregacao === "soma"} onClick={() => setAgregacao("soma")}>Somar registros</button>
                <button type="button" aria-selected={agregacao === "ultimo"} onClick={() => setAgregacao("ultimo")}>Última medida</button>
              </div>
              <p className="muted small m0">{agregacao === "soma" ? "Ex.: ler 12 livros, correr 100 km: cada registro é um pouco a mais." : "Ex.: chegar a 75 kg: vale sempre a medida mais recente."}</p>
            </>
          )}
        </>
      )}
      {medicao === "marcos" && !edit && <label className="fld"><span>Marcos <em className="opt">(um por linha, opcional)</em></span><textarea className="field" rows={4} value={marcos} onChange={(e) => setMarcos(e.target.value)} placeholder={"Módulo 1\nMódulo 2\nProva"} /></label>}
      <label className="fld"><span>Prazo <em className="opt">(opcional)</em></span><input className="field" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} /></label>
      <div className="form-actions"><button className="btn btn-pri" type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button><button className="btn" type="button" onClick={onClose}>Cancelar</button></div>
    </form>
  );
}
