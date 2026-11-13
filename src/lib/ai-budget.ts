import { checkReservation, isMissingFunction, safeRpc, type Reservation } from "@/lib/chat-budget-guard";
import type { supabaseServer } from "@/lib/supabase/server";

// Orçamento de IA com reserva (migração 20261113140001): reservar antes, liquidar pelo custo real depois,
// liberar se a IA falhar. Usado pelo chat, pelo resumo de conversa e pela importação de memórias.
type Db = Awaited<ReturnType<typeof supabaseServer>>;
export type Kind = "chat" | "summary" | "import";
export type UsageRecord = { provider: string; model: string; input: number; output: number; cost: number };

/** Reserva. `legacy: true` quando o banco ainda não tem a função (migração não aplicada): o chamador decide o caminho antigo. */
export async function reserveBudget(db: Db, kind: Kind, estimateUsd: number): Promise<Reservation & { legacy?: boolean }> {
  const res = await safeRpc<unknown>(() => db.rpc("reserve_ai_budget", { p_kind: kind, p_estimate_usd: Math.round(estimateUsd * 1e6) / 1e6 }));
  const r = checkReservation(res);
  if (!r.ok && r.reason === "unavailable" && isMissingFunction(res.error)) return { ...r, legacy: true };
  return r;
}

/**
 * Liquida pelo custo real (grava o consumo e fecha a reserva numa transação).
 * Se a liquidação falhar, grava o consumo direto para não perder custo; a reserva é liberada pelo chamador.
 */
export async function settleBudget(db: Db, reservationId: string | null, kind: Kind, u: UsageRecord): Promise<boolean> {
  if (reservationId) {
    const res = await safeRpc<unknown>(() => db.rpc("settle_ai_budget", {
      p_reservation: reservationId, p_provider: u.provider, p_model: u.model.slice(0, 80),
      p_input_tokens: Math.max(0, Math.round(u.input)), p_output_tokens: Math.max(0, Math.round(u.output)), p_cost_usd: Math.max(0, u.cost),
    }));
    const ok = !res.error && typeof res.data === "object" && res.data !== null && (res.data as { ok?: unknown }).ok === true;
    if (ok) return true;
    console.error("liquidação de orçamento falhou; gravando consumo direto");
  }
  await db.from("usage_events").insert({ provider: u.provider, model: u.model.slice(0, 80), kind, input_tokens: u.input, output_tokens: u.output, cost_usd: u.cost });
  return false;
}

/** Libera uma reserva não usada. Nunca lança erro. */
export async function releaseBudget(db: Db, reservationId: string | null): Promise<void> {
  if (!reservationId) return;
  const res = await safeRpc<unknown>(() => db.rpc("release_ai_budget", { p_reservation: reservationId }));
  if (res.error) console.error("liberação de reserva falhou (ela expira sozinha)");
}
