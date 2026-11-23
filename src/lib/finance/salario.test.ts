// Valores de referência calculados à parte, em Decimal (fora do TypeScript), com as tabelas de 2026 citadas em salario.ts.
import assert from "node:assert/strict";
import { test } from "node:test";
import { calcularSalario, INSS_FAIXAS, INSS_TETO_CENTAVOS, SALARIO_FONTES } from "./salario.ts";

type Esperado = [bruto: number, dep: number, inss: number, modelo: "legal" | "simplificado", baseIr: number, impostoTabela: number, reducao: number, irrf: number, liquido: number];
const CASOS: Esperado[] = [
  [1621, 0, 121.58, "simplificado", 1013.8, 0, 0, 0, 1499.42], // 1ª faixa inteira do INSS; isento
  [2000, 0, 155.69, "simplificado", 1392.8, 0, 0, 0, 1844.31],
  [3000, 0, 248.6, "simplificado", 2392.8, 0, 0, 0, 2751.4], // base logo abaixo de 2.428,80
  [3500, 1, 308.6, "simplificado", 2892.8, 39.76, 39.76, 0, 3191.4], // tabela cobra, a redução zera
  [4000, 0, 368.6, "simplificado", 3392.8, 114.76, 114.76, 0, 3631.4],
  [5000, 0, 501.51, "simplificado", 4392.8, 312.89, 312.89, 0, 4498.49], // limite da redução total
  [5000.01, 0, 501.52, "simplificado", 4392.81, 312.89, 312.89, 0, 4498.49], // 1ª linha da redução parcial: contínua com a anterior
  [5900, 0, 627.51, "legal", 5272.49, 541.2, 193.06, 348.14, 4924.35], // 978,62 − 0,133145 × 5.900 = 193,06
  [6500, 2, 711.51, "legal", 5409.31, 578.83, 113.18, 465.65, 5322.84],
  [7350, 0, 830.51, "legal", 6519.49, 884.13, 0, 884.13, 5635.36], // fim da redução parcial: zero
  [7350.01, 0, 830.52, "legal", 6519.49, 884.13, 0, 884.13, 5635.36],
  [8000, 0, 921.51, "legal", 7078.49, 1037.85, 0, 1037.85, 6040.64],
  [10000, 0, 988.09, "legal", 9011.91, 1569.55, 0, 1569.55, 7442.36], // acima do teto do INSS
  [15000, 3, 988.09, "legal", 13443.14, 2788.13, 0, 2788.13, 11223.78],
  [1518, 0, 113.85, "simplificado", 910.8, 0, 0, 0, 1404.15],
  [3200, 2, 272.6, "legal", 2548.22, 8.96, 8.96, 0, 2927.4], // dependentes: dedução legal passa a vencer
];

test("calcularSalario: casos de referência (INSS, IRRF, redução, líquido) em todas as faixas", () => {
  for (const [bruto, dep, inss, modelo, baseIr, impostoTabela, reducao, irrf, liquido] of CASOS) {
    const s = calcularSalario(bruto, dep)!;
    assert.ok(s, `bruto ${bruto}`);
    assert.deepEqual(
      { inss: s.inss, modelo: s.modelo, baseIr: s.baseIr, impostoTabela: s.impostoTabela, reducao: s.reducao, irrf: s.irrf, liquido: s.liquido },
      { inss, modelo, baseIr, impostoTabela, reducao, irrf, liquido },
      `bruto ${bruto} com ${dep} dependente(s)`,
    );
  }
});

test("INSS: progressivo faixa a faixa e limitado ao teto de R$ 8.475,55 (máximo R$ 988,09)", () => {
  const f = calcularSalario(4000)!.inssFaixas;
  assert.deepEqual(f.map((x) => [x.aliquota, x.base, x.valor]), [[7.5, 1621, 121.58], [9, 1281.84, 115.37], [12, 1097.16, 131.66]]);
  assert.equal(f.length, 3, "só as faixas que pegaram parte do salário");
  assert.equal(calcularSalario(8475.55)!.inss, 988.09);
  assert.equal(calcularSalario(8475.56)!.inss, 988.09, "acima do teto não paga mais");
  assert.equal(calcularSalario(1_000_000)!.inss, 988.09);
  assert.equal(INSS_TETO_CENTAVOS, INSS_FAIXAS[INSS_FAIXAS.length - 1].ateCentavos, "o teto é o fim da última faixa");
  assert.equal(calcularSalario(1000)!.inss, 75, "abaixo da 1ª faixa: 7,5% do salário");
});

test("IRRF: o modelo mais vantajoso vence (legal x simplificado) e dependente pesa na dedução", () => {
  const sem = calcularSalario(3200, 0)!, com = calcularSalario(3200, 2)!;
  assert.equal(sem.modelo, "simplificado");
  assert.equal(sem.deducaoSimplificada, 607.2);
  assert.equal(com.modelo, "legal");
  assert.equal(com.deducaoDependentes, 379.18);
  assert.equal(com.deducaoLegal, 272.6 + 379.18);
  assert.ok(com.irrf <= sem.irrf && com.liquido >= sem.liquido, "dependentes nunca pioram o líquido");
  // empate: o simplificado só vence quando é MAIOR que o legal
  const s = calcularSalario(2000, 0)!;
  assert.ok(s.deducaoSimplificada > s.deducaoLegal);
});

test("Redução (Lei 15.270/2025): zera até R$ 5.000, cai linearmente até R$ 7.350 e some acima", () => {
  for (const b of [2500, 3500, 4500, 5000]) assert.equal(calcularSalario(b)!.irrf, 0, `até 5.000 não retém: ${b}`);
  const r1 = calcularSalario(5500)!, r2 = calcularSalario(6500)!, r3 = calcularSalario(7350)!;
  assert.ok(r1.reducao > r2.reducao && r2.reducao > r3.reducao && r3.reducao === 0);
  assert.ok(r1.reducao <= r1.impostoTabela, "limitada ao imposto da tabela");
  // salto de imposto entre 7.350 e 7.350,01 é de centavos (sem degrau)
  assert.ok(Math.abs(calcularSalario(7350.01)!.irrf - calcularSalario(7350)!.irrf) < 0.05);
});

test("Imposto de até R$ 10 não é retido (art. 67 da Lei 9.430/1996)", () => {
  const s = calcularSalario(5000.03)!;
  assert.equal(s.impostoTabela - s.reducao > 0, true);
  assert.equal(s.irrf, 0);
  assert.equal(s.irrfDispensado, true);
  assert.equal(calcularSalario(5900)!.irrfDispensado, false);
  assert.equal(calcularSalario(3200, 2)!.irrfDispensado, false, "imposto zerado pela redução não é 'dispensa'");
});

test("arredondamento: meio centavo sobe e líquido fecha com bruto − INSS − IRRF", () => {
  for (const b of [1621.01, 2902.85, 4354.28, 5123.45, 6789.01, 8475.55, 9999.99]) {
    const s = calcularSalario(b, 1)!;
    assert.equal(Math.round(s.liquido * 100), Math.round(b * 100) - Math.round(s.inss * 100) - Math.round(s.irrf * 100), String(b));
    assert.equal(Math.round(s.inss * 100) / 100, s.inss, "centavos inteiros");
  }
  assert.equal(calcularSalario(8000)!.pctLiquido, 75.5);
});

test("entradas inválidas devolvem null (nunca adivinha)", () => {
  for (const b of [0, -1, NaN, Infinity, 10_000_001, "8000" as unknown as number, null as unknown as number]) assert.equal(calcularSalario(b), null, String(b));
  for (const d of [-1, 1.5, 21, NaN]) assert.equal(calcularSalario(5000, d), null, String(d));
  assert.equal(calcularSalario(0.004), null, "menos de 1 centavo");
});

test("as fontes oficiais estão citadas", () => {
  assert.equal(SALARIO_FONTES.length, 3);
  for (const f of SALARIO_FONTES) assert.ok(f.url.startsWith("https://www.gov.br/") || f.url.startsWith("https://www.planalto.gov.br/"));
});
