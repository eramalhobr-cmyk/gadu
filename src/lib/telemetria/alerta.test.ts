import assert from "node:assert/strict";
import { test } from "node:test";
import { agrupar, type LinhaErro } from "./agrupar.ts";
import { decidirAlerta, diaBrasilia, grupoLivre, grupoNovo, montarPush, PICO_MIN, TEXTO_GENERICO, URL_ALERTA } from "./alerta.ts";
import { impressao, protegerEvento, type EventoErro } from "./sanitize.ts";
import { resumirSaude } from "./saude.ts";

const agora = new Date("2026-11-23T18:00:00-03:00");
const antes = (min: number) => new Date(agora.getTime() - min * 60_000).toISOString();
const ev = (o: Partial<EventoErro> = {}): EventoErro => ({ origem: "servidor", rota: "/api/chat", nome: "TypeError", codigo: null, status: 500, local: "src/app/api/chat/route.ts:42", ...o });

test("protegerEvento: campo que o detector marca é descartado; o resto passa intacto", () => {
  assert.deepEqual(protegerEvento(ev()), ev());
  const r = protegerEvento(ev({ rota: "/u/maria@exemplo.com/perfil", local: "senha: 12345678:1", codigo: "ok" }));
  assert.equal(r.rota, "/");
  assert.equal(r.local, null);
  assert.equal(r.codigo, "ok");
  assert.equal(r.nome, "TypeError");
});

test("grupo novo: nunca visto, ou última vez há mais de 7 dias", () => {
  assert.equal(grupoNovo(null, agora), true);
  assert.equal(grupoNovo({ ultima_vez: antes(60) }, agora), false);
  assert.equal(grupoNovo({ ultima_vez: antes(6 * 24 * 60) }, agora), false);
  assert.equal(grupoNovo({ ultima_vez: antes(8 * 24 * 60) }, agora), true);
});

test("throttle do grupo: livre sem aviso ou com 6 h ou mais", () => {
  assert.equal(grupoLivre(null, agora), true);
  assert.equal(grupoLivre(antes(5 * 60 + 59), agora), false);
  assert.equal(grupoLivre(antes(6 * 60), agora), true);
});

test("decisão: novo avisa; pico avisa; poucos do mesmo grupo não; grupo avisado há pouco não", () => {
  assert.deepEqual(decidirAlerta({ novo: true, ocorrenciasNaJanela: 1, ultimoAlerta: null, agora }), { enviar: true, motivo: "novo" });
  assert.deepEqual(decidirAlerta({ novo: false, ocorrenciasNaJanela: PICO_MIN, ultimoAlerta: null, agora }), { enviar: true, motivo: "pico" });
  assert.deepEqual(decidirAlerta({ novo: false, ocorrenciasNaJanela: PICO_MIN - 1, ultimoAlerta: null, agora }), { enviar: false, motivo: null });
  assert.equal(decidirAlerta({ novo: false, ocorrenciasNaJanela: 50, ultimoAlerta: antes(30), agora }).enviar, false);
  assert.equal(decidirAlerta({ novo: true, ocorrenciasNaJanela: 1, ultimoAlerta: antes(30), agora }).enviar, false);
  assert.equal(decidirAlerta({ novo: false, ocorrenciasNaJanela: 9, ultimoAlerta: antes(7 * 60), agora }).motivo, "pico");
});

test("dia de Brasília: 01:00 UTC ainda é o dia anterior", () => {
  assert.equal(diaBrasilia(new Date("2026-11-24T01:00:00Z")), "2026-11-23");
  assert.equal(diaBrasilia(new Date("2026-11-24T03:00:00Z")), "2026-11-24");
});

test("push: curto, em português, estável e sem dado pessoal", () => {
  const imp = impressao(ev());
  const novo = montarPush({ motivo: "novo", nome: "TypeError", rota: "/api/chat", vezes: 3, impressao: imp });
  assert.equal(novo.body, "O GaDu teve um erro novo: TypeError em /api/chat (3 vezes).");
  assert.equal(novo.url, URL_ALERTA);
  assert.equal(novo.tag, `erro-${imp.slice(0, 16)}`);
  assert.equal(montarPush({ motivo: "novo", nome: "TypeError", rota: "/api/chat", vezes: 1, impressao: imp }).body, "O GaDu teve um erro novo: TypeError em /api/chat (1 vez).");
  const pico = montarPush({ motivo: "pico", nome: "TypeError", rota: "/api/chat", vezes: 7, impressao: imp });
  assert.match(pico.body, /em sequência.*7 vezes em 15 min/);
  assert.ok(novo.title.length <= 80 && novo.body.length <= 300);
  assert.doesNotMatch(JSON.stringify([novo, pico]), /@|user|token|stack/i);
});

test("push: campo sensível troca tudo pelo texto genérico", () => {
  const p = montarPush({ motivo: "novo", nome: "Error", rota: "/u/maria@exemplo.com", vezes: 2, impressao: "a".repeat(64) });
  assert.equal(p.body, TEXTO_GENERICO);
  assert.doesNotMatch(JSON.stringify(p), /maria/);
});

const linha = (min: number, o: Partial<LinhaErro> = {}): LinhaErro => ({ created_at: antes(min), origem: "servidor", rota: "/api/chat", nome: "TypeError", status: 500, local_codigo: null, versao: null, impressao: "a".repeat(64), ...o });

test("agrupamento junta a mesma impressão e conta as vezes", () => {
  const g = agrupar([linha(1), linha(2), linha(3, { impressao: "b".repeat(64), nome: "RangeError" })]);
  assert.equal(g.length, 2);
  assert.equal(g[0].vezes, 2);
});

test("saúde: totais, servidor × cliente, hoje, grupos e série de 7 dias só com dados reais", () => {
  const vazia = resumirSaude([], agora);
  assert.equal(vazia.hoje.total, 0);
  assert.equal(vazia.hoje.recente, null);
  assert.equal(vazia.porDia.length, 7);
  assert.ok(vazia.porDia.every((p) => p.value === 0));
  const s = resumirSaude([linha(10), linha(20), linha(30, { origem: "cliente", impressao: "c".repeat(64), nome: "ChunkLoadError", rota: "/app" }), linha(2 * 24 * 60)], agora);
  assert.equal(s.total24h, 3);
  assert.equal(s.total7d, 4);
  assert.equal(s.servidor24h, 2);
  assert.equal(s.cliente24h, 1);
  assert.equal(s.hoje.total, 3);
  assert.equal(s.hoje.grupos, 2);
  assert.deepEqual(s.hoje.recente, { nome: "TypeError", rota: "/api/chat", vezes: 2 });
  assert.equal(s.porDia[6].value, 3);
  assert.equal(s.porDia[4].value, 1);
  assert.equal(resumirSaude([linha(5)], agora, { d24h: 99, d7d: 100 }).total24h, 99);
});

test("saúde: texto sensível de registro antigo não aparece no painel", () => {
  const s = resumirSaude([linha(5, { rota: "/u/maria@exemplo.com" })], agora);
  assert.equal(s.grupos[0].rota, "/");
  assert.equal(s.hoje.recente?.rota, "/");
});
