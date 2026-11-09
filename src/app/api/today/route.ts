import { NextResponse } from "next/server";
import { z } from "zod";
import { accessToken, events, GoogleError, inbox } from "@/lib/google";
import { spNow } from "@/lib/briefing";
import { blockedTerm, isSensitive } from "@/lib/privacy";
import { signedIn } from "../google/_auth";

export const dynamic = "force-dynamic";

const Query = z.object({ days: z.coerce.number().int().min(1).max(14).default(1) });

// Painel "Hoje": compromissos e e-mails não lidos. Sensíveis e bloqueados aparecem como omitidos.
export async function GET(request: Request) {
  const a = await signedIn();
  if (!a) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!q.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  try {
    const token = await accessToken(a.supabase, a.user.id);
    const { data: profile } = await a.supabase.from("profiles").select("settings").eq("id", a.user.id).maybeSingle();
    const blocked = Array.isArray(profile?.settings?.blocked) ? (profile.settings.blocked as unknown[]).map(String) : [];
    // Do começo de hoje (Brasília) até o fim do período: compromissos que já passaram aparecem apagados.
    const from = spNow().start;
    const to = new Date(from.getTime() + q.data.days * 86_400_000);
    const [ev, mails] = await Promise.all([events(token, from, to), inbox(token)]);
    const hide = (t: string) => isSensitive(t) || Boolean(blockedTerm(t, blocked));
    return NextResponse.json(
      {
        connected: true,
        events: ev.filter((e) => !e.declined),
        emails: mails.map((m) => (hide(`${m.from} ${m.subject} ${m.snippet}`) ? { ...m, subject: "(omitido pela regra de privacidade)", snippet: "" } : m)),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    const kind = e instanceof GoogleError ? e.kind : "api";
    return NextResponse.json({ connected: kind !== "not_connected", error: kind }, { status: kind === "not_connected" ? 200 : 502 });
  }
}
