"use client";
import { useState } from "react";

// Login sem senha: digite o Gmail e abra o link enviado (no mesmo aparelho).
// O código de 6 dígitos (/api/auth/verify) fica pronto para quando houver SMTP próprio.
export function EmailLogin() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
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
  }

  if (step === "code") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "min(100%, 340px)" }}>
        <div className="notice" role="status">
          Se este e-mail tiver acesso, um link de entrada chega em instantes. Abra o link <b>neste mesmo aparelho e navegador</b>. Confira também o spam.
        </div>
        <button className="btn" type="button" onClick={() => { setStep("email"); setMsg(""); }}>Trocar e-mail ou pedir outro link</button>
        {msg && <div className="notice" role="alert">{msg}</div>}
      </div>
    );
  }
  return (
    <form onSubmit={sendCode} style={{ display: "flex", flexDirection: "column", gap: 10, width: "min(100%, 340px)" }}>
      <label className="sr" htmlFor="email">Seu e-mail</label>
      <input id="email" className="field" type="email" inputMode="email" autoComplete="email" required placeholder="seu@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button className="btn btn-pri" type="submit" disabled={busy || !email}>{busy ? "Enviando…" : "Receber link de entrada"}</button>
      {msg && <div className="notice" role="alert">{msg}</div>}
    </form>
  );
}
