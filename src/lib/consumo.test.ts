import { test } from "node:test";
import assert from "node:assert/strict";
import { falta, intervaloMes, lerPaginado, MesSchema, mesDe, minutos, pctUsado, porMes, porMotor, porPessoa, porTipo, quantidade, rotuloMes, somarMes, total, ultimosMeses, usd, type LinhaUso } from "./consumo.ts";

const l = (kind: string, cost: number | string, extra: Partial<LinhaUso> = {}): LinhaUso => ({
  provider: "gateway", model: "modelo-a", kind, input_tokens: 10, output_tokens: 5, cost_usd: cost, created_at: "2026-11-10T12:00:00Z", ...extra,
});

test("mês de Brasília: virada às 3h UTC", () => {
  assert.equal(mesDe(new Date("2026-12-01T02:59:00Z")), "2026-11");
  assert.equal(mesDe(new Date("2026-12-01T03:00:00Z")), "2026-12");
});

test("somar mês atravessa o ano", () => {
  assert.equal(somarMes("2026-01", -1), "2025-12");
  assert.equal(somarMes("2026-12", 1), "2027-01");
  assert.deepEqual(ultimosMeses("2026-02", 3), ["2026-02", "2026-01", "2025-12"]);
});

test("intervalo do mês em UTC", () => {
  assert.deepEqual(intervaloMes("2026-11"), { inicio: "2026-11-01T03:00:00.000Z", fim: "2026-12-01T03:00:00.000Z" });
  assert.equal(rotuloMes("2026-11"), "nov/2026");
});

test("validação do mês", () => {
  assert.equal(MesSchema.safeParse("2026-11").success, true);
  for (const bad of ["2026-13", "2026-1", "26-11", "2026-11-01", ""]) assert.equal(MesSchema.safeParse(bad).success, false, bad);
});

test("por tipo: ordem fixa, quantidades e segundos de áudio", () => {
  const r = porTipo([
    l("transcribe", 0.002, { input_tokens: 90 }), l("chat", 0.01), l("chat", "0.02"), l("transcribe", 0.001, { input_tokens: 30 }), l("desconhecido", 5),
  ]);
  assert.deepEqual(r.map((x) => x.tipo), ["chat", "transcribe"]);
  assert.equal(r[0].vezes, 2);
  assert.equal(r[0].custo, 0.03);
  assert.equal(r[1].segundos, 120);
  assert.equal(quantidade(r[0]), "2 mensagens");
  assert.equal(quantidade(r[1]), "2 min de áudio");
  assert.equal(quantidade({ tipo: "speech", rotulo: "Voz natural", custo: 0, vezes: 1 }), "1 fala");
});

test("por motor: do maior para o menor; valores inválidos contam zero", () => {
  const r = porMotor([l("chat", 0.01), l("chat", 0.05, { model: "modelo-b" }), l("chat", "abc"), l("chat", -1)]);
  assert.deepEqual(r.map((x) => [x.motor, x.custo, x.vezes]), [["modelo-b", 0.05, 1], ["modelo-a", 0.01, 3]]);
  assert.equal(total([l("chat", 0.1), l("chat", 0.2)]), 0.3);
});

test("por mês: meses sem uso aparecem com zero", () => {
  const r = porMes([l("chat", 1, { created_at: "2026-11-01T02:00:00Z" }), l("chat", 2, { created_at: "2026-11-20T12:00:00Z" })], ["2026-11", "2026-10", "2026-09"]);
  assert.deepEqual(r.map((x) => [x.mes, x.custo, x.vezes]), [["2026-11", 2, 1], ["2026-10", 1, 1], ["2026-09", 0, 0]]);
});

test("percentual e quanto falta", () => {
  assert.equal(pctUsado(5, 20), 25);
  assert.equal(pctUsado(1, 0), 100);
  assert.equal(pctUsado(0, 0), 0);
  assert.equal(pctUsado(1, null), null);
  assert.equal(falta(20, 5, 1), 14);
  assert.equal(falta(2, 5), 0);
  assert.equal(falta(null, 5), null);
});

test("por pessoa: ordenado por gasto, teto próprio ou padrão, conta removida", () => {
  const linhas = [
    l("chat", 0.5, { user_id: "u1" }), l("transcribe", 1.5, { user_id: "u2", input_tokens: 600 }), l("chat", 0.1, { user_id: "u9" }),
  ];
  const pessoas = [{ id: "u1", nome: "Pessoa Um", email: "um@exemplo.test" }, { id: "u2", nome: null, email: "dois@exemplo.test" }, { id: "u3", nome: "Pessoa Três", email: null }];
  const r = porPessoa(linhas, pessoas, new Map([["u2", { valor: 3, proprio: true }]]), 20);
  assert.deepEqual(r.map((x) => x.id), ["u2", "u1", "u9", "u3"]);
  assert.equal(r[0].nome, "dois@exemplo.test");
  assert.equal(r[0].pct, 50);
  assert.equal(r[0].tetoProprio, true);
  assert.equal(r[1].teto, 20);
  assert.equal(r[2].nome, "Pessoa removida");
  assert.equal(r[3].custo, 0);
  assert.deepEqual(Object.keys(r[0]).sort(), ["custo", "email", "id", "motores", "nome", "pct", "teto", "tetoProprio", "tipos"]);
  assert.equal(porPessoa(linhas, pessoas, new Map(), null)[0].pct, null);
});

test("formatos: US$ com 2 a 4 casas e minutos", () => {
  assert.equal(usd(1.5), "US$ 1,50");
  assert.equal(usd(0.0042), "US$ 0,0042");
  assert.equal(usd(0), "US$ 0,00");
  assert.equal(usd(Number.NaN), "US$ 0,00");
  assert.equal(minutos(0), "0 min");
  assert.equal(minutos(30), "menos de 1 min");
  assert.equal(minutos(150), "3 min");
  assert.equal(minutos(3900), "1 h 05 min");
});

test("leitura em páginas: junta, para no fim e no limite, erro vira null", async () => {
  const dados = Array.from({ length: 25 }, (_, i) => i);
  const fonte = async (de: number, ate: number) => ({ data: dados.slice(de, ate + 1), error: null });
  assert.deepEqual(await lerPaginado(fonte, { tamanho: 10 }), { linhas: dados, completo: true });
  const parcial = await lerPaginado(fonte, { tamanho: 10, maxPaginas: 2 });
  assert.equal(parcial?.linhas.length, 20);
  assert.equal(parcial?.completo, false);
  assert.equal(await lerPaginado(async () => ({ data: null, error: new Error("x") })), null);
});
