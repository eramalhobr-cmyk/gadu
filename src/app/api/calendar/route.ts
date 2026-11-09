import { NextResponse } from "next/server";
import { z } from "zod";
import { accessToken, createEvent, events, GoogleError } from "@/lib/google";
import { signedIn } from "../google/_auth";

export const dynamic = "force-dynamic";

const Range = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), days: z.coerce.number().int().min(1).max(14).default(7) });
const Create = z.object({
  title: z.string().trim().min(1).max(160),
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
  location: z.string().trim().max(160).optional(),
}).strict();

function fail(e: unknown) {
  const kind = e instanceof GoogleError ? e.kind : "api";
  const status = kind === "not_connected" ? 409 : kind === "scope" ? 403 : 502;
  const message = {
    not_connected: "Conecte o Google em Perfil › Ajustes › Conexões.",
    scope: "Falta permissão para criar eventos. Reconecte o Google em Perfil › Ajustes › Conexões.",
    revoked: "O acesso ao Google expirou. Reconecte em Perfil › Ajustes › Conexões.",
  }[kind as string] ?? "Não consegui falar com o Google agora. Tente de novo.";
  return NextResponse.json({ error: kind, message }, { status });
}

// Agenda de um período (horário de Brasília).
export async function GET(request: Request) {
  const a = await signedIn();
  if (!a) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = Range.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!q.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  try {
    const token = await accessToken(a.supabase, a.user.id);
    const from = new Date(`${q.data.from}T00:00:00-03:00`);
    const to = new Date(from.getTime() + q.data.days * 86_400_000);
    const ev = await events(token, from, to);
    return NextResponse.json({ events: ev.filter((e) => !e.declined) }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}

// Cria um evento. O app só chama depois que a pessoa toca em "Criar".
export async function POST(request: Request) {
  const a = await signedIn();
  if (!a) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const p = Create.safeParse(await request.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "invalid", message: "Confira título, dia e horário." }, { status: 400 });
  const start = Date.parse(p.data.start), end = Date.parse(p.data.end);
  if (!(end > start) || end - start > 24 * 3_600_000 || start < Date.now() - 86_400_000 || start > Date.now() + 366 * 86_400_000) {
    return NextResponse.json({ error: "invalid", message: "O fim precisa ser depois do início, no máximo 24 horas." }, { status: 400 });
  }
  try {
    const token = await accessToken(a.supabase, a.user.id);
    const ev = await createEvent(token, { title: p.data.title, start: p.data.start, end: p.data.end, location: p.data.location });
    return NextResponse.json({ ok: true, id: ev.id, link: ev.htmlLink });
  } catch (e) {
    return fail(e);
  }
}
