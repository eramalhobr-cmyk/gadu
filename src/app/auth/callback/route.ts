import { NextResponse, type NextRequest } from "next/server";
import { isAllowed } from "@/lib/config";
import { supabaseServer } from "@/lib/supabase/server";

// Volta do Google: troca o código pela sessão e confere a lista de acesso.
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}/login?erro=google`);

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(`${origin}/login?erro=google`);

  if (!isAllowed(data.user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?erro=acesso`);
  }
  return NextResponse.redirect(`${origin}/app`);
}
