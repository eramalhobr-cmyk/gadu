import assert from "node:assert/strict";
import { test } from "node:test";
import { calcularProgresso, calcularRitmo, diasEntre, metasAtencao, montarMeta, progressoTexto, ritmoTexto } from "./calc.ts";
import { fmtNum, parseNumero } from "./numero.ts";
import type { Goal, Marco, Registro, TarefaVinculada } from "./types.ts";

const goal = (o: Partial<Goal> = {}): Goal => ({
  id: "g1", titulo: "Ler 12 livros", descricao: null, categoria: "desenvolvimento", categoria_nome: null, medicao: "numerica", unidade: "livros", agregacao: "soma",
  valor_inicial: 0, valor_alvo: 12, inicio: "2026-01-01", prazo: "2026-12-31", status: "ativa", concluida_em: null, ...o,
});
const reg = (valor: number, data: string, extra: Partial<Registro> = {}): Registro => ({ id: `r-${data}-${valor}`, goal_id: "g1", valor, data, origem: "manual", nota: null, ...extra });
const marco = (feito: boolean, i = 0): Marco => ({ id: `m${i}`, goal_id: "g1", titulo: `m${i}`, data_alvo: null, ordem: i, concluido_em: feito ? "2026-03-01T00:00:00Z" : null });
const tarefa = (status: TarefaVinculada["status"], i = 0): TarefaVinculada => ({ goal_id: "g1", task_id: i, title: `t${i}`, status, due_date: null });

test("numérica por soma: valor atual = inicial + registros; % e restante", () => {
  const p = calcularProgresso(goal(), [reg(2, "2026-02-01"), reg(1, "2026-03-01"), reg(0.5, "2026-03-02")], [], []);
  assert.equal(p.atual, 3.5);
  assert.equal(p.pct, 29);
  assert.equal(p.restante, 8.5);
  assert.equal(p.semDados, false);
  assert.equal(p.ultimoRegistro, "2026-03-02");
});

test("sem registro é 'sem dados', nunca progresso inventado", () => {
  const p = calcularProgresso(goal(), [], [], []);
  assert.equal(p.semDados, true);
  assert.equal(p.pct, 0);
  assert.equal(p.ultimoRegistro, null);
  assert.equal(progressoTexto(montarMeta(goal(), [], [], [], "2026-06-01")), "Sem registros");
});

test("agregação 'ultimo' (peso): vale a medida mais recente; meta que diminui", () => {
  const g = goal({ titulo: "Chegar a 75 kg", unidade: "kg", agregacao: "ultimo", valor_inicial: 82, valor_alvo: 75 });
  const p = calcularProgresso(g, [reg(80, "2026-02-01"), reg(78, "2026-04-01"), reg(79, "2026-03-01")], [], []);
  assert.equal(p.atual, 78);
  assert.equal(p.pct, 57);
  assert.equal(p.restante, 3);
  // pior que o início não vira progresso negativo
  assert.equal(calcularProgresso(g, [reg(85, "2026-02-01")], [], []).pct, 0);
  // passou do alvo: limita em 100 e restante 0
  const alem = calcularProgresso(g, [reg(70, "2026-02-01")], [], []);
  assert.equal(alem.pct, 100); assert.equal(alem.restante, 0);
});

test("desempate no mesmo dia usa a ordem de criação", () => {
  const g = goal({ agregacao: "ultimo", valor_inicial: 0, valor_alvo: 100 });
  const p = calcularProgresso(g, [reg(10, "2026-02-01", { created_at: "2026-02-01T10:00:00Z" }), reg(20, "2026-02-01", { created_at: "2026-02-01T09:00:00Z" })], [], []);
  assert.equal(p.atual, 10);
});

test("percentual: último valor, limitado a 0..100", () => {
  const g = goal({ medicao: "percentual", unidade: null, agregacao: "ultimo", valor_alvo: 100 });
  assert.equal(calcularProgresso(g, [reg(40, "2026-02-01"), reg(65, "2026-03-01")], [], []).pct, 65);
  assert.equal(calcularProgresso(g, [reg(140, "2026-02-01")], [], []).pct, 100);
  assert.equal(progressoTexto(montarMeta(g, [reg(65, "2026-03-01")], [], [], "2026-03-02")), "65%");
});

test("marcos: feitos de total; sem marcos = sem dados", () => {
  const g = goal({ medicao: "marcos", unidade: null, valor_alvo: null });
  const p = calcularProgresso(g, [], [marco(true, 1), marco(true, 2), marco(false, 3), marco(false, 4), marco(false, 5)], []);
  assert.deepEqual([p.atual, p.alvo, p.pct, p.restante], [2, 5, 40, 3]);
  assert.equal(calcularProgresso(g, [], [], []).semDados, true);
  assert.equal(progressoTexto(montarMeta(g, [], [marco(true, 1), marco(false, 2)], [], "2026-06-01")), "1 de 2 marcos");
});

test("tarefas: concluídas entre as vinculadas; canceladas não contam", () => {
  const g = goal({ medicao: "tarefas", unidade: null, valor_alvo: null });
  const p = calcularProgresso(g, [], [], [tarefa("done", 1), tarefa("open", 2), tarefa("open", 3), tarefa("cancelled", 4), tarefa("done", 5)]);
  assert.deepEqual([p.atual, p.alvo, p.pct], [2, 4, 50]);
  assert.equal(calcularProgresso(g, [], [], [tarefa("cancelled", 1)]).semDados, true);
});

test("ritmo: no ritmo x atrasada, com tolerância", () => {
  // 2026-07-02: metade do ano passou (182 de 364 dias)
  const hoje = "2026-07-02";
  const m = (v: number) => montarMeta(goal(), [reg(v, "2026-06-01")], [], [], hoje);
  assert.equal(m(6).ritmo.situacao, "no_ritmo");
  assert.equal(m(5.7).ritmo.situacao, "no_ritmo", "dentro da tolerância de 5 pontos");
  assert.equal(m(4).ritmo.situacao, "atrasada");
  assert.equal(m(6).ritmo.esperadoPct, 50);
});

test("ritmo necessário até o prazo: por dia e por semana", () => {
  const r = montarMeta(goal(), [reg(6, "2026-06-01")], [], [], "2026-12-01").ritmo; // faltam 6 em 30 dias, mas 92% do tempo já passou
  assert.equal(r.diasRestantes, 30);
  assert.equal(r.porDia, 0.2);
  assert.equal(r.porSemana, 1.4);
  assert.equal(r.situacao, "atrasada");
  assert.equal(montarMeta(goal(), [reg(11, "2026-06-01")], [], [], "2026-12-01").ritmo.situacao, "no_ritmo");
});

test("situações especiais: vencida, batida, sem prazo, sem dados, status", () => {
  assert.equal(montarMeta(goal(), [reg(3, "2026-02-01")], [], [], "2027-01-05").ritmo.situacao, "vencida");
  assert.equal(montarMeta(goal(), [reg(12, "2026-02-01")], [], [], "2026-06-01").ritmo.situacao, "batida");
  assert.equal(montarMeta(goal({ prazo: null }), [reg(3, "2026-02-01")], [], [], "2026-06-01").ritmo.situacao, "sem_prazo");
  assert.equal(montarMeta(goal(), [], [], [], "2026-06-01").ritmo.situacao, "sem_dados");
  assert.equal(montarMeta(goal({ status: "pausada" }), [reg(1, "2026-02-01")], [], [], "2026-06-01").ritmo.situacao, "pausada");
  assert.equal(montarMeta(goal({ status: "concluida", concluida_em: "2026-05-01T00:00:00Z" }), [reg(1, "2026-02-01")], [], [], "2026-06-01").ritmo.situacao, "concluida");
  assert.equal(montarMeta(goal({ status: "arquivada" }), [], [], [], "2026-06-01").ritmo.situacao, "arquivada");
  // prazo vencido sem nenhum registro: continua "vencida" (não esconde o atraso)
  assert.equal(montarMeta(goal(), [], [], [], "2027-02-01").ritmo.situacao, "vencida");
});

test("prazo no mesmo dia do início e hoje antes do início não quebram", () => {
  const g = goal({ inicio: "2026-06-10", prazo: "2026-06-10" });
  assert.equal(montarMeta(g, [reg(1, "2026-06-10")], [], [], "2026-06-10").ritmo.situacao, "atrasada");
  assert.equal(montarMeta(goal({ inicio: "2026-09-01" }), [reg(1, "2026-02-01")], [], [], "2026-06-01").ritmo.esperadoPct, 0);
});

test("textos: sem inventar; ritmo com número e unidade", () => {
  const m = montarMeta(goal(), [reg(6, "2026-06-01")], [], [], "2026-12-01");
  assert.equal(progressoTexto(m), "6 livros de 12 livros");
  assert.match(ritmoTexto(m), /^Atrasada: faltam 6 livros em 30 dias, cerca de 1,4 livros por semana$/);
  assert.match(ritmoTexto(montarMeta(goal(), [], [], [], "2026-12-28")), /^Sem registros, prazo em 3 dias$/);
  assert.match(ritmoTexto(montarMeta(goal(), [reg(1, "2026-02-01")], [], [], "2027-01-05")), /^Prazo vencido em 31\/12$/);
});

test("metas que pedem atenção: vencidas e atrasadas primeiro, prazo próximo depois, máx. 3", () => {
  const mk = (id: string, o: Partial<Goal>, v: number) => montarMeta(goal({ id, titulo: id, ...o }), v ? [reg(v, "2026-06-01", { goal_id: id })] : [], [], [], "2026-07-02");
  const lista = [
    mk("ok", {}, 6),
    mk("atrasada", {}, 1),
    mk("vencida", { prazo: "2026-06-30" }, 1),
    mk("prazo-perto", { prazo: "2026-07-05", inicio: "2026-06-01" }, 11),
    mk("pausada", { status: "pausada", prazo: "2026-07-03" }, 1),
    mk("sem-prazo", { prazo: null }, 1),
    mk("longe", { prazo: "2026-09-01", inicio: "2026-06-01" }, 5),
  ];
  assert.deepEqual(metasAtencao(lista).map((m) => m.goal.id), ["vencida", "atrasada", "prazo-perto"]);
  assert.deepEqual(metasAtencao(lista, 7, 2).map((m) => m.goal.id), ["vencida", "atrasada"]);
  assert.deepEqual(metasAtencao([]), []);
});

test("diasEntre e números pt-BR", () => {
  assert.equal(diasEntre("2026-12-01", "2026-12-31"), 30);
  assert.equal(diasEntre("2026-12-31", "2026-12-01"), -30);
  assert.equal(diasEntre("x", "2026-12-01"), null);
  assert.equal(parseNumero("1.250,5"), 1250.5);
  assert.equal(parseNumero("5,25"), 5.25);
  assert.equal(parseNumero("2"), 2);
  assert.equal(parseNumero("1.500"), 1500);
  assert.equal(parseNumero(3.456), 3.46);
  for (const ruim of ["abc", "", "1,2,3", "1e5", null, undefined, NaN, Infinity, 2e9, "9999999999"]) assert.equal(parseNumero(ruim), null, String(ruim));
  assert.equal(fmtNum(1250.5), "1.250,5");
});
