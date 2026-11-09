import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { accessOf } from "@/lib/access";
import { APP_VERSION } from "@/lib/config";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Como funciona · GaDu" };

const S = "var(--sig)", H = "var(--hot)", V = "var(--c-violet)", B = "var(--c-blue)", G = "var(--c-green)", P = "var(--c-pink)";

function Box({ x, y, w, h, color, title, sub }: { x: number; y: number; w: number; h: number; color: string; title: string; sub?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="14" fill="rgba(10,18,22,.92)" stroke={color} strokeWidth="1.4" />
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
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!(await accessOf(supabase, data.user)).ok) redirect("/login");

  return (
    <main className="doc sobre">
      <a href="/app?tab=perfil" className="mono">‹ Voltar ao GaDu</a>
      <h1>Como o GaDu funciona</h1>
      <p className="muted">Versão {APP_VERSION}. Um assistente pessoal por voz e texto que lembra de você, organiza seu dia e cuida da sua privacidade.</p>

      <h2>1. A arquitetura, em uma imagem</h2>
      <figure className="diagram">
        <svg viewBox="0 0 360 560" role="img" aria-label="Diagrama: o celular fala com o servidor na Vercel, que usa o banco Supabase, os motores de IA, o Google e as notificações.">
          <defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill={S} /></marker></defs>
          <Box x={95} y={10} w={170} h={64} color={S} title="Você · celular" sub="app instalado (PWA), voz" />
          <Arrow d="M180 76 V120" />
          <text x="190" y="102" fill="var(--ink-3)" fontSize="10">HTTPS + login</text>
          <rect x="20" y="124" width="320" height="180" rx="18" fill="none" stroke={S} strokeDasharray="5 6" opacity=".6" />
          <text x="34" y="146" fill={S} fontSize="11" letterSpacing="1.5">SERVIDOR · VERCEL (SÃO PAULO)</text>
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

      <h2>2. O que acontece quando você fala</h2>
      <ol className="flow">
        {[
          ["Você fala", "O próprio celular transforma sua voz em texto (grátis)."],
          ["Privacidade", "Se tiver documento, senha, banco ou saúde, nada é enviado."],
          ["Contexto", "Memórias aprovadas, tarefas, agenda, e-mails e conversas parecidas (busca por significado)."],
          ["Motor de IA", "Claude responde. Se falhar ou passar do limite, entra o próximo motor."],
          ["Resposta", "Chega em texto e voz, frase a frase."],
          ["Você decide", "Memórias, tarefas, lembretes e eventos propostos só valem com a sua aprovação."],
        ].map(([t, d], i) => (
          <li key={t}><span className="flow-n">{i + 1}</span><div><b>{t}</b><span>{d}</span></div></li>
        ))}
      </ol>

      <h2>3. Navegação</h2>
      <div className="navmap">
        {[
          ["Hoje", "Seu painel: começar o dia, insights, agenda, lembretes, tarefas e e-mails. Toque em Ver semana para a agenda visual."],
          ["Conversa", "Falar ou escrever. Com um agente ou sobre um projeto, quando você escolhe."],
          ["Projetos", "Tarefas de tudo e projetos com objetivo, próximos passos e progresso."],
          ["Agentes", "Versões do GaDu com instruções próprias: saúde, finanças, estudos, negócio."],
          ["Perfil", "Memória, ajustes, conexões, notificações e (para o admin) convites."],
        ].map(([t, d]) => <div key={t} className="navmap-item"><b>{t}</b><span>{d}</span></div>)}
        <div className="navmap-item fab-note"><b>Botão de voz flutuante</b><span>Em qualquer tela: toque, fale e veja a resposta sem sair de onde está.</span></div>
      </div>

      <h2>4. O que o GaDu guarda</h2>
      <figure className="diagram">
        <svg viewBox="0 0 360 300" role="img" aria-label="Diagrama de dados: tudo pertence a você; memórias, conversas, tarefas, projetos, agentes, lembretes e índice de busca.">
          <circle cx="180" cy="150" r="46" fill="rgba(95,240,220,.1)" stroke={S} />
          <text x="180" y="146" textAnchor="middle" fill="var(--ink)" fontSize="14" fontWeight="600">Você</text>
          <text x="180" y="163" textAnchor="middle" fill="var(--ink-3)" fontSize="10">perfil e acesso</text>
          {[
            [70, 40, "Memórias", G], [180, 22, "Conversas", S], [290, 40, "Tarefas", H],
            [40, 150, "Agentes", V], [320, 150, "Projetos", B],
            [70, 262, "Lembretes", P], [180, 280, "Busca", V], [290, 262, "Google", B],
          ].map(([x, y, t, c]) => (
            <g key={t as string}>
              <line x1="180" y1="150" x2={x as number} y2={y as number} stroke={c as string} strokeWidth="1" opacity=".5" />
              <rect x={(x as number) - 46} y={(y as number) - 16} width="92" height="32" rx="10" fill="rgba(10,18,22,.95)" stroke={c as string} />
              <text x={x as number} y={(y as number) + 5} textAnchor="middle" fill="var(--ink)" fontSize="12">{t as string}</text>
            </g>
          ))}
        </svg>
        <figcaption>Tudo tem dono. O banco recusa qualquer leitura de dados de outra pessoa, mesmo de um administrador. O acesso ao Google fica criptografado.</figcaption>
      </figure>

      <h2>5. Segurança e privacidade</h2>
      <ul className="ticks">
        <li>Entrada só por convite, com senha. Cada pessoa vê apenas os próprios dados.</li>
        <li>Dados sensíveis não vão para a IA. Termos bloqueados (ex.: empresa onde você trabalha) também não.</li>
        <li>E-mail é só leitura. Eventos na agenda só são criados quando você toca em “Criar”.</li>
        <li>Limite de gasto por motor de IA e teto mensal, em Ajustes.</li>
        <li>Desconectar o Google revoga o acesso na hora.</li>
      </ul>

      <h2>6. Custos</h2>
      <div className="navmap">
        <div className="navmap-item"><b>Grátis</b><span>Voz do aparelho, banco (plano grátis), notificações, insights, agenda visual.</span></div>
        <div className="navmap-item"><b>Centavos</b><span>Respostas da IA (com limites que você define), resumos e a busca por significado.</span></div>
      </div>
    </main>
  );
}
