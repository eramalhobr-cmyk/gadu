import assert from "node:assert/strict";
import { test } from "node:test";
import { matchByName, parseAcoes, validAcao } from "./acoes.ts";

const NOW = Date.parse("2026-11-22T15:00:00-03:00");

test("meta_criar: numérica exige alvo; percentual vira alvo 100; marcos exige lista", () => {
  assert.deepEqual(validAcao({ tipo: "meta_criar", titulo: "Correr 50 km", medicao: "numerica", unidade: "km", alvo: 50, prazo: "2026-12-31", categoria: "saude" }, NOW),
    { tipo: "meta_criar", titulo: "Correr 50 km", medicao: "numerica", categoria: "saude", marcos: [], unidade: "km", alvo: 50, inicial: 0, prazo: "2026-12-31" });
  assert.equal(validAcao({ tipo: "meta_criar", titulo: "Correr", medicao: "numerica" }, NOW), null);
  assert.equal((validAcao({ tipo: "meta_criar", titulo: "Inglês", medicao: "percentual" }, NOW) as { alvo: number }).alvo, 100);
  assert.equal(validAcao({ tipo: "meta_criar", titulo: "Mudar de casa", medicao: "marcos" }, NOW), null);
  assert.deepEqual((validAcao({ tipo: "meta_criar", titulo: "Mudar de casa", medicao: "marcos", marcos: ["Achar casa", "Mudança"] }, NOW) as { marcos: string[] }).marcos, ["Achar casa", "Mudança"]);
});
test("meta_criar: categoria desconhecida vira desenvolvimento; prazo no passado é ignorado", () => {
  const a = validAcao({ tipo: "meta_criar", titulo: "Ler", medicao: "tarefas", categoria: "personalizada", prazo: "2020-01-01" }, NOW) as { categoria: string; prazo: string | null };
  assert.equal(a.categoria, "desenvolvimento");
  assert.equal(a.prazo, null);
});
test("registrar exige valor positivo; data só no passado próximo", () => {
  assert.equal(validAcao({ tipo: "meta_registrar", meta: "Correr", valor: 0 }, NOW), null);
  assert.deepEqual(validAcao({ tipo: "meta_registrar", meta: "Correr", valor: "5,5", data: "2026-11-21" }, NOW), { tipo: "meta_registrar", meta: "Correr", valor: 5.5, data: "2026-11-21" });
  assert.equal((validAcao({ tipo: "meta_registrar", meta: "Correr", valor: 5, data: "2026-12-01" }, NOW) as { data: string | null }).data, null);
});
test("tarefa_adiar exige prazo futuro; conta_paga e projeto", () => {
  assert.equal(validAcao({ tipo: "tarefa_adiar", tarefa: "X", prazo: "2026-11-01" }, NOW), null);
  assert.deepEqual(validAcao({ tipo: "tarefa_adiar", tarefa: "X", prazo: "2026-11-25" }, NOW), { tipo: "tarefa_adiar", tarefa: "X", prazo: "2026-11-25" });
  assert.deepEqual(validAcao({ tipo: "conta_paga", conta: " luz " }, NOW), { tipo: "conta_paga", conta: "luz" });
  assert.deepEqual(validAcao({ tipo: "projeto_criar", nome: "Reforma", objetivo: "" }, NOW), { tipo: "projeto_criar", nome: "Reforma", objetivo: null });
});
test("ajuste: só opções conhecidas", () => {
  assert.deepEqual(validAcao({ tipo: "ajuste", opcao: "texto", valor: "maior" }, NOW), { tipo: "ajuste", ajuste: { opcao: "texto", valor: "130" } });
  assert.deepEqual(validAcao({ tipo: "ajuste", opcao: "maos_livres", valor: true }, NOW), { tipo: "ajuste", ajuste: { opcao: "maos_livres", valor: true } });
  assert.deepEqual(validAcao({ tipo: "ajuste", opcao: "tema", valor: "claro" }, NOW), { tipo: "ajuste", ajuste: { opcao: "tema", valor: "light" } });
  assert.equal(validAcao({ tipo: "ajuste", opcao: "senha", valor: "x" }, NOW), null);
  assert.equal(validAcao({ tipo: "apagar_tudo" }, NOW), null);
});
test("parseAcoes: descarta inválidas e repetidas, no máximo 5", () => {
  const l = [{ tipo: "conta_paga", conta: "luz" }, { tipo: "conta_paga", conta: "luz" }, { tipo: "x" }, ...Array.from({ length: 8 }, (_, i) => ({ tipo: "tarefa_concluir", tarefa: `T${i}` }))];
  const r = parseAcoes(l, NOW);
  assert.equal(r.length, 5);
  assert.equal(r.filter((a) => a.tipo === "conta_paga").length, 1);
  assert.deepEqual(parseAcoes("lixo", NOW), []);
});
test("matchByName: exato, contém, palavras; ambíguo devolve null", () => {
  const contas = [{ n: "Luz (Enel)" }, { n: "Internet" }, { n: "Água" }, { n: "Cartão Nubank" }, { n: "Cartão Itaú" }];
  const f = (q: string) => matchByName(contas, (c) => c.n, q)?.n ?? null;
  assert.equal(f("luz"), "Luz (Enel)");
  assert.equal(f("a internet"), "Internet");
  assert.equal(f("agua"), "Água");
  assert.equal(f("cartão"), null);
  assert.equal(f("nubank"), "Cartão Nubank");
  assert.equal(f("gás"), null);
  const metas = [{ n: "Correr 50 km em novembro" }, { n: "Ler 12 livros" }];
  assert.equal(matchByName(metas, (m) => m.n, "corrida")?.n, "Correr 50 km em novembro");
  assert.equal(matchByName(contas, (c) => c.n, "carro")?.n ?? null, null);
  assert.equal(matchByName(metas, (m) => m.n, "meta de correr")?.n, "Correr 50 km em novembro");
  assert.equal(matchByName(metas, (m) => m.n, "livros")?.n, "Ler 12 livros");
});

test("tarefa_cancelar e tarefa_reabrir só pedem o nome", () => {
  assert.deepEqual(validAcao({ tipo: "tarefa_cancelar", tarefa: " Pagar  boleto " }, NOW), { tipo: "tarefa_cancelar", tarefa: "Pagar boleto" });
  assert.deepEqual(validAcao({ tipo: "tarefa_reabrir", tarefa: "Pagar boleto" }, NOW), { tipo: "tarefa_reabrir", tarefa: "Pagar boleto" });
  assert.equal(validAcao({ tipo: "tarefa_cancelar", tarefa: "" }, NOW), null);
  assert.equal(validAcao({ tipo: "tarefa_reabrir" }, NOW), null);
});

test("tarefa_editar: precisa de ao menos uma mudança válida; prioridade 1 a 3; prazo futuro", () => {
  assert.deepEqual(validAcao({ tipo: "tarefa_editar", tarefa: "Boleto", titulo: "Boleto da luz", prioridade: 1, prazo: "2026-11-30", projeto: "Casa" }, NOW),
    { tipo: "tarefa_editar", tarefa: "Boleto", titulo: "Boleto da luz", prioridade: 1, prazo: "2026-11-30", projeto: "Casa" });
  assert.deepEqual(validAcao({ tipo: "tarefa_editar", tarefa: "Boleto", prioridade: "3" }, NOW), { tipo: "tarefa_editar", tarefa: "Boleto", titulo: null, prioridade: 3, prazo: null, projeto: null });
  assert.equal(validAcao({ tipo: "tarefa_editar", tarefa: "Boleto" }, NOW), null, "sem mudança");
  assert.equal(validAcao({ tipo: "tarefa_editar", tarefa: "Boleto", prioridade: 9, prazo: "2026-11-01" }, NOW), null, "prioridade e prazo inválidos");
  assert.equal(validAcao({ tipo: "tarefa_editar", titulo: "Novo" }, NOW), null, "sem nome da tarefa");
});

test("lembrete_adiar exige horário futuro (sem fuso = Brasília) e até 1 ano", () => {
  assert.deepEqual(validAcao({ tipo: "lembrete_adiar", lembrete: "Remédio", quando: "2026-11-23T09:00:00" }, NOW), { tipo: "lembrete_adiar", lembrete: "Remédio", quando: "2026-11-23T12:00:00.000Z" });
  assert.deepEqual(validAcao({ tipo: "lembrete_adiar", lembrete: "Remédio", quando: "2026-11-22T17:00:00-03:00" }, NOW), { tipo: "lembrete_adiar", lembrete: "Remédio", quando: "2026-11-22T20:00:00.000Z" });
  assert.equal(validAcao({ tipo: "lembrete_adiar", lembrete: "Remédio", quando: "2026-11-22T10:00:00-03:00" }, NOW), null, "passado");
  assert.equal(validAcao({ tipo: "lembrete_adiar", lembrete: "Remédio", quando: "2028-01-01T10:00:00-03:00" }, NOW), null, "longe demais");
  assert.equal(validAcao({ tipo: "lembrete_adiar", lembrete: "Remédio", quando: "amanhã" }, NOW), null);
  assert.equal(validAcao({ tipo: "lembrete_adiar", quando: "2026-11-23T09:00:00" }, NOW), null);
});
