import type { Metadata } from "next";
import { Avatar } from "@/components/RobotFace";
import { Icon } from "@/components/ui";
import { ModuleCards } from "@/components/ModulePage";
import { ThemeToggle } from "@/components/ThemeToggle";
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
        <nav className="lp-nav" aria-label="Seções">
          <a href="#modulos">Módulos</a>
          <a href="#assistente">Assistente</a>
          <a href="#como">Como funciona</a>
          <a href="#privacidade">Privacidade</a>
        </nav>
        <span className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
          <ThemeToggle />
          <a className="btn btn-sm btn-pri" href={cta.href}>{cta.label}</a>
        </span>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-stage on-dark"><div className="lp-avatar"><Avatar mode="speaking" label="O rosto do GaDu" /></div></div>
          <div className="lp-hero-text">
            <span className="mono lp-kicker">Sua plataforma de inteligência pessoal</span>
            <h1>Fale com o GaDu. Ele <em>escuta</em>, <em>lembra</em> e <em>organiza</em>.</h1>
            <p className="muted">Um assistente por voz e texto que acompanha você em qualquer tela. Hoje ele cuida do seu dia: agenda, e-mails, tarefas e memória. Sempre com a sua aprovação.</p>
            <div className="row">
              <a className="btn btn-pri lp-cta" href={cta.href}>{cta.label}</a>
              <a className="btn" href="#como">Como funciona</a>
            </div>
            <p className="lp-now"><span className="pill disponivel">Disponível</span> Módulo Pessoal <span className="pill parcial">Parcial</span> Agent Office <span className="pill planejado">Planejado</span> outros módulos</p>
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

        <section className="lp-section" id="modulos">
          <span className="mono lp-kicker">Uma plataforma, seis módulos</span>
          <h2>O que já funciona e o que está no plano</h2>
          <p className="muted">O GaDu cresce por módulos. Cada um mostra o status real: nada aparece como pronto antes de estar.</p>
          <ModuleCards />
        </section>

        <section className="lp-section lp-assist" id="assistente">
          <div>
            <span className="mono lp-kicker">Assistente universal</span>
            <h2>Voz e texto em qualquer tela</h2>
            <p className="muted">O GaDu fica sempre à mão: um painel ao lado no computador e um painel que sobe no celular. Ele sabe em que tela você está e responde sem tirar você de lá.</p>
            <ul className="ticks ok">
              <li><Icon name="check" size={16} /><span>Fale ou escreva, como preferir</span></li>
              <li><Icon name="check" size={16} /><span>A mesma conversa em todas as telas</span></li>
              <li><Icon name="check" size={16} /><span>Usa só os seus dados, com as suas permissões</span></li>
            </ul>
          </div>
          <div className="lp-assist-mock on-dark" aria-hidden="true">
            <div className="assist-head">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/avatar/logo-96.webp" alt="" width={36} height={36} />
              <div className="t"><b>GaDu <span className="mono assist-state">· Pronto</span></b><small>Em Pessoal › Hoje</small></div>
            </div>
            <div className="assist-log">
              <div className="bub u">Como está o meu dia?</div>
              <div className="bub b"><span className="via">GaDu</span>Três compromissos, o primeiro às 9h. Há uma janela livre das 15h às 17h30.</div>
            </div>
            <div className="assist-composer"><span className="round"><Icon name="mic" /></span><span className="field muted" style={{ display: "flex", alignItems: "center" }}>Pergunte ou peça algo</span><span className="round pri"><Icon name="send" /></span></div>
          </div>
        </section>

        <section className="lp-section">
          <span className="mono lp-kicker">Disponível hoje · módulo Pessoal</span>
          <h2>O que o GaDu já faz</h2>
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
                <radialGradient id="lpg"><stop offset="0" stopColor="rgb(var(--sig-rgb) / .35)" /><stop offset="1" stopColor="rgb(var(--sig-rgb) / 0)" /></radialGradient>
              </defs>
              <circle cx="180" cy="150" r="70" fill="url(#lpg)" />
              {[[60, 46, "var(--sig)"], [300, 46, "var(--c-violet)"], [60, 254, "var(--c-green)"], [300, 254, "var(--c-blue)"]].map(([x, y, c]) => (
                <line key={`${x}-${y}`} x1="180" y1="150" x2={x as number} y2={y as number} stroke={c as string} strokeWidth="1.2" strokeDasharray="4 5" opacity=".7" />
              ))}
              <circle cx="180" cy="150" r="44" fill="rgb(var(--panel-rgb) / .98)" stroke="var(--sig)" strokeWidth="1.6" />
              <text x="180" y="146" textAnchor="middle" fill="var(--ink)" fontSize="16" fontWeight="600">GaDu</text>
              <text x="180" y="164" textAnchor="middle" fill="var(--ink-3)" fontSize="10">orquestra tudo</text>
              {[
                [60, 46, "Você", "voz ou texto", "var(--sig)"],
                [300, 46, "Inteligência", "Claude e reserva", "var(--c-violet)"],
                [60, 254, "Memória", "aprovada por você", "var(--c-green)"],
                [300, 254, "Agenda e e-mail", "Google", "var(--c-blue)"],
              ].map(([x, y, t, s, c]) => (
                <g key={t as string}>
                  <rect x={(x as number) - 56} y={(y as number) - 24} width="112" height="48" rx="14" fill="rgb(var(--panel-rgb) / .95)" stroke={c as string} />
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

        <section className="lp-section" id="privacidade">
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
    <div className="lp-phone on-dark" aria-hidden="true">
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
