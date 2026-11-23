import { supabaseAdmin } from "@/lib/supabase/admin";
import { impressao, versaoDoDeploy, type EventoErro } from "./sanitize.ts";

// Limite de taxa por pessoa, contado na própria tabela (sem balde novo em private.rate_limits, que pediria migração):
// no máximo LIMITE_POR_JANELA registros nos últimos JANELA_MIN minutos. Passou disso, o erro é descartado.
export const LIMITE_POR_JANELA = 30;
export const JANELA_MIN = 10;

export type Registro = "gravado" | "limitado" | "falhou";

/**
 * Grava um erro para a pessoa da SESSÃO (user_id nunca vem do corpo). Nunca lança: telemetria não pode quebrar o app.
 * Se a tabela não existir ou o banco falhar, devolve "falhou" e o app segue.
 */
export async function registrarErro(userId: string, e: EventoErro): Promise<Registro> {
  try {
    const db = supabaseAdmin();
    const desde = new Date(Date.now() - JANELA_MIN * 60_000).toISOString();
    const { count, error: cErr } = await db.from("error_events").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", desde);
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
