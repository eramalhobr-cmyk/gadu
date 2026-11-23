import test from "node:test";
import assert from "node:assert/strict";
import { falaAgentes, falaFinancas, falaHoje, falaMetas, falaTarefas, parseLerResumo } from "./painel-fala.ts";

test("finanças: contas, ano e tetos perto do limite; sem dados não inventa", () => {
  const t = falaFinancas({ mes: "novembro", ano: 2026, contas: { qtd: 8, pagas: 6, aberto: "R$ 1.100" }, anoTotal: "R$ 18.950", media: "R$ 1.723", tetos: [{ categoria: "Mercado", pct: 90 }, { categoria: "Restaurantes", pct: 114 }, { categoria: "Transporte", pct: 40 }] });
  assert.match(t, /pagou 6 de 8 contas; faltam R\$ 1\.100/);
  assert.match(t, /Restaurantes passou do teto, 114%\. Mercado está em 90%/);
  assert.ok(!/Transporte/.test(t));
  const v = falaFinancas({ mes: "novembro", ano: 2026, contas: { qtd: 0, pagas: 0, aberto: "R$ 0" }, anoTotal: null, media: null, tetos: [] });
  assert.equal(v, "Em novembro, nenhuma conta cadastrada. Ainda não há gastos do dia a dia em 2026.");
});

test("tarefas, metas, agentes e hoje", () => {
  assert.equal(falaTarefas({ abertas: 3, atrasadas: 1, paraHoje: 2, feitasHoje: 0, feitas7: 4 }), "Você tem 3 tarefas abertas, 1 atrasada e 2 para hoje. Hoje concluiu 0; nos últimos 7 dias, 4.");
  assert.equal(falaTarefas({ abertas: 0, atrasadas: 0, paraHoje: 0, feitasHoje: 0, feitas7: 0 }), "Nenhuma tarefa aberta e nenhuma concluída nos últimos 7 dias.");
  assert.equal(falaMetas([{ titulo: "Correr 50 km", pct: 40, situacao: "Atrasada" }, { titulo: "Ler", pct: null, situacao: "" }]), "Você tem 2 metas ativas. Correr 50 km: 40%, atrasada. Ler: sem registro ainda.");
  assert.equal(falaAgentes({ ativos: 1, total: "US$ 0,00", top: [] }), "1 agente ativo. Nenhum gasto registrado este mês.");
  assert.equal(falaHoje({ compromissos: 1, atencao: 0, abertas: 3, feitas: 1, gasto: { pago: "R$ 4.930", previsto: "R$ 6.030" } }), "Hoje: 1 compromisso pela frente, nada pedindo atenção, 3 tarefas abertas, 1 feita. Gasto no mês: R$ 4.930 de R$ 6.030 previstos.");
  assert.equal(falaHoje({ compromissos: null, atencao: null, abertas: null, feitas: null }), "");
});

test("lê o resumo: frases curtas, sem sequestrar pedidos ao GaDu", () => {
  for (const f of ["lê o resumo", "me fala o resumo", "quero ouvir o resumo desta tela", "ler o painel"]) assert.ok(parseLerResumo(f), f);
  for (const f of ["lê o resumo da reunião", "faz um resumo", "resumo das tarefas"]) assert.ok(!parseLerResumo(f), f);
});
