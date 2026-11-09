import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isAllowed } from "@/lib/config";

// Quem entra: e-mails da lista do servidor (ALLOWED_EMAILS) ou pessoas convidadas (tabela members, acesso ativo).
// Administrador: e-mails de ADMIN_EMAILS ou papel "admin" em members.
export type Access = { ok: boolean; admin: boolean };

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function accessOf(db: SupabaseClient<any, any, any>, user: User | null | undefined): Promise<Access> {
  if (!user) return { ok: false, admin: false };
  const email = (user.email ?? "").toLowerCase();
  const { data } = await db.from("members").select("role, access").eq("user_id", user.id).maybeSingle();
  const blocked = data?.access === "blocked";
  const ok = !blocked && (isAllowed(email) || data?.access === "active");
  return { ok, admin: ok && (adminEmails().includes(email) || data?.role === "admin") };
}
