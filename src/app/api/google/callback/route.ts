import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { connect, GOOGLE_SCOPES } from "@/lib/google";
import { OAUTH_COOKIE, redirectUri, signedIn } from "../_auth";

export const dynamic = "force-dynamic";

const Query = z.object({ code: z.string().min(10).max(2048), state: z.string().min(10).max(200), scope: z.string().max(2000).optional() });
const Saved = z.object({ state: z.string().min(10).max(200), verifier: z.string().min(43).max(128) });

export async function GET(request: Request) {
  const back = (r: string) => {
    const res = NextResponse.redirect(new URL(`/app?google=${r}`, request.url));
    res.cookies.set(OAUTH_COOKIE, "", { path: "/api/google", maxAge: 0 });
    return res;
  };
  const a = await signedIn();
  if (!a) return NextResponse.redirect(new URL("/login", request.url));
  const url = new URL(request.url);
  if (url.searchParams.get("error")) return back("cancelado");
  const q = Query.safeParse(Object.fromEntries(url.searchParams));
  const store = await cookies();
  let saved: z.infer<typeof Saved> | null = null;
  try { saved = Saved.parse(JSON.parse(store.get(OAUTH_COOKIE)?.value ?? "")); } catch { saved = null; }
  if (!q.success || !saved) return back("erro");
  const s1 = Buffer.from(q.data.state), s2 = Buffer.from(saved.state);
  if (s1.length !== s2.length || !timingSafeEqual(s1, s2)) return back("erro");
  const granted = (q.data.scope ?? "").split(" ");
  const missing = GOOGLE_SCOPES.filter((s) => s.startsWith("https://") && !granted.includes(s));
  if (missing.length) return back("permissoes");
  try {
    await connect(a.supabase, a.user.id, q.data.code, saved.verifier, redirectUri(request));
    return back("ok");
  } catch (e) {
    console.error("google connect falhou", e instanceof Error ? e.message : "erro");
    return back("erro");
  }
}
