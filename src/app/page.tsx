import type { Metadata } from "next";
import { Avatar } from "@/components/RobotFace";
import { Icon } from "@/components/ui";
import { accessOf } from "@/lib/access";
import { supabaseServer } from "@/lib/supabase/server";

// Home aberta: apresenta a ideia do GaDu (não é comercial). "Entrar" leva ao login; quem já entrou vai direto ao app.
export const dynamic = "force-dynamic"; // precisa do nonce da CSP para a animação do avatar
export const metadata: Metadata = {
  title: "GaDu · Seu centro de inteligência pessoal",
  description: "Um assistente pessoal por voz que escuta, lembra e organiza o seu dia, com a sua aprovação.",
};

const FEATURES = [
  { icon: "mic", color: "var(--sig)", title: "Conversa por voz", text: "Fale como falaria com uma pessoa. Ele responde falando, frase a frase." },
  { icon: "sun", color: "var(--hot)", title: "Começar o dia", text: "Um resumo falado da agenda, dos e-mails e das tarefas, com o que merece atenção." },
  { icon: "grid", color: "var(--c-blue)", title: "Agenda e e-mails", text: "Lê sua agenda e seus e-mails, mostra conflitos e janelas livres e marca eventos quando você confirma." },
  { icon: "check", color: "var(--c-green)", title: "Tarefas e lembretes", text: "“Anota aí”, “me lembra amanhã às 9”. Vira tarefa, lembrete e notificação no celular." },
  { icon: "book", color: "var(--c-violet)", title: "Memória que você aprova", text: "Aprende sobre você, mas só guarda o que você aprovar. Você vê, edita e apaga." },
  { icon: "agents", color: "var(--c-pink)", title: "Agentes especializados", text: "Versões do GaDu para saúde, finanças, estudos e o seu negócio, cada um com sua memória." },
];

const DAY = [
  { time: "07:00", title: "Briefing da manhã", text: "“Bom dia! 3 compromissos, o primeiro às 9h. Conflito às 14h.”", color: "var(--hot)" },
  { time: "09:40", title: "Lembrete por voz", text: "“Me lembra daqui a 20 minutos de ligar para o banco.”", color: "var(--c-pink)" },
  { time: "14:30", title: "Agenda", text: "“Marca dentista quinta às 10.” Você confere e toca em Criar.", color: "var(--c-blue)" },
  { time: "21:00", title: "Revisão da noite", text: "O que ficou pendente vai para amanhã com um toque.", color: "var(--c-violet)" },
];

export default async function Home() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const inside = (await accessOf(supabase, data.user)).ok;
  const cta = inside ? { href: "/app", label: "Abrir o GaDu" } : { href: "/login", label: "Entrar" };

  return (
    <div className="lp dots">
      <header className="lp-top">
        <a href="/" className="lp-brand" aria-label="GaDu, início">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/avatar/logo-96.webp" alt="" width={36} height={36} />
          <span className="brand">GaDu</span>
        </a>
        <a className="btn btn-sm btn-pri" href={cta.href}>{cta.label}</a>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-avatar"><Avatar mode="speaking" label="O rosto do GaDu" /></div>
          <div className="lp-hero-text">
            <span className="mono lp-kicker">Seu centro de inteligência pessoal</span>
            <h1>Um assistente que <em>escuta</em>, <em>lembra</em> e <em>organiza</em> o seu dia.</h1>
            <p className="muted">Por voz ou texto, no celular. Ele cuida da agenda, dos e-mails, das tarefas e da memória, e só age com a sua aprovação.</p>
            <div className="row">
              <a className="btn btn-pri lp-cta" href={cta.href}>{cta.label}</a>
              <a className="btn" href="#como">Como funciona</a>
            </div>
            <p className="mono muted lp-origin">GaDu = Gael + Eduardo</p>
          </div>
        </section>

        <section className="lp-pillars" aria-label="Os três pilares">
          {[
            ["mic", "Escuta", "Você fala, ele entende."],
            ["book", "Lembra", "Memória que é sua."],
            ["check", "Organiza", "Dia, tarefas e agenda em ordem."],
          ].map(([i, t, d]) => (
            <div key={t} className="lp-pillar"><span className="lp-ico"><Icon name={i} size={22} /></span><b>{t}</b><span className="muted">{d}</span></div>
          ))}
        </section>

        <section className="lp-section">
          <h2>O que o GaDu faz</h2>
          <div className="lp-features">
            {FEATURES.map((f) => (
              <article key={f.title} className="lp-feature" style={{ ["--c" as string]: f.color }}>
                <span className="lp-ico"><Icon name={f.icon} size={22} /></span>
                <b>{f.title}</b>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-section lp-split">
          <div>
            <h2>Um dia com o GaDu</h2>
            <ol className="lp-day">
              {DAY.map((d) => (
                <li key={d.time} style={{ ["--c" as string]: d.color }}>
                  <span className="mono lp-time">{d.time}</span>
                  <div><b>{d.title}</b><span className="muted">{d.text}</span></div>
                </li>
              ))}
            </ol>
          </div>
          <PhoneMock />
        </section>

        <section className="lp-section" id="como">
          <h2>Como funciona</h2>
          <p className="muted">Simples por fora, organizado por dentro.</p>
          <figure className="lp-diagram">
            <svg viewBox="0 0 360 300" role="img" aria-label="Você fala com o GaDu no celular. O GaDu consulta a memória, a agenda e os e-mails, usa a inteligência artificial e devolve a resposta, pedindo sua aprovação antes de agir.">
              <defs>
                <marker id="lpa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--sig)" /></marker>
                <radialGradient id="lpg"><stop offset="0" stopColor="rgba(95,240,220,.35)" /><stop offset="1" stopColor="rgba(95,240,220,0)" /></radialGradient>
              </defs>
              <circle cx="180" cy="150" r="70" fill="url(#lpg)" />
              {[[60, 46, "var(--sig)"], [300, 46, "var(--c-violet)"], [60, 254, "var(--c-green)"], [300, 254, "var(--c-blue)"]].map(([x, y, c]) => (
                <line key={`${x}-${y}`} x1="180" y1="150" x2={x as number} y2={y as number} stroke={c as string} strokeWidth="1.2" strokeDasharray="4 5" opacity=".7" />
              ))}
              <circle cx="180" cy="150" r="44" fill="rgba(10,18,22,.98)" stroke="var(--sig)" strokeWidth="1.6" />
              <text x="180" y="146" textAnchor="middle" fill="var(--ink)" fontSize="16" fontWeight="600">GaDu</text>
              <text x="180" y="164" textAnchor="middle" fill="var(--ink-3)" fontSize="10">orquestra tudo</text>
              {[
                [60, 46, "Você", "voz ou texto", "var(--sig)"],
                [300, 46, "Inteligência", "Claude e reserva", "var(--c-violet)"],
                [60, 254, "Memória", "aprovada por você", "var(--c-green)"],
                [300, 254, "Agenda e e-mail", "Google", "var(--c-blue)"],
              ].map(([x, y, t, s, c]) => (
                <g key={t as string}>
                  <rect x={(x as number) - 56} y={(y as number) - 24} width="112" height="48" rx="14" fill="rgba(10,18,22,.95)" stroke={c as string} />
                  <text x={x as number} y={(y as number) - 2} textAnchor="middle" fill="var(--ink)" fontSize="13" fontWeight="600">{t as string}</text>
                  <text x={x as number} y={(y as number) + 14} textAnchor="middle" fill="var(--ink-3)" fontSize="10">{s as string}</text>
                </g>
              ))}
            </svg>
          </figure>
          <ol className="lp-steps">
            <li><span className="flow-n">1</span><div><b>Você fala</b><span className="muted">O celular transforma sua voz em texto.</span></div></li>
            <li><span className="flow-n">2</span><div><b>Ele entende o contexto</b><span className="muted">Memória, agenda, tarefas e conversas parecidas.</span></div></li>
            <li><span className="flow-n">3</span><div><b>Responde e propõe</b><span className="muted">Em voz e texto. Tarefas, lembretes e eventos só valem com o seu toque.</span></div></li>
          </ol>
        </section>

        <section className="lp-section">
          <h2>Privacidade em primeiro lugar</h2>
          <div className="lp-badges">
            {[
              ["Seus dados são só seus", "Cada pessoa vê apenas o que é dela. Nem quem convidou vê."],
              ["Nada sensível vai para a IA", "Documentos, senhas, banco e saúde ficam de fora."],
              ["Você aprova tudo", "Memória, agenda e tarefas só mudam com o seu sim."],
            ].map(([t, d]) => (
              <div key={t} className="lp-badge"><span className="lp-ico"><Icon name="check" size={18} /></span><div><b>{t}</b><span className="muted">{d}</span></div></div>
            ))}
          </div>
        </section>

        <section className="lp-section lp-next">
          <span className="mono lp-kicker">Em construção</span>
          <h2>Pessoal e Trabalho</h2>
          <p className="muted">Agentes para a vida pessoal e uma empresa virtual para o negócio próprio: um CEO que orquestra comercial, projetos, financeiro e marketing.</p>
          <div className="lp-org" aria-hidden="true">
            <span className="lp-node ceo">CEO</span>
            <div className="lp-org-row">{["Comercial", "Projetos", "Financeiro", "Marketing"].map((a) => <span key={a} className="lp-node">{a}</span>)}</div>
          </div>
        </section>

        <section className="lp-final">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/avatar/logo.webp" alt="Logo do GaDu" width={140} height={140} />
          <h2>Pronto para conversar?</h2>
          <a className="btn btn-pri lp-cta" href={cta.href}>{cta.label}</a>
          <p className="mono muted">Acesso por convite</p>
        </section>
      </main>

      <footer className="lp-foot">
        <span className="muted">GaDu · assistente pessoal</span>
        <span><a href="/privacidade">Privacidade</a> · <a href="/termos">Termos</a></span>
      </footer>
    </div>
  );
}

/** Ilustração do app num celular (dados fictícios). */
function PhoneMock() {
  return (
    <div className="lp-phone" aria-hidden="true">
      <div className="lp-phone-screen">
        <div className="mono muted" style={{ fontSize: 9 }}>QUINTA-FEIRA, 12 DE NOVEMBRO</div>
        <div className="lp-phone-hello">Bom dia.</div>
        <div className="lp-phone-bar"><span className="lp-phone-mic"><Icon name="mic" size={14} /></span><span className="muted">Fale com o GaDu…</span></div>
        <div className="lp-phone-card hot"><b>Insights do GaDu</b><span>Janela livre das 15:00 às 17:30: boa hora para foco.</span></div>
        <div className="lp-phone-card">
          <b>Agenda de hoje</b>
          <span><i className="dot" />09:00 Treino</span>
          <span><i className="dot live" />11:00 Reunião de projeto</span>
          <span><i className="dot" />14:00 Dentista</span>
        </div>
        <div className="lp-phone-card">
          <b>Tarefas</b>
          <span><i className="tick-mini on" />Renovar o seguro</span>
          <span><i className="tick-mini" />Enviar proposta</span>
        </div>
      </div>
    </div>
  );
}
