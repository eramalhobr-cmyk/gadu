import assert from "node:assert/strict";
import { test } from "node:test";
import { FERRAMENTAS, acoesPermitidas, avisoFerramentas, ferramentaDaAcao, ferramentasDe, mesSP, pode, tetoAtingido, type AgenteLimites } from "./ferramentas.ts";
import { TIPOS } from "../acoes.ts";

const ag = (ferramentas: AgenteLimites["ferramentas"], teto: number | null = null): AgenteLimites => ({ id: 1, nome: "Mentor", ferramentas, teto });

test("ferramentasDe: só conhecidas, na ordem, sem repetir; sem lista = todas", () => {
  assert.deepEqual(ferramentasDe(["email", "agenda", "email", "hack"]), ["agenda", "email"]);
  assert.deepEqual(ferramentasDe(undefined), [...FERRAMENTAS]);
  assert.deepEqual(ferramentasDe([]), []);
});

test("pode: sem agente tudo vale; com agente só as dele", () => {
  assert.equal(pode(null, "financas"), true);
  assert.equal(pode(ag(["agenda"]), "financas"), false);
  assert.equal(pode(ag(["agenda"]), "agenda"), true);
});

test("toda ação tem ferramenta definida (ou é navegação)", () => {
  for (const t of TIPOS) {
    const f = ferramentaDaAcao(t);
    assert.ok(f === null || FERRAMENTAS.includes(f), t);
  }
  assert.equal(ferramentaDaAcao("meta_agenda"), "agenda");
  assert.equal(ferramentaDaAcao("projeto_criar"), "tarefas");
  assert.equal(ferramentaDaAcao("teto_definir"), "financas");
  assert.equal(ferramentaDaAcao("agente_editar"), "acoes");
  assert.equal(ferramentaDaAcao("guia"), null);
});

test("acoesPermitidas: sem 'acoes' só navegação; com 'acoes' só as que têm a ferramenta", () => {
  const l = [{ tipo: "tarefa_concluir" as const }, { tipo: "conta_paga" as const }, { tipo: "navegar" as const }, { tipo: "ajuste" as const }];
  assert.deepEqual(acoesPermitidas(null, l), l);
  assert.deepEqual(acoesPermitidas(ag(["tarefas"]), l).map((a) => a.tipo), ["navegar"]);
  assert.deepEqual(acoesPermitidas(ag(["tarefas", "acoes"]), l).map((a) => a.tipo), ["tarefa_concluir", "navegar", "ajuste"]);
});

test("avisoFerramentas: lista o que falta; nada quando tem todas ou sem agente", () => {
  assert.equal(avisoFerramentas(null), "");
  assert.equal(avisoFerramentas(ag([...FERRAMENTAS])), "");
  assert.match(avisoFerramentas(ag(["agenda"])), /Mentor: NÃO use nem proponha nada de E-mails, Tarefas e projetos/);
});

test("tetoAtingido e mesSP", () => {
  assert.equal(tetoAtingido(null, 999), false);
  assert.equal(tetoAtingido(ag([], null), 999), false);
  assert.equal(tetoAtingido(ag([], 5), 4.99), false);
  assert.equal(tetoAtingido(ag([], 5), 5), true);
  assert.equal(mesSP(Date.UTC(2026, 11, 1, 2)), "2026-11-01", "00h UTC de 1/12 ainda é novembro em Brasília");
  assert.equal(mesSP(Date.UTC(2026, 11, 1, 3)), "2026-12-01");
});
