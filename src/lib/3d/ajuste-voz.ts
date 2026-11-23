// Ajuste de peça pela conversa ("deixa o suporte 2 mm mais alto"): o cartão confirmado guarda o pedido na sessão do
// navegador e abre o 3D Studio; o Studio lê uma vez, só para a mesma peça e só se for recente, e apaga.
import { PEDIDO_MAX } from "./limits.ts";

export const AJUSTE_3D_KEY = "gadu.3d.ajuste";
export const AJUSTE_3D_VALIDADE_MS = 2 * 60_000;

/** Pedido guardado para esta peça, ou null (outra peça, velho, quebrado ou vazio). */
export function lerAjuste(raw: string | null, pecaId: string, now = Date.now()): string | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { id?: unknown; pedido?: unknown; t?: unknown };
    if (v.id !== pecaId || typeof v.pedido !== "string" || typeof v.t !== "number") return null;
    if (now - v.t > AJUSTE_3D_VALIDADE_MS || v.t > now + 5_000) return null;
    const p = v.pedido.trim().slice(0, PEDIDO_MAX);
    return p.length >= 3 ? p : null;
  } catch {
    return null;
  }
}
