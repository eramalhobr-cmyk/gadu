"use client";
import { useState } from "react";

// Login por código enviado ao e-mail: digite o Gmail, receba 6 números, entre.
export function EmailLogin() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function post(url: string, body: object) {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, error: (data as { error?: string }).error };
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const r = await post("/api/auth/otp", { email });
    setBusy(false);
    if (!r.ok) return setMsg(r.error ?? "Não consegui enviar. Tente de novo.");
    setStep("code");
    setMsg("Se este e-mail tiver acesso, o código chega em instantes. Confira também o spam.");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const r = await post("/api/auth/verify", { email, token: code });
    setBusy(false);
    if (!r.ok) return setMsg(r.error ?? "Código inválido.");
    window.location.href = "/app";
  }

  return step === "email" ? (
    <form onSubmit={sendCode} style={{ display: "flex", flexDirection: "column", gap: 10, width: "min(100%, 340px)" }}>
      <label className="sr" htmlFor="email">Seu e-mail</label>
      <input id="email" className="field" type="email" inputMode="email" autoComplete="email" required placeholder="seu@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button className="btn btn-pri" type="submit" disabled={busy || !email}>{busy ? "Enviando…" : "Receber código no e-mail"}</button>
      {msg && <div className="notice" role="alert">{msg}</div>}
    </form>
  ) : (
    <form onSubmit={verify} style={{ display: "flex", flexDirection: "column", gap: 10, width: "min(100%, 340px)" }}>
      <label className="sr" htmlFor="code">Código de 6 dígitos</label>
      <input id="code" className="field" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6,10}" maxLength={10} required placeholder="Código de 6 dígitos" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} style={{ textAlign: "center", letterSpacing: "0.3em", fontSize: 22 }} />
      <button className="btn btn-pri" type="submit" disabled={busy || code.length < 6}>{busy ? "Entrando…" : "Entrar"}</button>
      <button className="btn" type="button" onClick={() => { setStep("email"); setCode(""); setMsg(""); }}>Trocar e-mail ou pedir outro código</button>
      {msg && <div className="notice" role="status">{msg}</div>}
    </form>
  );
}
