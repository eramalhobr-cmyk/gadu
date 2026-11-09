export const dynamic = "force-static";

export default function Offline() {
  return (
    <main className="shell dots" style={{ alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", gap: 12 }}>
      <h1 className="brand" style={{ margin: 0 }}>GaDu</h1>
      <p className="muted" style={{ maxWidth: 320 }}>Você está sem internet. Assim que a conexão voltar, é só abrir de novo.</p>
      <a className="btn" href="/app">Tentar de novo</a>
    </main>
  );
}
