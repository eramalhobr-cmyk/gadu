"use client";
// Financeiro (base): Contas e Dia a dia. Tudo passa pelas rotas /api/finance/* (sessão obrigatória, RLS); nada de chave no navegador.
import { MSG, loadFailed } from "@/lib/errors";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { formatBRL, formatBRLRound } from "@/lib/finance/money";
import type { ItemComMes } from "@/lib/finance/month";
import type { PrevisaoRecebimento } from "@/lib/finance/previsao";
import type { ResumoMensal } from "@/lib/finance/summary";
import { CATEGORIAS, GRUPOS, MEIOS, MEIO_LABEL, MESES, type Config, type Gasto, type Meio } from "@/lib/finance/types";
import { ConfirmCard } from "./ConfirmCard";
import { EmptyState, Field, ModuleScreen, Panel, PrimaryAction } from "./kit";
import { showUndo } from "@/lib/undo";
import { Icon, todayKey } from "./ui";

type Payload = { enabled: boolean; config: Config; configSalva: boolean; itens: ItemComMes[]; gastos: Gasto[]; resumo: ResumoMensal; previsao: PrevisaoRecebimento | null };
type Tab = "contas" | "dia";
type Filtro = "todas" | "aberto" | "pagas";

async function api(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const r = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init?.headers }, cache: "no-store" });
  if (r.status === 401) window.location.href = "/login";
  return { ok: r.ok, status: r.status, json: await r.json().catch(() => ({})) };
}
const br = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function FinanceiroPage() {
  const hoje = todayKey();
  const [ano, setAno] = useState(Number(hoje.slice(0, 4)));
  const [mes, setMes] = useState(Number(hoje.slice(5, 7)));
  const [tab, setTab] = useState<Tab>("contas");
  const [data, setData] = useState<Payload | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; err?: boolean } | null>(null);

  const load = useCallback(async () => {
    const r = await api(`/api/finance/resumo?ano=${ano}&mes=${mes}`);
    if (r.status === 404) return setErro("O Financeiro está desligado no momento.");
    if (!r.ok) return setErro(loadFailed("o mês"));
    setErro(null);
    setData(r.json as unknown as Payload);
  }, [ano, mes]);
  useEffect(() => { setData(null); void load(); }, [load]);

  const say = (text: string, err = false) => { setToast({ text, err }); window.setTimeout(() => setToast(null), 4000); };
  /** Executa uma gravação, avisa o resultado e recarrega. */
  async function run(p: Promise<{ ok: boolean; json: Record<string, unknown> }>, okText: string, undo?: () => Promise<{ ok: boolean; json: Record<string, unknown> }>): Promise<boolean> {
    const r = await p;
    if (!r.ok) { say(typeof r.json.message === "string" ? r.json.message : MSG.save, true); return false; }
    // Com como desfazer: o aviso único "Feito · Desfazer". Sem: o aviso simples desta tela.
    if (undo) showUndo(okText, async () => { const u = await undo(); await load(); return u; });
    else say(okText);
    await load();
    return true;
  }
  const go = (d: number) => { const n = mes + d; if (n < 1) { setAno(ano - 1); setMes(12); } else if (n > 12) { setAno(ano + 1); setMes(1); } else setMes(n); };
  const isAtual = ano === Number(hoje.slice(0, 4)) && mes === Number(hoje.slice(5, 7));

  function lancarGasto() {
    setTab("dia");
    window.setTimeout(() => { const el = document.getElementById("fin-valor"); el?.scrollIntoView({ block: "center" }); el?.focus(); }, 60);
  }
  return (
    <ModuleScreen title="Financeiro" text="Contas do mês e gastos do dia a dia. Pergunte ao GaDu ou lance por aqui."
      action={<PrimaryAction onClick={lancarGasto}>Lançar gasto</PrimaryAction>}>

        <nav className="fin-month" aria-label="Mês">
          <button className="icon-btn" onClick={() => go(-1)} aria-label="Mês anterior"><span aria-hidden="true" className="flip-x"><Icon name="chevron" /></span></button>
          <b aria-live="polite">{MESES[mes - 1]} de {ano}</b>
          <button className="icon-btn" onClick={() => go(1)} aria-label="Próximo mês"><Icon name="chevron" /></button>
        </nav>
        {!isAtual && <button className="link-btn" onClick={() => { setAno(Number(hoje.slice(0, 4))); setMes(Number(hoje.slice(5, 7))); }}>Voltar para o mês atual</button>}

        {toast && <p className={`fin-toast ${toast.err ? "err" : ""}`} role="status">{toast.text}</p>}
        {erro && <div className="notice" role="alert">{erro} <button className="link-btn" onClick={load}>Tentar de novo</button></div>}
        {!data && !erro && <p className="muted">Carregando…</p>}

        {data && (
          <>
            <Resumo r={data.resumo} previsao={data.previsao} />
            <div className="seg" role="tablist" aria-label="Seções do Financeiro">
              <button role="tab" id="tab-contas" aria-selected={tab === "contas"} aria-controls="pn-contas" onClick={() => setTab("contas")}>Contas</button>
              <button role="tab" id="tab-dia" aria-selected={tab === "dia"} aria-controls="pn-dia" onClick={() => setTab("dia")}>Dia a dia</button>
            </div>
            {tab === "contas"
              ? <div role="tabpanel" id="pn-contas" aria-labelledby="tab-contas" className="stack"><Contas data={data} ano={ano} mes={mes} run={run} /><ConfigPanel data={data} run={run} /></div>
              : <div role="tabpanel" id="pn-dia" aria-labelledby="tab-dia" className="stack"><DiaADia data={data} ano={ano} mes={mes} isAtual={isAtual} run={run} /></div>}
          </>
        )}
    </ModuleScreen>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
function Resumo({ r, previsao }: { r: ResumoMensal; previsao: PrevisaoRecebimento | null }) {
  const vazio = r.receitas === 0 && r.despesas === 0;
  const maxCat = Math.max(0, ...r.diaADia.porCategoria.map((c) => c.total));
  return (
    <>
      <Panel title="Saldo do mês" icon="coin">
        {vazio ? <EmptyState icon="coin" title="Nada lançado neste mês" text="Cadastre suas contas e receitas na aba Contas e lance os gastos em Dia a dia. Os números aparecem aqui." phrase="Gastei 45 no mercado no pix" /> : (
          <>
            <span className={`fin-big fin-num ${r.sobra < 0 ? "bad" : "ok"}`} aria-label={`Sobra do mês: ${formatBRL(r.sobra)}`}>{formatBRLRound(r.sobra)}</span>
            <span className="muted">Sobra prevista: receitas {formatBRL(r.receitas)} − despesas {formatBRL(r.despesas)}</span>
            <div className="fin-bar" role="img" aria-label={`${r.pctPago}% das despesas já pagas`}><i style={{ width: `${Math.min(100, r.pctPago)}%` }} /></div>
            <span className="muted small">{r.pctPago}% pago · {formatBRL(r.pagoTotal)} pagos, {formatBRL(r.aPagar)} a pagar{r.recebido > 0 || r.receitas > 0 ? ` · recebido ${formatBRL(r.recebido)} de ${formatBRL(r.receitas)}` : ""}</span>
          </>
        )}
      </Panel>
      {!vazio && (
        <div className="kpis" aria-label="Resumo do mês">
          <div className="kpi"><span className="n fin-num">{formatBRLRound(r.receitas)}</span><span className="l">Receitas</span></div>
          <div className="kpi"><span className="n fin-num">{formatBRLRound(r.contas.total)}</span><span className="l">Contas ({r.contas.qtdPagas}/{r.contas.qtd} pagas)</span></div>
          <div className="kpi"><span className="n fin-num">{formatBRLRound(r.diaADia.total)}</span><span className="l">Dia a dia ({r.diaADia.qtd})</span></div>
          <div className="kpi"><span className="n fin-num">{formatBRLRound(r.aPagar)}</span><span className="l">A pagar</span></div>
        </div>
      )}
      {r.avisos.map((a) => <p key={a} className="fin-warn" role="note"><Icon name="lock" size={16} />{a}</p>)}
      {previsao?.proximo && (
        <Panel title="Até o próximo recebimento" icon="calendar">
          <p>{previsao.proximo.rotulo}: <b className="fin-num">{formatBRL(previsao.proximo.valor)}</b> em {br(previsao.proximo.data)} ({previsao.proximo.dias === 1 ? "amanhã" : `em ${previsao.proximo.dias} dias`}){previsao.proximo.estimado ? " · estimado" : ""}.</p>
          <p>Até lá vencem <b className="fin-num">{formatBRL(previsao.contasAteLa.total)}</b> em {previsao.contasAteLa.qtd} conta{previsao.contasAteLa.qtd === 1 ? "" : "s"}.</p>
          {previsao.contasAteLa.itens.length > 0 && <ul className="plist">{previsao.contasAteLa.itens.map((i, k) => <li key={k}><span>{br(i.data)} · {i.nome} · {formatBRL(i.valor)}</span></li>)}</ul>}
          {previsao.vencidasEmAberto.qtd > 0 && <p className="muted small">{previsao.vencidasEmAberto.qtd} conta{previsao.vencidasEmAberto.qtd === 1 ? "" : "s"} com vencimento passado e em aberto ({formatBRL(previsao.vencidasEmAberto.total)}). Se já pagou, marque como paga.</p>}
          {previsao.semDia > 0 && <p className="muted small">{previsao.semDia} item{previsao.semDia === 1 ? "" : "s"} sem dia de vencimento ficaram de fora desta conta.</p>}
        </Panel>
      )}
      {r.diaADia.porCategoria.length > 0 && (
        <Panel title="Dia a dia por categoria" icon="spark">
          <div className="rows">
            {r.diaADia.porCategoria.map((c) => (
              <div className="fin-cat" key={c.categoria}>
                <div className="grow"><span>{c.categoria} <span className="muted small">· {c.qtd}</span></span><div className="fin-bar cat" aria-hidden="true"><i style={{ width: `${maxCat ? Math.round((c.total / maxCat) * 100) : 0}%` }} /></div></div>
                <span className="fin-num">{formatBRL(c.total)}</span>
              </div>
            ))}
          </div>
          {r.credito.qtd > 0 && <p className="muted small">{r.credito.naFatura ? `Os ${r.credito.qtd} gastos no crédito (${formatBRL(r.credito.total)}) já estão na fatura do cartão e não entram aqui.` : `Inclui ${r.credito.qtd} gasto${r.credito.qtd === 1 ? "" : "s"} no crédito.`}</p>}
        </Panel>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
type Run = (p: Promise<{ ok: boolean; json: Record<string, unknown> }>, okText: string, undo?: () => Promise<{ ok: boolean; json: Record<string, unknown> }>) => Promise<boolean>;

function Contas({ data, ano, mes, run }: { data: Payload; ano: number; mes: number; run: Run }) {
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [novo, setNovo] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const noMes = data.itens.filter((i) => i.mes);
  const fora = data.itens.filter((i) => !i.mes && !i.cartao_id);
  const visiveis = noMes.filter((i) => filtro === "todas" || (filtro === "pagas" ? i.mes!.pago : !i.mes!.pago));
  const filhos = (id: string) => noMes.filter((i) => i.cartao_id === id);
  const raiz = visiveis.filter((i) => !i.cartao_id || !noMes.some((c) => c.id === i.cartao_id));
  const grupos = useMemo(() => {
    const m = new Map<string, ItemComMes[]>();
    for (const i of raiz) { const k = `${i.tipo === "receita" ? "Receitas · " : ""}${i.grupo}`; m.set(k, [...(m.get(k) ?? []), i]); }
    return [...m.entries()];
  }, [raiz]);

  const marcar = (id: string, pago: boolean) => api(`/api/finance/itens/${id}/mes`, { method: "PUT", body: JSON.stringify({ ano, mes, pago }) });
  const togglePago = (i: ItemComMes) => run(marcar(i.id, !i.mes!.pago), i.mes!.pago ? "Marcada em aberto." : i.tipo === "receita" ? "Receita marcada como recebida." : "Conta marcada como paga.", () => marcar(i.id, Boolean(i.mes!.pago)));

  // Função (não componente): o formulário aberto não pode ser remontado a cada aviso na tela.
  const renderRow = (i: ItemComMes, sub?: boolean): React.ReactNode => (
    <Fragment key={i.id}>
      <div className={`fin-row ${sub ? "sub" : ""} ${i.mes?.pago ? "paid" : ""}`}>
        <button className={`tl-tick ${i.mes?.pago ? "on" : ""}`} aria-pressed={Boolean(i.mes?.pago)} aria-label={`${i.mes?.pago ? "Marcar em aberto" : i.tipo === "receita" ? "Marcar como recebida" : "Marcar como paga"}: ${i.nome}`} onClick={() => togglePago(i)}>
          <span>{i.mes?.pago && <Icon name="check" size={14} />}</span>
        </button>
        <div className="grow">
          <span className="t">{i.nome}</span>
          <span className="s">{i.dia ? `dia ${i.dia}${i.dia_estimado ? " (estimado)" : ""}` : "sem dia"}{i.cartao_id ? " · dentro do cartão" : ""}{i.mes?.via_reserva ? " · via reserva" : ""}{i.mes?.nota ? ` · ${i.mes.nota}` : ""}</span>
        </div>
        <button className="fin-val fin-num" onClick={() => setEditando(editando === i.id ? null : i.id)} aria-expanded={editando === i.id} aria-label={`Editar ${i.nome}, ${formatBRL(i.mes!.valor)}`}>{formatBRL(i.mes!.valor)}</button>
      </div>
      {editando === i.id && <ItemEditor item={i} itens={data.itens} ano={ano} mes={mes} run={run} onClose={() => setEditando(null)} />}
      {!sub && filhos(i.id).filter((c) => filtro === "todas" || (filtro === "pagas" ? c.mes!.pago : !c.mes!.pago)).map((c) => renderRow(c, true))}
    </Fragment>
  );

  return (
    <Panel title="Contas e receitas" icon="check" action={<button className="btn btn-sm btn-pri" onClick={() => setNovo(!novo)} aria-expanded={novo}><Icon name="plus" size={16} />Adicionar</button>}>
      {novo && <ItemForm itens={data.itens} ano={ano} mes={mes} run={run} onClose={() => setNovo(false)} />}
      <div className="fin-filters" role="group" aria-label="Filtro">
        {([["todas", "Todas"], ["aberto", "Em aberto"], ["pagas", "Pagas"]] as [Filtro, string][]).map(([k, l]) => <button key={k} className="chip" aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{l}</button>)}
      </div>
      {noMes.length === 0 && fora.length === 0 && !novo && (
        <EmptyState icon="check" title="Nenhuma conta neste mês" text="Cadastre aluguel, escola, assinaturas, salário… Cada item guarda o valor de cada mês e se já foi pago." action={<button className="btn btn-sm btn-pri" onClick={() => setNovo(true)}>Adicionar a primeira</button>} />
      )}
      {noMes.length > 0 && visiveis.length === 0 && <p className="muted">Nada {filtro === "pagas" ? "pago" : "em aberto"} neste mês.</p>}
      {grupos.map(([g, lista]) => (
        <div key={g}><h3 className="fin-grp">{g}</h3><div className="rows">{lista.map((i) => renderRow(i))}</div></div>
      ))}
      {fora.length > 0 && (
        <div>
          <h3 className="fin-grp">Sem valor neste mês</h3>
          <div className="rows">
            {fora.map((i) => (
              <div key={i.id}>
                <div className="fin-row">
                  <div className="grow"><span className="t">{i.nome}</span><span className="s">{i.tipo === "receita" ? "Receita" : "Conta"} · {i.grupo}</span></div>
                  <button className="btn btn-sm" onClick={() => setEditando(editando === i.id ? null : i.id)} aria-expanded={editando === i.id}>Definir valor</button>
                </div>
                {editando === i.id && <ItemEditor item={i} itens={data.itens} ano={ano} mes={mes} run={run} onClose={() => setEditando(null)} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

function ItemForm({ itens, ano, mes, run, onClose }: { itens: ItemComMes[]; ano: number; mes: number; run: Run; onClose: () => void }) {
  const [tipo, setTipo] = useState<"despesa" | "receita">("despesa");
  const [nome, setNome] = useState("");
  const [grupo, setGrupo] = useState("");
  const [valor, setValor] = useState("");
  const [dia, setDia] = useState("");
  const [proximos, setProximos] = useState(true);
  const [cartao, setCartao] = useState("");
  const [busy, setBusy] = useState(false);
  const cartoes = itens.filter((i) => i.tipo === "despesa");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !valor.trim()) return;
    setBusy(true);
    const body = { tipo, nome, grupo: grupo.trim() || (tipo === "receita" ? "Receitas" : "Geral"), ...(dia ? { dia: Number(dia) } : {}), ...(tipo === "despesa" && cartao ? { cartao_id: cartao } : {}), inicial: { ano, mes, valor: valor.trim(), escopo: proximos ? "proximos" : "mes" } };
    const ok = await run(api("/api/finance/itens", { method: "POST", body: JSON.stringify(body) }), tipo === "receita" ? "Receita adicionada." : "Conta adicionada.");
    setBusy(false);
    if (ok) onClose();
  }
  return (
    <form className="fin-edit" onSubmit={save} aria-label="Nova conta ou receita">
      <div className="seg" role="group" aria-label="Tipo">
        <button type="button" aria-selected={tipo === "despesa"} onClick={() => setTipo("despesa")}>Conta (sai)</button>
        <button type="button" aria-selected={tipo === "receita"} onClick={() => setTipo("receita")}>Receita (entra)</button>
      </div>
      <Field label="Nome"><input className="field" value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} required placeholder={tipo === "receita" ? "Ex.: Salário" : "Ex.: Aluguel"} /></Field>
      <div className="two">
        <Field label="Valor do mês (R$)"><input id="fin-valor" className="field" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} required placeholder="0,00" /></Field>
        <label className="fld"><span>Dia <em className="opt">(opcional)</em></span><input className="field" inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="1 a 31" /></label>
      </div>
      <label className="fld"><span>Grupo <em className="opt">(opcional)</em></span><input className="field" list="fin-grupos" value={grupo} maxLength={40} onChange={(e) => setGrupo(e.target.value)} placeholder={tipo === "receita" ? "Receitas" : "Ex.: Moradia"} /></label>
      <datalist id="fin-grupos">{GRUPOS.map((g) => <option key={g} value={g} />)}</datalist>
      {tipo === "despesa" && cartoes.length > 0 && (
        <label className="fld"><span>Dentro da fatura de <em className="opt">(não soma de novo)</em></span>
          <select className="field" value={cartao} onChange={(e) => setCartao(e.target.value)}><option value="">Nenhum</option>{cartoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
        </label>
      )}
      <label className="fin-chk"><input type="checkbox" checked={proximos} onChange={(e) => setProximos(e.target.checked)} />Repetir este valor até dezembro</label>
      <div className="form-actions"><button className="btn btn-pri" disabled={busy} type="submit">{busy ? "Salvando…" : "Salvar"}</button><button className="btn" type="button" onClick={onClose}>Cancelar</button></div>
    </form>
  );
}

function ItemEditor({ item, itens, ano, mes, run, onClose }: { item: ItemComMes; itens: ItemComMes[]; ano: number; mes: number; run: Run; onClose: () => void }) {
  const [valor, setValor] = useState(item.mes ? String(item.mes.valor).replace(".", ",") : "");
  const [proximos, setProximos] = useState(false);
  const [nome, setNome] = useState(item.nome);
  const [grupo, setGrupo] = useState(item.grupo);
  const [dia, setDia] = useState(item.dia ? String(item.dia) : "");
  const [estimado, setEstimado] = useState(item.dia_estimado);
  const [cartao, setCartao] = useState(item.cartao_id ?? "");
  const [reserva, setReserva] = useState(Boolean(item.mes?.via_reserva));
  const [confirma, setConfirma] = useState(false);
  const cartoes = itens.filter((i) => i.tipo === "despesa" && i.id !== item.id);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const cad = await run(api(`/api/finance/itens/${item.id}`, { method: "PATCH", body: JSON.stringify({ nome, grupo, dia: dia ? Number(dia) : null, dia_estimado: estimado, ...(item.tipo === "despesa" ? { cartao_id: cartao || null } : {}) }) }), "Item atualizado.");
    if (!cad) return;
    if (valor.trim()) {
      const ok = await run(api(`/api/finance/itens/${item.id}/mes`, { method: "PUT", body: JSON.stringify({ ano, mes, valor: valor.trim(), escopo: proximos ? "proximos" : "mes", ...(item.mes ? { via_reserva: reserva } : {}) }) }), proximos ? "Valor salvo para este mês e os próximos." : "Valor deste mês salvo.");
      if (!ok) return;
    }
    onClose();
  }
  return (
    <form className="fin-edit" onSubmit={save} aria-label={`Editar ${item.nome}`}>
      <div className="two">
        <label className="fld"><span>Valor de {MESES[mes - 1]} (R$)</span><input id="fin-valor" className="field" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" /></label>
        <Field label="Dia"><input className="field" inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="1 a 31" /></Field>
      </div>
      <label className="fin-chk"><input type="checkbox" checked={proximos} onChange={(e) => setProximos(e.target.checked)} />Valer também para os próximos meses (até dezembro)</label>
      <label className="fin-chk"><input type="checkbox" checked={estimado} onChange={(e) => setEstimado(e.target.checked)} />Dia estimado</label>
      {item.tipo === "despesa" && item.mes && <label className="fin-chk"><input type="checkbox" checked={reserva} onChange={(e) => setReserva(e.target.checked)} />Paga com a reserva neste mês</label>}
      <Field label="Nome"><input className="field" value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} required /></Field>
      <Field label="Grupo"><input className="field" list="fin-grupos" value={grupo} maxLength={40} onChange={(e) => setGrupo(e.target.value)} required /></Field>
      {item.tipo === "despesa" && (
        <label className="fld"><span>Dentro da fatura de</span>
          <select className="field" value={cartao} onChange={(e) => setCartao(e.target.value)}><option value="">Nenhum</option>{cartoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
        </label>
      )}
      <div className="form-actions">
        <button className="btn btn-pri" type="submit">Salvar</button>
        <button className="btn" type="button" onClick={onClose}>Cancelar</button>
        {item.mes && <button className="btn" type="button" onClick={async () => { if (await run(api(`/api/finance/itens/${item.id}/mes`, { method: "PUT", body: JSON.stringify({ ano, mes, valor: 0 }) }), "Item tirado deste mês.")) onClose(); }}>Não tem neste mês</button>}
        {!confirma && <button className="btn btn-bad" type="button" onClick={() => setConfirma(true)}>Apagar</button>}
      </div>
      {confirma && <ConfirmCard danger icon="coin" title="Apagar esta conta ou receita?" detail="Some de todos os meses." confirmLabel="Apagar" onConfirm={async () => { if (await run(api(`/api/finance/itens/${item.id}`, { method: "DELETE" }), "Item apagado, com todos os meses.")) onClose(); }} onCancel={() => setConfirma(false)} />}
    </form>
  );
}

function ConfigPanel({ data, run }: { data: Payload; run: Run }) {
  const c = data.config;
  const [adi, setAdi] = useState(String(c.adiantamento_pct));
  const [diaAdi, setDiaAdi] = useState(String(c.dia_adiantamento));
  const [diaRest, setDiaRest] = useState(String(c.dia_restante));
  const [receita, setReceita] = useState(c.receita_principal_id ?? "");
  const [cartao, setCartao] = useState(c.cartao_principal_id ?? "");
  const receitas = data.itens.filter((i) => i.tipo === "receita");
  const despesas = data.itens.filter((i) => i.tipo === "despesa");
  return (
    <details className="panel">
      <summary className="panel-head"><h2><Icon name="gear" size={18} />Configurar recebimentos e cartão</h2></summary>
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); void run(api("/api/finance/config", { method: "PUT", body: JSON.stringify({ adiantamento_pct: Number(adi.replace(",", ".")), dia_adiantamento: Number(diaAdi), dia_restante: Number(diaRest), receita_principal_id: receita || null, cartao_principal_id: cartao || null }) }), "Configuração salva."); }}>
        <label className="fld"><span>Receita principal (salário)</span>
          <select className="field" value={receita} onChange={(e) => setReceita(e.target.value)}><option value="">Nenhuma</option>{receitas.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}</select>
        </label>
        <div className="grid-3">
          <Field label="% no adiantamento"><input className="field" inputMode="decimal" value={adi} onChange={(e) => setAdi(e.target.value)} /></Field>
          <Field label="Dia do adiantamento"><input className="field" inputMode="numeric" value={diaAdi} onChange={(e) => setDiaAdi(e.target.value.replace(/\D/g, "").slice(0, 2))} /></Field>
          <Field label="Dia do restante"><input className="field" inputMode="numeric" value={diaRest} onChange={(e) => setDiaRest(e.target.value.replace(/\D/g, "").slice(0, 2))} /></Field>
        </div>
        <label className="fld"><span>Cartão principal (fatura)</span>
          <select className="field" value={cartao} onChange={(e) => setCartao(e.target.value)}><option value="">Nenhum</option>{despesas.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}</select>
        </label>
        <p className="muted small">Com 0% de adiantamento, a receita entra inteira no dia dela. Gastos no crédito não somam de novo quando o cartão principal tem fatura no mês.</p>
        <div className="form-actions"><button className="btn btn-pri" type="submit">Salvar</button></div>
      </form>
    </details>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
function DiaADia({ data, ano, mes, isAtual, run }: { data: Payload; ano: number; mes: number; isAtual: boolean; run: Run }) {
  const [valor, setValor] = useState("");
  const [cat, setCat] = useState<string>("Mercado");
  const [meio, setMeio] = useState<Meio>("debito");
  const [dia, setDia] = useState(isAtual ? String(Number(todayKey().slice(8, 10))) : "1");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  useEffect(() => { setDia(isAtual ? String(Number(todayKey().slice(8, 10))) : "1"); }, [isAtual, ano, mes]);

  async function lancar(e: React.FormEvent) {
    e.preventDefault();
    if (!valor.trim()) return;
    setBusy(true);
    const ok = await run(api("/api/finance/gastos", { method: "POST", body: JSON.stringify({ ano, mes, dia: Number(dia || 1), valor: valor.trim(), categoria: cat, descricao: desc, meio, origem: "manual" }) }), "Gasto lançado.");
    setBusy(false);
    if (ok) { setValor(""); setDesc(""); }
  }
  const porDia = useMemo(() => {
    const m = new Map<number, Gasto[]>();
    for (const g of data.gastos) m.set(g.dia, [...(m.get(g.dia) ?? []), g]);
    return [...m.entries()].sort((a, b) => b[0] - a[0]);
  }, [data.gastos]);

  return (
    <>
      <Panel title="Lançar gasto" icon="plus">
        <form className="fin-edit" onSubmit={lancar} aria-label="Lançar gasto">
          <div className="two">
            <Field label="Valor (R$)"><input id="fin-valor" className="field" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" required /></Field>
            <Field label="Dia"><input className="field" inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value.replace(/\D/g, "").slice(0, 2))} required /></Field>
          </div>
          <div className="chips" role="group" aria-label="Categoria">{CATEGORIAS.map((c) => <button type="button" key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}</div>
          <div className="seg" role="group" aria-label="Meio de pagamento">{MEIOS.map((m) => <button type="button" key={m} aria-selected={meio === m} onClick={() => setMeio(m)}>{MEIO_LABEL[m]}</button>)}</div>
          <label className="fld"><span>Descrição <em className="opt">(opcional)</em></span><input className="field" value={desc} maxLength={200} onChange={(e) => setDesc(e.target.value)} placeholder="Ex.: mercado do bairro" /></label>
          <div className="form-actions"><button className="btn btn-pri" type="submit" disabled={busy}>{busy ? "Lançando…" : "Lançar"}</button></div>
        </form>
        <p className="muted small">Também dá para falar: “gastei 45 no mercado no pix”. O GaDu prepara o lançamento e você confirma.</p>
      </Panel>
      <Panel title="Gastos do mês" icon="coin">
        {data.gastos.length === 0 ? (
          <EmptyState icon="coin" title="Nenhum gasto neste mês" text="Lance acima ou fale com o GaDu." phrase="Gastei 45 no mercado no pix" />
        ) : porDia.map(([d, lista]) => (
          <div key={d}>
            <h3 className="fin-grp">Dia {String(d).padStart(2, "0")}/{String(mes).padStart(2, "0")}</h3>
            <div className="rows">
              {lista.map((g) => (
                <div key={g.id}>
                  <div className="fin-row">
                    <div className="grow"><span className="t">{g.descricao || g.categoria}</span><span className="s">{g.categoria} · {MEIO_LABEL[g.meio]}{g.meio === "credito" && data.resumo.credito.naFatura ? " · já na fatura" : ""}{g.origem !== "manual" ? ` · ${g.origem}` : ""}</span></div>
                    <button className="fin-val fin-num" aria-expanded={editando === g.id} aria-label={`Editar gasto de ${formatBRL(g.valor)}, ${g.categoria}`} onClick={() => setEditando(editando === g.id ? null : g.id)}>{formatBRL(g.valor)}</button>
                  </div>
                  {editando === g.id && <GastoEditor g={g} run={run} onClose={() => setEditando(null)} />}
                </div>
              ))}
            </div>
          </div>
        ))}
      </Panel>
    </>
  );
}

function GastoEditor({ g, run, onClose }: { g: Gasto; run: Run; onClose: () => void }) {
  const [valor, setValor] = useState(String(g.valor).replace(".", ","));
  const [dia, setDia] = useState(String(g.dia));
  const [cat, setCat] = useState(g.categoria);
  const [meio, setMeio] = useState<Meio>(g.meio);
  const [desc, setDesc] = useState(g.descricao);
  const [confirma, setConfirma] = useState(false);
  return (
    <form className="fin-edit" aria-label="Editar gasto" onSubmit={async (e) => { e.preventDefault(); if (await run(api(`/api/finance/gastos/${g.id}`, { method: "PATCH", body: JSON.stringify({ valor: valor.trim(), dia: Number(dia), categoria: cat, meio, descricao: desc }) }), "Gasto atualizado.")) onClose(); }}>
      <div className="two">
        <Field label="Valor (R$)"><input id="fin-valor" className="field" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} required /></Field>
        <Field label="Dia"><input className="field" inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value.replace(/\D/g, "").slice(0, 2))} required /></Field>
      </div>
      <Field label="Categoria"><input className="field" list="fin-cats" value={cat} maxLength={40} onChange={(e) => setCat(e.target.value)} required /></Field>
      <datalist id="fin-cats">{CATEGORIAS.map((c) => <option key={c} value={c} />)}</datalist>
      <div className="seg" role="group" aria-label="Meio de pagamento">{MEIOS.map((m) => <button type="button" key={m} aria-selected={meio === m} onClick={() => setMeio(m)}>{MEIO_LABEL[m]}</button>)}</div>
      <Field label="Descrição"><input className="field" value={desc} maxLength={200} onChange={(e) => setDesc(e.target.value)} /></Field>
      <div className="form-actions">
        <button className="btn btn-pri" type="submit">Salvar</button>
        <button className="btn" type="button" onClick={onClose}>Cancelar</button>
        {!confirma && <button className="btn btn-bad" type="button" onClick={() => setConfirma(true)}>Apagar</button>}
      </div>
      {confirma && <ConfirmCard danger icon="coin" title="Apagar este gasto?" detail="Dá para desfazer logo depois." confirmLabel="Apagar" onConfirm={async () => { if (await run(api(`/api/finance/gastos/${g.id}`, { method: "DELETE" }), "Gasto apagado.", () => api("/api/finance/gastos", { method: "POST", body: JSON.stringify({ ano: g.ano, mes: g.mes, dia: g.dia, valor: g.valor, categoria: g.categoria, descricao: g.descricao, meio: g.meio, origem: g.origem }) }))) onClose(); }} onCancel={() => setConfirma(false)} />}
    </form>
  );
}
