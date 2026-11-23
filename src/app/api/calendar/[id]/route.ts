import { NextResponse } from "next/server";
import { z } from "zod";
import { accessToken, deleteEvent, updateEvent } from "@/lib/google";
import { signedIn } from "../../google/_auth";
import { fail } from "../_fail";

export const dynamic = "force-dynamic";

// Id do evento do Google: letras minúsculas e números (base32hex) ou, em eventos importados, também _ e -.
const EventId = z.string().regex(/^[A-Za-z0-9_-]{5,1024}$/);
const Update = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  start: z.string().datetime({ offset: true }).optional(),
  end: z.string().datetime({ offset: true }).optional(),
  location: z.string().trim().min(1).max(160).optional(),
}).strict().refine((p) => Object.values(p).some((v) => v !== undefined), { message: "nada para alterar" });

// Muda um evento. O app só chama depois que a pessoa confirma o cartão (ou diz "sim"). Mesma permissão de criar (calendar.events).
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await signedIn();
  if (!a) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = EventId.safeParse((await ctx.params).id);
  const p = Update.safeParse(await request.json().catch(() => null));
  if (!id.success || !p.success) return NextResponse.json({ error: "invalid", message: "Confira o evento e o que mudar." }, { status: 400 });
  if (p.data.start && p.data.end) {
    const start = Date.parse(p.data.start), end = Date.parse(p.data.end);
    if (!(end > start) || end - start > 24 * 3_600_000) return NextResponse.json({ error: "invalid", message: "O fim precisa ser depois do início, no máximo 24 horas." }, { status: 400 });
  }
  try {
    const token = await accessToken(a.supabase, a.user.id);
    const ev = await updateEvent(token, id.data, p.data);
    return NextResponse.json({ ok: true, id: ev.id, link: ev.htmlLink });
  } catch (e) {
    return fail(e);
  }
}

// Apaga um evento. O app só chama depois da confirmação explícita.
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await signedIn();
  if (!a) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = EventId.safeParse((await ctx.params).id);
  if (!id.success) return NextResponse.json({ error: "invalid", message: "Evento inválido." }, { status: 400 });
  try {
    const token = await accessToken(a.supabase, a.user.id);
    await deleteEvent(token, id.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
