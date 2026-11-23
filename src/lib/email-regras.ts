// Triagem de e-mails que obedece às memórias aprovadas da pessoa (sem IA, custo zero).
// Módulo puro: sem dependências do app, para rodar nos testes e em qualquer rota.
import type { Mail } from "./google-format.ts";

/** Evento da janela: "isso não é importante" (voz ou texto) aplicado ao primeiro e-mail da lista Hoje. */
export const EMAIL_NAO_IMPORTANTE_EVENT = "gadu:email-nao-importante";
/** Evento da janela: recarregar a lista "Merece sua atenção". */
export const ATENCAO_RECARREGAR_EVENT = "gadu:atencao-recarregar";

export type RegrasEmail = { silenciar: string[]; manter: string[] };
export type NivelEmail = "critico" | "importante" | "normal" | "baixa";
export type MailBase = Pick<Mail, "from" | "subject" | "important"> & { fromEmail?: string };

export function normalizar(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const SERVICOS = ["vercel", "github", "netlify", "supabase", "cloudflare", "render", "railway", "gitlab", "circleci", "sentry", "npm", "linkedin", "bitbucket", "heroku", "docker", "stripe", "paypal", "nubank", "twitter", "instagram", "facebook"];

const TOPICOS: { gatilho: RegExp; termos: string[] }[] = [
  { gatilho: /\bdeploys?\b|\bdeployments?\b|\bimplantac/, termos: ["deploy", "deployment", "implantacao"] },
  { gatilho: /\bci\b|\bcicd\b|\bpipelines?\b|\bworkflows?\b|run failed|build failed|\bchecks?\b/, termos: ["ci", "run failed", "workflow", "checks", "actions", "pipeline", "build failed"] },
  { gatilho: /\bbuilds?\b/, termos: ["build"] },
  { gatilho: /\bnewsletters?\b|\bboletim\b|\bboletins\b|\bdigest\b/, termos: ["newsletter", "boletim", "digest"] },
  { gatilho: /notificac(ao|oes)/, termos: ["notificacao"] },
];

const PARADAS = new Set(["da", "de", "do", "das", "dos", "nao", "sao", "e", "eh", "que", "sejam", "seja", "como", "para", "pra", "sobre", "nos", "no", "na", "em", "com", "ao", "a", "o", "os", "as", "mas", "sim", "por", "ser", "quero", "quer"]);
const NOMES_FRACOS = new Set(["importantes", "importante", "hoje", "mim", "voce", "automaticos", "desconhecidos", "meus", "minha", "isso", "esse", "este"]);

const ASSUNTO_EMAIL = /\be-?mails?\b|notificac|newsletter|caixa de entrada/;
const NEGATIVO = /\bnao (e|eh|sao|sejam|seja|serao|ser) (muito )?importantes?\b|\bnao quer(o|em)?\b|\bnao merece(m)? (a )?atencao|\bignor(ar|e|a)\b|\bnao (mostr|exib)(ar|e|a)\b|baixa prioridade|irrelevantes?|sem importancia|\bnao (devem|deve) (ser )?(tratad|consider)/;
const POSITIVO = /\bcontinua(m)? (a ser |sendo )?(relevantes?|importantes?)|\bsao importantes?\b|\bquer(o)? ver\b|\bmanter\b|\bmantenha\b/;

const RE_EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g;
const RE_DOMINIO = /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com\.br|com|io|app|dev|net|org|br)\b/g;

function termosDaClausula(clausula: string): string[] {
  const termos = new Set<string>();
  let t = clausula;
  for (const m of t.match(RE_EMAIL) ?? []) termos.add(m);
  t = t.replace(RE_EMAIL, " ");
  for (const m of t.match(RE_DOMINIO) ?? []) termos.add(m);
  t = t.replace(RE_DOMINIO, " ");
  for (const s of SERVICOS) if (new RegExp(`(?<![a-z0-9])${s}(?![a-z0-9])`).test(t)) termos.add(s);
  for (const tp of TOPICOS) if (tp.gatilho.test(t)) for (const x of tp.termos) termos.add(x);
  // Nome do remetente: "e-mails do Banco Azul ..." → "banco azul".
  const nome = /\be-?mails? d[aeo]s? ([a-z0-9][a-z0-9 -]*)/.exec(t)?.[1];
  if (nome) {
    const palavras: string[] = [];
    for (const w of nome.split(/\s+/).filter(Boolean)) {
      if (PARADAS.has(w) || palavras.length >= 3) break;
      palavras.push(w);
    }
    const n = palavras.join(" ").trim();
    if (n.length >= 2 && !NOMES_FRACOS.has(n)) termos.add(n);
  }
  return [...termos];
}

/** Lê as memórias aprovadas e devolve o que silenciar e o que manter na triagem de e-mails. */
export function regrasDeMemorias(conteudos: string[]): RegrasEmail {
  const silenciar = new Set<string>();
  const manter = new Set<string>();
  for (const bruto of conteudos) {
    const texto = normalizar(String(bruto ?? ""));
    if (!ASSUNTO_EMAIL.test(texto)) continue;
    const clausulas = texto.split(/;|\.(?=\s|$)|\b(?:mas|porem|exceto|menos)\b/).map((c) => c.trim()).filter(Boolean);
    for (const c of clausulas) {
      // O negativo vence: "não são importantes" contém "são importantes".
      const alvo = NEGATIVO.test(c) ? silenciar : POSITIVO.test(c) ? manter : null;
      if (!alvo) continue;
      for (const x of termosDaClausula(c)) alvo.add(x);
    }
  }
  return { silenciar: [...silenciar], manter: [...manter] };
}

const CRITICOS = [
  "security alert", "alerta de seguranca", "atividade suspeita", "senha alterada", "password changed", "acesso nao autorizado",
  "conta suspensa", "account suspended", "pagamento recusado", "payment failed", "fatura vencida", "overdue", "dominio expira", "domain expir", "vazamento", "breach",
];

const escapa = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const casaPalavra = (termo: string, texto: string) => new RegExp(`(?<![a-z0-9])${escapa(termo)}(?![a-z0-9])`).test(texto);

function remetente(from: string, fromEmail?: string): { local: string; dominio: string } {
  const f = normalizar(fromEmail ? `<${fromEmail}>` : from);
  const addr = /<([^>]+)>/.exec(f)?.[1] ?? (f.includes("@") ? f.trim() : "");
  const [local = "", dominio = ""] = addr.split("@");
  return { local: local.trim(), dominio: dominio.trim() };
}

const LOCAL_AUTOMATICO = /^(no-?reply|donotreply|do-not-reply|notifications?|notify|alerts?|mailer(-daemon)?|bounces?)([+._-].*)?$/;
const DOMINIOS_DEV = ["vercel", "github", "netlify", "supabase", "cloudflare", "gitlab", "circleci", "sentry", "render", "railway"];
const ASSUNTO_AUTOMATICO = ["deploy", "deployment", "build", "pipeline", "workflow", "run failed", "newsletter", "digest"];

function automatico(from: string, subject: string, fromEmail?: string): boolean {
  const { local, dominio } = remetente(from, fromEmail);
  if (local && LOCAL_AUTOMATICO.test(local)) return true;
  if (dominio && dominio.split(".").some((p) => DOMINIOS_DEV.includes(p))) return true;
  const s = normalizar(subject);
  return ASSUNTO_AUTOMATICO.some((k) => casaPalavra(k, s));
}

export function classificarEmail(mail: MailBase, regras: RegrasEmail): { nivel: NivelEmail; motivo: string } {
  const texto = normalizar(`${mail.from} ${mail.fromEmail ?? ""} ${mail.subject}`);
  if (CRITICOS.some((k) => casaPalavra(k, texto))) return { nivel: "critico", motivo: "aviso de segurança ou cobrança" };
  if (regras.manter.some((k) => casaPalavra(k, texto))) {
    return mail.important ? { nivel: "importante", motivo: "regra da memória" } : { nivel: "normal", motivo: "regra da memória" };
  }
  if (regras.silenciar.some((k) => casaPalavra(k, texto))) return { nivel: "baixa", motivo: "regra da memória" };
  if (automatico(mail.from, mail.subject, mail.fromEmail)) return { nivel: "baixa", motivo: "notificação automática" };
  return mail.important ? { nivel: "importante", motivo: "marcado como importante" } : { nivel: "normal", motivo: "e-mail comum" };
}

export type MailClassificado = Mail & { nivel: NivelEmail; motivo: string };

/** Classifica a lista e recalcula `important` (só crítico e importante contam). */
export function aplicarRegras(mails: Mail[], regras: RegrasEmail): MailClassificado[] {
  return mails.map((m) => {
    const c = classificarEmail(m, regras);
    return { ...m, ...c, important: c.nivel === "critico" || c.nivel === "importante" };
  });
}

export const SEM_REGRAS: RegrasEmail = { silenciar: [], manter: [] };

/** Memórias aprovadas da própria pessoa (cliente da sessão ou filtro por user_id). Nunca lança: em erro, sem regras. */
export async function carregarRegrasEmail(db: { from: (t: string) => any }, userId: string): Promise<RegrasEmail> { // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    const r = await db.from("memories").select("content").eq("status", "approved").eq("user_id", userId).order("created_at", { ascending: false }).limit(200);
    if (r.error || !Array.isArray(r.data)) return { silenciar: [], manter: [] };
    return regrasDeMemorias((r.data as { content?: unknown }[]).map((x) => String(x.content ?? "")));
  } catch {
    return { silenciar: [], manter: [] };
  }
}

/** Texto canônico da memória criada por "isso não é importante". */
export function textoRegra(termo: string): string {
  const t = termo.replace(/\s+/g, " ").trim().slice(0, 120);
  return `E-mails de ${t} não são importantes (não aparecem em Merece sua atenção).`;
}

const PROVEDORES_PUBLICOS = ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "uol.com.br", "bol.com.br"];

/** Termo da regra a partir do remetente: domínio (ex.: "vercel.com") ou, em provedor público, o endereço inteiro. */
export function termoDoRemetente(de: string): string | null {
  const m = /<([^>]+)>/.exec(de);
  const addr = (m?.[1] ?? de).trim().toLowerCase();
  const at = addr.lastIndexOf("@");
  if (at < 1) return null;
  const dominio = addr.slice(at + 1).replace(/[^a-z0-9.-]/g, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(dominio)) return null;
  if (PROVEDORES_PUBLICOS.includes(dominio)) return addr.replace(/[\s<>"]/g, "");
  return dominio;
}

function limpar(texto: string): string {
  return normalizar(texto).replace(/[^a-z0-9@.\s-]/g, " ").replace(/\s+/g, " ").replace(/[.\s]+$/, "").trim();
}

const ISSO = /^(gadu )?(isso|esse e-? ?mail|este e-? ?mail|essa mensagem|esse|este|esse aviso) (nao (e|eh) importante|nao merece (a )?atencao|nao importa)$/;
const TERMO_A = /^(gadu )?(os |o )?e-? ?mails? d[aeo]s? (?<t>.{2,60}?) nao (sao|e|eh|seja|sejam) importantes?$/;
const TERMO_B = /^(gadu )?(nao (mostr(a|e|ar)|exib(e|a|ir)) mais|para de mostrar|ignora(r)?) (os |o )?e-? ?mails? d[aeo]s? (?<t>.{2,60})$/;

/** "isso não é importante" / "e-mails da Vercel não são importantes": comando local, sem modelo. Frase com mais conteúdo → null. */
export function parseNaoImportante(texto: string): { alvo: "isso" } | { alvo: "termo"; termo: string } | null {
  const t = limpar(String(texto ?? ""));
  if (!t || t.length > 120) return null;
  if (ISSO.test(t)) return { alvo: "isso" };
  const termo = (TERMO_A.exec(t) ?? TERMO_B.exec(t))?.groups?.t?.trim();
  if (!termo || termo.split(" ").length > 5 || NOMES_FRACOS.has(termo) || /\b(importante|importantes|hoje|amanha)\b/.test(termo)) return null;
  return { alvo: "termo", termo };
}
