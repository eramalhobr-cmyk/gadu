import { NextResponse } from "next/server";
import { authUrl, googleConfigured, pkce } from "@/lib/google";
import { OAUTH_COOKIE, redirectUri, signedIn } from "../_auth";

export const dynamic = "force-dynamic";

// Inicia a conexão com o Google. O estado e o verificador PKCE ficam num cookie curto, só do servidor.
export async function GET(request: Request) {
  const a = await signedIn();
  if (!a) return NextResponse.redirect(new URL("/login", request.url));
  if (!googleConfigured()) return NextResponse.redirect(new URL("/app?google=config", request.url));
  const { verifier, challenge, state } = pkce();
  const res = NextResponse.redirect(authUrl(redirectUri(request), state, challenge, a.user.email ?? undefined));
  res.cookies.set(OAUTH_COOKIE, JSON.stringify({ state, verifier }), { httpOnly: true, secure: true, sameSite: "lax", path: "/api/google", maxAge: 600 });
  return res;
}
