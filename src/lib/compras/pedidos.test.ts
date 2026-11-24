import assert from "node:assert/strict";
import { test } from "node:test";
import { agruparPedidos, blocoCompras, calendarioEntregas, ehPedido, lojaDe, numeroDe, pedeCompras, previsaoDe, rastreioDe, situacaoDe, type EmailPedido } from "./pedidos.ts";

// Só dados sintéticos: lojas, números e códigos fictícios.
const e = (p: Partial<EmailPedido> & { subject: string }): EmailPedido => ({
  id: Math.random().toString(36).slice(2), from: "Loja Exemplo", fromEmail: "pedidos@lojaexemplo.test", text: "", date: "2026-11-20T12:00:00-03:00", ...p,
});

test("confirmação e envio do mesmo pedido viram um só, com a situação mais avançada", () => {
  const ps = agruparPedidos([
    e({ subject: "Pedido 123456 confirmado", text: "Recebemos seu pedido nº 123456. Previsão de entrega: 28/11.", date: "2026-11-20T10:00:00-03:00" }),
    e({ subject: "Seu pedido 123456 foi enviado", text: "Código de rastreio: AB123456789BR. Chega até 27/11.", date: "2026-11-22T10:00:00-03:00" }),
  ]);
  assert.equal(ps.length, 1);
  assert.equal(ps[0].numero, "123456");
  assert.equal(ps[0].situacao, "enviado");
  assert.equal(ps[0].rastreio, "AB123456789BR");
  assert.equal(ps[0].previsao, "2026-11-27", "vale a previsão mais recente");
  assert.equal(ps[0].emails, 2);
});

test("pedidos diferentes da mesma loja ficam separados", () => {
  const ps = agruparPedidos([
    e({ subject: "Pedido 111111 confirmado" }),
    e({ subject: "Pedido 222222 confirmado" }),
  ]);
  assert.equal(ps.length, 2);
});

test("previsão ausente fica em branco; entregue e cancelado não têm previsão", () => {
  const [p] = agruparPedidos([e({ subject: "Pedido 333333 confirmado", text: "Obrigado pela compra." })]);
  assert.equal(p.previsao, null);
  const [q] = agruparPedidos([
    e({ subject: "Pedido 444444 enviado", text: "Previsão de entrega: 25/11", date: "2026-11-20T10:00:00-03:00" }),
    e({ subject: "Pedido 444444 foi entregue", text: "Seu pedido foi entregue.", date: "2026-11-24T10:00:00-03:00" }),
  ]);
  assert.equal(q.situacao, "entregue");
  assert.equal(q.previsao, null);
});

test("propaganda não vira pedido; e-mail sem sinal de pedido também não", () => {
  assert.equal(ehPedido(e({ subject: "Ofertas de Black Friday com cupom de desconto", text: "Aproveite a entrega grátis" })), false);
  assert.equal(ehPedido(e({ subject: "Reunião amanhã", text: "pauta da semana" })), false);
  assert.equal(ehPedido(e({ subject: "Oferta: seu pedido 555555 foi enviado" })), true, "com número, conta mesmo com palavra de oferta");
});

test("previsões em formatos comuns e virada de ano", () => {
  const nov = new Date("2026-11-20T12:00:00-03:00");
  assert.equal(previsaoDe("Previsão de entrega: 28/11", nov), "2026-11-28");
  assert.equal(previsaoDe("Entrega prevista para 3 de dezembro", nov), "2026-12-03");
  assert.equal(previsaoDe("Receba até 05/01", new Date("2026-12-20T12:00:00-03:00")), "2027-01-05");
  assert.equal(previsaoDe("chega até 31/02", nov), null, "data impossível não vira previsão");
  assert.equal(previsaoDe("Sem data informada", nov), null);
});

test("situação, número, rastreio e loja", () => {
  assert.equal(situacaoDe("Seu pedido saiu para entrega"), "saiu_para_entrega");
  assert.equal(situacaoDe("Pedido cancelado a pedido do cliente"), "cancelado");
  assert.equal(situacaoDe("Pagamento aprovado"), "confirmado");
  assert.equal(numeroDe("Pedido CONFIRMADO"), null, "precisa de dígito");
  assert.equal(numeroDe("Order #98765-AB shipped"), "98765-AB");
  assert.equal(rastreioDe("rastreamento: XY987654321BR"), "XY987654321BR");
  assert.equal(rastreioDe("tracking number: 1Z999AA10123456784"), "1Z999AA10123456784");
  assert.equal(lojaDe("Loja Exemplo | Pedidos"), "Loja Exemplo");
  assert.equal(lojaDe("no-reply@entregas.exemplo.test", "no-reply@entregas.exemplo.test"), "Entregas");
});

test("e-mail sem número na mesma conversa junta-se ao pedido", () => {
  const ps = agruparPedidos([
    e({ subject: "Pedido 666666 confirmado", thread: "abc123def" }),
    e({ subject: "Atualização da sua entrega", text: "Seu pedido está a caminho", thread: "abc123def", date: "2026-11-23T10:00:00-03:00" }),
  ]);
  assert.equal(ps.length, 1);
  assert.equal(ps[0].situacao, "enviado");
});

test("calendário de entregas: por dia, só pedidos em aberto, e os sem previsão à parte", () => {
  const ps = agruparPedidos([
    e({ subject: "Pedido 700001 enviado", text: "Previsão de entrega: 26/11" }),
    e({ subject: "Pedido 700002 enviado", text: "Previsão de entrega: 26/11" }),
    e({ subject: "Pedido 700003 enviado", text: "Previsão de entrega: 29/11" }),
    e({ subject: "Pedido 700004 confirmado" }),
    e({ subject: "Pedido 700005 foi entregue", text: "entregue com sucesso" }),
  ]);
  const cal = calendarioEntregas(ps);
  assert.deepEqual(cal.dias.map((d) => [d.dia, d.pedidos.length]), [["2026-11-26", 2], ["2026-11-29", 1]]);
  assert.equal(cal.semPrevisao.length, 1);
  assert.equal(ps[ps.length - 1].situacao, "entregue", "entregues vão para o fim");
});

test("conversa: detecta perguntas de compras e monta o bloco com origem, sem inventar", () => {
  assert.ok(pedeCompras("Quando chega meu pedido?"));
  assert.ok(pedeCompras("tem alguma entrega hoje?"));
  assert.equal(pedeCompras("cria uma tarefa de comprar pão"), false);
  assert.match(blocoCompras([], "2026-11-24"), /nenhum pedido/);
  const ps = agruparPedidos([e({ subject: "Pedido 800001 enviado", text: "Previsão de entrega: 24/11" })]);
  const b = blocoCompras(ps, "2026-11-24");
  assert.match(b, /\[C1\] Loja Exemplo · pedido 800001 · A caminho · previsão: hoje/);
});

test("pedeCompras não confunde lista de mercado nem gasto com pedido online", () => {
  for (const m of ["Coloca café na lista de compras", "Abre a lista de compras", "Gastei 50 reais em compras no mercado"]) assert.equal(pedeCompras(m), false, m);
  for (const m of ["Quando chega meu pedido?", "Tem alguma entrega hoje?", "Minhas compras chegaram?"]) assert.equal(pedeCompras(m), true, m);
});
