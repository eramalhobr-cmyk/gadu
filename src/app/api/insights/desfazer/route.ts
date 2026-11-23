import { NextResponse } from "next/server";
import { z } from "zod";
import { accessToken, deleteEvent, GoogleError } from "@/lib/google";
import { spNow } from "@/lib/briefing";
import { ATRASADAS_MAX, TIPOS_PERCEPCAO } from "@/lib/percepcoes";
import { signedIn } from "../../google/_auth";
import { fail } from "../../calendar/_fail";

export const dynamic = "force-dynamic";

const Body = z.object({
  tipo: z.enum(TIPOS_PERCEPCAO),
  desfazer: z.object({
    tarefas: z.array(z.object({ id: z.number().int().positive(), due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() }).strict()).max(ATRASADAS_MAX).optional(),
    tarefa_id: z.number().int().positive().optional(),
    evento_id: z.string().regex(/^[A-Za-z0-9_-]{5,1024}$/).optional(),
  }).strict().default({}),
}).strict();

// Desfazer de uma resposta a percepção: volta o que o Aceitar fez (só nas linhas da própria pessoa) e apaga a resposta de hoje,
// para a percepção voltar a aparecer.
export async function POST(request: Request) {
  const a = await signedIn();
  if (!a) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const p = Body.safeParse(await request.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { tipo, desfazer } = p.data;
  const uid = a.user.id;
  if (desfazer.evento_id) {
    try {
      await deleteEvent(await accessToken(a.supabase, uid), desfazer.evento_id);
    } catch (e) {
      if (!(e instanceof GoogleError && e.kind === "gone")) return fail(e);
    }
  }
  for (const t of desfazer.tarefas ?? []) {
    const r = await a.supabase.from("tasks").update({ due_date: t.due_date }).eq("user_id", uid).eq("id", t.id);
    if (r.error) return NextResponse.json({ error: "db" }, { status: 502 });
  }
  if (desfazer.tarefa_id) {
    const r = await a.supabase.from("tasks").update({ status: "cancelled" }).eq("user_id", uid).eq("id", desfazer.tarefa_id).eq("origin", "Percepção");
    if (r.error) return NextResponse.json({ error: "db" }, { status: 502 });
  }
  const d = await a.supabase.from("insight_respostas").delete().eq("user_id", uid).eq("dia", spNow().day).eq("tipo", tipo);
  if (d.error) return NextResponse.json({ error: "db" }, { status: 502 });
  return NextResponse.json({ ok: true });
}
