// Dinâmica de propósito: só assim o Next coloca o nonce da CSP nos scripts (página estática tinha 11 bloqueios de CSP).
export const dynamic = "force-dynamic";

export default function Offline() {
  return (
    <main className="shell dots page-center tight">
      <h1 className="brand m0">GaDu</h1>
      <p className="muted mw-320">Você está sem internet. Assim que a conexão voltar, é só abrir de novo.</p>
      <a className="btn" href="/app">Tentar de novo</a>
    </main>
  );
}
