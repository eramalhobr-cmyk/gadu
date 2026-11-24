import assert from "node:assert/strict";
import { test } from "node:test";
import { blocoFilhos, comigoNo, consultarData, dataValida, feriadoEm, fimsDeSemana, pascoa, pedeFilhos, sabadoDe, type AjusteFilhos, type ConfigFilhos } from "./agenda.ts";

// Referência fictícia: sábado 28/11/2026 com a pessoa.
const cfg: ConfigFilhos = { ancora: "2026-11-28", inicio: "sexta", fim: "domingo", feriadoSegue: true };

test("sabadoDe: sexta, sábado, domingo e segunda caem no mesmo fim de semana; terça a quinta vão para o próximo", () => {
  assert.equal(sabadoDe("2026-11-27"), "2026-11-28");
  assert.equal(sabadoDe("2026-11-28"), "2026-11-28");
  assert.equal(sabadoDe("2026-11-29"), "2026-11-28");
  assert.equal(sabadoDe("2026-11-30"), "2026-11-28");
  assert.equal(sabadoDe("2026-12-01"), "2026-12-05");
  assert.equal(sabadoDe("2026-12-03"), "2026-12-05");
});

test("alterna a cada semana, antes e depois da referência, inclusive na virada do ano", () => {
  assert.equal(comigoNo("2026-11-28", cfg, []).comigo, true);
  assert.equal(comigoNo("2026-12-05", cfg, []).comigo, false);
  assert.equal(comigoNo("2026-12-12", cfg, []).comigo, true);
  assert.equal(comigoNo("2026-11-21", cfg, []).comigo, false, "antes da referência");
  assert.equal(comigoNo("2026-11-14", cfg, []).comigo, true, "duas semanas antes");
  assert.equal(comigoNo("2026-12-26", cfg, []).comigo, true);
  assert.equal(comigoNo("2027-01-02", cfg, []).comigo, false, "virada do ano mantém a alternância");
  assert.equal(comigoNo("2027-01-09", cfg, []).comigo, true);
});

test("troca muda só aquele fim de semana; a alternância seguinte continua igual", () => {
  const ajustes: AjusteFilhos[] = [{ id: "t1", tipo: "troca", data: "2026-12-05", comigo: true }];
  assert.deepEqual(comigoNo("2026-12-05", cfg, ajustes), { comigo: true, origem: "troca" });
  assert.equal(comigoNo("2026-12-12", cfg, ajustes).comigo, true, "o seguinte não muda");
  assert.equal(comigoNo("2026-12-19", cfg, ajustes).comigo, false);
});

test("mudança permanente recomeça a alternância só daquela data em diante", () => {
  const ajustes: AjusteFilhos[] = [{ id: "r1", tipo: "recorrencia", data: "2027-01-02", comigo: true }];
  assert.equal(comigoNo("2026-12-26", cfg, ajustes).comigo, true, "antes da mudança, como era");
  assert.deepEqual(comigoNo("2027-01-02", cfg, ajustes), { comigo: true, origem: "recorrencia" });
  assert.equal(comigoNo("2027-01-09", cfg, ajustes).comigo, false, "inverte a partir dali");
  // Troca em cima de recorrência vale para aquele fim de semana.
  assert.equal(comigoNo("2027-01-09", cfg, [...ajustes, { id: "t", tipo: "troca", data: "2027-01-09", comigo: true }]).comigo, true);
});

test("feriados nacionais: Páscoa, Carnaval, Sexta-feira Santa e Corpus Christi móveis; fixos conferidos", () => {
  assert.equal(pascoa(2026), "2026-04-05");
  assert.equal(pascoa(2027), "2027-03-28");
  assert.equal(feriadoEm("2026-04-03"), "Sexta-feira Santa");
  assert.equal(feriadoEm("2026-02-16"), "Carnaval (segunda)");
  assert.equal(feriadoEm("2026-06-04"), "Corpus Christi");
  assert.equal(feriadoEm("2026-11-20"), "Consciência Negra");
  assert.equal(feriadoEm("2026-11-19"), null);
});

test("feriado colado segue o fim de semana; sem a regra, fica sem resposta", () => {
  // 20/11/2026 é sexta. Com o fim de semana começando no sábado, a sexta é feriado colado ao fim de semana de 21/11 (com o outro).
  const sab: ConfigFilhos = { ...cfg, inicio: "sabado" };
  const c = consultarData("2026-11-20", sab, []);
  assert.equal(c.feriado, "Consciência Negra");
  assert.equal(c.sabado, "2026-11-21");
  assert.equal(c.comigo, false);
  assert.equal(c.motivo, "feriado colado ao fim de semana");
  const semRegra = consultarData("2026-11-20", { ...sab, feriadoSegue: false }, []);
  assert.equal(semRegra.comigo, null);
  // Com início na sexta, a própria sexta já é fim de semana.
  assert.equal(consultarData("2026-11-20", cfg, []).motivo, "fim de semana");
  // Corpus Christi 2026 é quinta: colado à sexta em que o fim de semana começa (04/06 → fim de semana de 06/06).
  assert.equal(consultarData("2026-06-04", cfg, []).motivo, "feriado colado ao fim de semana");
  // Tiradentes 2026 é terça: no meio da semana, sem regra.
  assert.equal(consultarData("2026-04-21", cfg, []).comigo, null);
  // Dia comum de semana.
  assert.equal(consultarData("2026-12-02", cfg, []).motivo, "dia de semana, sem regra definida");
});

test("segunda de fim de semana longo conta quando o fim vai até segunda", () => {
  const ateSeg: ConfigFilhos = { ...cfg, fim: "segunda" };
  assert.equal(consultarData("2026-11-30", ateSeg, []).comigo, true);
  assert.equal(consultarData("2026-11-30", cfg, []).comigo, null);
});

test("lista de fins de semana: começa no fim de semana em curso e traz feriados colados", () => {
  const fs = fimsDeSemana("2026-11-29", 3, cfg, []);
  assert.deepEqual(fs.map((f) => [f.sabado, f.de, f.ate, f.comigo]), [["2026-11-28", "2026-11-27", "2026-11-29", true], ["2026-12-05", "2026-12-04", "2026-12-06", false], ["2026-12-12", "2026-12-11", "2026-12-13", true]]);
  const nov = fimsDeSemana("2026-11-17", 1, cfg, []);
  assert.deepEqual(nov[0].feriados, [{ data: "2026-11-20", nome: "Consciência Negra" }]);
});

test("validação de data e detecção da pergunta", () => {
  assert.equal(dataValida("2026-02-31"), null);
  assert.equal(dataValida("2026-12-05"), "2026-12-05");
  assert.equal(dataValida("05/12/2026"), null);
  for (const m of ["O fim de semana que vem é meu?", "As crianças ficam comigo no feriado?", "Quando pego meus filhos?"]) assert.equal(pedeFilhos(m), true, m);
  for (const m of ["Coloca café na lista de compras", "Como está meu dia?", "Gastei 50 no mercado"]) assert.equal(pedeFilhos(m), false, m);
});

test("bloco do chat: sem configuração pede para configurar; com configuração só traz fatos", () => {
  assert.match(blocoFilhos(null, [], "2026-11-24"), /ainda não configurada/);
  const b = blocoFilhos(cfg, [], "2026-11-24");
  assert.match(b, /sex 27\/11 a dom 29\/11: com você/);
  assert.match(b, /sex 04\/12 a dom 06\/12: com o outro responsável/);
  assert.match(b, /Natal: com você/, "25/12/2026 é sexta, dentro do fim de semana de 26/12 (com você)");
});
