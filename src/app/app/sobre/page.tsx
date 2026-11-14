import type { Metadata } from "next";
import { GaduApp } from "@/components/GaduApp";
import { HelpNav } from "@/components/HelpNav";
import { PageHeader, Panel } from "@/components/kit";
import { Icon } from "@/components/ui";
import { loadApp } from "../load";
import { APP_VERSION } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Como funciona · GaDu" };

const S = "var(--sig)", H = "var(--hot)", V = "var(--c-violet)", B = "var(--c-blue)", G = "var(--c-green)", P = "var(--c-pink)";

function Box({ x, y, w, h, color, title, sub }: { x: number; y: number; w: number; h: number; color: string; title: string; sub?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="14" fill="var(--panel)" stroke={color} strokeWidth="1.4" />
      <rect x={x} y={y} width={w} height={h} rx="14" fill={color} opacity=".08" />
      <text x={x + w / 2} y={y + (sub ? h / 2 - 3 : h / 2 + 5)} textAnchor="middle" fill="var(--ink)" fontSize="14" fontWeight="600">{title}</text>
      {sub && <text x={x + w / 2} y={y + h / 2 + 15} textAnchor="middle" fill="var(--ink-3)" fontSize="11">{sub}</text>}
    </g>
  );
}
function Arrow({ d, color = S, dash = false }: { d: string; color?: string; dash?: boolean }) {
  return <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeDasharray={dash ? "4 5" : undefined} markerEnd="url(#arr)" opacity=".85" />;
}

export default async function Sobre() {
  const { props } = await loadApp({ tab: "perfil" });

  return (
    <GaduApp {...props} page={
    <div className="wrap guide sobre2">
      <HelpNav active="sobre" />
      <PageHeader eyebrow={`Ajuda · versão ${APP_VERSION}`} title="Como o GaDu funciona" text="Um assistente pessoal por voz e texto que lembra de você, organiza seu dia e cuida da sua privacidade." />

      <div className="grid-2">
        <Panel title="A arquitetura, em uma imagem" icon="grid">
          <figure className="diagram2">
            <svg viewBox="0 0 360 560" role="img" aria-label="Diagrama: o celular fala com o servidor na Vercel, que usa o banco Supabase, os motores de IA, o Google e as notificações.">
              <defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill={S} /></marker></defs>
              <Box x={95} y={10} w={170} h={64} color={S} title="Você · celular" sub="app instalado (PWA), voz" />
              <Arrow d="M180 76 V120" />
              <text x="190" y="102" fill="var(--ink-3)" fontSize="10">HTTPS + login</text>
              <rect x="20" y="124" width="320" height="180" rx="18" fill="none" stroke={S} strokeDasharray="5 6" opacity=".6" />
              <text x="34" y="146" fill={S} fontSize="11">Servidor · Vercel (São Paulo)</text>
              <Box x={34} y={158} w={140} h={56} color={S} title="Portão de segurança" sub="sessão e quem entra" />
              <Box x={186} y={158} w={140} h={56} color={S} title="App e APIs" sub="conversa, hoje, agenda" />
              <Box x={34} y={228} w={140} h={60} color={H} title="Agendador" sub="a cada minuto" />
              <Box x={186} y={228} w={140} h={60} color={V} title="Roteador de IA" sub="troca se um falhar" />
              <Arrow d="M110 306 V356" />
              <Arrow d="M256 306 V356" color={V} />
              <Box x={20} y={360} w={150} h={70} color={G} title="Banco Supabase" sub="cada pessoa só vê o seu" />
              <Box x={190} y={360} w={150} h={70} color={V} title="Motores de IA" sub="Claude · Gemini (reserva)" />
              <Arrow d="M95 432 V476" color={B} dash />
              <Arrow d="M265 432 V476" color={P} dash />
              <Box x={20} y={480} w={150} h={66} color={B} title="Google" sub="agenda e Gmail" />
              <Box x={190} y={480} w={150} h={66} color={P} title="Notificações" sub="lembretes e briefing" />
            </svg>
            <figcaption>O celular só fala com o servidor do GaDu. As chaves (IA, Google, banco) ficam no servidor, nunca no aparelho.</figcaption>
          </figure>
        </Panel>

        <div className="stack">
          <Panel title="O que acontece quando você fala" icon="mic">
            <ol className="flow2">
              {[
                ["Você fala", "O próprio celular transforma sua voz em texto (grátis)."],
                ["Privacidade", "Se tiver documento, senha, banco ou saúde, nada é enviado."],
                ["Contexto", "Memórias aprovadas, tarefas, agenda, e-mails e conversas parecidas (busca por significado)."],
                ["Motor de IA", "Claude responde. Se falhar ou passar do limite, entra o próximo motor."],
                ["Resposta", "Chega em texto e voz, frase a frase."],
                ["Você decide", "Memórias, tarefas, lembretes e eventos propostos só valem com a sua aprovação."],
              ].map(([t, d], i) => (
                <li key={t}><span className="g-n" aria-hidden="true">{i + 1}</span><div><b>{t}</b><span>{d}</span></div></li>
              ))}
            </ol>
          </Panel>
          <Panel title="Segurança e privacidade" icon="lock">
            <ul className="plist ok">
              {[
                "Entrada só por convite, com senha. Cada pessoa vê apenas os próprios dados.",
                "Dados sensíveis não vão para a IA. Termos bloqueados (ex.: empresa onde você trabalha) também não.",
                "E-mail é só leitura. Eventos na agenda só são criados quando você toca em “Criar”.",
                "Limite de gasto por motor de IA e teto mensal, em Configurações.",
                "Desconectar o Google revoga o acesso na hora.",
              ].map((t) => <li key={t}><Icon name="check" size={16} /><span>{t}</span></li>)}
            </ul>
          </Panel>
        </div>
      </div>

      <section className="guide-sec" aria-labelledby="s-nav">
        <h2 id="s-nav" className="sec-title">Navegação</h2>
        <div className="navmap2">
          {[
            ["Hoje", "Seu painel: começar o dia, insights, agenda, lembretes, tarefas e e-mails."],
            ["Conversas", "Falar ou escrever. Com um agente ou sobre um projeto, quando você escolhe."],
            ["Tarefas", "Tudo o que você precisa fazer, das atrasadas às sem prazo."],
            ["Agenda", "A semana do Google Agenda, com criação de eventos."],
            ["Projetos", "Objetivo, próximos passos, tarefas e progresso."],
            ["Memórias", "O que o GaDu sabe sobre você, com a sua aprovação."],
            ["Agentes", "Versões do GaDu com instruções próprias: saúde, finanças, estudos, negócio."],
            ["Configurações", "Perfil, aparência, conexões, notificações e gastos."],
          ].map(([t, d]) => <div key={t} className="nm"><b>{t}</b><span>{d}</span></div>)}
          <div className="nm hl"><b>Assistente</b><span>Em qualquer tela: toque, fale e veja a resposta sem sair de onde está.</span></div>
        </div>
      </section>

      <div className="grid-2">
        <Panel title="O que o GaDu guarda" icon="book">
          <figure className="diagram2">
            <svg viewBox="0 0 360 300" role="img" aria-label="Diagrama de dados: tudo pertence a você; memórias, conversas, tarefas, projetos, agentes, lembretes e índice de busca.">
              <circle cx="180" cy="150" r="46" fill="var(--panel)" stroke={S} />
              <circle cx="180" cy="150" r="46" fill={S} opacity=".1" />
              <text x="180" y="146" textAnchor="middle" fill="var(--ink)" fontSize="14" fontWeight="600">Você</text>
              <text x="180" y="163" textAnchor="middle" fill="var(--ink-3)" fontSize="10">perfil e acesso</text>
              {[
                [70, 40, "Memórias", G], [180, 22, "Conversas", S], [290, 40, "Tarefas", H],
                [40, 150, "Agentes", V], [320, 150, "Projetos", B],
                [70, 262, "Lembretes", P], [180, 280, "Busca", V], [290, 262, "Google", B],
              ].map(([x, y, t, c]) => (
                <g key={t as string}>
                  <line x1="180" y1="150" x2={x as number} y2={y as number} stroke={c as string} strokeWidth="1" opacity=".5" />
                  <rect x={(x as number) - 46} y={(y as number) - 16} width="92" height="32" rx="10" fill="var(--panel)" stroke={c as string} />
                  <text x={x as number} y={(y as number) + 5} textAnchor="middle" fill="var(--ink)" fontSize="12">{t as string}</text>
                </g>
              ))}
            </svg>
            <figcaption>Tudo tem dono. O banco recusa qualquer leitura de dados de outra pessoa, mesmo de um administrador. O acesso ao Google fica criptografado.</figcaption>
          </figure>
        </Panel>
        <Panel title="Custos" icon="coin">
          <div className="rows">
            <div className="row-i"><span className="tag ok">Grátis</span><div className="grow"><span className="s">Voz do aparelho, banco (plano grátis), notificações, insights, agenda visual.</span></div></div>
            <div className="row-i"><span className="tag hot">Centavos</span><div className="grow"><span className="s">Respostas da IA (com limites que você define), resumos e a busca por significado.</span></div></div>
          </div>
        </Panel>
      </div>
    </div>
    } />
  );
}
