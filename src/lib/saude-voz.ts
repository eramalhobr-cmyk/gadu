// Voz da "Saúde do sistema": "teve algum erro hoje?", "o que quebrou?", "abre a saúde do sistema".
// Entendido no aparelho, sem modelo e sem custo (mesmo padrão de parseNavIntent e parseLerResumo). Só leitura: não grava nada.
// A frase falada só usa tipo do erro, rota e contagens; nunca e-mail, mensagem, token ou dado de pessoa.
import { sensivel } from "./telemetria/privado.ts";
import type { Saude } from "./telemetria/saude.ts";

export type SaudeIntent = { tipo: "resumo" } | { tipo: "painel" } | { tipo: "admin" };

export const FRASE_NAO_ADMIN = "Isso é só para administrador.";
export const FRASE_INDISPONIVEL = "Não consegui ler os erros agora. Tente de novo em instantes.";
export const FRASE_DESLIGADO = "O registro de erros está desligado.";

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
const PRE = "(?:gadu )?(?:por favor )?(?:me )?";
const RESUMO = [
  new RegExp(`^${PRE}(?:teve|tem|houve|deu|ha|aconteceu)(?: algum| algo| de)? (?:erro|erros|problema|problemas)(?: hoje| agora| no sistema| no gadu| hoje no gadu)?(?: por favor)?$`),
  // "algum erro" ou "erros hoje": precisa do "algum/algo de" ou de um recorte (hoje, agora, no sistema). "erro" sozinho segue para o GaDu.
  new RegExp(`^${PRE}(?:algum |algo de )(?:erro|erros|problema|problemas)(?: hoje| agora| no sistema| no gadu)?(?: por favor)?$`),
  new RegExp(`^${PRE}(?:erro|erros|problema|problemas)(?: hoje| agora| no sistema| no gadu)(?: por favor)?$`),
  new RegExp(`^${PRE}(?:o )?que (?:quebrou|deu errado|falhou|deu erro)(?: hoje| agora| no sistema| no gadu| hoje no gadu)?(?: por favor)?$`),
  new RegExp(`^${PRE}(?:o )?gadu (?:quebrou|teve erro|deu erro|falhou)(?: hoje| agora)?(?: por favor)?$`),
];
const PAINEL = new RegExp(`^${PRE}(?:(?:mostra|mostrar|mostre|abre|abrir|abra|ver|quero ver|exibe|vai para|vai pra)(?: a| o)? )?(?:tela |painel |resumo )?(?:de |da |do )?saude(?: do sistema| do gadu| dos sistemas)?(?: por favor)?$`);
const ADMIN = new RegExp(`^${PRE}(?:abre|abrir|abra|vai para|vai pra|me leva para|mostra|mostrar)(?: a| o)? (?:tela de |area de |painel de )?(?:administracao|admin|administrador)(?: por favor)?$`);

export function parseSaudeVoz(text: string): SaudeIntent | null {
  const t = norm(text);
  if (!t || t.length > 60) return null;
  if (RESUMO.some((r) => r.test(t))) return { tipo: "resumo" };
  if (PAINEL.test(t)) return { tipo: "painel" };
  if (ADMIN.test(t)) return { tipo: "admin" };
  return null;
}

const pl = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Frase honesta do dia de hoje (Brasília) a partir dos números reais. */
export function fraseSaude(s: Pick<Saude, "ligado" | "disponivel" | "hoje">): string {
  if (!s.ligado) return FRASE_DESLIGADO;
  if (!s.disponivel) return FRASE_INDISPONIVEL;
  if (s.hoje.total === 0) return "Nenhum erro registrado hoje.";
  let t = `Hoje houve ${pl(s.hoje.total, "erro", "erros")} em ${pl(s.hoje.grupos, "grupo", "grupos")}.`;
  const r = s.hoje.recente;
  if (r && !sensivel(r.nome) && !sensivel(r.rota)) t += ` O mais recente é ${r.nome} em ${r.rota}, ${pl(r.vezes, "vez", "vezes")}.`;
  return t;
}

/**
 * Executa o pedido: 403 vira "só para administrador", falha vira aviso honesto. `abrir` diz se a tela Admin deve abrir.
 * "abre a administração" só abre (sem falar números). Quem não é admin nunca chega a abrir a tela.
 */
export async function responderSaude(intent: SaudeIntent, admin: boolean, buscar: typeof fetch = fetch): Promise<{ abrir: boolean; fala: string }> {
  if (!admin) return { abrir: false, fala: FRASE_NAO_ADMIN };
  if (intent.tipo === "admin") return { abrir: true, fala: "Abrindo Administração." };
  try {
    const r = await buscar("/api/admin/saude", { cache: "no-store" });
    if (r.status === 403) return { abrir: false, fala: FRASE_NAO_ADMIN };
    if (!r.ok) return { abrir: intent.tipo === "painel", fala: FRASE_INDISPONIVEL };
    const s = (await r.json()) as Saude;
    return { abrir: true, fala: fraseSaude(s) };
  } catch {
    return { abrir: false, fala: FRASE_INDISPONIVEL };
  }
}
