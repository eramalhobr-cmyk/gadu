import assert from "node:assert/strict";
import { test } from "node:test";
import { acoesRules, matchByName, parseAcoes, TIPOS, validAcao } from "./acoes.ts";

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

test("conta_desmarcar e conta_valor: valor positivo, 'proximos' só quando dito", () => {
  assert.deepEqual(validAcao({ tipo: "conta_desmarcar", conta: "luz" }, NOW), { tipo: "conta_desmarcar", conta: "luz" });
  assert.equal(validAcao({ tipo: "conta_desmarcar" }, NOW), null);
  assert.deepEqual(validAcao({ tipo: "conta_valor", conta: "luz", valor: "R$ 210,50" }, NOW), { tipo: "conta_valor", conta: "luz", valor: 210.5, escopo: "mes" });
  assert.deepEqual(validAcao({ tipo: "conta_valor", conta: "luz", valor: 100, escopo: "proximos" }, NOW), { tipo: "conta_valor", conta: "luz", valor: 100, escopo: "proximos" });
  assert.equal(validAcao({ tipo: "conta_valor", conta: "luz", valor: 0 }, NOW), null, "zero tiraria a conta do mês: não por voz");
  assert.equal(validAcao({ tipo: "conta_valor", conta: "luz", valor: "abc" }, NOW), null);
});

test("gasto_apagar e gasto_editar: precisam de como achar o gasto; editar precisa de uma mudança", () => {
  assert.deepEqual(validAcao({ tipo: "gasto_apagar", gasto: "mercado", valor: 50, data: "2026-11-20" }, NOW), { tipo: "gasto_apagar", gasto: "mercado", valor: 50, data: "2026-11-20" });
  assert.deepEqual(validAcao({ tipo: "gasto_apagar", valor: "45,5" }, NOW), { tipo: "gasto_apagar", gasto: "", valor: 45.5, data: null });
  assert.equal(validAcao({ tipo: "gasto_apagar" }, NOW), null, "sem nome, valor nem data");
  assert.equal(validAcao({ tipo: "gasto_apagar", gasto: "x", valor: -1, data: "2026-11-30" }, NOW)?.tipo, "gasto_apagar", "valor e data inválidos só deixam de filtrar");
  const e = validAcao({ tipo: "gasto_editar", gasto: "feira", de_valor: 100, valor: 120, categoria: "supermercado", meio: "Cartão de crédito", data: "2026-11-21" }, NOW);
  assert.deepEqual(e, { tipo: "gasto_editar", gasto: "feira", de_valor: 100, de_data: null, valor: 120, categoria: "Mercado", descricao: null, meio: "credito", data: "2026-11-21" });
  assert.equal(validAcao({ tipo: "gasto_editar", gasto: "feira" }, NOW), null, "sem mudança");
  assert.equal(validAcao({ tipo: "gasto_editar", valor: 5 }, NOW), null, "sem como achar");
  assert.equal(validAcao({ tipo: "gasto_editar", gasto: "feira", data: "2026-11-25" }, NOW), null, "data futura");
  assert.equal((validAcao({ tipo: "gasto_editar", gasto: "feira", descricao: "" }, NOW) as { descricao: string }).descricao, "", "limpar a descrição vale");
});

test("evento_editar e evento_apagar", () => {
  assert.deepEqual(validAcao({ tipo: "evento_editar", evento: "Dentista", titulo: "Dentista da Ana", inicio: "2026-11-24T15:00:00-03:00", local: "Clínica" }, NOW),
    { tipo: "evento_editar", evento: "Dentista", titulo: "Dentista da Ana", inicio: "2026-11-24T18:00:00.000Z", fim: null, local: "Clínica" });
  assert.equal(validAcao({ tipo: "evento_editar", evento: "Dentista" }, NOW), null);
  assert.equal(validAcao({ tipo: "evento_editar", evento: "Dentista", inicio: "2026-11-01T15:00:00-03:00" }, NOW), null, "início no passado");
  assert.deepEqual(validAcao({ tipo: "evento_apagar", evento: "Dentista" }, NOW), { tipo: "evento_apagar", evento: "Dentista" });
  assert.equal(validAcao({ tipo: "evento_apagar", evento: " " }, NOW), null);
});

test("meta pausar, retomar, arquivar e editar; projeto editar e arquivar", () => {
  for (const t of ["meta_pausar", "meta_retomar", "meta_arquivar"] as const) {
    assert.deepEqual(validAcao({ tipo: t, meta: " Correr  50 km " }, NOW), { tipo: t, meta: "Correr 50 km" });
    assert.equal(validAcao({ tipo: t }, NOW), null);
  }
  assert.deepEqual(validAcao({ tipo: "meta_editar", meta: "Correr", titulo: "Correr 60 km", alvo: "60", prazo: "2027-03-01" }, NOW), { tipo: "meta_editar", meta: "Correr", titulo: "Correr 60 km", alvo: 60, prazo: "2027-03-01" });
  assert.deepEqual(validAcao({ tipo: "meta_editar", meta: "Correr", alvo: 0 }, NOW), { tipo: "meta_editar", meta: "Correr", titulo: null, alvo: 0, prazo: null }, "alvo 0 é número válido");
  assert.equal(validAcao({ tipo: "meta_editar", meta: "Correr" }, NOW), null, "sem mudança");
  assert.equal(validAcao({ tipo: "meta_editar", meta: "Correr", prazo: "2026-01-01" }, NOW), null, "prazo no passado");
  assert.deepEqual(validAcao({ tipo: "projeto_editar", projeto: "Casa", nome: "Casa nova", objetivo: "Mudar até junho" }, NOW), { tipo: "projeto_editar", projeto: "Casa", nome: "Casa nova", objetivo: "Mudar até junho" });
  assert.deepEqual(validAcao({ tipo: "projeto_editar", projeto: "Casa", objetivo: "" }, NOW), { tipo: "projeto_editar", projeto: "Casa", nome: null, objetivo: "" }, "limpar o objetivo vale");
  assert.equal(validAcao({ tipo: "projeto_editar", projeto: "Casa" }, NOW), null);
  assert.deepEqual(validAcao({ tipo: "projeto_arquivar", projeto: "Casa" }, NOW), { tipo: "projeto_arquivar", projeto: "Casa" });
  assert.equal(validAcao({ tipo: "projeto_arquivar" }, NOW), null);
});

test("memória aprovar, recusar e esquecer; nova conversa; navegar", () => {
  assert.deepEqual(validAcao({ tipo: "memoria_aprovar", memoria: "mora em Curitiba" }, NOW), { tipo: "memoria_aprovar", memoria: "mora em Curitiba", todas: false });
  assert.deepEqual(validAcao({ tipo: "memoria_aprovar", todas: true }, NOW), { tipo: "memoria_aprovar", memoria: null, todas: true });
  assert.equal(validAcao({ tipo: "memoria_aprovar" }, NOW), null);
  assert.deepEqual(validAcao({ tipo: "memoria_recusar", memoria: "gosta de café" }, NOW), { tipo: "memoria_recusar", memoria: "gosta de café" });
  assert.deepEqual(validAcao({ tipo: "memoria_esquecer", memoria: "Curitiba" }, NOW), { tipo: "memoria_esquecer", memoria: "Curitiba" });
  assert.equal(validAcao({ tipo: "memoria_esquecer", memoria: "" }, NOW), null);
  assert.deepEqual(validAcao({ tipo: "nova_conversa" }, NOW), { tipo: "nova_conversa" });
  for (const [dito, view] of [["Financeiro", "financeiro"], ["finanças", "financeiro"], ["Metas", "metas"], ["tarefas", "tarefas"], ["Início", "hoje"], ["Configurações", "ajustes"], ["mais", "modulos"], ["Memória", "memoria"]] as const) {
    assert.deepEqual(validAcao({ tipo: "navegar", destino: dito }, NOW), { tipo: "navegar", destino: view }, dito);
  }
  for (const ruim of ["admin", "3d", "studio", "casa", "../etc", "", 5, null]) assert.equal(validAcao({ tipo: "navegar", destino: ruim }, NOW), null, String(ruim));
});

test("guia: abrir o guia de primeiro uso por voz (sem dados, sem gravar)", () => {
  assert.deepEqual(validAcao({ tipo: "guia" }, NOW), { tipo: "guia" });
  assert.deepEqual(validAcao({ tipo: "guia", lixo: "x" }, NOW), { tipo: "guia" }, "campo extra é ignorado");
  assert.ok((TIPOS as readonly string[]).includes("guia"));
  assert.match(acoesRules(), /"tipo":"guia"/);
});

test("salario_simular: valor e dependentes validados; 'salvar' só quando dito; nada é adivinhado", () => {
  assert.deepEqual(validAcao({ tipo: "salario_simular", bruto: 8000 }, NOW), { tipo: "salario_simular", bruto: 8000, dependentes: 0, salvar: false });
  assert.deepEqual(validAcao({ tipo: "salario_simular", bruto: "R$ 6.500,00", dependentes: "2", salvar: true }, NOW), { tipo: "salario_simular", bruto: 6500, dependentes: 2, salvar: true });
  assert.deepEqual(validAcao({ tipo: "salario_simular", bruto: 5000, salvar: "talvez" }, NOW), { tipo: "salario_simular", bruto: 5000, dependentes: 0, salvar: false });
  for (const bad of [{ bruto: 0 }, { bruto: -1 }, { bruto: "abc" }, {}, { bruto: 5000, dependentes: -1 }, { bruto: 5000, dependentes: 1.5 }, { bruto: 5000, dependentes: 99 }, { bruto: 5000, dependentes: "x" }]) {
    assert.equal(validAcao({ tipo: "salario_simular", ...bad }, NOW), null, JSON.stringify(bad));
  }
  assert.match(acoesRules(), /salario_simular/);
});

test("ajuste de velocidade e de voz: número no intervalo, relativo ou normal; nada fora disso", () => {
  assert.deepEqual(validAcao({ tipo: "ajuste", opcao: "velocidade", valor: 1.23 }, NOW), { tipo: "ajuste", ajuste: { opcao: "velocidade", valor: 1.25 } });
  assert.deepEqual(validAcao({ tipo: "ajuste", opcao: "velocidade", valor: "mais devagar" }, NOW), { tipo: "ajuste", ajuste: { opcao: "velocidade", valor: "mais_devagar" } });
  assert.deepEqual(validAcao({ tipo: "ajuste", opcao: "velocidade", valor: "mais_rápido" }, NOW), { tipo: "ajuste", ajuste: { opcao: "velocidade", valor: "mais_rapido" } });
  assert.deepEqual(validAcao({ tipo: "ajuste", opcao: "velocidade", valor: "normal" }, NOW), { tipo: "ajuste", ajuste: { opcao: "velocidade", valor: 1 } });
  assert.equal(validAcao({ tipo: "ajuste", opcao: "velocidade", valor: 3 }, NOW), null);
  assert.equal(validAcao({ tipo: "ajuste", opcao: "velocidade", valor: "voando" }, NOW), null);
  assert.deepEqual(validAcao({ tipo: "ajuste", opcao: "voz_trocar", valor: "proxima" }, NOW), { tipo: "ajuste", ajuste: { opcao: "voz_trocar", valor: "proxima" } });
  assert.equal(validAcao({ tipo: "ajuste", opcao: "voz_trocar", valor: "https://x" }, NOW), null);
});

test("conversa_abrir: precisa de um assunto", () => {
  assert.deepEqual(validAcao({ tipo: "conversa_abrir", busca: "  o condomínio  " }, NOW), { tipo: "conversa_abrir", busca: "o condomínio" });
  assert.equal(validAcao({ tipo: "conversa_abrir", busca: "" }, NOW), null);
  assert.equal(validAcao({ tipo: "conversa_abrir" }, NOW), null);
});

test("meta_registro_apagar: valor e data opcionais; valor inválido derruba a ação", () => {
  assert.deepEqual(validAcao({ tipo: "meta_registro_apagar", meta: "corrida" }, NOW), { tipo: "meta_registro_apagar", meta: "corrida", valor: null, data: null });
  assert.deepEqual(validAcao({ tipo: "meta_registro_apagar", meta: "corrida", valor: "5" }, NOW)?.tipo, "meta_registro_apagar");
  assert.equal(validAcao({ tipo: "meta_registro_apagar", meta: "corrida", valor: "muito" }, NOW), null);
  assert.equal(validAcao({ tipo: "meta_registro_apagar", meta: "" }, NOW), null);
});

test("conta_criar e receita_principal: validação estrita", () => {
  assert.deepEqual(validAcao({ tipo: "conta_criar", nome: "Água", valor: "90", dia: 10, todoMes: true }, NOW), { tipo: "conta_criar", contaTipo: "despesa", nome: "Água", valor: 90, dia: 10, grupo: null, todoMes: true });
  assert.equal(validAcao({ tipo: "conta_criar", nome: "Água", dia: 40 }, NOW), null);
  assert.equal(validAcao({ tipo: "conta_criar", nome: "Água", valor: "caro" }, NOW), null);
  assert.equal(validAcao({ tipo: "conta_criar", nome: "" }, NOW), null);
  assert.equal((validAcao({ tipo: "conta_criar", contaTipo: "receita", nome: "Aluguel recebido" }, NOW) as { contaTipo: string }).contaTipo, "receita");
  assert.deepEqual(validAcao({ tipo: "receita_principal", receita: "Salário" }, NOW), { tipo: "receita_principal", receita: "Salário" });
  assert.equal(validAcao({ tipo: "receita_principal" }, NOW), null);
});

test("peca3d_abrir: sem busca ou 'última' = a mais recente", () => {
  assert.deepEqual(validAcao({ tipo: "peca3d_abrir" }, NOW), { tipo: "peca3d_abrir", busca: null });
  assert.deepEqual(validAcao({ tipo: "peca3d_abrir", busca: "última peça" }, NOW), { tipo: "peca3d_abrir", busca: null });
  assert.deepEqual(validAcao({ tipo: "peca3d_abrir", busca: "suporte de celular" }, NOW), { tipo: "peca3d_abrir", busca: "suporte de celular" });
});

test("teto_definir: valor em reais ou null para tirar", () => {
  assert.deepEqual(validAcao({ tipo: "teto_definir", categoria: "restaurante", valor: "800" }, NOW), { tipo: "teto_definir", categoria: "restaurante", valor: 800 });
  assert.deepEqual(validAcao({ tipo: "teto_definir", categoria: "Lazer", valor: null }, NOW), { tipo: "teto_definir", categoria: "Lazer", valor: null });
  assert.equal(validAcao({ tipo: "teto_definir", categoria: "Lazer", valor: -5 }, NOW), null);
  assert.equal(validAcao({ tipo: "teto_definir", valor: 100 }, NOW), null);
});

test("agente_criar e agente_editar: validação", () => {
  assert.deepEqual(validAcao({ tipo: "agente_criar", nome: "  Mentor   de estudos ", area: "Estudos", instrucoes: "Seja claro.\n\n\n\nUse exemplos." }, NOW), { tipo: "agente_criar", nome: "Mentor de estudos", area: "Estudos", instrucoes: "Seja claro.\n\nUse exemplos." });
  assert.deepEqual(validAcao({ tipo: "agente_criar", nome: "Só nome" }, NOW), { tipo: "agente_criar", nome: "Só nome", area: null, instrucoes: null });
  assert.equal(validAcao({ tipo: "agente_criar", nome: "  " }, NOW), null);
  assert.equal((validAcao({ tipo: "agente_criar", nome: "x".repeat(200) }, NOW) as { nome: string }).nome.length, 60);
  assert.equal((validAcao({ tipo: "agente_criar", nome: "x", instrucoes: "y".repeat(9000) }, NOW) as { instrucoes: string }).instrucoes.length, 4000);
  assert.deepEqual(validAcao({ tipo: "agente_editar", agente: "Mentor", instrucoes: "", ativo: "false" }, NOW), { tipo: "agente_editar", agente: "Mentor", nome: null, area: null, instrucoes: "", ativo: false }, "instruções vazias limpam; ativo aceita texto");
  assert.deepEqual(validAcao({ tipo: "agente_editar", agente: "Mentor", nome: "Novo" }, NOW), { tipo: "agente_editar", agente: "Mentor", nome: "Novo", area: null, instrucoes: null, ativo: null });
  assert.equal(validAcao({ tipo: "agente_editar", agente: "Mentor" }, NOW), null, "sem nada para mudar");
  assert.equal(validAcao({ tipo: "agente_editar", nome: "Novo" }, NOW), null, "sem dizer qual agente");
});
