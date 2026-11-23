// UX-4 · linguagem simples: as telas principais não mostram selos técnicos (Beta, Planejado, Plataforma, Core, "via modelo").
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripSourceTags } from "../src/lib/speech.ts";

const TELAS = ["TodayPage", "AttentionCard", "Assistant", "TasksPanel", "ProjectsPage", "MetasPage", "FinanceiroPage", "SettingsPage", "MemoryPage", "AgendaView", "AgentsPage", "AdminPage"];

test("telas principais não têm rótulo técnico no cabeçalho", () => {
  for (const nome of TELAS) {
    const src = readFileSync(new URL(`../src/components/${nome}.tsx`, import.meta.url), "utf8");
    assert.doesNotMatch(src, /eyebrow="(Beta|Planejado|Plataforma|Core|Pessoal|Agent Office)"/, `${nome}: eyebrow técnico`);
    assert.doesNotMatch(src, /via \$\{/, `${nome}: "via modelo" à vista`);
  }
});

test("a bolha da conversa mostra só GaDu e esconde as etiquetas [T1]/[M1]", () => {
  for (const nome of ["GaduApp", "Assistant"]) {
    const src = readFileSync(new URL(`../src/components/${nome}.tsx`, import.meta.url), "utf8");
    assert.match(src, /stripSourceTags\(m\.content\)/, `${nome}: etiquetas de origem à vista`);
    assert.doesNotMatch(src, /GaDu\{m\.via/, `${nome}: provedor na bolha`);
  }
  assert.equal(stripSourceTags("Você tem 2 tarefas [T1, T2]. Veja a reunião [A1]."), "Você tem 2 tarefas. Veja a reunião.");
});

test("tela Hoje: o que é secundário fica em “Mais opções”", () => {
  const src = readFileSync(new URL("../src/components/TodayPage.tsx", import.meta.url), "utf8");
  assert.match(src, /<details className="more-opts">/);
  assert.match(src, /Mais opções/);
});
