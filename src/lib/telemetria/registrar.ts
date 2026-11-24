import { supabaseAdmin } from "@/lib/supabase/admin";
import { impressao, protegerEvento, versaoDoDeploy, type EventoErro } from "./sanitize.ts";

// Limite de taxa por pessoa, contado na própria tabela (sem balde novo em private.rate_limits, que pediria migração):
// no máximo LIMITE_POR_JANELA registros nos últimos JANELA_MIN minutos. Passou disso, o erro é descartado.
export const LIMITE_POR_JANELA = 30;
export const JANELA_MIN = 10;

export type Registro = "gravado" | "limitado" | "falhou";

/**
 * Grava um erro para a pessoa da SESSÃO (user_id nunca vem do corpo) ou, sem sessão (cron, sistema, página pública),
 * com user_id nulo (precisa da migração 20261123200001; sem ela o insert falha e devolve "falhou").
 * O limite de taxa vale por pessoa e, para o "sem pessoa", num balde só. Nunca lança: telemetria não pode quebrar o app.
 * Se a tabela não existir ou o banco falhar, devolve "falhou" e o app segue.
 * A última barreira de privacidade (`protegerEvento`) roda aqui, em todo caminho de gravação.
 */
export async function registrarErro(userId: string | null, evento: EventoErro): Promise<Registro> {
  try {
    const e = protegerEvento(evento);
    const db = supabaseAdmin();
    const desde = new Date(Date.now() - JANELA_MIN * 60_000).toISOString();
    const base = db.from("error_events").select("id", { count: "exact", head: true });
    const { count, error: cErr } = await (userId ? base.eq("user_id", userId) : base.is("user_id", null)).gte("created_at", desde);
    if (cErr) return "falhou";
    if ((count ?? 0) >= LIMITE_POR_JANELA) return "limitado";
    const { error } = await db.from("error_events").insert({
      user_id: userId, origem: e.origem, rota: e.rota, nome: e.nome, codigo: e.codigo, status: e.status,
      local_codigo: e.local, versao: versaoDoDeploy(), impressao: impressao(e),
    });
    return error ? "falhou" : "gravado";
  } catch {
    return "falhou";
  }
}
