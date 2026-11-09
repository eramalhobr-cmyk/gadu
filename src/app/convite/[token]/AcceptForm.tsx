"use client";
import { useState } from "react";

export function AcceptForm({ token, email, name: initialName }: { token: string; email: string; name: string }) {
  const [name, setName] = useState(initialName);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 10) return setMsg("Use pelo menos 10 caracteres na senha.");
    if (pw !== pw2) return setMsg("As duas senhas não são iguais.");
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/invite/accept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, name, password: pw }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return setMsg(j.error || "Não consegui concluir. Tente de novo.");
      window.location.href = "/app?tab=hoje";
    } catch {
      setMsg("Sem conexão. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10, width: "min(100%, 360px)", textAlign: "left" }}>
      <label className="muted" style={{ fontSize: 14 }} htmlFor="inv-email">E-mail</label>
      <input id="inv-email" className="field" value={email} readOnly autoComplete="username" />
      <label className="muted" style={{ fontSize: 14 }} htmlFor="inv-name">Como quer ser chamado</label>
      <input id="inv-name" className="field" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} required />
      <label className="muted" style={{ fontSize: 14 }} htmlFor="inv-pw">Crie uma senha</label>
      <input id="inv-pw" className="field" type="password" autoComplete="new-password" placeholder="Mínimo 10 caracteres" value={pw} onChange={(e) => setPw(e.target.value)} />
      <input className="field" type="password" autoComplete="new-password" placeholder="Repita a senha" aria-label="Repita a senha" value={pw2} onChange={(e) => setPw2(e.target.value)} />
      <button className="btn btn-pri" type="submit" disabled={busy || !name.trim() || !pw || !pw2}>{busy ? "Criando…" : "Criar minha conta"}</button>
      {msg && <div className="notice" role="alert">{msg}</div>}
    </form>
  );
}
