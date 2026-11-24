// Liga o Core ao Google já existente (só leitura). Token cifrado só no servidor (accessToken); o Core não o vê.
import { accessToken, events, inbox } from "@/lib/google";
import type { GoogleReader, SessionDb } from "./types.ts";

export function googleReader(db: SessionDb, userId: string): GoogleReader {
  const token = () => accessToken(db as Parameters<typeof accessToken>[0], userId);
  return {
    async status() {
      // RLS: a pessoa só enxerga a própria conexão.
      const { data, error } = await db.from("google_connections").select("scopes, google_email").eq("user_id", userId).maybeSingle();
      if (error) throw new Error("status");
      if (!data || typeof (data as { scopes?: unknown }).scopes !== "string") return { connected: false, scopes: [] };
      return { connected: true, scopes: (data as { scopes: string }).scopes.split(/\s+/).filter(Boolean), email: (data as { google_email?: string | null }).google_email ?? null };
    },
    async events(from, to) { return events(await token(), from, to); },
    // Só não lidos recentes (48 h), sem promoções e redes sociais. Nenhuma escrita.
    async inbox(max) { return inbox(await token(), "in:inbox is:unread newer_than:2d -category:promotions -category:social -category:forums", max); },
  };
}
