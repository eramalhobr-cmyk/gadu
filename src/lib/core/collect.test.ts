import assert from "node:assert/strict";
import { test } from "node:test";
import { collectAttention } from "./collect.ts";
import { formatCoreBlock, toItem } from "./format.ts";
import { planFor } from "./plan.ts";
import { fakeDb, fakeGoogle, SCOPE_CAL, SCOPE_MAIL } from "./testing.ts";
import type { CalEvent, Mail } from "../google-format.ts";

const NOW = new Date("2026-11-22T15:00:00Z"); // 12:00 em Brasília; hoje = 2026-11-22
const A = "user-a";
const B = "user-b";
const task = (id: number, user: string, title: string, due: string | null, priority = 2, project: string | null = null) =>
  ({ id, user_id: user, title, due_date: due, priority, status: "open", projects: project ? { name: project } : null });
const ev = (id: string, title: string, start: string, end: string, extra: Partial<CalEvent> = {}): CalEvent => ({ id, title, start, end, allDay: false, meet: false, declined: false, ...extra });
const mail = (thread: string, from: string, subject: string, important = false, snippet = "corpo secreto do e-mail"): Mail => ({ thread, from, subject, snippet, date: "", important });

const dataset = () => ({
  tasks: [
    task(1, A, "Pagar fornecedor", "2026-11-12", 1, "Casa"), task(2, A, "Enviar relatório", "2026-11-20"), task(3, A, "Ligar para o contador", "2026-11-22"), task(4, A, "Estudar inglês", null, 1),
    task(90, B, "Segredo de B atrasado", "2026-11-01"), task(91, B, "Outra de B", "2026-11-22"),
  ],
  reminders: [{ id: 7, user_id: A, text: "Tomar remédio às 18h", due_at: "2026-11-22T21:00:00Z", status: "pending" }, { id: 70, user_id: B, text: "Lembrete de B", due_at: "2026-11-22T21:00:00Z", status: "pending" }],
});

test("sessão de A: só fatos de A, com origem e etiquetas T/L/A/E", async () => {
  const { db, calls } = fakeDb(A, dataset());
  const { reader } = fakeGoogle({
    events_: [ev("e1", "Reunião de equipe", "2026-11-22T17:00:00Z", "2026-11-22T18:00:00Z"), ev("e2", "Dentista", "2026-11-22T20:00:00Z", "2026-11-22T21:00:00Z")],
    mails_: [mail("abc123", "Banco Exemplo", "Fatura disponível", true)],
  });
  const r = await collectAttention({ userId: A, db, google: reader, blocked: [], now: NOW });
  const all = JSON.stringify(r);
  assert.ok(!/Segredo de B|Outra de B|Lembrete de B/.test(all), "nada de B");
  assert.ok(r.facts.every((f) => f.scope === "pessoal" && f.module === "pessoal"));
  assert.deepEqual(r.facts.map((f) => f.tag).sort(), ["A1", "A2", "E1", "L1", "T1", "T2", "T3", "T4"]);
  assert.deepEqual(r.unavailable, []);
  // Ordem de prioridade: atrasadas primeiro.
  assert.equal(r.facts[0].tag, "T1");
  assert.match(r.facts[0].text, /atrasada desde 12\/11: Pagar fornecedor \(projeto Casa\)/);
  assert.deepEqual(r.facts[0].source, { table: "tasks", id: 1 });
  assert.equal(r.facts.find((f) => f.tag === "L1")!.source.table, "reminders");
  assert.equal(r.facts.find((f) => f.tag === "A1")!.source.table, "google_calendar");
  assert.equal(r.facts.find((f) => f.tag === "E1")!.source.table, "gmail");
  // As consultas filtram pelo user_id da SESSÃO (defesa em profundidade além da RLS) e nunca pedem outro.
  const eqUsers = calls.filter((c) => c.op === "eq" && c.args[0] === "user_id").map((c) => c.args[1]);
  assert.ok(eqUsers.length >= 2 && eqUsers.every((u) => u === A), "só o user_id da sessão");
});

test("sessão de B no mesmo banco: só fatos de B", async () => {
  const { db } = fakeDb(B, dataset());
  const r = await collectAttention({ userId: B, db, google: null, blocked: [], now: NOW });
  const all = JSON.stringify(r);
  assert.ok(all.includes("Segredo de B atrasado"));
  assert.ok(!all.includes("Pagar fornecedor") && !all.includes("Tomar remédio"));
});

test("defesa em profundidade: mesmo que a RLS falhasse (banco devolvendo tudo), o filtro por user_id da sessão exclui B", async () => {
  const { db } = fakeDb(A, dataset(), { noRls: true });
  const r = await collectAttention({ userId: A, db, google: null, blocked: [], now: NOW });
  assert.ok(r.facts.length >= 4);
  assert.ok(!/Segredo de B|Outra de B|Lembrete de B/.test(JSON.stringify(r)), "sem texto de B");
});

test("Google desconectado: agenda e e-mail indisponíveis, o resto segue", async () => {
  const { db } = fakeDb(A, dataset());
  const r = await collectAttention({ userId: A, db, google: fakeGoogle({ connected: false, scopes: [] }).reader, blocked: [], now: NOW });
  assert.deepEqual(r.unavailable.map((u) => [u.source, u.reason]), [["agenda", "not_connected"], ["email", "not_connected"]]);
  assert.equal(r.unavailable[0].text, "Sua agenda não está conectada.");
  assert.ok(r.facts.some((f) => f.tag === "T1") && r.facts.every((f) => f.tag[0] !== "A" && f.tag[0] !== "E"));
  const block = formatCoreBlock(r);
  assert.match(block, /Sua agenda não está conectada\./);
  assert.match(block, /Sua caixa de e-mail não está conectada\./);
  // Sem leitor de Google (não configurado) é o mesmo.
  const r2 = await collectAttention({ userId: A, db, google: null, blocked: [], now: NOW });
  assert.deepEqual(r2.unavailable.map((u) => u.source), ["agenda", "email"]);
});

test("e-mail ausente: sem o escopo do Gmail, vai para unavailable e o Gmail NÃO é consultado", async () => {
  const { db } = fakeDb(A, dataset());
  const g = fakeGoogle({ scopes: [SCOPE_CAL], mails_: [mail("x1", "Alguém", "Assunto")], events_: [ev("e1", "Reunião", "2026-11-22T17:00:00Z", "2026-11-22T18:00:00Z")] });
  const r = await collectAttention({ userId: A, db, google: g.reader, blocked: [], now: NOW });
  assert.equal(g.spy.inbox, 0, "não chamou o Gmail");
  const u = r.unavailable.find((x) => x.source === "email");
  assert.equal(u?.reason, "scope");
  assert.ok(r.facts.some((f) => f.tag === "A1"), "agenda segue");
  assert.ok(!r.facts.some((f) => f.tag.startsWith("E")));
  // Sem escopo de agenda, só o e-mail entra.
  const g2 = fakeGoogle({ scopes: [SCOPE_MAIL], mails_: [mail("x1", "Alguém", "Assunto")] });
  const r2 = await collectAttention({ userId: A, db, google: g2.reader, blocked: [], now: NOW });
  assert.equal(r2.unavailable.find((x) => x.source === "agenda")?.reason, "scope");
  assert.ok(r2.facts.some((f) => f.tag === "E1"));
});

test("e-mail enxuto: no máximo 5, importantes primeiro, só remetente e assunto (sem corpo)", async () => {
  const { db } = fakeDb(A, { tasks: [], reminders: [] });
  const mails = Array.from({ length: 8 }, (_, i) => mail(`t${i}`, `Remetente ${i}`, `Assunto ${i}`, i === 6 || i === 7, `CORPO-SECRETO-${i}`));
  const g = fakeGoogle({ mails_: mails });
  const r = await collectAttention({ userId: A, db, google: g.reader, blocked: [], now: NOW });
  const emails = r.facts.filter((f) => f.kind === "email");
  assert.equal(emails.length, 5);
  assert.match(emails[0].text, /Remetente (6|7)/);
  assert.ok(emails[0].text.startsWith("E-mail importante"));
  assert.ok(!JSON.stringify(r).includes("CORPO-SECRETO"));
  assert.ok(g.spy.inboxMax <= 10);
  assert.match(emails[0].href ?? "", /^https:\/\/mail\.google\.com\//);
});

test("Gmail ou agenda com erro: aviso honesto, sem quebrar; acesso revogado tem texto próprio", async () => {
  const { db } = fakeDb(A, dataset());
  const boom = Object.assign(new Error("api"), { kind: "api" });
  const rev = Object.assign(new Error("revoked"), { kind: "revoked" });
  const r = await collectAttention({ userId: A, db, google: fakeGoogle({ events: async () => { throw boom; }, inbox: async () => { throw rev; } }).reader, blocked: [], now: NOW });
  assert.equal(r.unavailable.find((u) => u.source === "agenda")?.text, "Não consegui ler a agenda agora.");
  assert.equal(r.unavailable.find((u) => u.source === "email")?.reason, "revoked");
  assert.ok(r.facts.some((f) => f.tag === "T1"));
  // status() falhando também não quebra
  const r2 = await collectAttention({ userId: A, db, google: fakeGoogle({ status: async () => { throw new Error("x"); } }).reader, blocked: [], now: NOW });
  assert.deepEqual(r2.unavailable.map((u) => u.reason), ["error", "error"]);
});

test("falha nas tarefas vira indisponível, não erro", async () => {
  const { db } = fakeDb(A, dataset(), { error: ["tasks"] });
  const r = await collectAttention({ userId: A, db, google: null, blocked: [], now: NOW });
  assert.equal(r.unavailable.find((u) => u.source === "tarefas")?.reason, "error");
  assert.ok(r.facts.some((f) => f.tag === "L1"));
});

test("agenda: recusados e já encerrados ficam de fora; o que está acontecendo é marcado", async () => {
  const { db } = fakeDb(A, { tasks: [], reminders: [] });
  const g = fakeGoogle({ events_: [
    ev("p", "Já passou", "2026-11-22T11:00:00Z", "2026-11-22T12:00:00Z"),
    ev("r", "Recusado", "2026-11-22T20:00:00Z", "2026-11-22T21:00:00Z", { declined: true }),
    ev("l", "Em andamento", "2026-11-22T14:30:00Z", "2026-11-22T15:30:00Z"),
    ev("d", "Aniversário", "2026-11-22", "2026-11-23", { allDay: true }),
  ] });
  const r = await collectAttention({ userId: A, db, google: g.reader, blocked: [], now: NOW });
  const texts = r.facts.map((f) => f.text).join("\n");
  assert.ok(!texts.includes("Já passou") && !texts.includes("Recusado"));
  assert.match(texts, /Agenda 11:30–12:30, agora: Em andamento/);
  assert.match(texts, /Agenda dia todo: Aniversário/);
});

test("privacidade: termo bloqueado e dado sensível aparecem só como omitidos, em todas as fontes", async () => {
  const d = dataset();
  d.tasks.push(task(5, A, "Revisar contrato da Acme", "2026-11-21"), task(6, A, "Enviar CPF 123.456.789-09", "2026-11-22"));
  d.reminders.push({ id: 8, user_id: A, text: "Ligar para a Acme", due_at: "2026-11-22T20:00:00Z", status: "pending" });
  const { db } = fakeDb(A, d);
  const g = fakeGoogle({
    events_: [ev("e1", "Almoço com Acme", "2026-11-22T17:00:00Z", "2026-11-22T18:00:00Z"), ev("e2", "Exame médico de rotina: laudo", "2026-11-22T19:00:00Z", "2026-11-22T20:00:00Z")],
    mails_: [mail("m1", "Acme Financeiro", "Proposta"), mail("m2", "Amigo", "Oi", false, "minha senha é 1234")],
  });
  const r = await collectAttention({ userId: A, db, google: g.reader, blocked: ["acme"], now: NOW });
  const block = formatCoreBlock(r);
  for (const bad of ["Acme", "acme", "123.456.789-09", "laudo", "senha é"]) assert.ok(!block.includes(bad), `bloco não contém "${bad}"`);
  assert.ok(!JSON.stringify(r.facts.map(toItem)).match(/Acme|123\.456|laudo/), "interface também não");
  assert.equal(r.facts.filter((f) => f.omitted).length, 7);
  assert.match(block, /\(omitido pela regra de privacidade\)/);
  // Fatos omitidos continuam com origem e tela, para a pessoa abrir.
  assert.ok(r.facts.filter((f) => f.omitted).every((f) => f.source.id !== undefined && f.view));
});

test("limites: no máximo maxFacts, bloco até 6.000 caracteres, corte por prioridade e 'e mais N'", async () => {
  const tasks = Array.from({ length: 60 }, (_, i) => task(100 + i, A, `Tarefa ${i} ${"x".repeat(180)}`, i < 10 ? "2026-11-01" : "2026-11-22"));
  const { db } = fakeDb(A, { tasks, reminders: [] });
  const r = await collectAttention({ userId: A, db, google: null, blocked: [], now: NOW });
  const block = formatCoreBlock(r);
  assert.ok(block.length <= 6000, `bloco com ${block.length} caracteres`);
  assert.ok(r.facts.length <= 30);
  assert.ok(r.more > 0 && r.facts.length + r.more === 60);
  assert.match(block, new RegExp(`e mais ${r.more} itens não listados`));
  // O corte tira os menos urgentes: as 10 atrasadas estão todas dentro.
  assert.equal(r.facts.filter((f) => f.kind === "atrasada").length, 10);
  // Tags seguidas, sem buracos.
  assert.deepEqual(r.facts.map((f) => f.tag), r.facts.map((_, i) => `T${i + 1}`));
  // Limite menor via plano (cartão da tela Hoje).
  const r5 = await collectAttention({ userId: A, db, google: null, blocked: [], now: NOW, plan: planFor("atencao_hoje", { maxFacts: 5 }) });
  assert.equal(r5.facts.length, 5);
  assert.equal(r5.more, 55);
});

test("corte por prioridade entre fontes: atrasadas e hoje vencem e-mails comuns e eventos distantes", async () => {
  const { db } = fakeDb(A, dataset());
  const g = fakeGoogle({
    events_: [ev("1", "E1", "2026-11-22T17:00:00Z", "2026-11-22T18:00:00Z"), ev("2", "E2", "2026-11-22T18:00:00Z", "2026-11-22T19:00:00Z"), ev("3", "E3 distante", "2026-11-22T22:00:00Z", "2026-11-22T23:00:00Z")],
    mails_: [mail("a", "Fulano", "Comum")],
  });
  const r = await collectAttention({ userId: A, db, google: g.reader, blocked: [], now: NOW, plan: planFor("atencao_hoje", { maxFacts: 6 }) });
  const kinds = r.facts.map((f) => f.kind);
  assert.deepEqual(kinds.slice(0, 3), ["atrasada", "atrasada", "tarefa_hoje"]);
  assert.ok(!r.facts.some((f) => f.text.includes("E3 distante")));
  assert.ok(!r.facts.some((f) => f.kind === "email"));
});

test("vazio: bloco honesto, sem fatos fictícios", async () => {
  const { db } = fakeDb(A, { tasks: [], reminders: [] });
  const r = await collectAttention({ userId: A, db, google: fakeGoogle().reader, blocked: [], now: NOW });
  assert.deepEqual(r, { facts: [], unavailable: [], more: 0 });
  const block = formatCoreBlock(r);
  assert.match(block, /nenhum item pendente/);
  assert.match(block, /Cite a etiqueta/);
});

test("o bloco instrui a citar etiquetas e a dizer o que está indisponível", async () => {
  const { db } = fakeDb(A, dataset());
  const block = formatCoreBlock(await collectAttention({ userId: A, db, google: null, blocked: [], now: NOW }));
  assert.match(block, /\[T1\] Tarefa atrasada/);
  assert.match(block, /\[L1\] Lembrete/);
  assert.match(block, /Cite a etiqueta/);
  assert.match(block, /Diga explicitamente o que está indisponível/);
});

test("resumo de Fontes: contagem por tipo, em pt-BR", async () => {
  const { summarizeSources } = await import("./format.ts");
  assert.equal(summarizeSources([{ kind: "atrasada" }, { kind: "tarefa_hoje" }, { kind: "lembrete" }, { kind: "evento" }, { kind: "email" }]), "2 tarefas, 1 lembrete, 1 compromisso, 1 e-mail");
  assert.equal(summarizeSources([]), "");
});
