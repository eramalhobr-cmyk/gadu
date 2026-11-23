"use client";
// Simulador de salário bruto → líquido (aba "Salário" do Financeiro). O cálculo é calcularSalario (src/lib/finance/salario.ts),
// o mesmo da conversa e da voz; esta tela não calcula nada por conta própria. Salvar grava o líquido MENSAL (não o 13º nem as férias)
// na receita principal do mês, pela rota do Financeiro (sessão + RLS), e tem Desfazer.
import { useMemo, useState } from "react";
import { formatBRL, parseValor } from "@/lib/finance/money";
import { calcularSalario, INSS_TETO_CENTAVOS, MAX_DEPENDENTES, SALARIO_ANO, SALARIO_FONTES, type Pagamento } from "@/lib/finance/salario";
import { resumoSalario } from "@/lib/finance/salario-texto";
import { MESES, type Config } from "@/lib/finance/types";
import type { ItemComMes } from "@/lib/finance/month";
import { Kpi, KpiRow, PainelHead, Stack } from "./charts";
import { Field, Panel } from "./kit";

type Resp = Promise<{ ok: boolean; json: Record<string, unknown> }>;
type Run = (p: Resp, okText: string, undo?: () => Resp) => Promise<boolean>;

const pct = (n: number) => `${String(n).replace(".", ",")}%`;
const TETO_INSS = formatBRL(INSS_TETO_CENTAVOS / 100);

/** Campo opcional em reais: vazio ou zero = 0; texto que não é valor = null (inválido, nunca adivinha). */
function opcional(texto: string): number | null {
  const t = texto.trim();
  if (!t || /^0+(?:[.,]0{1,2})?$/.test(t)) return 0;
  return parseValor(t);
}

function LinhaPagamento({ nome, p }: { nome: string; p: Pagamento }) {
  return (
    <div className="sal-est" role="listitem" aria-label={`${nome}: bruto ${formatBRL(p.bruto)}, INSS ${formatBRL(p.inss)}, imposto de renda ${formatBRL(p.irrf)}, líquido ${formatBRL(p.liquido)}`}>
      <b className="sal-est-n">{nome}</b>
      <span className="muted">Bruto <span className="fin-num num">{formatBRL(p.bruto)}</span></span>
      <span className="muted">INSS <span className="fin-num num">− {formatBRL(p.inss)}</span></span>
      <span className="muted">Imposto <span className="fin-num num">− {formatBRL(p.irrf)}</span></span>
      <span className="sal-est-l">Líquido <b className="fin-num num ok">{formatBRL(p.liquido)}</b></span>
    </div>
  );
}

export function SalarioSimulador({ config, itens, ano, mes, run }: { config: Config; itens: ItemComMes[]; ano: number; mes: number; run: Run }) {
  const [bruto, setBruto] = useState("");
  const [dep, setDep] = useState("0");
  const [outras, setOutras] = useState("");
  const [benef, setBenef] = useState("");
  const valor = bruto.trim() ? parseValor(bruto) : null;
  const dependentes = dep === "" ? 0 : Number(dep);
  const outrasV = opcional(outras), benefV = opcional(benef);
  const s = useMemo(
    () => (valor === null || outrasV === null || benefV === null ? null : calcularSalario(valor, dependentes, { outrasDeducoes: outrasV, beneficios: benefV })),
    [valor, dependentes, outrasV, benefV],
  );
  const alvo = itens.find((i) => i.tipo === "receita" && i.id === config.receita_principal_id) ?? null;

  function salvar() {
    if (!s || !alvo) return;
    const put = (v: number): Resp => fetch(`/api/finance/itens/${alvo.id}/mes`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ano, mes, valor: v, escopo: "mes" }) }).then(async (r) => ({ ok: r.ok, json: (await r.json().catch(() => ({}))) as Record<string, unknown> }));
    const antes = alvo.mes?.valor ?? 0;
    void run(put(s.liquido), `Salário de ${MESES[mes - 1]} salvo.`, () => put(antes));
  }

  const campoRuim = (t: string, v: number | null) => t.trim() !== "" && v === null;

  return (
    <div className="stack">
      <Panel title="Quanto fica líquido?" icon="coin">
        <p className="muted">Digite o salário bruto. O cálculo usa as tabelas de {SALARIO_ANO} do INSS e do imposto de renda.</p>
        <p className="sal-diga">Diga: <q>quanto fica líquido um salário de 12 mil?</q></p>
        <form className="form-grid" onSubmit={(e) => e.preventDefault()}>
          <Field label="Salário bruto (R$)"><input id="sal-bruto" className="field" inputMode="decimal" placeholder="8000" value={bruto} onChange={(e) => setBruto(e.target.value)} aria-invalid={bruto.trim() !== "" && valor === null} /></Field>
          <Field label="Dependentes" hint={`até ${MAX_DEPENDENTES}`}><input id="sal-dep" className="field" inputMode="numeric" value={dep} onChange={(e) => setDep(e.target.value.replace(/\D/g, "").slice(0, 2))} /></Field>
          <Field label="Outras deduções do IR (R$)" hint="pensão, previdência privada"><input id="sal-outras" className="field" inputMode="decimal" placeholder="0" value={outras} onChange={(e) => setOutras(e.target.value)} aria-invalid={campoRuim(outras, outrasV)} aria-describedby="sal-outras-d" /></Field>
          <Field label="Benefícios (R$)" hint="VR, VA: sem imposto"><input id="sal-benef" className="field" inputMode="decimal" placeholder="0" value={benef} onChange={(e) => setBenef(e.target.value)} aria-invalid={campoRuim(benef, benefV)} aria-describedby="sal-outras-d" /></Field>
        </form>
        <p className="muted small" id="sal-outras-d">Outras deduções abatem o imposto e saem do líquido; não mudam o INSS. Benefícios não pagam INSS nem imposto e só entram no total recebido.</p>
        {bruto.trim() !== "" && valor === null && <p className="muted small" role="alert">Confira o valor. Exemplo: 8000 ou 8.000,50.</p>}
        {(campoRuim(outras, outrasV) || campoRuim(benef, benefV)) && <p className="muted small" role="alert">Confira os campos opcionais: use só números, como 500 ou 800,50.</p>}
        {valor !== null && outrasV !== null && benefV !== null && !s && <p className="muted small" role="alert">{Number.isInteger(dependentes) && dependentes >= 0 && dependentes <= MAX_DEPENDENTES ? "As outras deduções passam do que sobra do salário. Confira o valor." : `Confira os dependentes: de 0 a ${MAX_DEPENDENTES}.`}</p>}
      </Panel>

      {s && (
        <section className="pnl" id="painel-salario" aria-labelledby="sal-res">
          <PainelHead id="sal-res" title="Resultado" dica={`tabelas de ${SALARIO_ANO}`} fala={resumoSalario(s)} />
          <div className="hud-frame pnl-box">
            <KpiRow label="Resumo do salário">
              <Kpi label="Líquido" tone="ok" value={<span className="fin-num num" aria-label={`Salário líquido: ${formatBRL(s.liquido)}`}>{formatBRL(s.liquido)}</span>} sub={`de ${formatBRL(s.bruto)} bruto`} />
              <Kpi label="% do bruto" value={<span className="fin-num num">{pct(s.pctLiquido)}</span>} sub="fica com você" />
              {s.beneficios > 0 && <Kpi label="Líquido + benefícios" tone="ok" value={<span className="fin-num num" aria-label={`Total recebido: ${formatBRL(s.totalRecebido)}`}>{formatBRL(s.totalRecebido)}</span>} sub={`${formatBRL(s.beneficios)} de benefícios`} />}
            </KpiRow>
            <Stack label="Composição do salário bruto" fmt={formatBRL} parts={[
              { n: s.liquido, label: "Líquido", tone: "ok" },
              { n: s.inss, label: "INSS", tone: "sig" },
              { n: s.irrf, label: "Imposto de renda", tone: "hot" },
              { n: s.outrasDeducoes, label: "Outras deduções", tone: "mut" },
            ]} />
            <div className="sal-rows" role="list" aria-label="Passo a passo">
              <div role="listitem"><span>Salário bruto</span><b className="fin-num num">{formatBRL(s.bruto)}</b></div>
              <div role="listitem"><span>INSS</span><b className="fin-num num">− {formatBRL(s.inss)}</b></div>
              <div role="listitem"><span>Imposto de renda</span><b className="fin-num num">− {formatBRL(s.irrf)}</b></div>
              {s.outrasDeducoes > 0 && <div role="listitem"><span>Outras deduções</span><b className="fin-num num">− {formatBRL(s.outrasDeducoes)}</b></div>}
              <div role="listitem" className="sal-total"><span>Líquido</span><b className="fin-num num ok">{formatBRL(s.liquido)}</b></div>
              {s.beneficios > 0 && <div role="listitem"><span>Mais benefícios</span><b className="fin-num num">+ {formatBRL(s.beneficios)}</b></div>}
            </div>
            {s.irrfDispensado && <p className="muted small">O imposto deu até R$ 10,00, e a lei dispensa a retenção.</p>}
            <details className="sal-det">
              <summary>Como foi calculado</summary>
              <ul className="sal-list">
                {s.inssFaixas.map((f) => <li key={f.de}>INSS {pct(f.aliquota)} sobre {formatBRL(f.base)}: {formatBRL(f.valor)}</li>)}
                <li>Total do INSS: {formatBRL(s.inss)} (a soma exata, arredondada uma vez no fim){s.bruto > INSS_TETO_CENTAVOS / 100 ? `; o INSS para no teto de ${TETO_INSS}` : ""}. As outras deduções não entram nessa conta.</li>
                <li>Para o imposto, vale a maior dedução: {s.modelo === "simplificado" ? `desconto simplificado de ${formatBRL(s.deducaoSimplificada)}` : `INSS${s.dependentes ? ", dependentes" : ""}${s.outrasDeducoes > 0 ? " e outras deduções" : ""}, ${formatBRL(s.deducaoLegal)}`} (a outra seria {formatBRL(s.modelo === "simplificado" ? s.deducaoLegal : s.deducaoSimplificada)}).</li>
                <li>Base do imposto: {formatBRL(s.baseIr)}. Pela tabela ({s.aliquotaIr === 0 ? "isento" : pct(s.aliquotaIr)}): {formatBRL(s.impostoTabela)}.</li>
                <li>Redução da Lei 15.270/2025, sobre o rendimento de {formatBRL(s.bruto)}: − {formatBRL(s.reducao)}.</li>
              </ul>
            </details>
          </div>

          <div className="hud-frame pnl-box" role="group" aria-labelledby="sal-est-h">
            <h3 className="pnl-sub" id="sal-est-h">Estimativas: 13º e férias + 1/3</h3>
            <div className="sal-ests" role="list" aria-label="Estimativas de 13º e férias">
              <LinhaPagamento nome="13º salário" p={s.decimoTerceiro} />
              <LinhaPagamento nome="Férias + 1/3" p={s.ferias} />
            </div>
            <p className="muted small">São estimativas. Cada pagamento tem INSS (com teto) e imposto próprios. O 13º é calculado como se fosse pago em uma parcela. As férias são o bruto × 4/3, sem abono, sem venda de férias e sem pagamento junto com o mensal. Dependentes e outras deduções entram como no mês.</p>
          </div>

          {alvo ? (
            <div className="form-actions">
              <button className="btn btn-pri" onClick={salvar}>Salvar líquido mensal como salário de {MESES[mes - 1]}</button>
              <span className="muted small">Grava {formatBRL(s.liquido)} (o líquido do mês, sem 13º, férias e benefícios) em “{alvo.nome}”{alvo.mes ? ` (hoje ${formatBRL(alvo.mes.valor)})` : ""}. Dá para desfazer.</span>
            </div>
          ) : (
            <p className="muted small">Para guardar o líquido como salário do mês, escolha a receita principal em Contas › Configurar recebimentos e cartão.</p>
          )}
          <p className="muted small">Estimativa para empregado (CLT). Não inclui PLR nem outras verbas. Fontes:{" "}
            {SALARIO_FONTES.map((f, i) => <span key={f.url}>{i > 0 && "; "}<a href={f.url} target="_blank" rel="noopener noreferrer">{f.nome}</a></span>)}.
          </p>
        </section>
      )}
      {!s && <p className="muted small">Digite o salário bruto acima para ver o resultado. Também dá para perguntar ao GaDu: “quanto fica líquido um salário de 12 mil?”.</p>}
    </div>
  );
}
