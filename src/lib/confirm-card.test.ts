// UX-5: um cartão de confirmação só. Nenhuma tela monta o próprio "Confirmar: …" ou "Apagar de vez";
// tudo passa por ConfirmCard (telas) ou ActionCard (ações da conversa), que usam a mesma moldura.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "src/components");
const files = readdirSync(dir).filter((f) => f.endsWith(".tsx"));
const src = (f: string) => readFileSync(join(dir, f), "utf8");

test("nenhuma tela tem confirmação própria fora do ConfirmCard", () => {
  for (const f of files) {
    if (f === "ConfirmCard.tsx") continue;
    const t = src(f);
    assert.ok(!/>Confirmar: /.test(t), `${f}: botão "Confirmar: …" solto; use ConfirmCard`);
    assert.ok(!/className="btn btn-sm btn-bad"/.test(t), `${f}: botão de perigo solto; use ConfirmCard`);
    assert.ok(!/<Panel className="danger"/.test(t), `${f}: painel de perigo; use ConfirmCard`);
  }
});

test("a moldura .evc só nasce em ConfirmCard.tsx", () => {
  for (const f of files) {
    if (f === "ConfirmCard.tsx") continue;
    assert.ok(!/className=\{?[`"]evc[ "`]/.test(src(f)), `${f}: monta .evc à mão; use CardFrame`);
  }
});

test("conversa, telas e tela de escuta usam a mesma moldura", () => {
  assert.match(src("ActionCard.tsx"), /CardFrame/);
  assert.match(src("ConfirmSheet.tsx"), /CardFrame/);
  for (const f of ["ProjectsPage.tsx", "AgentsPage.tsx", "MetasPage.tsx", "FinanceiroPage.tsx", "ConversationsDrawer.tsx", "SettingsPage.tsx"]) assert.match(src(f), /ConfirmCard/, f);
});
