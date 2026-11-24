import { z } from "zod";
import { falha, filhosGuard, resposta } from "../../_guard";

type Contexto = { params: Promise<{ id: string }> };
const Id = z.uuid();

export async function DELETE(_request: Request, { params }: Contexto) {
  const g = await filhosGuard();
  if (!g.ok) return g.res;
  const id = Id.safeParse((await params).id);
  if (!id.success) return resposta({ error: "invalid" }, 400);
  const { error } = await g.a.supabase.from("filhos_agenda_ajustes").delete().eq("user_id", g.a.user.id).eq("id", id.data);
  return error ? falha(error) : resposta({ ok: true });
}
