"use client";
import { useState } from "react";

// Entrada com e-mail e senha. Alternativa: link enviado ao e-mail (útil se esquecer a senha).
export function EmailLogin() {
  const [mode, setMode] = useState<"password" | "link" | "sent">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function post(url: string, body: object) {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, error: (data as { error?: string }).error };
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const r = await post("/api/auth/password", { email, password });
    setBusy(false);
    if (!r.ok) return setMsg(r.error ?? "Não consegui entrar. Tente de novo.");
    window.location.href = "/app";
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const r = await post("/api/auth/otp", { email });
    setBusy(false);
    if (!r.ok) return setMsg(r.error ?? "Não consegui enviar. Tente de novo.");
    setMode("sent");
  }

  const box = { display: "flex", flexDirection: "column" as const, gap: 10, width: "min(100%, 340px)" };

  if (mode === "sent") {
    return (
      <div style={box}>
        <div className="notice" role="status">
          Se este e-mail tiver acesso, um link de entrada chega em instantes. Abra o link <b>neste mesmo aparelho e navegador</b>. Confira também o spam.
        </div>
        <button className="btn" type="button" onClick={() => { setMode("password"); setMsg(""); }}>Voltar para entrar com senha</button>
      </div>
    );
  }

  return (
    <form onSubmit={mode === "password" ? signIn : sendLink} style={box}>
      <label className="sr" htmlFor="email">E-mail</label>
      <input id="email" className="field" type="email" inputMode="email" autoComplete="username" required placeholder="seu@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      {mode === "password" && (
        <>
          <label className="sr" htmlFor="password">Senha</label>
          <input id="password" className="field" type="password" autoComplete="current-password" required placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
        </>
      )}
      <button className="btn btn-pri" type="submit" disabled={busy || !email || (mode === "password" && !password)}>
        {busy ? "Aguarde…" : mode === "password" ? "Entrar" : "Receber link de entrada"}
      </button>
      {msg && <div className="notice" role="alert">{msg}</div>}
      <button className="btn" type="button" onClick={() => { setMode(mode === "password" ? "link" : "password"); setMsg(""); }}>
        {mode === "password" ? "Esqueci a senha ou ainda não tenho: receber link" : "Entrar com senha"}
      </button>
    </form>
  );
}
