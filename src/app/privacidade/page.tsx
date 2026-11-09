import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacidade · GaDu" };

// Política de privacidade pública (exigida pelo Google para publicar o app OAuth).
export default function Privacidade() {
  return (
    <main className="doc">
      <a href="/login" className="mono">← GaDu</a>
      <h1>Política de privacidade</h1>
      <p className="muted">Atualizada em 9 de novembro de 2026.</p>

      <p>O GaDu é um assistente pessoal por voz e texto, de uso particular e por convite. Esta página explica quais dados ele usa, para quê e como você controla tudo.</p>

      <h2>Quais dados o GaDu guarda</h2>
      <ul>
        <li>Sua conta: e-mail e nome de exibição.</li>
        <li>Suas conversas com o GaDu e os resumos que ele faz delas.</li>
        <li>As memórias que você aprova, adiciona ou importa.</li>
        <li>Preferências (voz, limites de gasto, termos bloqueados) e registros de uso para controlar custos.</li>
      </ul>

      <h2>Dados do Google (Agenda e Gmail)</h2>
      <p>Só se você conectar a sua conta Google, e sempre com permissão de leitura:</p>
      <ul>
        <li><strong>Google Agenda (somente leitura):</strong> títulos, horários e locais dos seus compromissos, para responder sobre a sua agenda e montar o briefing do dia.</li>
        <li><strong>Gmail (somente leitura):</strong> remetente, assunto e um trecho curto dos e-mails não lidos recentes, para dizer quais pedem ação.</li>
      </ul>
      <p>Esses dados são lidos na hora em que você pergunta e <strong>não são armazenados</strong> pelo GaDu, exceto quando aparecem no texto da conversa. O GaDu não envia e-mails, não apaga nada e não altera a sua agenda.</p>
      <p>E-mails que contêm dados sensíveis (documentos, senhas, dados bancários ou de saúde) ou termos que você bloqueou não são enviados à inteligência artificial.</p>
      <p>O uso e a transferência de informações recebidas das APIs do Google seguem a <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener noreferrer">Política de Dados do Usuário dos Serviços de API do Google</a>, incluindo os requisitos de Uso Limitado. Os dados do Google não são vendidos, não são usados para publicidade e não são usados para treinar modelos de inteligência artificial.</p>
      <p>O acesso ao Google fica guardado criptografado. Você pode desconectar a qualquer momento em Ajustes, Conexões: o acesso é revogado no Google e apagado do GaDu. Também é possível revogar em <a href="https://myaccount.google.com/permissions" rel="noopener noreferrer">myaccount.google.com/permissions</a>.</p>

      <h2>Com quem os dados são compartilhados</h2>
      <ul>
        <li><strong>Provedores de inteligência artificial</strong> (Anthropic e, como contingência, outros modelos via Vercel AI Gateway): recebem o texto necessário para gerar cada resposta, pela API, sem uso para treinamento.</li>
        <li><strong>Supabase</strong> (banco de dados, em São Paulo) e <strong>Vercel</strong> (hospedagem): guardam e servem o app.</li>
      </ul>
      <p>Nenhum dado é vendido ou compartilhado para outros fins.</p>

      <h2>Segurança</h2>
      <p>Cada pessoa só vê os próprios dados (regras de acesso no banco). As chaves ficam só no servidor e toda a comunicação usa HTTPS.</p>

      <h2>Seus direitos</h2>
      <p>Você pode ver, corrigir e apagar memórias e conversas no próprio app, desconectar o Google e pedir a exclusão completa da conta ao responsável pelo GaDu, pelo e-mail de suporte exibido na tela de autorização do Google.</p>
    </main>
  );
}
