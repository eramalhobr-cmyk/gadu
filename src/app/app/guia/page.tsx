import type { Metadata } from "next";
import { GaduApp } from "@/components/GaduApp";
import { HelpNav } from "@/components/HelpNav";
import { PageHeader, Panel } from "@/components/kit";
import { Icon } from "@/components/ui";
import { loadApp } from "../load";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Guia · GaDu" };

type Step = { title: string; why: string; how: string[]; done: boolean | null; href: string; cta: string };

const ASK: { area: string; color: string; say: string[]; then: string }[] = [
  { area: "Organizar o dia", color: "var(--sig)", say: ["Começar o dia", "Priorizar meu dia", "Planejar minha semana"], then: "O GaDu cruza agenda, e-mails, tarefas e lembretes e responde falando." },
  { area: "Agenda", color: "var(--c-blue)", say: ["Como está minha agenda amanhã?", "Marca dentista quinta às 10", "Tenho horário livre hoje à tarde?"], then: "Para marcar, ele mostra um cartão. Nada entra na agenda até você tocar em Criar na agenda." },
  { area: "Lembretes", color: "var(--c-pink)", say: ["Me lembra daqui a 20 minutos de tirar o bolo do forno", "Me lembra sexta às 9 de pagar o condomínio"], then: "Na hora certa chega uma notificação no celular. Os lembretes aparecem no Hoje." },
  { area: "Tarefas", color: "var(--hot)", say: ["Anota aí: renovar o seguro do carro até sexta", "Quais tarefas estão atrasadas?"], then: "As tarefas ficam na tela Tarefas e as urgentes aparecem no Hoje. Toque no quadradinho para concluir." },
  { area: "E-mails", color: "var(--c-violet)", say: ["Tenho e-mails importantes?", "Quais e-mails pedem resposta?"], then: "O GaDu só lê. No Hoje, cada e-mail tem o botão Virar tarefa." },
  { area: "Memória", color: "var(--c-green)", say: ["Lembre que prefiro reuniões depois das 10h", "O que você sabe sobre mim?"], then: "O que ele aprende fica para você aprovar em Memórias. Só vale depois do seu sim." },
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
    { title: "Ligue as notificações", why: "Para receber lembretes, o briefing da manhã e a revisão da noite.", how: ["Configurações › Ligar notificações › Permitir.", "Toque em Enviar teste para conferir."], done: has(push), href: "/app?tab=ajustes", cta: "Abrir Configurações" },
    { title: "Conecte o Google", why: "Para o GaDu ler sua agenda e seus e-mails e criar eventos quando você confirmar.", how: ["Configurações › Conexões › Conectar Google.", "Na tela do Google, marque todas as caixas."], done: has(google), href: "/app?tab=ajustes", cta: "Conectar" },
    { title: "Traga o que outras IAs já sabem", why: "Assim o GaDu começa já conhecendo você.", how: ["Memórias › Importar de outra IA.", "Copie o pedido, cole no ChatGPT ou no Claude e traga a resposta.", "Aprove o que fizer sentido."], done: has(memories), href: "/app?tab=memoria", cta: "Abrir Memórias" },
    { title: "Escolha seus agentes", why: "Versões do GaDu para cada área: saúde, finanças, estudos, seu negócio.", how: ["Agentes › Adicionar sugeridos, ou Novo agente.", "Edite as instruções do seu jeito."], done: has(agents), href: "/app?tab=agentes", cta: "Ver agentes" },
    { title: "Converse pela primeira vez", why: "Fale como falaria com uma pessoa. Comece por: Começar o dia.", how: ["Toque no microfone, fale e solte.", "Ou use o botão redondo no canto, em qualquer tela."], done: has(convs), href: "/app?tab=conversa", cta: "Conversar" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const checkable = steps.filter((s) => s.done !== null).length;

  return (
    <GaduApp {...props} page={
    <div className="wrap guide">
      <HelpNav active="guia" />
      <PageHeader eyebrow="Ajuda" title="Guia do GaDu" text="Seis passos para deixar tudo pronto e os jeitos de pedir cada coisa. Leva uns 10 minutos." />

      <Panel className="guide-progress">
        <div className="gp-row">
          <b>{doneCount} de {checkable} passos prontos</b>
          <span className="muted small">{doneCount === checkable ? "Tudo pronto." : "Os passos com marca o GaDu confere sozinho."}</span>
        </div>
        <div className="gp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={checkable} aria-valuenow={doneCount} aria-label="Passos concluídos"><span style={{ width: `${(doneCount / checkable) * 100}%` }} /></div>
      </Panel>

      <section className="guide-sec" aria-labelledby="g-steps">
        <h2 id="g-steps" className="sec-title">Primeiros passos</h2>
        <ol className="g-steps">
          {steps.map((s, i) => (
            <li key={s.title} className={`g-step ${s.done ? "done" : ""}`}>
              <span className="g-n" aria-hidden="true">{s.done ? <Icon name="check" size={16} /> : i + 1}</span>
              <div className="g-body">
                <b>{s.title}{s.done && <span className="sr"> (feito)</span>}</b>
                <span className="muted">{s.why}</span>
                <ul>{s.how.map((h) => <li key={h}>{h}</li>)}</ul>
                {!s.done && <a className="btn btn-sm" href={s.href}>{s.cta}<Icon name="chevron" size={14} /></a>}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="guide-sec" aria-labelledby="g-ask">
        <h2 id="g-ask" className="sec-title">Como pedir cada coisa</h2>
        <p className="muted">Fale ou escreva do seu jeito. Estes são só exemplos.</p>
        <div className="ask2-grid">
          {ASK.map((a) => (
            <section key={a.area} className="ask2" style={{ ["--c" as string]: a.color }}>
              <h3><i aria-hidden="true" />{a.area}</h3>
              <div className="ask2-says">{a.say.map((q) => <span key={q} className="say2">“{q}”</span>)}</div>
              <p className="muted small">{a.then}</p>
            </section>
          ))}
        </div>
      </section>

      <div className="grid-2">
        <Panel title="Voz: como usar bem" icon="mic">
          <ul className="plist ok">
            <li><Icon name="check" size={16} /><span>Toque no microfone, fale e faça uma pausa. Ele entende quando você terminou.</span></li>
            <li><Icon name="check" size={16} /><span>Para interromper a resposta, toque de novo no botão.</span></li>
            <li><Icon name="check" size={16} /><span>Em Configurações, escolha a voz e a velocidade. Ligue o modo conversa para ele voltar a ouvir sozinho.</span></li>
          </ul>
        </Panel>
        <Panel title="Se algo der errado" icon="bell">
          <div className="rows">
            <div className="row-i"><div className="grow"><span className="t">Ele entendeu errado</span><span className="s">Corrija falando: “não, é quinta às 11”. Propostas erradas você descarta com um toque.</span></div></div>
            <div className="row-i"><div className="grow"><span className="t">Quero apagar algo</span><span className="s">Memórias na tela Memórias. Conversas no histórico. Tarefas e lembretes no próprio item.</span></div></div>
            <div className="row-i"><div className="grow"><span className="t">Não chegou notificação</span><span className="s">Configurações › Enviar teste. No iPhone, abra o GaDu pelo ícone da tela de início.</span></div></div>
            <div className="row-i"><div className="grow"><span className="t">Quanto estou gastando?</span><span className="s">Configurações mostra o gasto do mês e os limites de cada motor de IA.</span></div></div>
          </div>
        </Panel>
      </div>

      <p className="muted guide-foot">Quer ver como tudo se conecta por dentro? <a href="/app/sobre">Como o GaDu funciona</a>.</p>
    </div>
    } />
  );
}
