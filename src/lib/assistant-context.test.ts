import assert from "node:assert/strict";
import { test } from "node:test";
import { AssistantContextSchema, contextLabel, contextLine, contextOf, scopesFor } from "./assistant-context.ts";
import { AREAS, isOverview, MODULES, moduleOf, parseView, VIEW_IDS } from "./modules.ts";

test("módulos: oito módulos, telas únicas e status coerente", () => {
  assert.deepEqual(MODULES.map((m) => m.id), ["pessoal", "metas", "financeiro", "casa", "office", "studio", "studio3d", "plataforma"]);
  assert.equal(new Set(VIEW_IDS).size, VIEW_IDS.length);
  for (const m of MODULES) {
    if (m.status === "planejado") assert.equal(m.available.length, 0, `${m.name} planejado não lista nada como disponível`);
    if (m.status === "disponivel") assert.ok(m.available.length > 0);
    for (const v of m.views) if (m.status === "planejado") assert.ok(isOverview(v.id), "módulo planejado só tem tela de visão geral");
  }
});

test("áreas cobrem todos os módulos uma única vez; Casa e Metas são planejados", () => {
  const ids = AREAS.flatMap((a) => a.modules);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...ids].sort(), MODULES.map((m) => m.id).sort());
  for (const id of ["casa", "metas"] as const) {
    const m = MODULES.find((x) => x.id === id)!;
    assert.equal(m.status, "planejado");
    assert.equal(m.available.length, 0, "módulo planejado não mostra nada como disponível");
    assert.ok(isOverview(m.views[0].id));
  }
  assert.equal(parseView("casa", false), "casa");
  assert.equal(parseView("modulos", false), "modulos");
});

test("endereços antigos continuam abrindo a tela certa", () => {
  assert.equal(parseView("perfil", false), "perfil");
  assert.equal(parseView("memorias", false), "memoria");
  assert.equal(parseView("agenda", false), "agenda");
  assert.equal(parseView("ajustes", false), "ajustes");
  assert.equal(parseView("admin", false), "ajustes");
  assert.equal(parseView("admin", true), "admin");
  assert.equal(parseView("hoje", false), "hoje");
  assert.equal(parseView("qualquer", false), null);
});

test("contexto do assistente: válido só quando a tela pertence ao módulo", () => {
  assert.ok(AssistantContextSchema.safeParse(contextOf("hoje")).success);
  assert.ok(AssistantContextSchema.safeParse({ module: "financeiro", view: "financeiro" }).success);
  assert.equal(AssistantContextSchema.safeParse({ module: "financeiro", view: "hoje" }).success, false);
  assert.equal(AssistantContextSchema.safeParse({ module: "pessoal", view: "hoje", org: "x" }).success, false, "campos extras são recusados");
  assert.equal(AssistantContextSchema.safeParse({ module: "outro", view: "hoje" }).success, false);
});

test("contexto nunca amplia o acesso: escopo é sempre pessoal", () => {
  for (const v of VIEW_IDS) assert.deepEqual(scopesFor(contextOf(v)), ["pessoal"]);
});

test("linha de contexto avisa quando o módulo é só planejado", () => {
  assert.match(contextLine(contextOf("financeiro")), /beta/);
  assert.match(contextLine(contextOf("metas")), /planejado/);
  assert.doesNotMatch(contextLine(contextOf("hoje")), /planejado/);
  assert.equal(contextLabel(contextOf("agentes")), "Agent Office › Agentes");
  assert.equal(moduleOf("admin").id, "plataforma");
});
