"use client";
import "./globals.css";
import "./v2.css";

// Erro no próprio layout: página mínima, sem depender do resto do app.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body>
        <main className="shell dots error-screen" role="alert">
          <div className="error-box">
            <span className="brand">GaDu</span>
            <h1>O GaDu não conseguiu abrir</h1>
            <p className="muted">Tente de novo em instantes. Seus dados estão salvos.</p>
            <div className="row" style={{ justifyContent: "center" }}>
              <button className="btn btn-pri" onClick={reset}>Tentar de novo</button>
              <a className="btn" href="/app">Recarregar</a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
