import assert from "node:assert/strict";
import { test } from "node:test";
import { blocoSalario, calcularPedido, dependentesDoTexto, pedeSalvarSalario, pedidoSalario, resumoSalario, valorDoTexto } from "./salario-texto.ts";
import { formatBRL } from "./money.ts";
import { calcularSalario } from "./salario.ts";

test("valorDoTexto: mil, k, pontos e vírgulas; ignora o número dos dependentes", () => {
  const ok: [string, number][] = [["salário de 8 mil", 8000], ["8mil", 8000], ["8,5 mil", 8500], ["8k", 8000], ["R$ 8.500,50", 8500.5], ["8000", 8000], ["R$ 1.621", 1621], ["salário de 5000,00 reais", 5000], ["2 dependentes e 6 mil", 6000]];
  for (const [t, v] of ok) assert.equal(valorDoTexto(t), v, t);
  for (const t of ["", "quanto fica líquido", "tenho 2 dependentes", "salário de 50"]) assert.equal(valorDoTexto(t), null, t);
});

test("dependentesDoTexto", () => {
  assert.equal(dependentesDoTexto("com 2 dependentes"), 2);
  assert.equal(dependentesDoTexto("com dois dependentes"), 2);
  assert.equal(dependentesDoTexto("um dependente"), 1);
  assert.equal(dependentesDoTexto("sem dependentes"), 0);
  assert.equal(dependentesDoTexto("com 3 filhos dependentes"), 3);
  assert.equal(dependentesDoTexto("salário de 8 mil"), 0);
  assert.equal(dependentesDoTexto("99 dependentes"), 0, "acima do limite: ignora");
});

test("pedidoSalario: frases comuns", () => {
  assert.deepEqual(pedidoSalario("Quanto fica líquido um salário de 8 mil?"), { bruto: 8000, dependentes: 0 });
  assert.deepEqual(pedidoSalario("quanto sobra de um salário bruto de R$ 6.500 com 2 dependentes"), { bruto: 6500, dependentes: 2 });
  assert.deepEqual(pedidoSalario("qual o líquido de um salário de 4500?"), { bruto: 4500, dependentes: 0 });
  assert.deepEqual(pedidoSalario("quanto desconta de INSS e imposto de renda num salário de 12 mil"), { bruto: 12000, dependentes: 0 });
});

test("pedidoSalario: não dispara em conversa comum", () => {
  for (const t of ["gastei 45 no mercado", "paguei o salário da moça, 1500", "quanto é 8 mil mais 2 mil", "qual o salário mínimo", "me lembra do aluguel de 2000", "o líquido da conta de luz foi 200"]) assert.equal(pedidoSalario(t), null, t);
});

test("resumo e bloco do contexto usam só os números do cálculo", () => {
  const s = calcularSalario(8000)!;
  const r = resumoSalario(s);
  assert.match(r, /líquido R\$ 6\.040,64/);
  assert.match(r, /INSS R\$ 921,51/);
  assert.match(r, /imposto de renda R\$ 1\.037,85/);
  const b = blocoSalario({ bruto: 8000, dependentes: 0 })!;
  assert.ok(b.includes(r) && /não calcule/.test(b));
  assert.equal(blocoSalario({ bruto: -1, dependentes: 0 }), null);
  assert.match(resumoSalario(calcularSalario(3000, 2)!), /isento/);
  assert.match(resumoSalario(calcularSalario(5000.03)!), /até R\$ 10/);
});

test("pedidoSalario: a frase do Eduardo (voz) e as frases com dependentes, outras deduções e benefícios", () => {
  assert.deepEqual(pedidoSalario("quanto fica líquido um salário de 12 mil?"), { bruto: 12000, dependentes: 0 });
  assert.deepEqual(pedidoSalario("Quanto fica líquido um salário de 12 mil com 2 dependentes?"), { bruto: 12000, dependentes: 2 });
  assert.deepEqual(pedidoSalario("quanto fica líquido um salário de 12 mil descontando 500 de previdência?"), { bruto: 12000, dependentes: 0, outrasDeducoes: 500 });
  assert.deepEqual(pedidoSalario("líquido de um salário de 8 mil com pensão alimentícia de 1.200"), { bruto: 8000, dependentes: 0, outrasDeducoes: 1200 });
  assert.deepEqual(pedidoSalario("quanto fica líquido um salário de 9 mil com 800 de benefícios"), { bruto: 9000, dependentes: 0, beneficios: 800 });
  assert.deepEqual(pedidoSalario("com 800 de vale refeição, quanto fica líquido o salário de 6.500 com 1 dependente e 300 de previdência privada"), { bruto: 6500, dependentes: 1, outrasDeducoes: 300, beneficios: 800 });
});

test("pedidoSalario: valores que não fecham são ignorados (0), e nunca viram o salário", () => {
  // outras deduções maiores que o salário: ignora o campo, mantém o salário
  assert.deepEqual(pedidoSalario("quanto fica líquido um salário de 2 mil descontando 9 mil de pensão"), { bruto: 2000, dependentes: 0 });
  // sem salário dito, não inventa um a partir do benefício
  assert.equal(pedidoSalario("quanto fica líquido com 800 de benefícios, no salário"), null);
  // "va" dentro de outra palavra não é benefício
  assert.deepEqual(pedidoSalario("quanto vai ficar líquido o salário de 8 mil"), { bruto: 8000, dependentes: 0 });
});

test("pedeSalvarSalario: só quando a pessoa pede para guardar", () => {
  assert.equal(pedeSalvarSalario("salva o líquido de um salário de 12 mil como salário do mês"), true);
  assert.equal(pedeSalvarSalario("guarda o líquido como meu salário"), true);
  assert.equal(pedeSalvarSalario("quanto fica líquido um salário de 12 mil?"), false);
});

test("resumo falado: líquido, benefícios e estimativas de 13º e férias, tudo de calcularSalario", () => {
  const p = pedidoSalario("quanto fica líquido um salário de 12 mil?")!;
  const s = calcularPedido(p)!;
  const r = resumoSalario(s);
  assert.match(r, /líquido R\$ 8\.892,36 \(74,1% do bruto\)/);
  assert.match(r, /INSS R\$ 988,09, imposto de renda R\$ 2\.119,55/);
  assert.match(r, /Estimativas: 13º líquido de R\$ 8\.892,36 e férias com um terço líquidas de /);
  assert.ok(r.includes(formatBRL(s.ferias.liquido)));
  assert.ok(!/benefícios|outras deduções/.test(r));
  assert.ok(!/Estimativas/.test(resumoSalario(s, { estimativas: false })));
  const c = calcularSalario(12000, 0, { outrasDeducoes: 500, beneficios: 800 })!;
  const rc = resumoSalario(c);
  assert.match(rc, /outras deduções R\$ 500,00, líquido R\$ 8\.529,86/);
  assert.match(rc, /Com R\$ 800,00 de benefícios, você recebe R\$ 9\.329,86 no total/);
  assert.equal(calcularPedido({ bruto: 12000, dependentes: 0, outrasDeducoes: 500, beneficios: 800 })!.totalRecebido, 9329.86);
});
