import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/config";

// Cliente com a chave secreta: ignora RLS. Só no servidor e depois de checagem: agendador (CRON_SECRET), convite (token com hash) e admin (adminOnly). Toda consulta filtra por user_id.
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY ausente");
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
