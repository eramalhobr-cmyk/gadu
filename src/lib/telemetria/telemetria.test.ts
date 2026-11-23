import { test } from "node:test";
import assert from "node:assert/strict";
import { ErroClienteBody, eventoDoCliente, impressao, localDaPilha, sanitizeCode, sanitizeLocal, sanitizeName, sanitizeRoute, sanitizeStatus, versaoDoDeploy } from "./sanitize.ts";
import { agrupar } from "./agrupar.ts";
import { montarAviso } from "./cliente.ts";
import { telemetriaEnabled } from "./flag.ts";

test("rota: sem endereço, query e âncora; ids viram :id", () => {
  assert.equal(sanitizeRoute("https://gadu-agent.vercel.app/app?tab=hoje&email=a@b.c#x"), "/app");
  assert.equal(sanitizeRoute("/api/goals/3f2b8c9e-1a2b-4c3d-8e9f-0a1b2c3d4e5f/progresso/12345"), "/api/goals/:id/progresso/:id");
  assert.equal(sanitizeRoute("/api/invite/AbCdEfGhIjKlMnOpQrStUvWx"), "/api/invite/:id");
  assert.equal(sanitizeRoute("sem-barra"), "/");
  assert.equal(sanitizeRoute(42), "/");
  assert.ok(sanitizeRoute("/" + "a/".repeat(300)).length <= 200);
  assert.ok(!/[?#\s]/.test(sanitizeRoute("/app/ casa\t/x?y")));
});

test("nome do erro: só identificador; texto livre (mensagem) vira Error", () => {
  assert.equal(sanitizeName("TypeError"), "TypeError");
  assert.equal(sanitizeName("ChunkLoadError"), "ChunkLoadError");
  assert.equal(sanitizeName("Falha ao salvar para maria@exemplo.com"), "Error");
  assert.equal(sanitizeName("a".repeat(81)), "Error");
  assert.equal(sanitizeName(undefined), "Error");
  assert.equal(sanitizeName({}), "Error");
});

test("código, status e local", () => {
  assert.equal(sanitizeCode("ECONNRESET"), "ECONNRESET");
  assert.equal(sanitizeCode("tem espaço e @"), null);
  assert.equal(sanitizeStatus(500), 500);
  for (const x of [42, 600, 500.5, "500", null]) assert.equal(sanitizeStatus(x), null);
  assert.equal(sanitizeLocal("https://gadu-agent.vercel.app/_next/static/chunks/app-1a2b.js:10:20"), "/_next/static/chunks/app-1a2b.js:10");
  assert.equal(sanitizeLocal("/app/api/chat/route.ts:42"), "/app/api/chat/route.ts:42");
  assert.equal(sanitizeLocal("Erro ao salvar: maria@exemplo.com:1"), null);
  assert.equal(sanitizeLocal("sem linha"), null);
});

test("pilha: usa só o primeiro quadro com arquivo e linha, nunca a mensagem", () => {
  const stack = "TypeError: não foi possível ler o saldo de maria@exemplo.com\n    at calc (https://gadu-agent.vercel.app/_next/static/chunks/fin-9f.js:7:13)\n    at x (/a.js:1:1)";
  const l = localDaPilha(stack);
  assert.equal(l, "/_next/static/chunks/fin-9f.js:7");
  assert.ok(!String(l).includes("maria"));
  assert.equal(localDaPilha("só mensagem sem quadro"), null);
  assert.equal(localDaPilha(undefined), null);
});

test("corpo do navegador: .strict() recusa campo desconhecido (message, email, stack)", () => {
  assert.ok(ErroClienteBody.safeParse({ rota: "/app", nome: "TypeError" }).success);
  for (const extra of [{ message: "oi" }, { email: "a@b.c" }, { stack: "x" }, { userId: "x" }]) {
    assert.equal(ErroClienteBody.safeParse({ rota: "/app", nome: "TypeError", ...extra }).success, false, JSON.stringify(extra));
  }
  assert.equal(ErroClienteBody.safeParse({ rota: "/app" }).success, false);
  const ev = eventoDoCliente({ rota: "/app?q=segredo", nome: "mensagem livre aqui", local: "https://x.test/a.js:3:4" });
  assert.deepEqual(ev, { origem: "cliente", rota: "/app", nome: "Error", codigo: null, status: null, local: "/a.js:3" });
});

test("impressão digital: igual para o mesmo erro, diferente para outro, 64 hex", () => {
  const a = { origem: "cliente" as const, rota: "/app", nome: "TypeError", local: "/a.js:1" };
  assert.match(impressao(a), /^[0-9a-f]{64}$/);
  assert.equal(impressao(a), impressao({ ...a }));
  assert.notEqual(impressao(a), impressao({ ...a, rota: "/login" }));
  assert.notEqual(impressao(a), impressao({ ...a, origem: "servidor" }));
});

test("versão do deploy: só hexadecimal curto", () => {
  assert.equal(versaoDoDeploy({ VERCEL_GIT_COMMIT_SHA: "a3b4a791cfc32b5c9da17f10e9f888339a028399" }), "a3b4a791cfc3");
  assert.equal(versaoDoDeploy({ VERCEL_GIT_COMMIT_SHA: "maria@exemplo.com" }), null);
  assert.equal(versaoDoDeploy({}), null);
});

test("agrupar: junta iguais, conta, mais recente primeiro", () => {
  const l = (impressao: string, created_at: string, extra = {}) => ({ created_at, origem: "cliente", rota: "/app", nome: "E", status: null, local_codigo: null, versao: "v1", impressao, ...extra });
  const g = agrupar([l("a", "2026-11-23T10:00:00Z"), l("b", "2026-11-23T12:00:00Z"), l("a", "2026-11-23T11:00:00Z", { versao: "v2" })]);
  assert.deepEqual(g.map((x) => [x.impressao, x.vezes, x.versao]), [["b", 1, "v1"], ["a", 2, "v2"]]);
  assert.equal(g[1].primeira, "2026-11-23T10:00:00Z");
  assert.equal(agrupar([l("a", "2026-11-23T10:00:00Z"), l("b", "2026-11-23T12:00:00Z")], 1).length, 1);
});

test("aviso do navegador nunca carrega a mensagem", () => {
  const err = Object.assign(new Error("saldo de maria@exemplo.com inválido"), { name: "TypeError" });
  const aviso = montarAviso(err, "/app?tab=financeiro&q=x");
  assert.deepEqual(Object.keys(aviso).sort(), aviso.local ? ["local", "nome", "rota"] : ["nome", "rota"]);
  assert.equal(aviso.rota, "/app");
  assert.equal(aviso.nome, "TypeError");
  assert.ok(!JSON.stringify(aviso).includes("maria"));
  assert.deepEqual(montarAviso("texto solto", "/x"), { rota: "/x", nome: "Error" });
  assert.deepEqual(montarAviso(null, "/x"), { rota: "/x", nome: "Error" });
});

test("interruptor TELEMETRIA_ENABLED: ligado por padrão, 0 desliga", () => {
  assert.equal(telemetriaEnabled({}), true);
  assert.equal(telemetriaEnabled({ TELEMETRIA_ENABLED: "1" }), true);
  for (const v of ["0", "false", "off", "NÃO"]) assert.equal(telemetriaEnabled({ TELEMETRIA_ENABLED: v }), false, v);
});
