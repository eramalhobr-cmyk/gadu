import { z } from "zod";
import { ITEM_COLS } from "@/lib/lista-compras/types";
import { falha, listaGuard, resposta } from "../_guard";

type Contexto = { params: Promise<{ id: string }> };
const Id = z.uuid();
const Alteracao = z.object({ comprado: z.boolean() }).strict();

export async function PATCH(request: Request, { params }: Contexto) {
  const g = await listaGuard();
  if ("res" in g) return g.res;
  const id = Id.safeParse((await params).id);
  const input = Alteracao.safeParse(await request.json().catch(() => null));
  if (!id.success || !input.success) return resposta({ error: "invalid" }, 400);
  const { data, error } = await g.a.supabase.from("lista_compras_itens").update(input.data)
    .eq("user_id", g.a.user.id).eq("id", id.data).select(ITEM_COLS).maybeSingle();
  if (error) return falha(error);
  return data ? resposta({ item: data }) : resposta({ error: "not_found" }, 404);
}

export async function DELETE(_request: Request, { params }: Contexto) {
  const g = await listaGuard();
  if ("res" in g) return g.res;
  const id = Id.safeParse((await params).id);
  if (!id.success) return resposta({ error: "invalid" }, 400);
  const { error } = await g.a.supabase.from("lista_compras_itens").delete()
    .eq("user_id", g.a.user.id).eq("id", id.data);
  return error ? falha(error) : resposta({ ok: true });
}
