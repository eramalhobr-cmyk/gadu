import type { Metadata } from "next";

export const metadata: Metadata = { title: "Termos · GaDu" };

export default function Termos() {
  return (
    <main className="doc">
      <a href="/login" className="mono">← GaDu</a>
      <h1>Termos de uso</h1>
      <p className="muted">Atualizados em 9 de novembro de 2026.</p>
      <p>O GaDu é um assistente pessoal, de uso particular e por convite. Ao usar, você concorda com estes termos.</p>
      <ul>
        <li>As respostas são geradas por inteligência artificial e podem conter erros. Confira antes de tomar decisões importantes.</li>
        <li>O GaDu só lê a sua agenda e os seus e-mails quando você conecta o Google, e não envia nada em seu nome.</li>
        <li>Não use o GaDu para assuntos corporativos nem para guardar dados sensíveis.</li>
        <li>O serviço pode mudar ou ser interrompido. Você pode apagar seus dados e desconectar o Google a qualquer momento.</li>
      </ul>
      <p>Veja também a <a href="/privacidade">Política de privacidade</a>.</p>
    </main>
  );
}
