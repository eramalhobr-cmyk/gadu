// UX-4 · "Feito · Desfazer": um componente só, montado uma vez, usado por todas as telas que gravam.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const dir = new URL("../src/components/", import.meta.url);
const read = (n: string) => readFileSync(new URL(n, dir), "utf8");

test("só existe um aviso de desfazer (UndoToast), montado uma vez em GaduApp", () => {
  const donos = readdirSync(dir).filter((f) => f.endsWith(".tsx") && /className="undo-toast"/.test(read(f)));
  assert.deepEqual(donos, ["UndoToast.tsx"]);
  assert.equal((read("GaduApp.tsx").match(/<UndoToast \/>/g) ?? []).length, 1);
});

test("as telas que gravam usam o aviso único", () => {
  for (const n of ["AttentionCard", "TasksPanel", "TodayPage", "FinanceiroPage", "MetasPage", "MemoryPage", "GaduApp"]) {
    assert.match(read(`${n}.tsx`), /showUndo/, `${n} sem showUndo`);
  }
});

test("cartões da conversa: só as ações reversíveis ganham Desfazer; apagar de verdade não", () => {
  const src = read("ActionCard.tsx");
  const capture = src.slice(src.indexOf("async function capture"), src.indexOf("async function execute"));
  const reversiveis = ["tarefa_ok", "tarefa_cancelar", "tarefa_reabrir", "tarefa_adiar", "tarefa_editar", "lembrete_adiar", "lembrete_off", "memoria_aprovar", "projeto_arquivar", "conta_paga", "conta_desmarcar", "marco_ok", "meta_status", "gasto", "evento", "agente_novo", "agente_editar"];
  for (const k of reversiveis) assert.match(capture, new RegExp(`case "${k}"`), `${k} sem desfazer`);
  for (const k of ["memoria_esquecer", "memoria_recusar", "gasto_apagar", "evento_apagar", "nova_conversa", "navegar", "ajuste"]) assert.doesNotMatch(capture, new RegExp(`case "${k}"`), `${k} não deveria ter desfazer`);
});

test("o 'desfaz' falado passa pelo mesmo caminho do texto, sem modelo", () => {
  const src = read("GaduApp.tsx");
  const i = src.indexOf("parseUndoCommand(message)");
  assert.ok(i > 0 && i < src.indexOf('fetch("/api/chat"'), "o comando precisa vir antes da chamada ao /api/chat");
});
