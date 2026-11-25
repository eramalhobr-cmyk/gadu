import { checkReservation, safeRpc, type Reservation } from "@/lib/chat-budget-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Orçamento de IA com reserva (migrações 20261113140001 e 20261122120001): reservar antes, liquidar pelo custo real
// depois, liberar se a IA falhar. Usado pelo chat, pelo resumo de conversa, pela importação de memórias e pela transcrição.
//
// S-01: estas chamadas usam as funções server_* e o cliente com a chave secreta. Elas recebem o `user_id` DA
// SESSÃO (já validada pela rota); o navegador não consegue chamá-las. Nunca passe um id vindo do corpo da requisição.
export type Kind = "chat" | "summary" | "import" | "transcribe" | "speech";
export type UsageRecord = { provider: string; model: string; input: number; output: number; cost: number };

type Admin = ReturnType<typeof supabaseAdmin>;

/** Cliente do servidor; sem a chave secreta devolve null e quem chama trata como indisponível (fail closed). */
function admin(): Admin | null {
  try {
    return supabaseAdmin();
  } catch {
    console.error("cliente do servidor indisponível (SUPABASE_SECRET_KEY)");
    return null;
  }
}

export async function reserveBudget(userId: string, kind: Kind, estimateUsd: number): Promise<Reservation> {
  const db = admin();
  if (!db) return { ok: false, reason: "unavailable" };
  const res = await safeRpc<unknown>(() => db.rpc("server_reserve_ai_budget", { p_user: userId, p_kind: kind, p_estimate_usd: Math.round(estimateUsd * 1e6) / 1e6 }));
  return checkReservation(res);
}

/**
 * Liquida pelo custo real (grava o consumo e fecha a reserva numa transação). O banco aceita também reserva já
 * liquidada com custo menor (grava a diferença), então o custo real nunca fica de fora.
 * Se a liquidação falhar, grava o consumo direto (cliente do servidor) para não perder custo; a reserva é
 * liberada pelo chamador. Devolve true só se a reserva foi liquidada.
 */
export async function settleBudget(userId: string, reservationId: string | null, kind: Kind, u: UsageRecord): Promise<boolean> {
  const db = admin();
  if (!db) return false;
  const row = { provider: u.provider, model: u.model.slice(0, 80), input_tokens: Math.max(0, Math.round(u.input)), output_tokens: Math.max(0, Math.round(u.output)), cost_usd: Math.max(0, u.cost) };
  if (reservationId) {
    const res = await safeRpc<unknown>(() => db.rpc("server_settle_ai_budget", {
      p_user: userId, p_reservation: reservationId, p_provider: row.provider, p_model: row.model,
      p_input_tokens: row.input_tokens, p_output_tokens: row.output_tokens, p_cost_usd: row.cost_usd,
    }));
    const ok = !res.error && typeof res.data === "object" && res.data !== null && (res.data as { ok?: unknown }).ok === true;
    if (ok) return true;
    console.error("liquidação de orçamento falhou; gravando consumo direto");
  }
  const { error } = await db.from("usage_events").insert({ user_id: userId, kind, ...row });
  if (error) console.error("gravação direta do consumo falhou");
  return false;
}

/** Libera uma reserva não usada. Nunca lança erro. */
export async function releaseBudget(userId: string, reservationId: string | null): Promise<void> {
  if (!reservationId) return;
  const db = admin();
  if (!db) return;
  const res = await safeRpc<unknown>(() => db.rpc("server_release_ai_budget", { p_user: userId, p_reservation: reservationId }));
  if (res.error) console.error("liberação de reserva falhou (ela expira sozinha)");
}
