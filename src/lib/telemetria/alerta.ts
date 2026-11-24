// Decisão e texto do alerta de erro (funções puras, sem banco). Quem grava o estado e envia o push é `avisar.ts`.
// Regra: avisa o administrador quando aparece um grupo NOVO (primeira vez daquela impressão, ou primeira em 7 dias)
// ou um PICO (PICO_MIN ocorrências do mesmo grupo em PICO_JANELA_MIN minutos). Nunca mais de 1 aviso por grupo a cada
// GRUPO_HORAS horas e de MAX_POR_DIA avisos por dia (Brasília). Sem dado pessoal no texto.
import { sensivel } from "./privado.ts";

export const PICO_MIN = 5;
export const PICO_JANELA_MIN = 15;
export const NOVO_APOS_DIAS = 7;
export const GRUPO_HORAS = 6;
export const MAX_POR_DIA = 4;
export const URL_ALERTA = "/app?tab=admin#painel-saude";
export const TEXTO_GENERICO = "O GaDu registrou um erro. Abra Administração para ver.";

export type Motivo = "novo" | "pico";
export type EstadoGrupo = { primeira_vez: string; ultima_vez: string; ultimo_alerta: string | null; alertas: number };

/** "Dia" de Brasília (AAAA-MM-DD) de um instante. Brasília é UTC-3 o ano todo (sem horário de verão). */
export function diaBrasilia(agora: Date): string {
  return new Date(agora.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

/** O grupo é novo se nunca apareceu ou se a última vez foi há mais de NOVO_APOS_DIAS dias. */
export function grupoNovo(anterior: Pick<EstadoGrupo, "ultima_vez"> | null, agora: Date): boolean {
  if (!anterior) return true;
  return agora.getTime() - new Date(anterior.ultima_vez).getTime() > NOVO_APOS_DIAS * 86_400_000;
}

/** Throttle do grupo: livre se nunca avisou ou se o último aviso foi há GRUPO_HORAS horas ou mais. */
export function grupoLivre(ultimoAlerta: string | null, agora: Date): boolean {
  if (!ultimoAlerta) return true;
  return agora.getTime() - new Date(ultimoAlerta).getTime() >= GRUPO_HORAS * 3_600_000;
}

/** Decide se este grupo merece aviso agora (o limite diário é conferido depois, ao tomar a vaga). Novo vale mais que pico. */
export function decidirAlerta(a: { novo: boolean; ocorrenciasNaJanela: number; ultimoAlerta: string | null; agora: Date }): { enviar: boolean; motivo: Motivo | null } {
  if (!grupoLivre(a.ultimoAlerta, a.agora)) return { enviar: false, motivo: null };
  if (a.novo) return { enviar: true, motivo: "novo" };
  if (a.ocorrenciasNaJanela >= PICO_MIN) return { enviar: true, motivo: "pico" };
  return { enviar: false, motivo: null };
}

/** Texto do push. Só tipo do erro, rota e número de vezes. Qualquer campo que o detector de privacidade marcar troca tudo pelo texto genérico. */
export function montarPush(a: { motivo: Motivo; nome: string; rota: string; vezes: number; impressao: string }): { title: string; body: string; url: string; tag: string } {
  const tag = `erro-${a.impressao.slice(0, 16)}`;
  const vezes = Math.max(1, Math.floor(a.vezes));
  const quando = a.motivo === "pico" ? ` em ${PICO_JANELA_MIN} min` : "";
  const veze = `${vezes} ${vezes === 1 ? "vez" : "vezes"}${quando}`;
  const body = a.motivo === "pico"
    ? `O GaDu está com erros em sequência: ${a.nome} em ${a.rota} (${veze}).`
    : `O GaDu teve um erro novo: ${a.nome} em ${a.rota} (${veze}).`;
  const title = a.motivo === "pico" ? "GaDu: erros em sequência" : "GaDu: erro novo";
  if (sensivel(a.nome) || sensivel(a.rota) || sensivel(body)) return { title: "GaDu: erro registrado", body: TEXTO_GENERICO, url: URL_ALERTA, tag };
  return { title, body, url: URL_ALERTA, tag };
}
