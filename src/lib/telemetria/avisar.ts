import { pushConfigured, sendPush, type Sub } from "@/lib/push";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { decidirAlerta, diaBrasilia, grupoNovo, GRUPO_HORAS, MAX_POR_DIA, montarPush, PICO_JANELA_MIN, type EstadoGrupo, type Motivo } from "./alerta.ts";
import { agrupar, type LinhaErro } from "./agrupar.ts";
import { telemetriaEnabled } from "./flag.ts";
import { impressao, type EventoErro } from "./sanitize.ts";

// Alerta de erro para os administradores pelo push que o app já tem (nada de serviço novo). Duas portas:
//  - `avaliarEAvisar`: logo depois de gravar o erro (em segundo plano, nunca segura a resposta);
//  - `redeDeSeguranca`: o cron `tick` olha os últimos 30 min e avisa o que a primeira porta perdeu.
// Throttle PERSISTIDO (error_alert_state e error_alert_dia): 1 aviso por grupo a cada 6 h e até 4 por dia (Brasília).
// Sem a migração aplicada (tabelas ausentes) ou com o push desligado, fica em silêncio: o erro continua gravado e aparece no painel.
// Nunca lança.

type Db = ReturnType<typeof supabaseAdmin>;
const RETENCAO_DIAS = 30;
const REDE_JANELA_MIN = 30;
const REDE_MAX_GRUPOS = 3;

async function assinaturasDosAdmins(db: Db): Promise<Sub[]> {
  const { data: adm, error } = await db.from("members").select("user_id").eq("role", "admin").eq("access", "active");
  if (error || !adm?.length) return [];
  const ids = adm.map((m) => m.user_id as string);
  const { data } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").in("user_id", ids);
  return (data ?? []) as Sub[];
}

/** Toma uma das vagas do dia (insert com chave (dia, vaga): a chave primária impede duas execuções de pegarem a mesma). */
async function tomarVaga(db: Db, dia: string): Promise<number | null> {
  for (let vaga = 1; vaga <= MAX_POR_DIA; vaga++) {
    const { error } = await db.from("error_alert_dia").insert({ dia, vaga });
    if (!error) return vaga;
    if (error.code !== "23505") return null; // erro de banco: sem como limitar, não envia
  }
  return null;
}

type Grupo = { impressao: string; nome: string; rota: string };

/** Tenta enviar o aviso do grupo. Só envia se tomar a vaga do grupo (6 h) E a do dia (4/dia); senão devolve o que tomou. */
async function tentarAvisar(db: Db, g: Grupo, motivo: Motivo, vezes: number, agora: Date): Promise<boolean> {
  if (!pushConfigured()) return false;
  const subs = await assinaturasDosAdmins(db);
  if (!subs.length) return false;
  const iso = agora.toISOString();
  const limite = new Date(agora.getTime() - GRUPO_HORAS * 3_600_000).toISOString();
  const { data: antes } = await db.from("error_alert_state").select("ultimo_alerta, alertas").eq("impressao", g.impressao).maybeSingle();
  if (!antes) return false;
  const { data: tomou, error } = await db.from("error_alert_state").update({ ultimo_alerta: iso, alertas: Number(antes.alertas ?? 0) + 1 }).eq("impressao", g.impressao).or(`ultimo_alerta.is.null,ultimo_alerta.lt.${limite}`).select("impressao");
  if (error || !tomou?.length) return false;
  const desfazGrupo = () => db.from("error_alert_state").update({ ultimo_alerta: antes.ultimo_alerta ?? null, alertas: Number(antes.alertas ?? 0) }).eq("impressao", g.impressao);
  const dia = diaBrasilia(agora);
  const vaga = await tomarVaga(db, dia);
  if (vaga === null) { await desfazGrupo(); return false; }
  const r = await sendPush(subs, montarPush({ motivo, nome: g.nome, rota: g.rota, vezes, impressao: g.impressao }));
  if (r.gone.length) await db.from("push_subscriptions").delete().in("id", r.gone);
  if (r.sent === 0) { await desfazGrupo(); await db.from("error_alert_dia").delete().eq("dia", dia).eq("vaga", vaga); return false; }
  return true;
}

/** Depois de gravar um erro: atualiza o estado do grupo e avisa se for grupo novo ou pico. Nunca lança. */
export async function avaliarEAvisar(e: EventoErro, agora: Date = new Date()): Promise<boolean> {
  try {
    if (!telemetriaEnabled()) return false;
    const db = supabaseAdmin();
    const imp = impressao(e);
    const iso = agora.toISOString();
    const { data: est, error } = await db.from("error_alert_state").select("primeira_vez, ultima_vez, ultimo_alerta, alertas").eq("impressao", imp).maybeSingle();
    if (error) return false; // sem tabela de estado não há como limitar: silêncio
    const anterior = est as EstadoGrupo | null;
    const novo = grupoNovo(anterior, agora);
    if (!anterior) {
      const ins = await db.from("error_alert_state").insert({ impressao: imp, primeira_vez: iso, ultima_vez: iso });
      if (ins.error) return false; // outra execução criou ao mesmo tempo: ela cuida do aviso
    } else {
      await db.from("error_alert_state").update(novo ? { primeira_vez: iso, ultima_vez: iso, ultimo_alerta: null } : { ultima_vez: iso }).eq("impressao", imp);
    }
    let vezes = 1;
    if (!novo) {
      const desde = new Date(agora.getTime() - PICO_JANELA_MIN * 60_000).toISOString();
      const { count } = await db.from("error_events").select("id", { count: "exact", head: true }).eq("impressao", imp).gte("created_at", desde);
      vezes = count ?? 1;
    }
    const d = decidirAlerta({ novo, ocorrenciasNaJanela: vezes, ultimoAlerta: novo ? null : anterior?.ultimo_alerta ?? null, agora });
    if (!d.enviar || !d.motivo) return false;
    return await tentarAvisar(db, { impressao: imp, nome: e.nome, rota: e.rota }, d.motivo, vezes, agora);
  } catch {
    return false;
  }
}

/** Rede de segurança do cron: grupos dos últimos 30 min que ainda não foram avisados (ou em pico). Devolve quantos avisos enviou. */
export async function redeDeSeguranca(db: Db = supabaseAdmin(), agora: Date = new Date()): Promise<number> {
  try {
    if (!telemetriaEnabled() || !pushConfigured()) return 0;
    const desde = new Date(agora.getTime() - REDE_JANELA_MIN * 60_000).toISOString();
    const { data, error } = await db.from("error_events").select("created_at, origem, rota, nome, status, local_codigo, versao, impressao").gte("created_at", desde).order("created_at", { ascending: false }).limit(300);
    if (error || !data?.length) return 0;
    const linhas = data as LinhaErro[];
    const janela = agora.getTime() - PICO_JANELA_MIN * 60_000;
    let enviados = 0;
    for (const g of agrupar(linhas, REDE_MAX_GRUPOS * 3)) {
      if (enviados >= REDE_MAX_GRUPOS) break;
      const { data: est, error: e1 } = await db.from("error_alert_state").select("primeira_vez, ultima_vez, ultimo_alerta, alertas").eq("impressao", g.impressao).maybeSingle();
      if (e1) return enviados;
      const s = est as EstadoGrupo | null;
      if (!s) await db.from("error_alert_state").insert({ impressao: g.impressao, primeira_vez: g.primeira, ultima_vez: g.ultima });
      // Novo = ainda não avisado nesta aparição (primeira vez nos últimos 30 min). O resto só vale se virou pico.
      const novo = !s || (s.ultimo_alerta === null && new Date(s.primeira_vez).getTime() >= agora.getTime() - REDE_JANELA_MIN * 60_000);
      const vezes = linhas.filter((l) => l.impressao === g.impressao && new Date(l.created_at).getTime() >= janela).length;
      const d = decidirAlerta({ novo, ocorrenciasNaJanela: vezes, ultimoAlerta: s?.ultimo_alerta ?? null, agora });
      if (d.enviar && d.motivo && await tentarAvisar(db, g, d.motivo, Math.max(vezes, 1), agora)) enviados++;
    }
    return enviados;
  } catch {
    return 0;
  }
}

/** Retenção de 30 dias (erros, estado dos grupos e vagas do dia). Roda uma vez por hora no tick. Devolve quantos erros apagou. */
export async function retencaoDeErros(db: Db = supabaseAdmin(), agora: Date = new Date()): Promise<number> {
  try {
    if (agora.getUTCMinutes() !== 7) return 0;
    const corte = new Date(agora.getTime() - RETENCAO_DIAS * 86_400_000);
    const r = await db.from("error_events").delete({ count: "exact" }).lt("created_at", corte.toISOString());
    await db.from("error_alert_state").delete().lt("ultima_vez", corte.toISOString());
    await db.from("error_alert_dia").delete().lt("dia", diaBrasilia(corte));
    return r.count ?? 0;
  } catch {
    return 0;
  }
}
