import assert from "node:assert/strict";
import { test } from "node:test";
import { avaliar, ema, forcaRelativa, macd, quedaMaxima, retorno, rsi, sma, valorAte, volatilidadeAnual, type Serie } from "./sinais.ts";

const D0 = 1_700_000_000;
/** Série fictícia: tendência diária + oscilação determinística. */
export function serie(n: number, tendencia: number, amplitude = 0.01, base = 100): Serie {
  const datas: number[] = [], fechamentos: number[] = [];
  let p = base;
  for (let i = 0; i < n; i++) {
    p *= 1 + tendencia + amplitude * Math.sin(i * 1.7);
    datas.push(D0 + i * 86_400);
    fechamentos.push(p);
  }
  return { datas, fechamentos };
}

test("médias, RSI e MACD batem com valores calculados à mão", () => {
  assert.deepEqual(sma([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4]);
  const e = ema([1, 2, 3, 4, 5], 3);
  assert.deepEqual(e.slice(0, 3), [null, null, 2]);
  assert.equal(e[3], 3); // 4*0,5 + 2*0,5
  assert.equal(rsi(Array.from({ length: 20 }, (_, i) => i + 1)).at(-1), 100);
  assert.equal(rsi(Array.from({ length: 20 }, (_, i) => 20 - i)).at(-1), 0);
  const m = macd(Array.from({ length: 60 }, (_, i) => 100 + i));
  assert.ok(m.macd.at(-1)! > 0);
  assert.equal(m.macd[24], null);
  assert.equal(retorno([100, 110, 121], 2)!.toFixed(2), "0.21");
  assert.equal(retorno([1, 2], 5), null);
  assert.equal(quedaMaxima([100, 120, 60, 130, 117]), -0.5);
  assert.equal(volatilidadeAnual([1, 2, 3]), null);
  assert.ok(Math.abs(volatilidadeAnual(Array.from({ length: 60 }, () => 50))!) < 1e-12);
});

test("índice: lê só até a data pedida e mede a força relativa nos mesmos dias", () => {
  const indice: Serie = { datas: [D0, D0 + 86_400, D0 + 2 * 86_400], fechamentos: [100, 110, 999] };
  assert.equal(valorAte(indice, D0 + 86_400 + 3600), 110);
  assert.equal(valorAte(indice, D0 - 86_400), null);
  const acao: Serie = { datas: [D0, D0 + 86_400], fechamentos: [10, 12] };
  assert.equal(forcaRelativa(acao, indice, 1)!.toFixed(2), "0.10"); // 20% - 10%
  assert.equal(forcaRelativa(acao, null, 1), null);
});

test("alta firme dá Compra; queda firme dá Venda; histórico curto não dá sinal", () => {
  const indice = serie(400, 0.0002, 0.004);
  const alta = avaliar(serie(400, 0.002), indice, "Ibovespa");
  assert.equal(alta.sinal, "compra");
  assert.ok(alta.confianca > 0 && alta.confianca <= 85);
  assert.ok(alta.motivos.length >= 1 && alta.motivos.length <= 3);
  assert.ok(alta.motivos.some((m) => /média de 200|Subiu|Ganhou do Ibovespa/.test(m)));
  const queda = avaliar(serie(400, -0.002), indice, "Ibovespa");
  assert.equal(queda.sinal, "venda");
  assert.ok(queda.motivos.some((m) => /abaixo|Caiu|Perdeu/.test(m)));
  const curta = avaliar(serie(30, 0.002), indice);
  assert.equal(curta.sinal, "sem_dados");
  assert.equal(curta.confianca, 0);
});

test("cada analista dá nota entre -1 e +1 e o consolidado nunca inventa valuation", () => {
  for (const t of [-0.003, -0.001, 0, 0.001, 0.003]) {
    const a = avaliar(serie(500, t, 0.03), serie(500, 0.0003), "S&P 500 (SPY)");
    for (const x of a.analistas) if (x.nota !== null) assert.ok(x.nota >= -1 && x.nota <= 1, `${x.id} ${x.nota}`);
    assert.deepEqual(a.analistas.map((x) => x.id), ["tendencia", "momento", "forca", "risco"]);
    assert.ok(!a.motivos.some((m) => /lucro|P\/L|valuation|preço-alvo/i.test(m)));
  }
});

test("só olha a janela final: dados antigos além de 300 pregões não mudam o sinal", () => {
  const s = serie(600, 0.001, 0.02);
  const mexida = { datas: s.datas, fechamentos: s.fechamentos.map((v, i) => (i < 200 ? v * 3 : v)) };
  assert.deepEqual(avaliar(s, null), avaliar(mexida, null));
});
