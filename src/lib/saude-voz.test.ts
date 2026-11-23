import assert from "node:assert/strict";
import { test } from "node:test";
import { FRASE_DESLIGADO, FRASE_INDISPONIVEL, FRASE_NAO_ADMIN, fraseSaude, parseSaudeVoz, responderSaude } from "./saude-voz.ts";
import { saudeVazia, type Saude } from "./telemetria/saude.ts";

test("parser: pergunta de erro de hoje", () => {
  for (const t of ["teve algum erro hoje?", "Teve algum erro hoje", "algum erro hoje?", "teve erro hoje", "o que quebrou?", "O que quebrou hoje?", "gadu, o que quebrou hoje?", "deu algum erro hoje", "teve algum problema hoje?"]) {
    assert.deepEqual(parseSaudeVoz(t), { tipo: "resumo" }, t);
  }
});

test("parser: saúde do sistema e administração", () => {
  for (const t of ["mostra a saúde do sistema", "abre a saúde do sistema", "saúde do sistema", "Mostra a saude do sistema por favor"]) assert.deepEqual(parseSaudeVoz(t), { tipo: "painel" }, t);
  for (const t of ["abre a administração", "abre o admin", "vai para a administração"]) assert.deepEqual(parseSaudeVoz(t), { tipo: "admin" }, t);
});

test("parser: conversa comum e frases longas seguem para o GaDu", () => {
  for (const t of ["", "erro", "problemas", "como está meu dia?", "tive um erro no extrato do banco ontem e quero te contar a história toda", "cria a tarefa corrigir o erro", "abre finanças", "quanto gastei hoje", "o que quebrou na minha casa quando choveu muito ontem à noite"]) {
    assert.equal(parseSaudeVoz(t), null, t);
  }
});

const base: Saude = { ...saudeVazia(true, true) };
test("frase: sem erros, com erros, desligado e indisponível", () => {
  assert.equal(fraseSaude(base), "Nenhum erro registrado hoje.");
  assert.equal(fraseSaude({ ...base, hoje: { total: 3, grupos: 2, recente: { nome: "TypeError", rota: "/api/chat", vezes: 2 } } }), "Hoje houve 3 erros em 2 grupos. O mais recente é TypeError em /api/chat, 2 vezes.");
  assert.equal(fraseSaude({ ...base, hoje: { total: 1, grupos: 1, recente: { nome: "TypeError", rota: "/app", vezes: 1 } } }), "Hoje houve 1 erro em 1 grupo. O mais recente é TypeError em /app, 1 vez.");
  assert.equal(fraseSaude(saudeVazia(false, false)), FRASE_DESLIGADO);
  assert.equal(fraseSaude(saudeVazia(true, false)), FRASE_INDISPONIVEL);
});

test("frase: texto sensível nunca é falado", () => {
  const f = fraseSaude({ ...base, hoje: { total: 1, grupos: 1, recente: { nome: "Error", rota: "/u/maria@exemplo.com", vezes: 1 } } });
  assert.equal(f, "Hoje houve 1 erro em 1 grupo.");
});

const resp = (status: number, corpo: unknown) => (async () => new Response(JSON.stringify(corpo), { status })) as unknown as typeof fetch;

test("responder: não admin não chama a API nem abre a tela; 403 vira 'só para administrador'", async () => {
  let chamou = false;
  const r = await responderSaude({ tipo: "resumo" }, false, (async () => { chamou = true; return new Response("{}"); }) as unknown as typeof fetch);
  assert.deepEqual(r, { abrir: false, fala: FRASE_NAO_ADMIN });
  assert.equal(chamou, false);
  assert.deepEqual(await responderSaude({ tipo: "resumo" }, true, resp(403, { error: "forbidden" })), { abrir: false, fala: FRASE_NAO_ADMIN });
});

test("responder: admin abre a tela e ouve o resumo; falha avisa com honestidade", async () => {
  const ok = await responderSaude({ tipo: "painel" }, true, resp(200, { ...base, hoje: { total: 0, grupos: 0, recente: null } }));
  assert.deepEqual(ok, { abrir: true, fala: "Nenhum erro registrado hoje." });
  assert.deepEqual(await responderSaude({ tipo: "resumo" }, true, resp(500, {})), { abrir: false, fala: FRASE_INDISPONIVEL });
  assert.deepEqual(await responderSaude({ tipo: "resumo" }, true, (async () => { throw new Error("rede"); }) as unknown as typeof fetch), { abrir: false, fala: FRASE_INDISPONIVEL });
  assert.deepEqual(await responderSaude({ tipo: "admin" }, true), { abrir: true, fala: "Abrindo Administração." });
});
