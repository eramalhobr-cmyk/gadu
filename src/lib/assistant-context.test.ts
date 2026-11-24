import assert from "node:assert/strict";
import { test } from "node:test";
import { AssistantContextSchema, contextLabel, contextLine, contextOf, scopesFor } from "./assistant-context.ts";
import { AREAS, isOverview, MODULES, moduleOf, parseView, VIEW_IDS } from "./modules.ts";

test("módulos: telas únicas e status coerente", () => {
  assert.deepEqual(MODULES.map((m) => m.id), ["pessoal", "metas", "financeiro", "lista_compras", "compras", "casa", "office", "studio", "studio3d", "plataforma"]);
  assert.equal(new Set(VIEW_IDS).size, VIEW_IDS.length);
  for (const m of MODULES) {
    if (m.status === "planejado") assert.equal(m.available.length, 0, `${m.name} planejado não lista nada como disponível`);
    if (m.status === "disponivel") assert.ok(m.available.length > 0);
    for (const v of m.views) if (m.status === "planejado") assert.ok(isOverview(v.id), "módulo planejado só tem tela de visão geral");
  }
});

test("áreas cobrem todos os módulos uma única vez; Casa é planejada e Metas é beta", () => {
  const ids = AREAS.flatMap((a) => a.modules);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...ids].sort(), MODULES.map((m) => m.id).sort());
  const casa = MODULES.find((x) => x.id === "casa")!;
  assert.equal(casa.status, "planejado");
  assert.equal(casa.available.length, 0, "módulo planejado não mostra nada como disponível");
  assert.ok(isOverview(casa.views[0].id));
  const metas = MODULES.find((x) => x.id === "metas")!;
  assert.equal(metas.status, "parcial");
  assert.ok(metas.available.length > 0 && metas.planned.length > 0, "beta lista o que existe e o que falta");
  assert.ok(!isOverview("metas"), "Metas tem tela própria");
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
  assert.match(contextLine(contextOf("metas")), /beta/);
  assert.match(contextLine(contextOf("casa")), /planejado/);
  assert.doesNotMatch(contextLine(contextOf("hoje")), /planejado/);
  assert.equal(contextLabel(contextOf("agentes")), "Agent Office › Agentes");
  assert.equal(moduleOf("admin").id, "plataforma");
});

test("UX-7: grupos dos menus cobrem cada tela principal uma vez só, e escondem o que está desligado", async () => {
  const { NAV_GROUPS, MAIN_VIEWS, navGroups, DOCK_VIEWS } = await import("./modules.ts");
  const all = NAV_GROUPS.flatMap((g) => g.views);
  assert.deepEqual([...all].sort(), [...MAIN_VIEWS].sort());
  assert.equal(new Set(all).size, all.length);
  for (const g of NAV_GROUPS) assert.match(g.hint, /^“.+”$/);
  const ultimas = navGroups((v) => v === "financeiro" || v === "metas", DOCK_VIEWS).find((g) => g.id === "vida")?.views ?? [];
  assert.ok(ultimas.includes("lista_compras"));
  assert.ok(!ultimas.includes("financeiro") && !ultimas.includes("metas"));
  const off = navGroups((v) => v === "lista_compras", DOCK_VIEWS);
  assert.ok(!off.find((g) => g.id === "vida")?.views.includes("lista_compras"));
  assert.deepEqual(off.find((g) => g.id === "dia")?.views, ["agenda", "projetos", "memoria"]);
});
