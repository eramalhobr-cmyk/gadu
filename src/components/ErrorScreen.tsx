/** Tela de erro própria do GaDu: o que aconteceu, em português, e o que fazer. */
export function ErrorScreen(props: { title: string; text: string; action?: React.ReactNode; code?: string }) {
  return (
    <main className="shell dots error-screen" role="alert">
      <div className="error-box">
        <span className="brand">GaDu</span>
        {props.code && <span className="mono muted">{props.code}</span>}
        <h1>{props.title}</h1>
        <p className="muted">{props.text}</p>
        <div className="row" style={{ justifyContent: "center" }}>
          {props.action}
          <a className="btn" href="/app">Voltar ao início</a>
        </div>
      </div>
    </main>
  );
}
