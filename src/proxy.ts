import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/config";
import { accessOf } from "@/lib/access";

// Roda antes de cada página: renova a sessão, aplica a CSP com nonce
// e bloqueia quem não está logado ou não está na lista de acesso.
export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const supa = SUPABASE_URL ? new URL(SUPABASE_URL).host : "";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://lh3.googleusercontent.com",
    "font-src 'self'",
    `connect-src 'self'${supa ? ` https://${supa} wss://${supa}` : ""}`,
    "media-src 'self' blob:",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  const path = request.nextUrl.pathname;
  const isProtected = path.startsWith("/app") || (path.startsWith("/api/") && !path.startsWith("/api/auth") && !path.startsWith("/api/health") && !path.startsWith("/api/cron") && !path.startsWith("/api/invite"));
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    // S-11: sem a configuração do Supabase não dá para saber quem é a pessoa. Rota protegida NÃO passa (fail closed).
    if (!isProtected) return response;
    console.error("proxy: configuração do Supabase ausente; rota protegida recusada");
    const headers = { "cache-control": "no-store", "Content-Security-Policy": csp };
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Serviço indisponível no momento. Tente de novo em instantes." }, { status: 503, headers });
    return new NextResponse("Serviço indisponível no momento. Tente de novo em instantes.", { status: 503, headers: { ...headers, "content-type": "text/plain; charset=utf-8", "retry-after": "60" } });
  }

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        for (const { name, value, options } of items) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (isProtected) {
    if (!user || !(await accessOf(supabase, user)).ok) {
      if (path.startsWith("/api/")) {
        return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
      }
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = user ? "?erro=acesso" : "";
      if (user) await supabase.auth.signOut();
      const redirect = NextResponse.redirect(url);
      for (const c of response.cookies.getAll()) redirect.cookies.set(c);
      return redirect;
    }
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|vendor/|manifest.webmanifest|sw.js|robots.txt).*)",
  ],
};
