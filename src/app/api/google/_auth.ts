import { accessOf } from "@/lib/access";
import { supabaseServer } from "@/lib/supabase/server";

export async function signedIn() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const access = await accessOf(supabase, data.user);
  if (!data.user || !access.ok) return null;
  return { supabase, user: data.user, admin: access.admin };
}

export const OAUTH_COOKIE = "g_oauth";
export const redirectUri = (request: Request) => new URL("/api/google/callback", request.url).toString();
