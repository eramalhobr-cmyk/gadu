import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/config";

// Cliente com a chave secreta: ignora RLS. Use SÓ no agendador (/api/cron), que é protegido por CRON_SECRET.
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY ausente");
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
