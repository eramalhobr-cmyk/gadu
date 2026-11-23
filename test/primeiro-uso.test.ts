// UX-4 · primeiro uso guiado: ligações que não podem se perder (Voltar do Android, Configurações, voz, preferência sem migração).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("o guia ocupa uma camada do histórico (Voltar do Android fecha) e pular grava a marca", () => {
  const app = read("src/components/GaduApp.tsx");
  assert.match(app, /const layers = \(onboarding \? 1 : 0\)/, "uma entrada de histórico para o guia");
  assert.match(app, /o\.onboarding && !o\.confirm && !o\.voice && !o\.drawer\) closeGuideRef\.current\("skipped"\)/, "Voltar fecha o guia");
  assert.match(app, /withOnboarding\(data\?\.settings, status\)/, "a marca vai para profiles.settings, sem migração");
  assert.match(app, /<Onboarding /);
});

test("o guia pode ser refeito em Configurações e por voz", () => {
  assert.match(read("src/components/SettingsPage.tsx"), /Ver o guia de primeiro uso/);
  assert.match(read("src/components/GaduApp.tsx"), /onGuide=\{openGuide\}/);
  assert.match(read("src/components/GaduApp.tsx"), /if \(guia\) openGuideRef\.current\(\)/, "ação por voz abre o guia na hora");
});

test("só pessoa nova vê o guia sozinho (decisão no servidor)", () => {
  assert.match(read("src/app/app/load.ts"), /showOnboarding: needsOnboarding\(settings\)/);
});

test("o guia tem os 3 passos, é falado, pode ser pulado e não grava nada além de nome e marca", () => {
  const ob = read("src/components/Onboarding.tsx");
  assert.match(ob, /Pular o guia/);
  assert.match(ob, /announce\(STEPS\[step\]\.say\)/, "fala o passo");
  assert.match(ob, /createRecognizer/, "testa o microfone");
  assert.match(ob, /speaker\.test\(/, "testa a voz");
  assert.match(ob, /\/api\/google\/connect/, "conecta o Google pelo fluxo que já existe");
  assert.doesNotMatch(ob, /supabaseBrowser|\.from\("/, "o componente não grava: quem grava é o GaduApp");
});

test("nenhuma migração nova para o guia", () => {
  const novas = readdirSync(new URL("../supabase/migrations/", import.meta.url)).filter((f) => /onboard|guia/i.test(f));
  assert.deepEqual(novas, []);
});
