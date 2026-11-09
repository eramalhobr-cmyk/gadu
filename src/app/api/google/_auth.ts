import { isAllowed } from "@/lib/config";
import { supabaseServer } from "@/lib/supabase/server";

export async function signedIn() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user || !isAllowed(data.user.email)) return null;
  return { supabase, user: data.user };
}

export const OAUTH_COOKIE = "g_oauth";
export const redirectUri = (request: Request) => new URL("/api/google/callback", request.url).toString();
