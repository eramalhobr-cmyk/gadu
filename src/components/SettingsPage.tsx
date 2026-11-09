"use client";
import { useCallback, useEffect, useState } from "react";
import { canSpeak, listVoices, voiceLabel, type Speaker } from "@/lib/speech";
import { supabaseBrowser } from "@/lib/supabase/client";

export type Prefs = { voice: boolean; handsFree: boolean; voiceURI: string; rate: number };
type Usage = {
  budgets: { anthropic: number; gateway: number };
  spent: { anthropic: number; gateway: number; gemini: number };
  total: number;
  monthlyBudget: number;
  gateway: { balance: number; used: number } | null;
};

const usd = (n: number) => `US$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 100;
  return (
    <div className="bar" aria-hidden="true">
      <div style={{ width: `${pct}%`, background: pct >= 100 ? "var(--bad)" : pct > 80 ? "var(--hot)" : "var(--sig)" }} />
    </div>
  );
}

export function SettingsPage(props: {
  email: string;
  version: string;
  prefs: Prefs;
  setPrefs: (p: Prefs) => void;
  voiceOk: boolean;
  speaker: Speaker | null;
  onNew: () => void;
  initialBlocked: string[];
  morningLink: string;
}) {
  const [blocked, setBlocked] = useState<string[]>(props.initialBlocked);
  const [term, setTerm] = useState("");
  const [saved, setSaved] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const db = supabaseBrowser();

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 10) return setPwMsg("Use pelo menos 10 caracteres.");
    if (pw !== pw2) return setPwMsg("As duas senhas não são iguais.");
    const { error } = await db.auth.updateUser({ password: pw });
    if (error) return setPwMsg(/weak|pwned|leaked/i.test(error.message) ? "Senha fraca ou já vazada na internet. Escolha outra." : "Não consegui salvar a senha. Tente de novo.");
    setPw(""); setPw2("");
    setPwMsg("Senha salva. Da próxima vez, entre com e-mail e senha.");
  }

  async function saveBlocked(next: string[]) {
    setBlocked(next);
    const { data: auth } = await db.auth.getUser();
    if (!auth.user) return;
    const { data } = await db.from("profiles").select("settings").eq("id", auth.user.id).maybeSingle();
    const settings = { ...((data?.settings as object) ?? {}), blocked: next };
    const { error } = await db.from("profiles").update({ settings }).eq("id", auth.user.id);
    setSaved(error ? "Não salvou. Tente de novo." : "Salvo.");
  }

  return (
    <main className="page">
      <ConnectionsCard morningLink={props.morningLink} />
      <SpendCard />
      <VoiceCard {...props} />
      <section className="card">
        <h2>Termos bloqueados</h2>
        <p className="muted" style={{ margin: 0 }}>Memórias com estes termos não podem ser aprovadas. Use para o nome da empresa e assuntos corporativos.</p>
        <div className="row">{blocked.length ? blocked.map((b) => <button key={b} className="chip" onClick={() => saveBlocked(blocked.filter((x) => x !== b))} aria-label={`Remover ${b}`}>{b} ×</button>) : <span className="muted">Nenhum termo ainda.</span>}</div>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <label className="sr" htmlFor="term">Novo termo</label>
          <input id="term" className="field" value={term} maxLength={60} placeholder="Ex.: nome da empresa" onChange={(e) => setTerm(e.target.value)} />
          <button className="btn" disabled={!term.trim()} onClick={() => { void saveBlocked([...new Set([...blocked, term.trim()])]); setTerm(""); }}>Bloquear</button>
        </div>
        {saved && <span className="muted" role="status">{saved}</span>}
      </section>
      <section className="card">
        <h2>Senha</h2>
        <form onSubmit={savePassword} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input type="text" autoComplete="username" value={props.email} readOnly hidden />
          <label className="sr" htmlFor="pw1">Nova senha</label>
          <input id="pw1" className="field" type="password" autoComplete="new-password" placeholder="Nova senha (mínimo 10 caracteres)" value={pw} onChange={(e) => setPw(e.target.value)} />
          <label className="sr" htmlFor="pw2">Repita a senha</label>
          <input id="pw2" className="field" type="password" autoComplete="new-password" placeholder="Repita a senha" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          <div><button className="btn" type="submit" disabled={!pw || !pw2}>Salvar senha</button></div>
          {pwMsg && <span className="muted" role="status">{pwMsg}</span>}
        </form>
      </section>
      <section className="card">
        <h2>Conta</h2>
        <div>{props.email}</div>
        <div className="row">
          <button className="btn" onClick={props.onNew}>Nova conversa</button>
          <form action="/auth/signout" method="post"><button className="btn" type="submit">Sair</button></form>
        </div>
        <div className="mono muted">GaDu {props.version}</div>
      </section>
    </main>
  );
}

function SpendCard() {
  const [u, setU] = useState<Usage | null>(null);
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState<{ anthropic: string; gateway: string } | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/usage", { cache: "no-store" });
      if (!r.ok) throw new Error();
      setU(await r.json());
      setErr("");
    } catch {
      setErr("Não consegui carregar o gasto.");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!edit) return;
    const parse = (s: string) => Number(s.replace(",", "."));
    const budgets = { anthropic: parse(edit.anthropic), gateway: parse(edit.gateway) };
    if (![budgets.anthropic, budgets.gateway].every((n) => Number.isFinite(n) && n >= 0 && n <= 1000)) return setMsg("Use valores entre 0 e 1000.");
    const r = await fetch("/api/usage", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ budgets }) });
    if (!r.ok) return setMsg("Não salvou. Tente de novo.");
    setEdit(null);
    setMsg("Limites salvos.");
    void load();
  }

  const rows = u
    ? [
        { id: "anthropic" as const, name: "Claude · Anthropic", hint: "Chave direta. A Anthropic não informa o saldo por API: o gasto é estimado pelos tokens." },
        { id: "gateway" as const, name: "AI Gateway · Vercel", hint: u.gateway ? `Saldo real na Vercel: ${usd(u.gateway.balance)} (já usado: ${usd(u.gateway.used)}).` : "Saldo da Vercel indisponível agora." },
      ]
    : [];

  return (
    <section className="card">
      <h2>Gasto com IA neste mês</h2>
      {err && <div className="notice" role="alert">{err}</div>}
      {!u ? (
        !err && <p className="muted">Carregando…</p>
      ) : (
        <>
          <div style={{ fontSize: 22, fontVariantNumeric: "tabular-nums" }}>
            {usd(u.total)} <span className="muted" style={{ fontSize: 15 }}>de {usd(u.monthlyBudget)} (teto geral)</span>
          </div>
          <Bar value={u.total} max={u.monthlyBudget} />
          {rows.map((r) => {
            const spent = u.spent[r.id];
            const limit = u.budgets[r.id];
            return (
              <div className="item" key={r.id}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span>{r.name}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{usd(spent)} <span className="muted">/ {usd(limit)}</span></span>
                </div>
                <Bar value={spent} max={limit} />
                {spent >= limit && <div style={{ color: "var(--bad)", fontSize: 14 }}>Limite atingido. O GaDu usa o outro motor até você aumentar.</div>}
                <div className="muted" style={{ fontSize: 14 }}>{r.hint}</div>
                {edit && (
                  <label className="row" style={{ flexWrap: "nowrap" }}>
                    <span className="muted" style={{ whiteSpace: "nowrap" }}>Limite US$</span>
                    <input className="field" inputMode="decimal" value={edit[r.id]} onChange={(e) => setEdit({ ...edit, [r.id]: e.target.value })} aria-label={`Limite mensal ${r.name}`} />
                  </label>
                )}
              </div>
            );
          })}
          <div className="row">
            {edit ? (
              <>
                <button className="btn btn-pri" onClick={save}>Salvar limites</button>
                <button className="btn" onClick={() => { setEdit(null); setMsg(""); }}>Cancelar</button>
              </>
            ) : (
              <button className="btn" onClick={() => { setEdit({ anthropic: String(u.budgets.anthropic), gateway: String(u.budgets.gateway) }); setMsg(""); }}>Ajustar limites</button>
            )}
          </div>
          {msg && <span className="muted" role="status">{msg}</span>}
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>Ao chegar no limite de um motor, o GaDu passa para o outro. Com os dois no limite, ele para até o próximo mês.</p>
        </>
      )}
    </section>
  );
}

function VoiceCard(props: { prefs: Prefs; setPrefs: (p: Prefs) => void; voiceOk: boolean; speaker: Speaker | null }) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!canSpeak()) return;
    const upd = () => setVoices(listVoices());
    upd();
    window.speechSynthesis.addEventListener("voiceschanged", upd);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", upd);
  }, []);
  const p = props.prefs;
  const set = (patch: Partial<Prefs>) => props.setPrefs({ ...p, ...patch });
  function test(patch: Partial<Prefs> = {}) {
    if (!props.speaker) return;
    props.speaker.prefs = { voiceURI: patch.voiceURI ?? p.voiceURI, rate: patch.rate ?? p.rate };
    props.speaker.test();
  }

  return (
    <section className="card">
      <h2>Voz</h2>
      <label className="switch"><span>GaDu responde falando</span><input type="checkbox" checked={p.voice} onChange={(e) => set({ voice: e.target.checked })} /></label>
      <label className="switch"><span>Modo conversa (volta a ouvir depois de responder)</span><input type="checkbox" checked={p.handsFree} disabled={!props.voiceOk} onChange={(e) => set({ handsFree: e.target.checked })} /></label>
      {!props.voiceOk && <p className="muted" style={{ margin: 0 }}>Este navegador não reconhece voz. No celular, use o Chrome (Android) ou o Safari (iPhone), ou o ditado do teclado.</p>}
      {canSpeak() && (
        <>
          <label htmlFor="voice" className="muted" style={{ fontSize: 14 }}>Voz do GaDu</label>
          <select id="voice" className="field" value={p.voiceURI} onChange={(e) => { set({ voiceURI: e.target.value }); test({ voiceURI: e.target.value }); }}>
            <option value="">Automática (a mais natural do aparelho)</option>
            {voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{voiceLabel(v)}</option>)}
          </select>
          <label htmlFor="rate" className="row" style={{ justifyContent: "space-between", fontSize: 14 }}>
            <span className="muted">Velocidade</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{p.rate.toFixed(2).replace(".", ",")}×</span>
          </label>
          <input id="rate" type="range" min={0.7} max={1.6} step={0.05} value={p.rate} onChange={(e) => set({ rate: Number(e.target.value) })} onPointerUp={() => test()} onKeyUp={() => test()} />
          <div><button className="btn btn-sm" onClick={() => test()}>Ouvir exemplo</button></div>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            Vozes marcadas como “natural” soam menos robóticas. Para ter mais: no iPhone, Ajustes › Acessibilidade › Conteúdo Falado › Vozes › Português (Brasil) e baixe uma voz “Aprimorada” ou “Premium”. No Android, instale as vozes do Google. No computador, o Edge tem as vozes “Online (Natural)”.
          </p>
        </>
      )}
    </section>
  );
}

type GStatus = { configured: boolean; connected: boolean; email: string | null };

function ConnectionsCard({ morningLink }: { morningLink: string }) {
  const [g, setG] = useState<GStatus | null>(null);
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [link, setLink] = useState(morningLink);
  const [msg, setMsg] = useState("");
  const db = supabaseBrowser();

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/google/status", { cache: "no-store" });
      if (!r.ok) throw new Error();
      setG(await r.json());
      setErr("");
    } catch {
      setErr("Não consegui ver o estado da conexão.");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function disconnect() {
    const r = await fetch("/api/google/disconnect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: true }) });
    setConfirm(false);
    if (!r.ok) return setErr("Não consegui desconectar. Tente de novo.");
    void load();
  }

  async function saveLink() {
    const v = link.trim();
    if (v && !/^https:\/\/[^\s]{4,300}$/.test(v)) return setMsg("Cole um link que comece com https://");
    const { data: auth } = await db.auth.getUser();
    if (!auth.user) return;
    const { data } = await db.from("profiles").select("settings").eq("id", auth.user.id).maybeSingle();
    const settings = { ...((data?.settings as object) ?? {}), morningLink: v };
    const { error } = await db.from("profiles").update({ settings }).eq("id", auth.user.id);
    setMsg(error ? "Não salvou. Tente de novo." : "Salvo. Vale a partir do próximo Começar o dia.");
  }

  return (
    <section className="card">
      <h2>Conexões</h2>
      {err && <div className="notice" role="alert">{err}</div>}
      <div className="item">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span>Google · Agenda e Gmail</span>
          <span className="mono" style={{ color: g?.connected ? "var(--sig)" : "var(--ink-3)" }}>{g === null ? "…" : g.connected ? "Conectado" : "Desconectado"}</span>
        </div>
        {g?.connected ? (
          <>
            <div className="muted" style={{ fontSize: 14 }}>{g.email ?? "Conta Google"} · só leitura. O GaDu lê agenda e e-mails quando você pergunta ou pede para começar o dia.</div>
            {confirm ? (
              <div className="row">
                <button className="btn btn-sm" style={{ borderColor: "var(--bad)", color: "var(--bad)" }} onClick={disconnect}>Desconectar de vez</button>
                <button className="btn btn-sm" onClick={() => setConfirm(false)}>Cancelar</button>
              </div>
            ) : (
              <div><button className="btn btn-sm" onClick={() => setConfirm(true)}>Desconectar</button></div>
            )}
          </>
        ) : g && !g.configured ? (
          <div className="muted" style={{ fontSize: 14 }}>Falta configurar as credenciais do Google no servidor. Siga o passo a passo que o GaDu passou.</div>
        ) : (
          <>
            <div className="muted" style={{ fontSize: 14 }}>Permite que o GaDu leia sua agenda e seus e-mails para responder e montar o briefing do dia. Ele não envia e-mails nem muda a agenda.</div>
            <div><a className="btn btn-pri" href="/api/google/connect">Conectar Google</a></div>
          </>
        )}
      </div>
      <div className="item">
        <label htmlFor="morning">Notícias do Começar o dia</label>
        <div className="muted" style={{ fontSize: 14 }}>Cole o link do Update Diário no Spotify (Compartilhar › Copiar link). Sem link, abro a busca do Spotify.</div>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <input id="morning" className="field" inputMode="url" placeholder="https://open.spotify.com/show/…" value={link} maxLength={300} onChange={(e) => setLink(e.target.value)} />
          <button className="btn" onClick={saveLink}>Salvar</button>
        </div>
        {msg && <span className="muted" role="status">{msg}</span>}
      </div>
    </section>
  );
}
