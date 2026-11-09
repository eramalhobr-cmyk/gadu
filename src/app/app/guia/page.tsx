import type { Metadata } from "next";
import { GaduApp } from "@/components/GaduApp";
import { HelpNav } from "@/components/HelpNav";
import { loadApp } from "../load";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Guia · GaDu" };

type Step = { title: string; why: string; how: string[]; done: boolean | null; href: string; cta: string };

const ASK: { area: string; color: string; say: string[]; then: string }[] = [
  { area: "Organizar o dia", color: "var(--sig)", say: ["Começar o dia", "Priorizar meu dia", "Planejar minha semana"], then: "O GaDu cruza agenda, e-mails, tarefas e lembretes e responde falando." },
  { area: "Agenda", color: "var(--c-blue)", say: ["Como está minha agenda amanhã?", "Marca dentista quinta às 10", "Tenho horário livre hoje à tarde?"], then: "Para marcar, ele mostra um cartão. Nada entra na agenda até você tocar em Criar na agenda." },
  { area: "Lembretes", color: "var(--c-pink)", say: ["Me lembra daqui a 20 minutos de tirar o bolo do forno", "Me lembra sexta às 9 de pagar o condomínio"], then: "Na hora certa chega uma notificação no celular. Os lembretes aparecem na aba Hoje." },
  { area: "Tarefas", color: "var(--hot)", say: ["Anota aí: renovar o seguro do carro até sexta", "Quais tarefas estão atrasadas?"], then: "As tarefas ficam em Projetos › Tarefas e as urgentes aparecem no Hoje. Toque no quadradinho para concluir." },
  { area: "E-mails", color: "var(--c-violet)", say: ["Tenho e-mails importantes?", "Quais e-mails pedem resposta?"], then: "O GaDu só lê. No Hoje, cada e-mail tem o botão Virar tarefa." },
  { area: "Memória", color: "var(--c-green)", say: ["Lembre que prefiro reuniões depois das 10h", "O que você sabe sobre mim?"], then: "O que ele aprende fica para você aprovar em Perfil › Memória. Só vale depois do seu sim." },
  { area: "Projetos e agentes", color: "var(--c-blue)", say: ["Me ajuda a quebrar isso em tarefas", "Pode anotar"], then: "Abra um projeto ou um agente e toque em Conversar. Ele já sabe do que se trata." },
];

export default async function Guia() {
  const { supabase, props } = await loadApp({ tab: "perfil" });

  const head = { count: "exact" as const, head: true };
  const [google, push, agents, memories, convs] = await Promise.all([
    supabase.from("google_connections").select("user_id", head),
    supabase.from("push_subscriptions").select("id", head),
    supabase.from("agents").select("id", head),
    supabase.from("memories").select("id", head).eq("status", "approved"),
    supabase.from("conversations").select("id", head),
  ]);
  const has = (r: { count: number | null }) => (r.count ?? 0) > 0;

  const steps: Step[] = [
    { title: "Instale na tela de início", why: "Abre como um aplicativo e é o que permite receber notificações no iPhone.", how: ["iPhone: no Safari, toque em Compartilhar › Adicionar à Tela de Início.", "Android: no Chrome, toque nos três pontinhos › Instalar app."], done: null, href: "/app?tab=hoje", cta: "Abrir o Hoje" },
    { title: "Ligue as notificações", why: "Para receber lembretes, o briefing da manhã e a revisão da noite.", how: ["Perfil › Ajustes › Ligar notificações › Permitir.", "Toque em Enviar teste para conferir."], done: has(push), href: "/app?tab=ajustes", cta: "Ir para Ajustes" },
    { title: "Conecte o Google", why: "Para o GaDu ler sua agenda e seus e-mails e criar eventos quando você confirmar.", how: ["Perfil › Ajustes › Conexões › Conectar Google.", "Na tela do Google, marque todas as caixas."], done: has(google), href: "/app?tab=ajustes", cta: "Conectar" },
    { title: "Traga o que outras IAs já sabem", why: "Assim o GaDu começa já conhecendo você.", how: ["Perfil › Memória › Importar de outra IA.", "Copie o pedido, cole no ChatGPT ou no Claude e traga a resposta.", "Aprove o que fizer sentido."], done: has(memories), href: "/app?tab=memoria", cta: "Ir para Memória" },
    { title: "Escolha seus agentes", why: "Versões do GaDu para cada área: saúde, finanças, estudos, seu negócio.", how: ["Aba Agentes › Adicionar sugeridos, ou Novo agente.", "Edite as instruções do seu jeito."], done: has(agents), href: "/app?tab=agentes", cta: "Ver agentes" },
    { title: "Converse pela primeira vez", why: "Fale como falaria com uma pessoa. Comece por: Começar o dia.", how: ["Toque no microfone, fale e solte.", "Ou use o botão redondo no canto, em qualquer tela."], done: has(convs), href: "/app?tab=conversa", cta: "Conversar" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const checkable = steps.filter((s) => s.done !== null).length;

  return (
    <GaduApp {...props} page={
    <div className="doc guia">
      <HelpNav active="guia" />
      <h1>Guia do GaDu</h1>
      <p className="muted">Seis passos para deixar tudo pronto e os jeitos de pedir cada coisa. Leva uns 10 minutos.</p>

      <div className="guia-progress" aria-label={`${doneCount} de ${checkable} passos concluídos`}>
        <div className="bar"><div style={{ width: `${(doneCount / checkable) * 100}%`, background: "var(--sig)" }} /></div>
        <span className="mono">{doneCount} de {checkable} prontos</span>
      </div>

      <h2>Primeiros passos</h2>
      <ol className="guia-steps">
        {steps.map((s, i) => (
          <li key={s.title} className={s.done ? "done" : ""}>
            <span className="flow-n">{s.done ? "✓" : i + 1}</span>
            <div className="guia-step">
              <b>{s.title}</b>
              <span className="muted">{s.why}</span>
              <ul>{s.how.map((h) => <li key={h}>{h}</li>)}</ul>
              {!s.done && <a className="btn btn-sm" href={s.href}>{s.cta}</a>}
            </div>
          </li>
        ))}
      </ol>

      <h2>Como pedir cada coisa</h2>
      <p className="muted">Fale ou escreva do seu jeito. Estes são só exemplos.</p>
      <div className="ask-grid">
        {ASK.map((a) => (
          <section key={a.area} className="ask" style={{ ["--c" as string]: a.color }}>
            <b>{a.area}</b>
            <div className="ask-says">{a.say.map((q) => <span key={q} className="say">“{q}”</span>)}</div>
            <span className="muted">{a.then}</span>
          </section>
        ))}
      </div>

      <h2>Voz: como usar bem</h2>
      <ul className="ticks">
        <li>Toque no microfone, fale e faça uma pausa. Ele entende quando você terminou.</li>
        <li>Para interromper a resposta, toque de novo no botão.</li>
        <li>Em Ajustes, escolha a voz e a velocidade. Ligue o modo conversa para ele voltar a ouvir sozinho.</li>
      </ul>

      <h2>Se algo der errado</h2>
      <div className="navmap">
        <div className="navmap-item"><b>Ele entendeu errado</b><span>Corrija falando: “não, é quinta às 11”. Propostas erradas você descarta com um toque.</span></div>
        <div className="navmap-item"><b>Quero apagar algo</b><span>Memórias em Perfil › Memória. Conversas no menu ☰. Tarefas e lembretes no próprio item.</span></div>
        <div className="navmap-item"><b>Não chegou notificação</b><span>Perfil › Ajustes › Enviar teste. No iPhone, abra o GaDu pelo ícone da tela de início.</span></div>
        <div className="navmap-item"><b>Quanto estou gastando?</b><span>Perfil › Ajustes mostra o gasto do mês e os limites de cada motor de IA.</span></div>
      </div>

      <p className="muted" style={{ marginTop: 24 }}>Quer ver como tudo se conecta por dentro? <a href="/app/sobre">Como o GaDu funciona</a>.</p>
    </div>
    } />
  );
}
