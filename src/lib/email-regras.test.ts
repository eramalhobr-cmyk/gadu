import { test } from "node:test";
import assert from "node:assert/strict";
import { aplicarRegras, carregarRegrasEmail, classificarEmail, normalizar, parseNaoImportante, regrasDeMemorias, termoDoRemetente, textoRegra } from "./email-regras.ts";

const M61 = "Não quer que e-mails de deploy da Vercel sejam tratados como importantes nos resumos; falhas de CI continuam relevantes.";
const mail = (from: string, subject: string, important = false) => ({ from, subject, snippet: "", date: "", important });
const vazio = { silenciar: [], manter: [] };

test("normalizar tira acento e caixa", () => assert.equal(normalizar("AÇÃO Não"), "acao nao"));

test("memória 61: silencia Vercel/deploy e mantém CI", () => {
  const r = regrasDeMemorias([M61]);
  for (const t of ["vercel", "deploy"]) assert.ok(r.silenciar.includes(t), t);
  for (const t of ["ci", "run failed", "workflow", "pipeline"]) assert.ok(r.manter.includes(t), t);
  assert.ok(!r.silenciar.includes("ci"));
});

test("memória que não fala de e-mail é ignorada", () => {
  assert.deepEqual(regrasDeMemorias(["Não quer ouvir sobre a Vercel nas reuniões."]), vazio);
  assert.deepEqual(regrasDeMemorias(["Gosta de café sem açúcar."]), vazio);
});

test("texto canônico vira regra de silenciar", () => {
  assert.deepEqual(regrasDeMemorias([textoRegra("vercel.com")]).silenciar, ["vercel.com"]);
  assert.deepEqual(regrasDeMemorias([textoRegra("ana@gmail.com")]).silenciar, ["ana@gmail.com"]);
  assert.deepEqual(regrasDeMemorias([textoRegra("banco azul")]).silenciar, ["banco azul"]);
  assert.ok(textoRegra("x".repeat(500)).length <= 200);
});

test("Vercel falha de deploy com a memória 61 → baixa", () => {
  const r = regrasDeMemorias([M61]);
  const c = classificarEmail(mail("Vercel <notifications@vercel.com>", "Failed production deployment", true), r);
  assert.equal(c.nivel, "baixa");
  assert.equal(c.motivo, "regra da memória");
});

test("GitHub 'Run failed' com a memória 61 → não é baixa", () => {
  const c = classificarEmail(mail("GitHub <notifications@github.com>", "Run failed: CI - main"), regrasDeMemorias([M61]));
  assert.notEqual(c.nivel, "baixa");
});

test("notificação do GitHub sem memória → baixa (padrão)", () => {
  const c = classificarEmail(mail("GitHub <notifications@github.com>", "Nova atividade no repositório", true), vazio);
  assert.deepEqual(c, { nivel: "baixa", motivo: "notificação automática" });
});

test("alerta de segurança de noreply → crítico, mesmo silenciado", () => {
  const e = mail("Conta <noreply@conta.example.com>", "Alerta de segurança: nova entrada");
  assert.equal(classificarEmail(e, vazio).nivel, "critico");
  assert.equal(classificarEmail(e, { silenciar: ["conta.example.com"], manter: [] }).nivel, "critico");
  assert.equal(classificarEmail(mail("Banco <aviso@banco.example.com>", "Pagamento recusado"), vazio).nivel, "critico");
});

test("e-mail de pessoa: importante ou normal", () => {
  assert.equal(classificarEmail(mail("Maria <maria@exemplo.com>", "Contrato para assinar", true), vazio).nivel, "importante");
  assert.equal(classificarEmail(mail("Maria <maria@exemplo.com>", "Oi", false), vazio).nivel, "normal");
});

test("aplicarRegras recalcula important", () => {
  const l = aplicarRegras([mail("Vercel <notifications@vercel.com>", "Build failed", true), mail("Maria <maria@exemplo.com>", "Oi", true), mail("Z <z@exemplo.com>", "Segurança: atividade suspeita")].map((m) => m), vazio);
  assert.deepEqual(l.map((m) => m.important), [false, true, true]);
  assert.deepEqual(l.map((m) => m.nivel), ["baixa", "importante", "critico"]);
});

test("carregarRegrasEmail lê só aprovadas e nunca lança", async () => {
  const cadeia = (res: unknown) => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: async () => res }) }) }) }) }) });
  assert.ok((await carregarRegrasEmail(cadeia({ data: [{ content: M61 }], error: null }), "u1")).silenciar.includes("vercel"));
  assert.deepEqual(await carregarRegrasEmail({ from: () => { throw new Error("x"); } }, "u1"), vazio);
  assert.deepEqual(await carregarRegrasEmail(cadeia({ data: null, error: { message: "x" } }), "u1"), vazio);
});

test("termoDoRemetente: domínio, ou endereço em provedor público", () => {
  assert.equal(termoDoRemetente("Vercel <notifications@vercel.com>"), "vercel.com");
  assert.equal(termoDoRemetente("Ana <Ana@Gmail.com>"), "ana@gmail.com");
  assert.equal(termoDoRemetente("sem endereço"), null);
});

test("parseNaoImportante: positivos", () => {
  for (const f of ["Isso não é importante", "esse e-mail não é importante", "Isso não merece atenção.", "isso não é importante!"]) assert.deepEqual(parseNaoImportante(f), { alvo: "isso" }, f);
  assert.deepEqual(parseNaoImportante("e-mails da vercel não são importantes"), { alvo: "termo", termo: "vercel" });
  assert.deepEqual(parseNaoImportante("E-mail do GitHub não é importante"), { alvo: "termo", termo: "github" });
  assert.deepEqual(parseNaoImportante("não mostra mais e-mails da vercel"), { alvo: "termo", termo: "vercel" });
  assert.deepEqual(parseNaoImportante("e-mails de vercel.com não são importantes."), { alvo: "termo", termo: "vercel.com" });
});

test("parseNaoImportante: não sequestra outras frases", () => {
  for (const f of ["isso não é importante pra reunião de amanhã?", "o que é importante hoje", "isso não é importante pra mim hoje", "Me lembra de ligar", "", "e-mails da vercel"]) assert.equal(parseNaoImportante(f), null, f);
});
