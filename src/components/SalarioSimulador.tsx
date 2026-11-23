"use client";
// Simulador de salário bruto → líquido (aba "Salário" do Financeiro). O cálculo é calcularSalario (src/lib/finance/salario.ts),
// o mesmo da conversa; esta tela não calcula nada por conta própria. Salvar grava o líquido na receita principal do mês, pela rota
// do Financeiro (sessão + RLS), e tem Desfazer.
import { useMemo, useState } from "react";
import { formatBRL, parseValor } from "@/lib/finance/money";
import { calcularSalario, MAX_DEPENDENTES, SALARIO_ANO, SALARIO_FONTES } from "@/lib/finance/salario";
import { MESES, type Config } from "@/lib/finance/types";
import type { ItemComMes } from "@/lib/finance/month";
import { Field, Panel } from "./kit";

type Resp = Promise<{ ok: boolean; json: Record<string, unknown> }>;
type Run = (p: Resp, okText: string, undo?: () => Resp) => Promise<boolean>;

const pct = (n: number) => `${String(n).replace(".", ",")}%`;

export function SalarioSimulador({ config, itens, ano, mes, run }: { config: Config; itens: ItemComMes[]; ano: number; mes: number; run: Run }) {
  const [bruto, setBruto] = useState("");
  const [dep, setDep] = useState("0");
  const valor = bruto.trim() ? parseValor(bruto) : null;
  const dependentes = dep === "" ? 0 : Number(dep);
  const s = useMemo(() => (valor === null ? null : calcularSalario(valor, dependentes)), [valor, dependentes]);
  const alvo = itens.find((i) => i.tipo === "receita" && i.id === config.receita_principal_id) ?? null;

  function salvar() {
    if (!s || !alvo) return;
    const put = (v: number): Resp => fetch(`/api/finance/itens/${alvo.id}/mes`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ano, mes, valor: v, escopo: "mes" }) }).then(async (r) => ({ ok: r.ok, json: (await r.json().catch(() => ({}))) as Record<string, unknown> }));
    const antes = alvo.mes?.valor ?? 0;
    void run(put(s.liquido), `Salário de ${MESES[mes - 1]} salvo.`, () => put(antes));
  }

  return (
    <div className="stack">
      <Panel title="Quanto fica líquido?" icon="coin">
        <p className="muted">Digite o salário bruto. O cálculo usa as tabelas de {SALARIO_ANO} do INSS e do imposto de renda.</p>
        <form className="form-grid" onSubmit={(e) => e.preventDefault()}>
          <Field label="Salário bruto (R$)"><input id="sal-bruto" className="field" inputMode="decimal" placeholder="8000" value={bruto} onChange={(e) => setBruto(e.target.value)} aria-invalid={bruto.trim() !== "" && valor === null} /></Field>
          <Field label="Dependentes" hint={`até ${MAX_DEPENDENTES}`}><input className="field" inputMode="numeric" value={dep} onChange={(e) => setDep(e.target.value.replace(/\D/g, "").slice(0, 2))} /></Field>
        </form>
        {bruto.trim() !== "" && valor === null && <p className="muted small" role="alert">Confira o valor. Exemplo: 8000 ou 8.000,50.</p>}
        {valor !== null && !s && <p className="muted small" role="alert">Confira os dependentes: de 0 a {MAX_DEPENDENTES}.</p>}
      </Panel>

      {s && (
        <Panel title="Resultado" icon="check">
          <span className="fin-big fin-num ok" aria-label={`Salário líquido: ${formatBRL(s.liquido)}`}>{formatBRL(s.liquido)}</span>
          <span className="muted">{pct(s.pctLiquido)} do bruto de {formatBRL(s.bruto)}</span>
          <div className="sal-rows" role="list" aria-label="Passo a passo">
            <div role="listitem"><span>Salário bruto</span><b className="fin-num">{formatBRL(s.bruto)}</b></div>
            <div role="listitem"><span>INSS</span><b className="fin-num">− {formatBRL(s.inss)}</b></div>
            <div role="listitem"><span>Imposto de renda</span><b className="fin-num">− {formatBRL(s.irrf)}</b></div>
            <div role="listitem" className="sal-total"><span>Líquido</span><b className="fin-num ok">{formatBRL(s.liquido)}</b></div>
          </div>
          {s.irrfDispensado && <p className="muted small">O imposto deu até R$ 10,00, e a lei dispensa a retenção.</p>}
          <details className="sal-det">
            <summary>Como foi calculado</summary>
            <ul className="sal-list">
              {s.inssFaixas.map((f) => <li key={f.de}>INSS {pct(f.aliquota)} sobre {formatBRL(f.base)}: {formatBRL(f.valor)}</li>)}
              <li>Total do INSS: {formatBRL(s.inss)} (a soma exata, arredondada uma vez no fim){s.bruto > 8475.55 ? "; o INSS para no teto de R$ 8.475,55" : ""}.</li>
              <li>Para o imposto, vale a maior dedução: {s.modelo === "simplificado" ? `desconto simplificado de ${formatBRL(s.deducaoSimplificada)}` : `INSS${s.dependentes ? " e dependentes" : ""}, ${formatBRL(s.deducaoLegal)}`} (a outra seria {formatBRL(s.modelo === "simplificado" ? s.deducaoLegal : s.deducaoSimplificada)}).</li>
              <li>Base do imposto: {formatBRL(s.baseIr)}. Pela tabela ({s.aliquotaIr === 0 ? "isento" : pct(s.aliquotaIr)}): {formatBRL(s.impostoTabela)}.</li>
              <li>Redução da Lei 15.270/2025: − {formatBRL(s.reducao)}.</li>
            </ul>
          </details>
          {alvo ? (
            <div className="form-actions">
              <button className="btn btn-pri" onClick={salvar}>Salvar como salário de {MESES[mes - 1]}</button>
              <span className="muted small">Grava {formatBRL(s.liquido)} em “{alvo.nome}”{alvo.mes ? ` (hoje ${formatBRL(alvo.mes.valor)})` : ""}. Dá para desfazer.</span>
            </div>
          ) : (
            <p className="muted small">Para guardar o líquido como salário do mês, escolha a receita principal em Contas › Configurar recebimentos e cartão.</p>
          )}
          <p className="muted small">Estimativa para salário mensal de empregado (CLT). Não inclui 13º, férias, pensão alimentícia nem outras deduções. Fontes:{" "}
            {SALARIO_FONTES.map((f, i) => <span key={f.url}>{i > 0 && "; "}<a href={f.url} target="_blank" rel="noopener noreferrer">{f.nome}</a></span>)}.
          </p>
        </Panel>
      )}
      {!s && <p className="muted small">Também dá para perguntar ao GaDu: “quanto fica líquido um salário de 8 mil?”.</p>}
    </div>
  );
}
