"use client";
import { useCallback, useEffect, useState } from "react";
import { AGENT_PRESETS } from "@/lib/presets";
import { Icon } from "./ui";

type Person = {
  id: string; me: boolean; role: string; access: "active" | "blocked"; name: string | null; email: string | null; since: string; lastSeen: string | null;
  setup: { google: boolean; push: boolean; agents: number; projects: number; memories: number; tasks: number; conversations: number };
};
type Invite = { id: number; email: string; name: string | null; expires_at: string; created_at: string };

const d = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit" }) : "nunca");

/** Área do administrador: convidar pessoas e acompanhar a configuração inicial (sem ver o conteúdo de ninguém). */
export function AdminPage() {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [err, setErr] = useState("");
  const [form, setForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/people", { cache: "no-store" });
      if (!r.ok) throw new Error();
      const j = await r.json();
      setPeople(j.people); setInvites(j.invites); setErr("");
    } catch {
      setErr("Não consegui carregar as pessoas.");
      setPeople([]);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function setAccess(p: Person, access: "active" | "blocked") {
    await fetch("/api/admin/people", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: p.id, access }) });
    void load();
  }
  async function revoke(id: number) {
    await fetch("/api/admin/invites", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    void load();
  }

  return (
    <main className="page">
      <section className="card">
        <h2>Pessoas</h2>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>Cada pessoa vê só os próprios dados. Aqui você acompanha a configuração inicial (números e ✓), nunca o conteúdo.</p>
        {err && <div className="notice" role="alert">{err}</div>}
        {people === null ? <p className="muted">Carregando…</p> : people.map((p) => (
          <div className="item" key={p.id}>
            <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 500 }}>{p.name || p.email}{p.me ? " (você)" : ""}</div>
                <div className="mono muted">{p.email} · {p.role === "admin" ? "admin" : "membro"}{p.access === "blocked" ? " · bloqueado" : ""}</div>
              </div>
              {!p.me && (p.access === "active"
                ? <button className="link-btn" onClick={() => setAccess(p, "blocked")}>Bloquear</button>
                : <button className="btn btn-sm" onClick={() => setAccess(p, "active")}>Liberar</button>)}
            </div>
            <div className="checks">
              <Check ok label="Senha criada" />
              <Check ok={p.setup.google} label="Google conectado" />
              <Check ok={p.setup.push} label="Notificações" />
              <Check ok={p.setup.agents > 0} label={`${p.setup.agents} agentes`} />
              <Check ok={p.setup.memories > 0} label={`${p.setup.memories} memórias`} />
              <Check ok={p.setup.conversations > 0} label={`${p.setup.conversations} conversas`} />
            </div>
            <div className="mono muted">desde {d(p.since)} · último acesso {d(p.lastSeen)}</div>
          </div>
        ))}
      </section>

      {invites.length > 0 && (
        <section className="card">
          <h2>Convites pendentes</h2>
          {invites.map((i) => (
            <div className="item" key={i.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ minWidth: 0 }}>
                <div>{i.name || i.email}</div>
                <div className="mono muted">{i.email} · vale até {d(i.expires_at)}</div>
              </div>
              <button className="link-btn" onClick={() => revoke(i.id)}>Cancelar</button>
            </div>
          ))}
        </section>
      )}

      {form ? <InviteForm onDone={() => { setForm(false); void load(); }} /> : <button className="btn btn-pri" onClick={() => setForm(true)}>Convidar pessoa</button>}

      <section className="card">
        <h2>Como ajudar na configuração inicial</h2>
        <ol className="steps">
          <li>Crie o convite com os agentes que fazem sentido para a pessoa (e o negócio dela, se tiver).</li>
          <li>Envie o link pelo WhatsApp. Ela abre, cria a senha e já entra.</li>
          <li>Junto com ela, no celular dela: instalar na tela inicial, Perfil › Ajustes › ligar notificações e conectar o Google.</li>
          <li>Em Perfil › Memória › Importar, ela traz o que o ChatGPT ou o Claude já sabem sobre ela.</li>
          <li>Volte aqui: os ✓ mostram o que falta.</li>
        </ol>
      </section>
    </main>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`check ${ok ? "ok" : ""}`}><Icon name={ok ? "check" : "spark"} size={14} />{label}</span>;
}

function InviteForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [agents, setAgents] = useState<string[]>([]);
  const [business, setBusiness] = useState("");
  const [link, setLink] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/admin/invites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, email, agents, ...(business.trim() ? { business } : {}) }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return setMsg(j.message || "Não consegui criar o convite.");
      setLink(j.link);
    } finally {
      setBusy(false);
    }
  }
  const text = `Oi, ${name.split(" ")[0]}! Te convidei para o GaDu, meu assistente pessoal. Abra este link no celular e crie sua senha (vale 7 dias): ${link}`;

  if (link) {
    return (
      <section className="card">
        <h2>Convite criado</h2>
        <p style={{ margin: 0 }}>Envie para {name}. O link vale 7 dias e funciona uma vez.</p>
        <div className="quote" style={{ wordBreak: "break-all" }}>{link}</div>
        <div className="row">
          <a className="btn btn-pri" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">Enviar pelo WhatsApp</a>
          <button className="btn" onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setCopied(false); } }}>{copied ? "Copiado" : "Copiar mensagem"}</button>
          <button className="btn" onClick={onDone}>Concluir</button>
        </div>
      </section>
    );
  }

  return (
    <form className="card" onSubmit={create}>
      <h2>Novo convite</h2>
      <input className="field" placeholder="Nome" aria-label="Nome" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} required />
      <input className="field" type="email" placeholder="E-mail" aria-label="E-mail" value={email} maxLength={320} onChange={(e) => setEmail(e.target.value)} required />
      <span className="muted" style={{ fontSize: 14 }}>Agentes para já começar</span>
      <div className="row">
        {AGENT_PRESETS.map((a) => (
          <button type="button" key={a.name} className="chip" aria-pressed={agents.includes(a.name)} onClick={() => setAgents((xs) => (xs.includes(a.name) ? xs.filter((x) => x !== a.name) : [...xs, a.name]))}>{a.name}</button>
        ))}
      </div>
      <label className="muted" style={{ fontSize: 14 }} htmlFor="inv-biz">Negócio próprio (opcional): cria um agente de clientes e um projeto</label>
      <input id="inv-biz" className="field" placeholder="Ex.: nome da consultoria" value={business} maxLength={40} onChange={(e) => setBusiness(e.target.value)} />
      {msg && <span className="muted" role="alert">{msg}</span>}
      <div className="row">
        <button className="btn btn-pri" type="submit" disabled={busy || !name.trim() || !email.trim()}>{busy ? "Criando…" : "Criar convite"}</button>
        <button className="btn" type="button" onClick={onDone}>Cancelar</button>
      </div>
    </form>
  );
}
