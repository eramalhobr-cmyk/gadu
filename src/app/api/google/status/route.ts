import { NextResponse } from "next/server";
import { googleConfigured } from "@/lib/google";
import { signedIn } from "../_auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const a = await signedIn();
  if (!a) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data } = await a.supabase.from("google_connections").select("google_email, updated_at").eq("user_id", a.user.id).maybeSingle();
  return NextResponse.json(
    { configured: googleConfigured(), connected: Boolean(data), email: data?.google_email ?? null, since: data?.updated_at ?? null },
    { headers: { "cache-control": "no-store" } },
  );
}
