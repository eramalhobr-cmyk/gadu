import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Inicia o login com o Google (OAuth com PKCE, gerenciado pelo Supabase).
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    return NextResponse.redirect(`${origin}/login?erro=google`);
  }
  return NextResponse.redirect(data.url);
}
