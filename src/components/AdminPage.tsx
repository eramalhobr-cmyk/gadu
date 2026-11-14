"use client";
import { useCallback, useEffect, useState } from "react";
import { AGENT_PRESETS } from "@/lib/presets";
import { EmptyState, PageHeader, Panel } from "./kit";
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
    <main className="page" id="conteudo">
      <div className="wrap">
        <PageHeader eyebrow="Plataforma" title="Administração" text="Convide pessoas e acompanhe a configuração inicial. Você vê números e marcas, nunca o conteúdo."
          actions={!form && <button className="btn btn-pri" onClick={() => setForm(true)}><Icon name="plus" size={18} />Convidar pessoa</button>} />
        {form && <InviteForm onDone={() => { setForm(false); void load(); }} />}
        {err && <div className="notice" role="alert">{err}</div>}

        <div className="split">
          <Panel title={`Pessoas${people?.length ? ` · ${people.length}` : ""}`} icon="user">
            {people === null ? <p className="muted" role="status">Carregando…</p> : people.length === 0 ? (
              <EmptyState icon="user" title="Ninguém por aqui" text="Convide a primeira pessoa pelo botão acima." />
            ) : (
              <div className="rows">
                {people.map((p) => (
                  <div className="adm-person" key={p.id}>
                    <div className="adm-top">
                      <span className="initial" aria-hidden="true">{(p.name || p.email || "?").charAt(0).toUpperCase()}</span>
                      <div className="grow">
                        <b className="adm-name">{p.name || p.email}{p.me ? " (você)" : ""}</b>
                        <span className="adm-mail">{p.email}</span>
                      </div>
                      <span className={`tag ${p.access === "blocked" ? "bad" : p.role === "admin" ? "sig" : ""}`}>{p.access === "blocked" ? "Bloqueado" : p.role === "admin" ? "Admin" : "Membro"}</span>
                    </div>
                    <div className="checks2">
                      <Check ok label="Senha criada" />
                      <Check ok={p.setup.google} label="Google" />
                      <Check ok={p.setup.push} label="Notificações" />
                      <Check ok={p.setup.agents > 0} label={`${p.setup.agents} agentes`} />
                      <Check ok={p.setup.memories > 0} label={`${p.setup.memories} memórias`} />
                      <Check ok={p.setup.conversations > 0} label={`${p.setup.conversations} conversas`} />
                    </div>
                    <div className="adm-foot">
                      <span className="muted small">Desde {d(p.since)} · último acesso {d(p.lastSeen)}</span>
                      {!p.me && (p.access === "active"
                        ? <button className="btn btn-sm btn-quiet" onClick={() => setAccess(p, "blocked")}>Bloquear</button>
                        : <button className="btn btn-sm" onClick={() => setAccess(p, "active")}>Liberar</button>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <aside className="split-side">
            <Panel title={`Convites pendentes${invites.length ? ` · ${invites.length}` : ""}`} icon="bell">
              {invites.length === 0 ? <p className="muted small">Nenhum convite aguardando.</p> : (
                <div className="rows">
                  {invites.map((i) => (
                    <div className="row-i" key={i.id}>
                      <div className="grow"><span className="t">{i.name || i.email}</span><span className="s">{i.email} · vale até {d(i.expires_at)}</span></div>
                      <button className="btn btn-sm btn-quiet" onClick={() => revoke(i.id)}>Cancelar</button>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="Como ajudar na configuração" icon="book">
              <ol className="numbered">
                <li>Crie o convite com os agentes que fazem sentido para a pessoa (e o negócio dela, se tiver).</li>
                <li>Envie o link pelo WhatsApp. Ela abre, cria a senha e já entra.</li>
                <li>Junto com ela, no celular: instalar na tela inicial, ligar as notificações e conectar o Google em Configurações.</li>
                <li>Em Memórias › Importar, ela traz o que o ChatGPT ou o Claude já sabem sobre ela.</li>
                <li>Volte aqui: as marcas mostram o que falta.</li>
              </ol>
            </Panel>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`chk ${ok ? "ok" : ""}`}>{ok ? <Icon name="check" size={14} /> : <i aria-hidden="true" />}{label}<span className="sr">{ok ? " (feito)" : " (falta)"}</span></span>;
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
      <Panel title="Convite criado" icon="check" className="form-panel">
        <p>Envie para {name}. O link vale 7 dias e funciona uma vez.</p>
        <div className="quote" style={{ wordBreak: "break-all" }}>{link}</div>
        <div className="form-actions">
          <a className="btn btn-pri" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">Enviar pelo WhatsApp</a>
          <button className="btn" onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setCopied(false); } }}>{copied ? "Copiado" : "Copiar mensagem"}</button>
          <button className="btn" onClick={onDone}>Concluir</button>
        </div>
      </Panel>
    );
  }

  return (
    <form className="panel form-panel" onSubmit={create}>
      <div className="panel-head"><h2><Icon name="user" size={18} />Novo convite</h2></div>
      <div className="form-grid">
        <label className="fld">
          <span>Nome</span>
          <input className="field" placeholder="Nome da pessoa" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="fld">
          <span>E-mail</span>
          <input className="field" type="email" placeholder="nome@exemplo.com" value={email} maxLength={320} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <div className="fld full">
          <span id="inv-ag-l">Agentes para já começar</span>
          <div className="chips" role="group" aria-labelledby="inv-ag-l">
            {AGENT_PRESETS.map((a) => (
              <button type="button" key={a.name} className="chip" aria-pressed={agents.includes(a.name)} onClick={() => setAgents((xs) => (xs.includes(a.name) ? xs.filter((x) => x !== a.name) : [...xs, a.name]))}>{a.name}</button>
            ))}
          </div>
        </div>
        <label className="fld full" htmlFor="inv-biz">
          <span>Negócio próprio <i className="opt">opcional · cria um agente de clientes e um projeto</i></span>
          <input id="inv-biz" className="field" placeholder="Ex.: nome da consultoria" value={business} maxLength={40} onChange={(e) => setBusiness(e.target.value)} />
        </label>
      </div>
      {msg && <p className="form-err" role="alert">{msg}</p>}
      <div className="form-actions">
        <button className="btn btn-pri" type="submit" disabled={busy || !name.trim() || !email.trim()}>{busy ? "Criando…" : "Criar convite"}</button>
        <button className="btn" type="button" onClick={onDone}>Cancelar</button>
      </div>
    </form>
  );
}
